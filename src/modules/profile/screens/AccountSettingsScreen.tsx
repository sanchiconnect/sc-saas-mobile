import React, {useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {launchImageLibrary} from 'react-native-image-picker';

import {AuthSession} from '../../auth/models/auth.models';
import {authService} from '../../auth/services/auth.service';
import {TenantContext} from '../../../core/tenant/TenantProvider';
import {AppButton} from '../../../core/components/AppButton';
import {AppCard} from '../../../core/components/AppCard';
import {AppTextField} from '../../../core/components/AppTextField';
import {CalendarPicker} from '../../../core/components/CalendarPicker';
import {ConfirmModal} from '../../../core/components/ConfirmModal';
import {Icon} from '../../../core/components/Icon';
import {fromApi, toApi} from '../availabilityMapper';
import {availabilityService} from '../services/availability.service';
import {colors, withAlpha} from '../../../core/theme/colors';
import {Picker} from './editProfile/Picker';
import {useToast} from '../../../core/toast/ToastProvider';
import {FeedbackModal} from '../../feedback/FeedbackWidget';

// Supported country dial codes — mirrors COUNTRY_CODES in the frontend's
// shared/constants/country-code.ts so the mobile picker offers the same
// menu as the web's <ng-select>.
const COUNTRY_CODES: Array<{name: string; value: string}> = [
  {name: 'USA', value: '1'},
  {name: 'India', value: '91'},
  {name: 'Canada', value: '1'},
  {name: 'United Arab Emirates', value: '971'},
  {name: 'Singapore', value: '65'},
];

const formatCountryCodeOption = (entry: {name: string; value: string}) =>
  `${entry.name} (+${entry.value})`;

type AccountSettingsScreenProps = {
  token: string;
  session: AuthSession;
  onBack: () => void;
  onLogout: () => void;
};

type AccountSettingsTabKey =
  | 'personal-information'
  | 'availability-hours'
  | 'membership'
  | 'email-notifications'
  | 'platform-updates';

type PersonalInformation = {
  avatarUrl: string | null;
  fullName: string;
  email: string;
  designation: string;
  countryCode: string;
  mobileNumber: string;
  whatsappNumber: string;
  // Frontend's parallel-save fields. None of these participate in the main
  // "Save Changes" PATCH — each has its own endpoint and (for newsletter +
  // deactivate) auto-saves on toggle.
  accountType: string;
  subscribeToNewsletter: boolean;
  isDeactivated: boolean;
  linkedinUrl: string;
  twitterUrl: string;
};

type AvailabilityMode = 'anytime' | 'temporary-unavailable' | 'specific-days';

type WeeklyAvailabilityRow = {
  dayKey: string;
  label: string;
  unavailable: boolean;
  fromTime: string;
  toTime: string;
};

type SpecificDateAvailabilityRow = {
  id: string;
  dateLabel: string;
  unavailable: boolean;
  fromTime: string;
  toTime: string;
};

type AccountSettingsTab = {
  key: AccountSettingsTabKey;
  label: string;
  description: string;
  available: boolean;
};

type TenantFeatures = Record<string, any>;

type TimePickerTarget =
  | {kind: 'weekly-from'; dayKey: string}
  | {kind: 'weekly-to'; dayKey: string}
  | {kind: 'specific-from'; id: string}
  | {kind: 'specific-to'; id: string}
  | {kind: 'new-from'}
  | {kind: 'new-to'}
  | null;

const SUPPORT_MESSAGE =
  'This action is not wired in the mobile app yet. Please use support or the web portal until the account-settings API contract is exposed here.';

const TIME_OPTIONS = [
  '06:00 AM',
  '06:30 AM',
  '07:00 AM',
  '07:30 AM',
  '08:00 AM',
  '08:30 AM',
  '09:00 AM',
  '09:30 AM',
  '10:00 AM',
  '10:30 AM',
  '11:00 AM',
  '11:30 AM',
  '12:00 PM',
  '12:30 PM',
  '01:00 PM',
  '01:30 PM',
  '02:00 PM',
  '02:30 PM',
  '03:00 PM',
  '03:30 PM',
  '04:00 PM',
  '04:30 PM',
  '05:00 PM',
  '05:30 PM',
  '06:00 PM',
  '06:30 PM',
  '07:00 PM',
  '07:30 PM',
  '08:00 PM',
];

const DEFAULT_WEEKLY_AVAILABILITY: WeeklyAvailabilityRow[] = [
  {dayKey: 'mon', label: 'Mon', unavailable: false, fromTime: '', toTime: ''},
  {dayKey: 'tue', label: 'Tue', unavailable: false, fromTime: '', toTime: ''},
  {dayKey: 'wed', label: 'Wed', unavailable: false, fromTime: '', toTime: ''},
  {dayKey: 'thu', label: 'Thu', unavailable: false, fromTime: '', toTime: ''},
  {dayKey: 'fri', label: 'Fri', unavailable: false, fromTime: '', toTime: ''},
  {dayKey: 'sat', label: 'Sat', unavailable: false, fromTime: '', toTime: ''},
  {dayKey: 'sun', label: 'Sun', unavailable: false, fromTime: '', toTime: ''},
];

const asString = (value: unknown) =>
  value === undefined || value === null ? '' : String(value).trim();

// Renders "2026-05-22" as "May 22, 2026". Falls back to the raw label when
// the input isn't a valid ISO date so manually-typed strings don't disappear.
const formatSpecificDateLabel = (raw: string): string => {
  if (!raw) return '';
  const match = raw.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return raw;
  const [, y, m, d] = match;
  const parsed = new Date(Number(y), Number(m) - 1, Number(d));
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const toAbsoluteAssetUrl = (
  value: unknown,
  baseUrl?: string,
): string | null => {
  const source = asString(value);
  if (!source) {
    return null;
  }

  if (/^https?:\/\//i.test(source)) {
    return source;
  }

  if (!baseUrl) {
    return null;
  }

  return `${baseUrl.replace(/\/$/, '')}/${source.replace(/^\//, '')}`;
};

const extractPersonalInformation = (
  payload: Record<string, any> | null | undefined,
  session: AuthSession,
  logoBaseUrl?: string,
): PersonalInformation => {
  const root = payload?.data?.user || payload?.data || payload?.user || payload || {};

  return {
    avatarUrl: toAbsoluteAssetUrl(
      root?.avatar || root?.profilePicture || root?.image || root?.photo,
      logoBaseUrl,
    ),
    fullName: asString(
      root?.fullName || root?.name || root?.displayName || session.user.fullName,
    ),
    email: asString(root?.email || root?.emailAddress || session.user.email),
    designation: asString(
      root?.designation || root?.accountRole || root?.title || root?.role,
    ),
    countryCode: asString(root?.countryCode || 91),
    mobileNumber: asString(
      root?.mobileNumber ||
        root?.mobile ||
        root?.phoneNumber ||
        root?.phone ||
        root?.contactNumber,
    ),
    whatsappNumber: asString(root?.whatsappNumber),
    accountType: asString(root?.accountType).toLowerCase(),
    subscribeToNewsletter: Boolean(
      root?.subscribeToNewsletter ??
        root?.newsletterSubscription ??
        false,
    ),
    isDeactivated: Boolean(root?.isDeactivated ?? root?.deactivated ?? false),
    linkedinUrl: asString(root?.linkedinUrl || root?.socialLinks?.linkedinUrl),
    twitterUrl: asString(root?.twitterUrl || root?.socialLinks?.twitterUrl),
  };
};

const buildTabs = (features: TenantFeatures): AccountSettingsTab[] => [
  {
    key: 'personal-information',
    label: 'Personal Information',
    description: 'Review your identity details and profile contact information.',
    available: true,
  },
  {
    key: 'availability-hours',
    label: 'Availability Hours',
    description: 'Manage your meeting availability once the mobile scheduling flow is wired.',
    available: features?.online_meetings !== false,
  },
  {
    key: 'membership',
    label: 'Membership',
    description: 'Review subscription and eligibility details when membership APIs are enabled.',
    available: features?.membership_enabled !== false,
  },
  {
    key: 'email-notifications',
    label: 'Email Notifications',
    description: 'Control your email alerts after the notification preferences endpoint is added.',
    available: true,
  },
  {
    key: 'platform-updates',
    label: 'Platform Updates',
    description: 'Browse release notes and product announcements in a future mobile release.',
    available: features?.product_updates !== false,
  },
];

export function AccountSettingsScreen({
  token,
  session,
  onBack,
  onLogout,
}: AccountSettingsScreenProps) {
  const {theme, globalSetting} = useContext(TenantContext);
  const toast = useToast();
  const {width} = useWindowDimensions();
  const primaryColor = theme?.primary || colors.primary;
  const secondaryColor = theme?.secondary || '#1e1f3a';
  const dangerColor = theme?.danger || '#dc2626';
  const successColor = theme?.success || '#15803d';
  const logoBaseUrl =
    globalSetting?.imgKitUrl || globalSetting?.assetsImgKitUrl;
  const tenantFeatures = useMemo(
    () => globalSetting?.features || {},
    [globalSetting?.features],
  );

  const [activeTab, setActiveTab] =
    useState<AccountSettingsTabKey>('personal-information');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isFeedbackModalVisible, setIsFeedbackModalVisible] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<{
    text: string;
    tone: 'success' | 'error';
  } | null>(null);
  const [availabilityMode, setAvailabilityMode] =
    useState<AvailabilityMode>('anytime');
  const [weeklyAvailability, setWeeklyAvailability] = useState<
    WeeklyAvailabilityRow[]
  >(DEFAULT_WEEKLY_AVAILABILITY);
  const [specificDateRows, setSpecificDateRows] = useState<
    SpecificDateAvailabilityRow[]
  >([]);
  const [timePickerTarget, setTimePickerTarget] =
    useState<TimePickerTarget>(null);
  const [isAddingSpecificDate, setIsAddingSpecificDate] = useState(false);
  const [isCalendarPickerOpen, setIsCalendarPickerOpen] = useState(false);
  const [pendingDeleteDateId, setPendingDeleteDateId] = useState<string | null>(
    null,
  );
  const [newSpecificDate, setNewSpecificDate] = useState<{
    dateLabel: string;
    unavailable: boolean;
    fromTime: string;
    toTime: string;
  }>({dateLabel: '', unavailable: false, fromTime: '', toTime: ''});
  const [personalInformation, setPersonalInformation] =
    useState<PersonalInformation>(() =>
      extractPersonalInformation(null, session, logoBaseUrl),
    );
  const [initialPersonalInformation, setInitialPersonalInformation] =
    useState<PersonalInformation>(() =>
      extractPersonalInformation(null, session, logoBaseUrl),
    );

  const tabs = useMemo(
    () => buildTabs(tenantFeatures).filter(tab => tab.available),
    [tenantFeatures],
  );
  const isWideLayout = width >= 1040;
  const canDeleteProfile = tenantFeatures?.can_delete_profile !== false;
  const canDeactivateProfile = tenantFeatures?.can_deactivate_profile === true;
  const canShowWhatsappNumber =
    tenantFeatures?.wa_enable === true ||
    tenantFeatures?.whatsapp_otp_verification === true;
  // Frontend hides the avatar upload for mentor accounts. Mirror that exactly.
  const showAvatarSection = personalInformation.accountType !== 'mentor';

  // Per-section save state for the three auto-save / separate-save controls.
  // Inline-saved bits don't share the top-level save banner because users
  // expect immediate feedback right next to the control.
  const [isSavingDeactivate, setIsSavingDeactivate] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isCountryCodePickerOpen, setIsCountryCodePickerOpen] = useState(false);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await authService.getProfile(token);
      const nextPersonalInformation = extractPersonalInformation(
        response,
        session,
        logoBaseUrl,
      );
      setPersonalInformation(nextPersonalInformation);
      setInitialPersonalInformation(nextPersonalInformation);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not load your account settings.';
      setLoadError(message);
    } finally {
      setIsLoading(false);
    }
  }, [logoBaseUrl, session, token]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Hydrate availability from the calendar-availability endpoint on mount.
  // Same endpoint the web uses, so changes made on either client stay in
  // sync. Missing days fall back to the empty defaults already in state.
  useEffect(() => {
    let cancelled = false;
    if (!token) return;
    (async () => {
      try {
        const data = await availabilityService.get(token);
        if (cancelled || !data) return;
        const {mode, weekly, specificDates} = fromApi(data);
        setAvailabilityMode(mode);
        setWeeklyAvailability(weekly);
        setSpecificDateRows(specificDates);
      } catch {
        // Non-fatal — first-time users will not have a record yet and the
        // backend can 404. Defaults already in state will show.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!tabs.some(tab => tab.key === activeTab)) {
      setActiveTab('personal-information');
    }
  }, [activeTab, tabs]);

  // Success messages auto-dismiss after 3s so they don't linger; errors stay
  // visible until the user retries or edits the form (so they have time to
  // read what went wrong).
  useEffect(() => {
    if (!saveMessage || saveMessage.tone !== 'success') return;
    const timer = setTimeout(() => setSaveMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [saveMessage]);

  const updatePersonalInformation = <
    K extends keyof PersonalInformation,
  >(
    key: K,
    value: PersonalInformation[K],
  ) => {
    setPersonalInformation(current => ({...current, [key]: value}));
    setSaveMessage(null);
  };

  const isDirty =
    JSON.stringify(personalInformation) !==
    JSON.stringify(initialPersonalInformation);
  const isDeleteConfirmationValid =
    deleteConfirmationText.trim().toLowerCase() === 'delete account';

  const handleSavePersonalInformation = async () => {
    const trimmedName = personalInformation.fullName.trim();
    const trimmedDesignation = personalInformation.designation.trim();
    const normalizedCountryCode =
      personalInformation.countryCode.replace(/[^0-9]/g, '') || '91';
    const normalizedMobileNumber =
      personalInformation.mobileNumber.replace(/[^0-9]/g, '');
    const normalizedWhatsappNumber =
      personalInformation.whatsappNumber.replace(/[^0-9]/g, '');

    if (!trimmedName) {
      setSaveMessage({text: 'Full name is required.', tone: 'error'});
      return;
    }

    if (!trimmedDesignation) {
      setSaveMessage({text: 'Designation is required.', tone: 'error'});
      return;
    }

    if (!normalizedMobileNumber) {
      setSaveMessage({text: 'Mobile number is required.', tone: 'error'});
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const payload = {
        name: trimmedName,
        designation: trimmedDesignation,
        countryCode: Number(normalizedCountryCode),
        mobileNumber: Number(normalizedMobileNumber),
        whatsappNumber: normalizedWhatsappNumber,
      };

      const response = await authService.updateUserProfile(token, payload);
      const nextPersonalInformation = extractPersonalInformation(
        response,
        {
          ...session,
          user: {
            ...session.user,
            fullName: trimmedName,
          },
        },
        logoBaseUrl,
      );

      setPersonalInformation(nextPersonalInformation);
      setInitialPersonalInformation(nextPersonalInformation);
      toast.success('Personal information saved.');
    } catch (error) {
      setSaveMessage({
        text:
          error instanceof Error
            ? error.message
            : 'Could not save personal information.',
        tone: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!isDeleteConfirmationValid) {
      return;
    }

    setIsDeletingAccount(true);

    try {
      const response = await authService.deleteUserAccount(token);
      setIsDeleteModalVisible(false);
      setDeleteConfirmationText('');
      Alert.alert(
        'Account deleted',
        response?.message || 'The account has been deleted successfully.',
        [{text: 'OK', onPress: onLogout}],
      );
    } catch (error) {
      Alert.alert(
        'Delete account failed',
        error instanceof Error
          ? error.message
          : 'Could not delete your account.',
      );
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleUnavailableAction = (title: string) => {
    Alert.alert(title, SUPPORT_MESSAGE);
  };

  const handleAvatarPress = async () => {
    try {
      if (typeof launchImageLibrary !== 'function') {
        Alert.alert(
          'Avatar upload unavailable',
          'Image picker is not ready yet. Please rebuild the app and try again.',
        );
        return;
      }
      const result = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
        includeBase64: false,
      });
      if (result.didCancel) return;
      if (result.errorCode) {
        Alert.alert(
          'Avatar upload failed',
          result.errorMessage || 'Could not open the image picker.',
        );
        return;
      }
      const asset = result.assets?.[0];
      if (!asset?.uri) {
        Alert.alert('Avatar upload failed', 'No image was selected.');
        return;
      }
      // Frontend uses a 10MB cap; mirror to stay consistent across roles.
      if ((asset.fileSize ?? 0) > 10 * 1024 * 1024) {
        Alert.alert(
          'Image too large',
          'Please choose an image smaller than 10MB.',
        );
        return;
      }
      const mimeType = (asset.type || '').toLowerCase();
      if (
        mimeType &&
        !['image/png', 'image/jpg', 'image/jpeg'].includes(mimeType)
      ) {
        Alert.alert(
          'Unsupported format',
          'Please choose a png, jpg, or jpeg image.',
        );
        return;
      }

      setIsUploadingAvatar(true);
      // Optimistic preview while the upload is in flight.
      setPersonalInformation(current => ({...current, avatarUrl: asset.uri!}));
      try {
        await authService.uploadUserAvatar(token, {
          uri: asset.uri,
          name: asset.fileName || `avatar-${Date.now()}.jpg`,
          type: mimeType || 'image/jpeg',
        });
        // Refresh from server so we get the canonical CDN URL.
        await loadProfile();
        toast.success('Profile photo updated.');
      } catch (error) {
        // Roll back the optimistic preview on failure.
        setPersonalInformation(current => ({
          ...current,
          avatarUrl: initialPersonalInformation.avatarUrl,
        }));
        Alert.alert(
          'Avatar upload failed',
          error instanceof Error
            ? error.message
            : 'Could not upload your photo.',
        );
      } finally {
        setIsUploadingAvatar(false);
      }
    } catch (error) {
      Alert.alert(
        'Avatar upload failed',
        error instanceof Error ? error.message : 'Could not select the image.',
      );
    }
  };

  const handleDeactivateToggle = (nextDeactivated: boolean) => {
    const action = nextDeactivated ? 'Deactivate' : 'Reactivate';
    Alert.alert(
      `${action} account?`,
      nextDeactivated
        ? 'Your profile will be hidden across the platform until you reactivate it.'
        : 'Your profile will become visible again on the platform.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: action,
          style: nextDeactivated ? 'destructive' : 'default',
          onPress: async () => {
            const previous = personalInformation.isDeactivated;
            setPersonalInformation(current => ({
              ...current,
              isDeactivated: nextDeactivated,
            }));
            setIsSavingDeactivate(true);
            try {
              await authService.setAccountDeactivated(token, nextDeactivated);
              setInitialPersonalInformation(current => ({
                ...current,
                isDeactivated: nextDeactivated,
              }));
              toast.success(
                nextDeactivated
                  ? 'Account deactivated.'
                  : 'Account reactivated.',
              );
            } catch (error) {
              setPersonalInformation(current => ({
                ...current,
                isDeactivated: previous,
              }));
              Alert.alert(
                `${action} failed`,
                error instanceof Error
                  ? error.message
                  : `Could not ${action.toLowerCase()} your account.`,
              );
            } finally {
              setIsSavingDeactivate(false);
            }
          },
        },
      ],
    );
  };

  const selectAvailabilityMode = (mode: AvailabilityMode) => {
    setAvailabilityMode(mode);
  };

  const updateWeeklyAvailability = (
    dayKey: string,
    patch: Partial<WeeklyAvailabilityRow>,
  ) => {
    setWeeklyAvailability(current =>
      current.map(row =>
        row.dayKey === dayKey ? {...row, ...patch} : row,
      ),
    );
  };

  const updateSpecificDateRow = (
    id: string,
    patch: Partial<SpecificDateAvailabilityRow>,
  ) => {
    setSpecificDateRows(current =>
      current.map(row => (row.id === id ? {...row, ...patch} : row)),
    );
  };

  const removeSpecificDateRow = (id: string) => {
    setSpecificDateRows(current => current.filter(row => row.id !== id));
  };

  const addSpecificDateRow = () => {
    setNewSpecificDate({
      dateLabel: '',
      unavailable: false,
      fromTime: '',
      toTime: '',
    });
    setIsAddingSpecificDate(true);
  };

  const handleSaveNewSpecificDate = () => {
    const trimmedDate = newSpecificDate.dateLabel.trim();
    if (!trimmedDate) {
      toast.error('Please pick a date first.');
      return;
    }

    setSpecificDateRows(current => [
      ...current,
      {
        id: `${Date.now()}_${current.length + 1}`,
        dateLabel: trimmedDate,
        unavailable: newSpecificDate.unavailable,
        fromTime: newSpecificDate.fromTime,
        toTime: newSpecificDate.toTime,
      },
    ]);
    setIsAddingSpecificDate(false);
    setNewSpecificDate({
      dateLabel: '',
      unavailable: false,
      fromTime: '',
      toTime: '',
    });
  };

  const handleCancelNewSpecificDate = () => {
    setIsAddingSpecificDate(false);
    setNewSpecificDate({
      dateLabel: '',
      unavailable: false,
      fromTime: '',
      toTime: '',
    });
  };

  const assignTimeValue = (value: string) => {
    if (!timePickerTarget) {
      return;
    }

    if (timePickerTarget.kind === 'weekly-from') {
      updateWeeklyAvailability(timePickerTarget.dayKey, {fromTime: value});
    } else if (timePickerTarget.kind === 'weekly-to') {
      updateWeeklyAvailability(timePickerTarget.dayKey, {toTime: value});
    } else if (timePickerTarget.kind === 'specific-from') {
      updateSpecificDateRow(timePickerTarget.id, {fromTime: value});
    } else if (timePickerTarget.kind === 'specific-to') {
      updateSpecificDateRow(timePickerTarget.id, {toTime: value});
    } else if (timePickerTarget.kind === 'new-from') {
      setNewSpecificDate(current => ({...current, fromTime: value}));
    } else if (timePickerTarget.kind === 'new-to') {
      setNewSpecificDate(current => ({...current, toTime: value}));
    }

    setTimePickerTarget(null);
  };

  const handleSaveAvailability = async () => {
    if (!token) {
      toast.error('Could not save — sign in again.');
      return;
    }
    try {
      await availabilityService.update(
        token,
        toApi(availabilityMode, weeklyAvailability, specificDateRows),
      );
      toast.success('Availability hours saved.');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not save availability.';
      toast.error(message);
    }
  };

  const renderTabs = () => (
    <AppCard style={styles.tabsCard} padded={false}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}>
        {tabs.map(tab => {
          const active = tab.key === activeTab;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="button"
              accessibilityState={{selected: active}}
              onPress={() => setActiveTab(tab.key)}
              style={[
                styles.tabChip,
                active && styles.tabChipActive,
                active && {borderColor: primaryColor},
              ]}>
              <Text
                style={[
                  styles.tabChipText,
                  active && {color: primaryColor},
                ]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </AppCard>
  );

  const renderReadonlyField = (
    label: string,
    value: string,
    options?: {helperText?: string; required?: boolean},
  ) => (
    <AppTextField
      editable={false}
      label={label}
      required={options?.required}
      value={value}
      helperText={options?.helperText}
      placeholder="Not available"
      containerStyle={styles.field}
    />
  );

  const renderProfileCard = () => (
    <AppCard
      style={styles.formCard}
      header={<Text style={styles.cardTitle}>Your Personal Information</Text>}>
      <View style={styles.sectionDivider} />

      {showAvatarSection ? (
        <View style={styles.photoSection}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            onPress={handleAvatarPress}
            disabled={isUploadingAvatar}
            style={styles.photoFrame}>
            {personalInformation.avatarUrl ? (
              <Image
                source={{uri: personalInformation.avatarUrl}}
                style={styles.photoImage}
              />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Icon name="account-outline" size={36} color="#94a3b8" />
              </View>
            )}
            <View style={[styles.photoBadge, {backgroundColor: primaryColor}]}>
              <Icon name="camera" size={14} color="#ffffff" />
            </View>
          </Pressable>

          <View style={styles.photoCopy}>
            <Text style={styles.photoHintTitle}>Profile photo</Text>
            <Text style={styles.photoHintBody}>
              {isUploadingAvatar
                ? 'Uploading…'
                : 'PNG, JPG, or JPEG · up to 10MB'}
            </Text>
            <Pressable
              onPress={handleAvatarPress}
              disabled={isUploadingAvatar}
              hitSlop={4}
              style={styles.photoActionPill}>
              <Text style={[styles.photoAction, {color: primaryColor}]}>
                {personalInformation.avatarUrl ? 'Change photo' : 'Upload photo'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <AppTextField
        label="Full Name"
        required
        value={personalInformation.fullName}
        onChangeText={text => updatePersonalInformation('fullName', text)}
        placeholder="Enter your full name"
        containerStyle={styles.field}
        autoCapitalize="words"
      />
      {renderReadonlyField('Email', personalInformation.email, {required: true})}
      <AppTextField
        label="Designation"
        required
        value={personalInformation.designation}
        onChangeText={text => updatePersonalInformation('designation', text)}
        placeholder="Enter your designation"
        containerStyle={styles.field}
        autoCapitalize="words"
      />
      <View style={styles.phoneRow}>
        <View style={[styles.field, styles.countryCodeField]}>
          <Text style={styles.countryCodeLabel}>Country Code</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose country code"
            onPress={() => setIsCountryCodePickerOpen(true)}
            style={styles.countryCodeDropdown}>
            <Text style={styles.countryCodeValue}>
              +{personalInformation.countryCode || '91'}
            </Text>
            <Icon name="chevron-down" size={18} color="#64748b" />
          </Pressable>
        </View>
        <AppTextField
          label="Mobile Number"
          required
          value={personalInformation.mobileNumber}
          onChangeText={text =>
            updatePersonalInformation(
              'mobileNumber',
              text.replace(/[^0-9]/g, '').slice(0, 15),
            )
          }
          placeholder="Enter your mobile number"
          containerStyle={[styles.field, styles.mobileNumberField]}
          keyboardType="phone-pad"
        />
      </View>
      {canShowWhatsappNumber ? (
        <AppTextField
          label="Whatsapp Number"
          value={personalInformation.whatsappNumber}
          onChangeText={text =>
            updatePersonalInformation(
              'whatsappNumber',
              text.replace(/[^0-9]/g, '').slice(0, 15),
            )
          }
          placeholder="Enter whatsapp number"
          containerStyle={styles.field}
          keyboardType="phone-pad"
        />
      ) : null}

      {saveMessage ? (
        <View
          style={[
            styles.saveMessage,
            saveMessage.tone === 'success'
              ? styles.saveMessageSuccess
              : styles.saveMessageError,
          ]}>
          <Text
            style={[
              styles.saveMessageText,
              {
                color:
                  saveMessage.tone === 'success' ? successColor : dangerColor,
              },
            ]}>
            {saveMessage.text}
          </Text>
        </View>
      ) : null}

      <View style={styles.formFooter}>
        <AppButton
          label="Save Changes"
          loading={isSaving}
          loadingLabel="Saving..."
          // Always enabled (except while submitting) — users found the
          // disable-when-pristine state confusing since the form looks
          // fully filled. The handler validates required fields before
          // posting, so an unnecessary tap still surfaces useful feedback.
          disabled={isSaving}
          onPress={handleSavePersonalInformation}
        />
      </View>

      {canDeactivateProfile ? (
        <>
          <View style={styles.sectionDivider} />
          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <Text style={styles.toggleTitle}>
                {personalInformation.isDeactivated
                  ? 'Account deactivated'
                  : 'Sleep mode'}
              </Text>
              <Text style={styles.toggleHint}>
                {personalInformation.isDeactivated
                  ? 'Reactivate to make your profile visible again.'
                  : 'Hide your profile across the platform temporarily.'}
              </Text>
            </View>
            <Switch
              value={personalInformation.isDeactivated}
              onValueChange={handleDeactivateToggle}
              disabled={isSavingDeactivate}
              trackColor={{false: '#cbd5e1', true: '#fca5a5'}}
              thumbColor={
                personalInformation.isDeactivated ? '#dc2626' : '#f1f5f9'
              }
            />
          </View>
        </>
      ) : null}
    </AppCard>
  );

  const renderDeleteCard = () => (
    <View style={styles.deleteSection}>
      <View style={styles.deleteCopy}>
        <Text style={styles.deleteSectionTitle}>Delete account</Text>
        <Text style={styles.deleteSectionBody}>
          Permanently removes your profile, data, and connections. This cannot
          be undone.
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Delete account"
        onPress={() => setIsDeleteModalVisible(true)}
        style={styles.deleteLink}>
        <Icon name="trash-can-outline" size={16} color={dangerColor} />
        <Text style={[styles.deleteLinkText, {color: dangerColor}]}>
          Delete account
        </Text>
      </Pressable>
    </View>
  );

  const renderAvailabilityOption = (
    value: AvailabilityMode,
    label: string,
    iconName: string,
    description: string,
  ) => {
    const active = availabilityMode === value;
    return (
      <Pressable
        key={value}
        accessibilityRole="radio"
        accessibilityState={{selected: active}}
        onPress={() => selectAvailabilityMode(value)}
        style={[
          styles.availabilityOption,
          active && {
            borderColor: primaryColor,
            backgroundColor: withAlpha(primaryColor, 0.08),
          },
        ]}>
        <View
          style={[
            styles.availabilityOptionIconWrap,
            {
              backgroundColor: active
                ? withAlpha(primaryColor, 0.15)
                : '#f1f5f9',
            },
          ]}>
          <Icon
            name={iconName}
            size={20}
            color={active ? primaryColor : '#64748b'}
          />
        </View>
        <View style={styles.availabilityOptionCopy}>
          <Text
            style={[
              styles.availabilityOptionText,
              active && {color: primaryColor},
            ]}>
            {label}
          </Text>
          <Text style={styles.availabilityOptionHint}>{description}</Text>
        </View>
        <View
          style={[
            styles.radioOuter,
            active && {borderColor: primaryColor},
          ]}>
          {active ? (
            <View
              style={[
                styles.radioInner,
                {backgroundColor: primaryColor},
              ]}
            />
          ) : null}
        </View>
      </Pressable>
    );
  };

  const renderTimeCell = (
    value: string,
    onPress: () => void,
    disabled?: boolean,
  ) => (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.timeCell, disabled && styles.timeCellDisabled]}>
      <Icon
        name="clock-outline"
        size={16}
        color={disabled ? '#cbd5e1' : '#94a3b8'}
      />
      <Text
        style={[
          styles.timeCellText,
          !value && styles.timeCellPlaceholder,
          disabled && styles.timeCellTextDisabled,
        ]}>
        {value || 'Choose time'}
      </Text>
      <Icon
        name="chevron-down"
        size={16}
        color={disabled ? '#cbd5e1' : '#94a3b8'}
      />
    </Pressable>
  );

  const renderUnavailableToggle = (
    checked: boolean,
    onToggle: () => void,
  ) => (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{checked}}
      onPress={onToggle}
      style={styles.inlineSwitchWrap}>
      <Text
        style={[
          styles.inlineSwitchLabel,
          checked && {color: primaryColor},
        ]}>
        Unavailable
      </Text>
      <View
        style={[
          styles.switchTrack,
          checked && {backgroundColor: primaryColor},
        ]}>
        <View
          style={[
            styles.switchThumb,
            checked && styles.switchThumbActive,
          ]}
        />
      </View>
    </Pressable>
  );

  const renderDayBadge = (label: string, muted: boolean) => (
    <View
      style={[
        styles.dayBadge,
        {
          backgroundColor: muted
            ? '#f1f5f9'
            : withAlpha(primaryColor, 0.12),
        },
      ]}>
      <Text
        style={[
          styles.dayBadgeText,
          {color: muted ? '#94a3b8' : primaryColor},
        ]}>
        {label.slice(0, 1)}
      </Text>
    </View>
  );

  const renderAvailabilityHours = () => {
    const showWeeklySchedule = availabilityMode === 'specific-days';
    const showSpecificDatesSection =
      availabilityMode === 'anytime' || availabilityMode === 'specific-days';

    return (
      <AppCard
        style={styles.availabilityCard}
        header={<Text style={styles.cardTitle}>Manage Availability Hours</Text>}>
        <View style={styles.sectionDivider} />

        <Text style={styles.availabilityLabel}>Choose an option</Text>
        <View style={styles.availabilityOptionsRow}>
          {renderAvailabilityOption(
            'anytime',
            'Anytime',
            'calendar-check-outline',
            'Available all the time',
          )}
          {renderAvailabilityOption(
            'temporary-unavailable',
            'Temporary Unavailable',
            'calendar-remove-outline',
            'Pause new requests for now',
          )}
          {renderAvailabilityOption(
            'specific-days',
            'Specific Days',
            'calendar-clock-outline',
            'Pick weekly windows and dates',
          )}
        </View>

        {showWeeklySchedule ? (
          <View style={styles.availabilityScheduleSection}>
            <Text style={styles.availabilitySectionTitle}>Weekly schedule</Text>
            <Text style={styles.availabilitySectionHint}>
              Set the hours you&apos;re available on each day of the week.
            </Text>
            {weeklyAvailability.map(row => (
              <View
                key={row.dayKey}
                style={[
                  styles.scheduleCard,
                  row.unavailable && styles.scheduleCardMuted,
                ]}>
                <View style={styles.scheduleCardHeader}>
                  <View style={styles.scheduleDayLeft}>
                    {renderDayBadge(row.label, row.unavailable)}
                    <Text
                      style={[
                        styles.scheduleCardTitle,
                        row.unavailable && styles.scheduleCardTitleMuted,
                      ]}>
                      {row.label}
                    </Text>
                  </View>
                  {renderUnavailableToggle(row.unavailable, () =>
                    updateWeeklyAvailability(row.dayKey, {
                      unavailable: !row.unavailable,
                    }),
                  )}
                </View>
                {row.unavailable ? (
                  <View style={styles.unavailableSlim}>
                    <Icon
                      name="moon-waning-crescent"
                      size={14}
                      color="#94a3b8"
                    />
                    <Text style={styles.unavailableSlimText}>
                      Marked unavailable
                    </Text>
                  </View>
                ) : (
                  <View style={styles.scheduleTimesRow}>
                    <View style={styles.scheduleTimeCol}>
                      <Text style={styles.scheduleTimeLabel}>From</Text>
                      {renderTimeCell(
                        row.fromTime,
                        () =>
                          setTimePickerTarget({
                            kind: 'weekly-from',
                            dayKey: row.dayKey,
                          }),
                        row.unavailable,
                      )}
                    </View>
                    <View style={styles.scheduleTimeCol}>
                      <Text style={styles.scheduleTimeLabel}>To</Text>
                      {renderTimeCell(
                        row.toTime,
                        () =>
                          setTimePickerTarget({
                            kind: 'weekly-to',
                            dayKey: row.dayKey,
                          }),
                        row.unavailable,
                      )}
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>
        ) : null}

        {showSpecificDatesSection ? (
          <View style={styles.availabilityScheduleSection}>
            <Text style={styles.availabilitySectionTitle}>Specific dates</Text>
            <Text style={styles.availabilitySectionHint}>
              Override your default availability for one-off dates.
            </Text>
            {specificDateRows.length === 0 && !isAddingSpecificDate ? (
              <View style={styles.emptySpecificDates}>
                <View style={styles.emptySpecificDatesIcon}>
                  <Icon name="calendar-blank-outline" size={22} color="#94a3b8" />
                </View>
                <Text style={styles.emptySpecificDatesTitle}>
                  No specific dates yet
                </Text>
                <Text style={styles.emptySpecificDatesText}>
                  Add a date to override your weekly availability.
                </Text>
              </View>
            ) : (
              specificDateRows.map(row => (
                <View
                  key={row.id}
                  style={[
                    styles.scheduleCard,
                    styles.specificDateCard,
                    row.unavailable && styles.scheduleCardMuted,
                  ]}>
                  <View style={styles.scheduleCardHeader}>
                    <View
                      style={[
                        styles.scheduleDateBadge,
                        {
                          backgroundColor: withAlpha(primaryColor, 0.1),
                          borderColor: withAlpha(primaryColor, 0.25),
                        },
                      ]}>
                      <Icon
                        name="calendar-blank-outline"
                        size={14}
                        color={primaryColor}
                      />
                      <Text
                        style={[
                          styles.scheduleDateBadgeText,
                          {color: primaryColor},
                        ]}>
                        {formatSpecificDateLabel(row.dateLabel)}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Remove date"
                      hitSlop={8}
                      onPress={() => setPendingDeleteDateId(row.id)}
                      style={styles.scheduleCardDelete}>
                      <Icon
                        name="trash-can-outline"
                        size={16}
                        color="#94a3b8"
                      />
                    </Pressable>
                  </View>
                  <View style={styles.scheduleToggleRow}>
                    {renderUnavailableToggle(row.unavailable, () =>
                      updateSpecificDateRow(row.id, {
                        unavailable: !row.unavailable,
                      }),
                    )}
                  </View>
                  {row.unavailable ? (
                    <View style={styles.unavailableSlim}>
                      <Icon
                        name="moon-waning-crescent"
                        size={14}
                        color="#94a3b8"
                      />
                      <Text style={styles.unavailableSlimText}>
                        Unavailable all day
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.scheduleTimesRow}>
                      <View style={styles.scheduleTimeCol}>
                        <Text style={styles.scheduleTimeLabel}>From</Text>
                        {renderTimeCell(
                          row.fromTime,
                          () =>
                            setTimePickerTarget({
                              kind: 'specific-from',
                              id: row.id,
                            }),
                          row.unavailable,
                        )}
                      </View>
                      <View style={styles.scheduleTimeCol}>
                        <Text style={styles.scheduleTimeLabel}>To</Text>
                        {renderTimeCell(
                          row.toTime,
                          () =>
                            setTimePickerTarget({
                              kind: 'specific-to',
                              id: row.id,
                            }),
                          row.unavailable,
                        )}
                      </View>
                    </View>
                  )}
                </View>
              ))
            )}

            {isAddingSpecificDate ? (
              <View style={styles.addDateCard}>
                <View style={styles.addDateHeader}>
                  <View
                    style={[
                      styles.addDateIconWrap,
                      {backgroundColor: withAlpha(primaryColor, 0.12)},
                    ]}>
                    <Icon
                      name="calendar-plus"
                      size={18}
                      color={primaryColor}
                    />
                  </View>
                  <View style={styles.addDateHeaderCopy}>
                    <Text style={styles.addDateTitle}>Add a date</Text>
                    <Text style={styles.addDateSubtitle}>
                      Override your availability for a single day.
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                    hitSlop={8}
                    onPress={handleCancelNewSpecificDate}
                    style={styles.addDateCloseButton}>
                    <Icon name="close" size={16} color="#64748b" />
                  </Pressable>
                </View>
                <View style={styles.addDateDivider} />

                <View style={styles.addDateFormGroup}>
                  <Text style={styles.addDateFieldLabel}>
                    Date <Text style={{color: dangerColor}}>*</Text>
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Pick a date"
                    onPress={() => setIsCalendarPickerOpen(true)}
                    style={styles.datePickerTrigger}>
                    <Icon
                      name="calendar-blank-outline"
                      size={18}
                      color={
                        newSpecificDate.dateLabel ? primaryColor : '#94a3b8'
                      }
                    />
                    <Text
                      style={[
                        styles.datePickerTriggerText,
                        !newSpecificDate.dateLabel &&
                          styles.datePickerTriggerPlaceholder,
                      ]}>
                      {newSpecificDate.dateLabel
                        ? formatSpecificDateLabel(newSpecificDate.dateLabel)
                        : 'Select a date'}
                    </Text>
                    <Icon name="chevron-down" size={18} color="#94a3b8" />
                  </Pressable>
                </View>

                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{checked: newSpecificDate.unavailable}}
                  onPress={() =>
                    setNewSpecificDate(current => ({
                      ...current,
                      unavailable: !current.unavailable,
                      fromTime: !current.unavailable ? '' : current.fromTime,
                      toTime: !current.unavailable ? '' : current.toTime,
                    }))
                  }
                  style={styles.allDayRow}>
                  <View style={styles.allDayCopy}>
                    <Text style={styles.allDayTitle}>Unavailable all day</Text>
                    <Text style={styles.allDayHint}>
                      Skip the time window for this date.
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.switchTrack,
                      newSpecificDate.unavailable && {
                        backgroundColor: primaryColor,
                      },
                    ]}>
                    <View
                      style={[
                        styles.switchThumb,
                        newSpecificDate.unavailable &&
                          styles.switchThumbActive,
                      ]}
                    />
                  </View>
                </Pressable>

                {!newSpecificDate.unavailable ? (
                  <View style={styles.addDateFormGroup}>
                    <Text style={styles.addDateFieldLabel}>Time window</Text>
                    <View style={styles.scheduleTimesRow}>
                      <View style={styles.scheduleTimeCol}>
                        <Text style={styles.scheduleTimeLabel}>Starts</Text>
                        {renderTimeCell(
                          newSpecificDate.fromTime,
                          () => setTimePickerTarget({kind: 'new-from'}),
                          newSpecificDate.unavailable,
                        )}
                      </View>
                      <View style={styles.scheduleTimeCol}>
                        <Text style={styles.scheduleTimeLabel}>Ends</Text>
                        {renderTimeCell(
                          newSpecificDate.toTime,
                          () => setTimePickerTarget({kind: 'new-to'}),
                          newSpecificDate.unavailable,
                        )}
                      </View>
                    </View>
                  </View>
                ) : null}

                <View style={styles.addDateActions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={handleSaveNewSpecificDate}
                    style={[
                      styles.addDateSavePrimary,
                      {backgroundColor: primaryColor},
                    ]}>
                    <Icon name="check" size={16} color="#ffffff" />
                    <Text style={styles.addDateSavePrimaryLabel}>
                      Save date
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={handleCancelNewSpecificDate}
                    style={styles.addDateCancelGhost}>
                    <Text style={styles.addDateCancelGhostLabel}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={addSpecificDateRow}
                style={[styles.addNewButton, {borderColor: primaryColor}]}>
                <Icon name="plus" size={16} color={primaryColor} />
                <Text
                  style={[styles.addNewButtonLabel, {color: primaryColor}]}>
                  Add new date
                </Text>
              </Pressable>
            )}
          </View>
        ) : null}

        <View style={styles.formFooter}>
          <AppButton
            label="Save changes"
            onPress={handleSaveAvailability}
            style={[styles.availabilitySaveButton, {backgroundColor: primaryColor}]}
          />
          <View style={styles.availabilityFootnote}>
            <Icon name="information-outline" size={13} color="#94a3b8" />
            <Text style={styles.availabilityFootnoteText}>
              Synced with your web calendar.
            </Text>
          </View>
        </View>
      </AppCard>
    );
  };

  const renderPersonalInformation = () => {
    if (isWideLayout) {
      if (canDeleteProfile) {
        return (
          <View style={styles.desktopColumns}>
            <View style={styles.desktopMainColumn}>{renderProfileCard()}</View>
            <View style={styles.desktopSideColumn}>{renderDeleteCard()}</View>
          </View>
        );
      }

      return renderProfileCard();
    }

    return (
      <View style={styles.mobileSections}>
        {renderProfileCard()}
        {canDeleteProfile ? renderDeleteCard() : null}
      </View>
    );
  };

  const renderUnavailableTab = () => {
    const currentTab = tabs.find(tab => tab.key === activeTab);

    return (
      <AppCard
        style={styles.placeholderCard}
        header={<Text style={styles.cardTitle}>{currentTab?.label}</Text>}>
        <Text style={styles.placeholderCopy}>{currentTab?.description}</Text>
        <View style={styles.placeholderPanel}>
          <Icon name="tools" size={24} color={primaryColor} />
          <Text style={styles.placeholderTitle}>Backend wiring pending</Text>
          <Text style={styles.placeholderBody}>
            The mobile shell is ready, but this section should only go live
            after its API contract and save flow are confirmed.
          </Text>
        </View>
        <AppButton
          fullWidth={false}
          label="Why is this locked?"
          onPress={() => handleUnavailableAction(currentTab?.label || 'Section')}
          variant="secondary"
        />
      </AppCard>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={primaryColor} size="large" />
        <Text style={styles.loadingTitle}>Loading account settings...</Text>
        <Text style={styles.loadingSubtitle}>
          Fetching your profile and account-level details.
        </Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.pageContent}
        keyboardShouldPersistTaps="handled">
        {/* No RefreshControl: Account Settings is a form, and pull-to-refresh
            would reload server data over the user's in-progress edits. The
            "Try again" button on the load-error state covers the recovery
            case. */}
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to dashboard"
            onPress={onBack}
            style={styles.backButton}>
            <Icon name="arrow-left" size={20} color="#0f172a" />
          </Pressable>

          <View style={styles.headerCopy}>
            <Text style={styles.pageTitle}>Account Settings</Text>
            <Text style={styles.pageSubtitle}>
              Manage your personal information, preferences, and account
              controls.
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Leave feedback"
            onPress={() => setIsFeedbackModalVisible(true)}
            hitSlop={6}
            style={styles.feedbackIconButton}>
            <Icon
              name="message-text-outline"
              size={20}
              color={primaryColor}
            />
          </Pressable>
        </View>

        {loadError ? (
          <AppCard style={styles.errorCard}>
            <Text style={styles.errorTitle}>We could not refresh your profile</Text>
            <Text style={styles.errorBody}>{loadError}</Text>
            <AppButton
              fullWidth={false}
              label="Try Again"
              onPress={() => loadProfile()}
              style={styles.retryButton}
            />
          </AppCard>
        ) : null}

        {renderTabs()}

        {activeTab === 'personal-information'
          ? renderPersonalInformation()
          : activeTab === 'availability-hours'
            ? renderAvailabilityHours()
            : renderUnavailableTab()}
      </ScrollView>

      <FeedbackModal
        visible={isFeedbackModalVisible}
        onClose={() => setIsFeedbackModalVisible(false)}
      />

      <Picker
        visible={isCountryCodePickerOpen}
        title="Select country code"
        options={COUNTRY_CODES.map(formatCountryCodeOption)}
        selected={
          COUNTRY_CODES.find(
            c => c.value === personalInformation.countryCode,
          )
            ? formatCountryCodeOption(
                COUNTRY_CODES.find(
                  c => c.value === personalInformation.countryCode,
                )!,
              )
            : undefined
        }
        primaryColor={primaryColor}
        searchable
        onClose={() => setIsCountryCodePickerOpen(false)}
        onSelect={(label: string) => {
          const match = COUNTRY_CODES.find(
            c => formatCountryCodeOption(c) === label,
          );
          if (match) {
            updatePersonalInformation('countryCode', match.value);
          }
          setIsCountryCodePickerOpen(false);
        }}
      />

      <Modal
        animationType="fade"
        transparent
        visible={isDeleteModalVisible}
        onRequestClose={() => {
          if (!isDeletingAccount) {
            setIsDeleteModalVisible(false);
            setDeleteConfirmationText('');
          }
        }}>
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => {
              if (!isDeletingAccount) {
                setIsDeleteModalVisible(false);
                setDeleteConfirmationText('');
              }
            }}
          />

          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Delete Account</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close delete account dialog"
                disabled={isDeletingAccount}
                onPress={() => {
                  setIsDeleteModalVisible(false);
                  setDeleteConfirmationText('');
                }}
                style={styles.modalCloseButton}>
                <Icon name="close" size={22} color="#0f172a" />
              </Pressable>
            </View>

            <View style={styles.modalDivider} />

            <Text style={styles.modalBody}>
              We will immediately delete all your data from our site.
            </Text>
            <Text style={styles.modalBody}>
              You will no longer be able to login. Type{' '}
              <Text style={styles.modalBodyStrong}>delete account</Text> to
              confirm account deletion from our platform.
            </Text>

            <AppTextField
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isDeletingAccount}
              placeholder="delete account"
              value={deleteConfirmationText}
              onChangeText={setDeleteConfirmationText}
              containerStyle={styles.modalInput}
            />

            <AppButton
              label="Delete"
              loading={isDeletingAccount}
              loadingLabel="Deleting..."
              disabled={!isDeleteConfirmationValid}
              onPress={handleDeleteAccount}
              style={[styles.modalDeleteButton, {backgroundColor: dangerColor}]}
              labelStyle={styles.modalDeleteButtonLabel}
            />
          </View>
        </View>
      </Modal>

      <CalendarPicker
        visible={isCalendarPickerOpen}
        value={newSpecificDate.dateLabel}
        onSelect={iso => {
          setNewSpecificDate(current => ({...current, dateLabel: iso}));
          setIsCalendarPickerOpen(false);
        }}
        onClose={() => setIsCalendarPickerOpen(false)}
      />

      <ConfirmModal
        visible={pendingDeleteDateId !== null}
        title="Remove this date?"
        message={(() => {
          const row = specificDateRows.find(
            r => r.id === pendingDeleteDateId,
          );
          if (!row) return undefined;
          return `${formatSpecificDateLabel(row.dateLabel)} will no longer override your weekly availability.`;
        })()}
        confirmLabel="Remove"
        cancelLabel="Keep"
        variant="destructive"
        onConfirm={() => {
          if (pendingDeleteDateId) {
            removeSpecificDateRow(pendingDeleteDateId);
          }
          setPendingDeleteDateId(null);
        }}
        onCancel={() => setPendingDeleteDateId(null)}
      />

      <Modal
        animationType="fade"
        transparent
        visible={timePickerTarget !== null}
        onRequestClose={() => setTimePickerTarget(null)}>
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setTimePickerTarget(null)}
          />

          <View style={styles.timeModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Time</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close time picker"
                onPress={() => setTimePickerTarget(null)}
                style={styles.modalCloseButton}>
                <Icon name="close" size={22} color="#0f172a" />
              </Pressable>
            </View>

            <ScrollView
              style={styles.timeOptionsList}
              contentContainerStyle={styles.timeOptionsContent}>
              {TIME_OPTIONS.map(option => (
                <Pressable
                  key={option}
                  onPress={() => assignTimeValue(option)}
                  style={styles.timeOptionItem}>
                  <Text style={styles.timeOptionText}>{option}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#eef2f7',
    flex: 1,
  },
  pageContent: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingWrap: {
    alignItems: 'center',
    backgroundColor: '#eef2f7',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingTitle: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 18,
  },
  loadingSubtitle: {
    color: '#64748b',
    fontSize: 15,
    marginTop: 8,
    textAlign: 'center',
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    elevation: 1,
    height: 40,
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 4,
    width: 40,
  },
  headerCopy: {
    flex: 1,
  },
  pageTitle: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '800',
  },
  pageSubtitle: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  feedbackIconButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    elevation: 1,
    height: 40,
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 4,
    width: 40,
  },
  feedbackButton: {
    minWidth: 160,
  },
  errorCard: {
    borderColor: '#fecaca',
    borderWidth: 1,
    marginBottom: 18,
  },
  errorTitle: {
    color: '#991b1b',
    fontSize: 17,
    fontWeight: '800',
  },
  errorBody: {
    color: '#7f1d1d',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  retryButton: {
    marginTop: 16,
  },
  tabsCard: {
    marginBottom: 18,
  },
  tabsRow: {
    gap: 10,
    padding: 14,
  },
  tabChip: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  tabChipActive: {
    backgroundColor: '#ffffff',
  },
  tabChipText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '700',
  },
  desktopColumns: {
    flexDirection: 'row',
    gap: 18,
  },
  desktopMainColumn: {
    flex: 1.45,
  },
  desktopSideColumn: {
    flex: 1,
  },
  mobileSections: {
    gap: 18,
  },
  formCard: {
    minHeight: 560,
  },
  availabilityCard: {
    minHeight: 560,
  },
  cardTitle: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '800',
  },
  sectionDivider: {
    backgroundColor: '#e2e8f0',
    height: 1,
    marginVertical: 18,
    marginHorizontal: -20,
  },
  availabilityLabel: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 16,
  },
  availabilityOptionsRow: {
    flexDirection: 'column',
    gap: 10,
  },
  availabilityOption: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  availabilityOptionIconWrap: {
    alignItems: 'center',
    borderRadius: 10,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  availabilityOptionCopy: {
    flex: 1,
    gap: 2,
  },
  availabilityOptionText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
  availabilityOptionHint: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '500',
  },
  radioOuter: {
    alignItems: 'center',
    borderColor: '#cbd5e1',
    borderRadius: 11,
    borderWidth: 2,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  radioInner: {
    borderRadius: 6,
    height: 10,
    width: 10,
  },
  availabilityScheduleSection: {
    marginTop: 24,
  },
  availabilitySectionTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  availabilitySectionHint: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 14,
  },
  scheduleCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 14,
    borderWidth: 1,
    gap: 14,
    marginBottom: 10,
    padding: 14,
  },
  scheduleCardMuted: {
    backgroundColor: '#f8fafc',
  },
  scheduleCardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  scheduleCardTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
  },
  scheduleDateBadge: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  scheduleDateBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  scheduleCardDelete: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  specificDateCard: {
    gap: 12,
  },
  scheduleToggleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  scheduleTimesRow: {
    flexDirection: 'row',
    gap: 10,
  },
  scheduleTimeCol: {
    flex: 1,
    gap: 6,
  },
  scheduleTimeLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  inlineSwitchWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  inlineSwitchLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  dayBadge: {
    alignItems: 'center',
    borderRadius: 10,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  dayBadgeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  scheduleDayLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  scheduleCardTitleMuted: {
    color: '#94a3b8',
  },
  unavailableSlim: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingTop: 2,
  },
  unavailableSlimText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  checkbox: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 5,
    borderWidth: 1.5,
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
  timeCell: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  timeCellDisabled: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  timeCellText: {
    color: '#0f172a',
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  timeCellPlaceholder: {
    color: '#94a3b8',
    fontWeight: '500',
  },
  timeCellTextDisabled: {
    color: '#cbd5e1',
  },
  emptySpecificDates: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 14,
    borderStyle: 'dashed',
    borderWidth: 1,
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 22,
  },
  emptySpecificDatesIcon: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    marginBottom: 4,
    width: 44,
  },
  emptySpecificDatesTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
  emptySpecificDatesText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  addNewButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: 10,
    paddingVertical: 12,
  },
  addNewButtonLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  addDateCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 10,
    padding: 18,
    shadowColor: '#0f172a',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  addDateHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  addDateIconWrap: {
    alignItems: 'center',
    borderRadius: 10,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  addDateHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  addDateTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
  },
  addDateSubtitle: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '500',
  },
  addDateCloseButton: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  addDateDivider: {
    backgroundColor: '#e2e8f0',
    height: 1,
    marginHorizontal: -18,
    marginTop: 14,
    marginBottom: 16,
  },
  addDateFormGroup: {
    gap: 6,
    marginBottom: 14,
  },
  addDateFieldLabel: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
  },
  datePickerTrigger: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  datePickerTriggerText: {
    color: '#0f172a',
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  datePickerTriggerPlaceholder: {
    color: '#94a3b8',
    fontWeight: '500',
  },
  allDayRow: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  allDayCopy: {
    flex: 1,
    gap: 2,
  },
  allDayTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
  allDayHint: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '500',
  },
  switchTrack: {
    backgroundColor: '#cbd5e1',
    borderRadius: 14,
    height: 26,
    justifyContent: 'center',
    paddingHorizontal: 3,
    width: 46,
  },
  switchThumb: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    height: 20,
    shadowColor: '#0f172a',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
    width: 20,
  },
  switchThumbActive: {
    transform: [{translateX: 20}],
  },
  addDateActions: {
    flexDirection: 'column',
    gap: 10,
    marginTop: 6,
  },
  addDateCancelGhost: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    justifyContent: 'center',
    paddingVertical: 14,
    width: '100%',
  },
  addDateCancelGhostLabel: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
  },
  addDateSavePrimary: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 14,
    width: '100%',
  },
  addDateSavePrimaryLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  availabilitySaveButton: {
    marginTop: 4,
  },
  availabilityFootnote: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: 10,
  },
  availabilityFootnoteText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
  },
  photoSection: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  photoLabel: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  photoDetails: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  photoFrame: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 40,
    height: 80,
    justifyContent: 'center',
    overflow: 'visible',
    position: 'relative',
    width: 80,
  },
  photoImage: {
    borderRadius: 40,
    height: 80,
    width: 80,
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
  },
  photoBadge: {
    alignItems: 'center',
    borderColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 2,
    bottom: -2,
    height: 28,
    justifyContent: 'center',
    position: 'absolute',
    right: -2,
    width: 28,
  },
  photoCopy: {
    flex: 1,
  },
  photoHintTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
  },
  photoHintBody: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  photoActionPill: {
    marginTop: 6,
  },
  photoAction: {
    fontSize: 13,
    fontWeight: '700',
  },
  field: {
    marginTop: 16,
  },
  infoBanner: {
    alignItems: 'flex-start',
    backgroundColor: '#eff6ff',
    borderColor: '#93c5fd',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    padding: 14,
  },
  infoBannerText: {
    color: '#1e3a8a',
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 12,
  },
  countryCodeField: {
    flex: 0.8,
  },
  countryCodeLabel: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  countryCodeDropdown: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  countryCodeValue: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '600',
  },
  mobileNumberField: {
    flex: 1.6,
  },
  saveMessage: {
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  saveMessageSuccess: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  saveMessageError: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
  },
  saveMessageText: {
    fontSize: 13,
    fontWeight: '600',
  },
  saveMessageTextSuccess: {
    color: '#166534',
  },
  saveMessageTextError: {
    color: '#991b1b',
  },
  formFooter: {
    marginTop: 22,
    // Padding below the button prevents it from butting up against the
    // following sectionDivider — gives the save action room to breathe.
    marginBottom: 4,
  },
  subSection: {
    gap: 4,
    marginTop: 16,
  },
  subSectionTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  toggleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
  },
  toggleCopy: {
    flex: 1,
    gap: 2,
  },
  toggleTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
  toggleHint: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 16,
  },
  // Subtle, non-aggressive delete-account section — a quiet row at the
  // bottom of the page with a danger-coloured link instead of a big red card.
  deleteSection: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  deleteCopy: {
    flex: 1,
    gap: 2,
  },
  deleteSectionTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
  deleteSectionBody: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 17,
  },
  deleteLink: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  deleteLinkText: {
    fontSize: 13,
    fontWeight: '700',
  },
  deleteCard: {
    borderColor: '#fda4af',
    borderWidth: 1,
  },
  deleteTitle: {
    color: '#dc2626',
    fontSize: 17,
    fontWeight: '800',
  },
  deleteBody: {
    color: '#0f172a',
    fontSize: 15,
    lineHeight: 25,
  },
  deleteFooter: {
    alignItems: 'flex-end',
    marginTop: 24,
  },
  deleteButton: {
    backgroundColor: '#dc2626',
    minWidth: 176,
  },
  deleteButtonLabel: {
    color: '#ffffff',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.56)',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    maxWidth: 640,
    padding: 28,
    width: '100%',
    zIndex: 2,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalTitle: {
    color: '#0f172a',
    fontSize: 24,
    fontWeight: '800',
  },
  modalCloseButton: {
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    borderRadius: 16,
    borderWidth: 1,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  modalDivider: {
    backgroundColor: '#e2e8f0',
    height: 1,
    marginHorizontal: -28,
    marginVertical: 22,
  },
  modalBody: {
    color: '#0f172a',
    fontSize: 16,
    lineHeight: 28,
    marginBottom: 10,
  },
  modalBodyStrong: {
    fontWeight: '800',
  },
  modalInput: {
    marginTop: 10,
  },
  modalDeleteButton: {
    backgroundColor: '#ef4444',
    marginTop: 26,
  },
  modalDeleteButtonLabel: {
    color: '#ffffff',
    letterSpacing: 0.6,
  },
  timeModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    maxHeight: '72%',
    maxWidth: 420,
    padding: 24,
    width: '100%',
    zIndex: 2,
  },
  timeOptionsList: {
    marginTop: 12,
  },
  timeOptionsContent: {
    paddingBottom: 8,
  },
  timeOptionItem: {
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    paddingVertical: 14,
  },
  timeOptionText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '600',
  },
  placeholderCard: {
    paddingBottom: 24,
  },
  placeholderCopy: {
    color: '#64748b',
    fontSize: 14,
    lineHeight: 22,
  },
  placeholderPanel: {
    alignItems: 'flex-start',
    backgroundColor: '#f8fafc',
    borderColor: '#dbe4ef',
    borderRadius: 18,
    borderWidth: 1,
    marginVertical: 18,
    padding: 18,
  },
  placeholderTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 12,
  },
  placeholderBody: {
    color: '#64748b',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
  },
});
