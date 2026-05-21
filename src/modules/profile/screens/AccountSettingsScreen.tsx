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

import {
  linkedinUrl as linkedinValidator,
  twitterUrl as twitterValidator,
} from '../../../core/form/validators';

import {AuthSession} from '../../auth/models/auth.models';
import {authService} from '../../auth/services/auth.service';
import {TenantContext} from '../../../core/tenant/TenantProvider';
import {AppButton} from '../../../core/components/AppButton';
import {AppCard} from '../../../core/components/AppCard';
import {AppTextField} from '../../../core/components/AppTextField';
import {Icon} from '../../../core/components/Icon';
import {colors} from '../../../core/theme/colors';
import {FeedbackModal} from '../../feedback/FeedbackWidget';

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
  const [availabilitySaveMessage, setAvailabilitySaveMessage] = useState<{
    text: string;
    tone: 'success' | 'error';
  } | null>(null);
  const [timePickerTarget, setTimePickerTarget] =
    useState<TimePickerTarget>(null);
  const [isAddingSpecificDate, setIsAddingSpecificDate] = useState(false);
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
  const [isSavingNewsletter, setIsSavingNewsletter] = useState(false);
  const [isSavingDeactivate, setIsSavingDeactivate] = useState(false);
  const [isSavingSocialLinks, setIsSavingSocialLinks] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [socialLinkErrors, setSocialLinkErrors] = useState<{
    linkedin?: string;
    twitter?: string;
  }>({});

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

  useEffect(() => {
    if (!tabs.some(tab => tab.key === activeTab)) {
      setActiveTab('personal-information');
    }
  }, [activeTab, tabs]);

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
      setSaveMessage({text: 'Personal information saved.', tone: 'success'});
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
        setSaveMessage({text: 'Profile photo updated.', tone: 'success'});
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

  const handleNewsletterToggle = async (next: boolean) => {
    // Optimistic update — flip the UI first, roll back on error.
    const previous = personalInformation.subscribeToNewsletter;
    setPersonalInformation(current => ({
      ...current,
      subscribeToNewsletter: next,
    }));
    setIsSavingNewsletter(true);
    try {
      await authService.updateNewsletterSubscription(token, next);
      setInitialPersonalInformation(current => ({
        ...current,
        subscribeToNewsletter: next,
      }));
    } catch (error) {
      setPersonalInformation(current => ({
        ...current,
        subscribeToNewsletter: previous,
      }));
      Alert.alert(
        'Newsletter update failed',
        error instanceof Error
          ? error.message
          : 'Could not update newsletter preference.',
      );
    } finally {
      setIsSavingNewsletter(false);
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
              setSaveMessage({
                text: nextDeactivated
                  ? 'Account deactivated.'
                  : 'Account reactivated.',
                tone: 'success',
              });
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

  const handleSaveSocialLinks = async () => {
    const linkedin = personalInformation.linkedinUrl.trim();
    const twitter = personalInformation.twitterUrl.trim();
    const errors: {linkedin?: string; twitter?: string} = {};
    const linkedinErr = linkedin ? linkedinValidator(linkedin) : undefined;
    const twitterErr = twitter ? twitterValidator(twitter) : undefined;
    if (linkedinErr) errors.linkedin = linkedinErr;
    if (twitterErr) errors.twitter = twitterErr;
    setSocialLinkErrors(errors);
    if (linkedinErr || twitterErr) return;

    setIsSavingSocialLinks(true);
    try {
      await authService.updateUserSocialLinks(token, {
        linkedinUrl: linkedin,
        twitterUrl: twitter,
      });
      setInitialPersonalInformation(current => ({
        ...current,
        linkedinUrl: linkedin,
        twitterUrl: twitter,
      }));
      setSaveMessage({text: 'Social links saved.', tone: 'success'});
    } catch (error) {
      Alert.alert(
        'Save failed',
        error instanceof Error ? error.message : 'Could not save social links.',
      );
    } finally {
      setIsSavingSocialLinks(false);
    }
  };

  const selectAvailabilityMode = (mode: AvailabilityMode) => {
    setAvailabilityMode(mode);
    setAvailabilitySaveMessage(null);
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
    setAvailabilitySaveMessage(null);
  };

  const updateSpecificDateRow = (
    id: string,
    patch: Partial<SpecificDateAvailabilityRow>,
  ) => {
    setSpecificDateRows(current =>
      current.map(row => (row.id === id ? {...row, ...patch} : row)),
    );
    setAvailabilitySaveMessage(null);
  };

  const addSpecificDateRow = () => {
    setNewSpecificDate({
      dateLabel: '',
      unavailable: false,
      fromTime: '',
      toTime: '',
    });
    setIsAddingSpecificDate(true);
    setAvailabilitySaveMessage(null);
  };

  const handleSaveNewSpecificDate = () => {
    const trimmedDate = newSpecificDate.dateLabel.trim();
    if (!trimmedDate) {
      setAvailabilitySaveMessage({
        text: 'Please enter a date in yyyy-mm-dd format.',
        tone: 'error',
      });
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
    setAvailabilitySaveMessage(null);
  };

  const handleCancelNewSpecificDate = () => {
    setIsAddingSpecificDate(false);
    setNewSpecificDate({
      dateLabel: '',
      unavailable: false,
      fromTime: '',
      toTime: '',
    });
    setAvailabilitySaveMessage(null);
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

  const handleSaveAvailability = () => {
    setAvailabilitySaveMessage({
      text:
        'Availability Hours UI is ready. The save API is not confirmed yet, so this is staged locally for now.',
      tone: 'success',
    });
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
    options?: {helperText?: string},
  ) => (
    <AppTextField
      editable={false}
      label={label}
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
          <Text style={styles.photoLabel}>Your Photo</Text>

          <View style={styles.photoDetails}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Profile photo actions"
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
                  <Icon name="account-outline" size={34} color="#94a3b8" />
                  <Text style={styles.photoPlaceholderText}>No photo</Text>
                </View>
              )}

              <View style={styles.photoBadge}>
                <Icon name="pencil" size={14} color="#64748b" />
              </View>
            </Pressable>

            <View style={styles.photoCopy}>
              <Text style={styles.photoHintTitle}>Profile photo</Text>
              <Text style={styles.photoHintBody}>
                {isUploadingAvatar
                  ? 'Uploading…'
                  : 'PNG, JPG, or JPEG up to 10MB.'}
              </Text>
              <Pressable
                onPress={handleAvatarPress}
                disabled={isUploadingAvatar}>
                <Text style={[styles.photoAction, {color: primaryColor}]}>
                  {personalInformation.avatarUrl
                    ? 'Change photo'
                    : 'Upload photo'}
                </Text>
              </Pressable>
            </View>
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
      {renderReadonlyField(
        'Email',
        personalInformation.email,
        {
          helperText:
            'To change your email address, please contact your support team.',
        },
      )}
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
        <AppTextField
          label="Country Code"
          value={`+${personalInformation.countryCode}`}
          onChangeText={text =>
            updatePersonalInformation(
              'countryCode',
              text.replace(/[^0-9]/g, '').slice(0, 4),
            )
          }
          placeholder="+91"
          containerStyle={[styles.field, styles.countryCodeField]}
          keyboardType="phone-pad"
        />
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

      <View style={styles.infoBanner}>
        <Icon name="information-outline" size={18} color="#1d4ed8" />
        <Text style={styles.infoBannerText}>
          Email cannot be changed from the app — contact your support team if
          you need to update it.
        </Text>
      </View>

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
          fullWidth={false}
          label="Save Changes"
          loading={isSaving}
          loadingLabel="Saving..."
          disabled={!isDirty}
          onPress={handleSavePersonalInformation}
          style={styles.saveButtonDisabled}
        />
      </View>

      <View style={styles.sectionDivider} />

      <View style={styles.subSection}>
        <Text style={styles.subSectionTitle}>Social Links</Text>
        <AppTextField
          label="LinkedIn URL"
          value={personalInformation.linkedinUrl}
          onChangeText={text => {
            updatePersonalInformation('linkedinUrl', text);
            if (socialLinkErrors.linkedin) {
              setSocialLinkErrors(prev => ({...prev, linkedin: undefined}));
            }
          }}
          placeholder="https://linkedin.com/in/your-handle"
          error={socialLinkErrors.linkedin}
          autoCapitalize="none"
          keyboardType="url"
          containerStyle={styles.field}
        />
        <AppTextField
          label="X / Twitter URL"
          value={personalInformation.twitterUrl}
          onChangeText={text => {
            updatePersonalInformation('twitterUrl', text);
            if (socialLinkErrors.twitter) {
              setSocialLinkErrors(prev => ({...prev, twitter: undefined}));
            }
          }}
          placeholder="https://x.com/your-handle"
          error={socialLinkErrors.twitter}
          autoCapitalize="none"
          keyboardType="url"
          containerStyle={styles.field}
        />
        <View style={styles.formFooter}>
          <AppButton
            fullWidth={false}
            label="Save Social Links"
            loading={isSavingSocialLinks}
            loadingLabel="Saving..."
            onPress={handleSaveSocialLinks}
          />
        </View>
      </View>

      <View style={styles.sectionDivider} />

      <View style={styles.toggleRow}>
        <View style={styles.toggleCopy}>
          <Text style={styles.toggleTitle}>Subscribe to newsletter</Text>
          <Text style={styles.toggleHint}>
            Receive product updates and announcements over email.
          </Text>
        </View>
        <Switch
          value={personalInformation.subscribeToNewsletter}
          onValueChange={handleNewsletterToggle}
          disabled={isSavingNewsletter}
          trackColor={{false: '#cbd5e1', true: `${primaryColor}55`}}
          thumbColor={
            personalInformation.subscribeToNewsletter
              ? primaryColor
              : '#f1f5f9'
          }
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
    <AppCard
      style={styles.deleteCard}
      header={
        <Text style={[styles.deleteTitle, {color: dangerColor}]}>
          Delete Account
        </Text>
      }>
      <View style={styles.sectionDivider} />
      <Text style={styles.deleteBody}>
        Deleting your account permanently removes your profile, data, and
        connections from the platform. This action cannot be undone.
      </Text>
      <View style={styles.deleteFooter}>
        <AppButton
          fullWidth={false}
          label="Delete Account"
          onPress={() => setIsDeleteModalVisible(true)}
          style={[styles.deleteButton, {backgroundColor: dangerColor}]}
          labelStyle={styles.deleteButtonLabel}
        />
      </View>
    </AppCard>
  );

  const renderAvailabilityOption = (
    value: AvailabilityMode,
    label: string,
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
          active && {borderColor: primaryColor},
        ]}>
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
        <Text style={styles.availabilityOptionText}>{label}</Text>
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
        size={18}
        color={disabled ? '#cbd5e1' : '#94a3b8'}
      />
    </Pressable>
  );

  const renderAvailabilityTableHeader = (label: 'Day' | 'Date') => (
    <View style={styles.tableHeaderRow}>
      <Text style={[styles.tableHeaderText, styles.tableDayColumn]}>
        {label}
      </Text>
      <Text style={[styles.tableHeaderText, styles.tableCheckColumn]}>
        Not Available
      </Text>
      <Text style={[styles.tableHeaderText, styles.tableTimeColumn]}>
        Time From
      </Text>
      <Text style={[styles.tableHeaderText, styles.tableTimeColumn]}>
        Time To
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
          {renderAvailabilityOption('anytime', 'Anytime')}
          {renderAvailabilityOption(
            'temporary-unavailable',
            'Temporary Unavailable',
          )}
          {renderAvailabilityOption('specific-days', 'Specific Days')}
        </View>

        {showWeeklySchedule ? (
          <View style={styles.availabilityTableSection}>
            {renderAvailabilityTableHeader('Day')}
            {weeklyAvailability.map(row => (
              <View key={row.dayKey} style={styles.tableBodyRow}>
                <Text style={[styles.tableBodyText, styles.tableDayColumn]}>
                  {row.label}
                </Text>
                <View style={[styles.tableCheckColumn, styles.checkCellWrap]}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{checked: row.unavailable}}
                    onPress={() =>
                      updateWeeklyAvailability(row.dayKey, {
                        unavailable: !row.unavailable,
                      })
                    }
                    style={[
                      styles.checkbox,
                      row.unavailable && {borderColor: primaryColor},
                    ]}>
                    {row.unavailable ? (
                      <Icon name="check" size={16} color={primaryColor} />
                    ) : null}
                  </Pressable>
                </View>
                <View style={styles.tableTimeColumn}>
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
                <View style={styles.tableTimeColumn}>
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
            ))}
          </View>
        ) : null}

        {showSpecificDatesSection ? (
          <View style={styles.availabilityTableSection}>
            <Text style={styles.availabilitySectionTitle}>Specific Dates</Text>
            {renderAvailabilityTableHeader('Date')}
            {specificDateRows.length === 0 ? (
              <View style={styles.emptySpecificDatesRow}>
                <Text style={styles.emptySpecificDatesText}>
                  No specific dates added yet
                </Text>
              </View>
            ) : (
              specificDateRows.map(row => (
                <View key={row.id} style={styles.tableBodyRow}>
                  <Text style={[styles.tableBodyText, styles.tableDayColumn]}>
                    {row.dateLabel}
                  </Text>
                  <View style={[styles.tableCheckColumn, styles.checkCellWrap]}>
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{checked: row.unavailable}}
                      onPress={() =>
                        updateSpecificDateRow(row.id, {
                          unavailable: !row.unavailable,
                        })
                      }
                      style={[
                        styles.checkbox,
                        row.unavailable && {borderColor: primaryColor},
                      ]}>
                      {row.unavailable ? (
                        <Icon name="check" size={16} color={primaryColor} />
                      ) : null}
                    </Pressable>
                  </View>
                  <View style={styles.tableTimeColumn}>
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
                  <View style={styles.tableTimeColumn}>
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
              ))
            )}

            {isAddingSpecificDate ? (
              <View style={styles.addDateCard}>
                <Text style={styles.addDateTitle}>Add a date</Text>
                <View style={styles.addDateDivider} />
                <View style={styles.addDateRow}>
                  <AppTextField
                    value={newSpecificDate.dateLabel}
                    onChangeText={text =>
                      setNewSpecificDate(current => ({
                        ...current,
                        dateLabel: text,
                      }))
                    }
                    placeholder="yyyy-mm-dd"
                    containerStyle={styles.addDateField}
                  />
                  <View style={styles.addDateCheckWrap}>
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{
                        checked: newSpecificDate.unavailable,
                      }}
                      onPress={() =>
                        setNewSpecificDate(current => ({
                          ...current,
                          unavailable: !current.unavailable,
                          fromTime: !current.unavailable ? '' : current.fromTime,
                          toTime: !current.unavailable ? '' : current.toTime,
                        }))
                      }
                      style={[
                        styles.checkbox,
                        newSpecificDate.unavailable && {
                          borderColor: primaryColor,
                        },
                      ]}>
                      {newSpecificDate.unavailable ? (
                        <Icon name="check" size={16} color={primaryColor} />
                      ) : null}
                    </Pressable>
                    <Text style={styles.addDateCheckLabel}>Not available</Text>
                  </View>
                  <View style={styles.addDateTimeWrap}>
                    {renderTimeCell(
                      newSpecificDate.fromTime,
                      () => setTimePickerTarget({kind: 'new-from'}),
                      newSpecificDate.unavailable,
                    )}
                  </View>
                  <View style={styles.addDateTimeWrap}>
                    {renderTimeCell(
                      newSpecificDate.toTime,
                      () => setTimePickerTarget({kind: 'new-to'}),
                      newSpecificDate.unavailable,
                    )}
                  </View>
                </View>
                <View style={styles.addDateActions}>
                  <AppButton
                    fullWidth={false}
                    label="Save"
                    onPress={handleSaveNewSpecificDate}
                    style={[
                      styles.addDateSaveButton,
                      {backgroundColor: primaryColor},
                    ]}
                  />
                  <AppButton
                    fullWidth={false}
                    label="Cancel"
                    onPress={handleCancelNewSpecificDate}
                    style={[styles.addDateCancelButton, {backgroundColor: secondaryColor}]}
                    labelStyle={styles.addDateCancelLabel}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.addNewRow}>
                <AppButton
                  fullWidth={false}
                  label="+ Add new"
                  onPress={addSpecificDateRow}
                  style={[styles.addNewButton, {backgroundColor: secondaryColor}]}
                  labelStyle={styles.addNewButtonLabel}
                />
              </View>
            )}
          </View>
        ) : null}

        {availabilitySaveMessage ? (
          <View
            style={[
              styles.saveMessage,
              availabilitySaveMessage.tone === 'success'
                ? styles.saveMessageSuccess
                : styles.saveMessageError,
            ]}>
            <Text
              style={[
                styles.saveMessageText,
                {
                  color:
                    availabilitySaveMessage.tone === 'success'
                      ? successColor
                      : dangerColor,
                },
              ]}>
              {availabilitySaveMessage.text}
            </Text>
          </View>
        ) : null}

        <View style={styles.formFooter}>
          <AppButton
            fullWidth={false}
            label="Save"
            onPress={handleSaveAvailability}
            style={styles.saveButtonDisabled}
          />
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
              Review your account information and keep unsupported actions safely
              gated until their mobile APIs are ready.
            </Text>
          </View>

          <AppButton
            fullWidth={false}
            label="Leave Feedback"
            onPress={() => setIsFeedbackModalVisible(true)}
            variant="secondary"
            style={styles.feedbackButton}
          />
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
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 20,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  headerCopy: {
    flex: 1,
    minWidth: 240,
  },
  pageTitle: {
    color: '#0f172a',
    fontSize: 30,
    fontWeight: '800',
  },
  pageSubtitle: {
    color: '#64748b',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
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
    marginBottom: 18,
    marginHorizontal: -20,
  },
  availabilityLabel: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 16,
  },
  availabilityOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  availabilityOption: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#dbe4ef',
    borderRadius: 16,
    borderStyle: 'dashed',
    borderWidth: 1,
    flexDirection: 'row',
    minWidth: 200,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  availabilityOptionText: {
    color: '#1e293b',
    fontSize: 14,
    fontWeight: '600',
  },
  radioOuter: {
    alignItems: 'center',
    borderColor: '#e2e8f0',
    borderRadius: 14,
    borderWidth: 2,
    height: 28,
    justifyContent: 'center',
    marginRight: 10,
    width: 28,
  },
  radioInner: {
    borderRadius: 8,
    height: 14,
    width: 14,
  },
  availabilityTableSection: {
    marginTop: 28,
  },
  availabilitySectionTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 14,
  },
  tableHeaderRow: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  tableHeaderText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
  },
  tableBodyRow: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopWidth: 1,
    flexDirection: 'row',
    minHeight: 80,
    paddingHorizontal: 12,
  },
  tableBodyText: {
    color: '#1e293b',
    fontSize: 14,
    fontWeight: '700',
  },
  tableDayColumn: {
    flex: 1.2,
  },
  tableCheckColumn: {
    flex: 1,
  },
  tableTimeColumn: {
    flex: 1.2,
    marginLeft: 10,
  },
  checkCellWrap: {
    alignItems: 'center',
  },
  checkbox: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 10,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  timeCell: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 46,
    paddingHorizontal: 12,
  },
  timeCellDisabled: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  timeCellText: {
    color: '#334155',
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
  emptySpecificDatesRow: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  emptySpecificDatesText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '500',
  },
  addNewRow: {
    borderColor: '#e2e8f0',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  addNewButton: {
    backgroundColor: '#1e1f3a',
    minWidth: 140,
  },
  addNewButtonLabel: {
    color: '#ffffff',
  },
  addDateCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 14,
    padding: 18,
  },
  addDateTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
  addDateDivider: {
    backgroundColor: '#e2e8f0',
    height: 1,
    marginHorizontal: -18,
    marginTop: 14,
  },
  addDateRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 16,
  },
  addDateField: {
    flexGrow: 1,
    flexShrink: 1,
    marginTop: 0,
    minWidth: 200,
  },
  addDateCheckWrap: {
    alignItems: 'center',
    flexDirection: 'column',
    gap: 6,
    paddingBottom: 4,
  },
  addDateCheckLabel: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  addDateTimeWrap: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 160,
  },
  addDateActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  addDateSaveButton: {
    minWidth: 120,
  },
  addDateCancelButton: {
    backgroundColor: '#1e1f3a',
    minWidth: 120,
  },
  addDateCancelLabel: {
    color: '#ffffff',
  },
  photoSection: {
    marginBottom: 12,
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
    backgroundColor: '#f8fafc',
    borderColor: '#dbe4ef',
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 132,
    minWidth: 132,
    padding: 8,
    position: 'relative',
  },
  photoImage: {
    borderRadius: 14,
    height: 116,
    width: 116,
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 116,
    minWidth: 116,
  },
  photoPlaceholderText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
  },
  photoBadge: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    position: 'absolute',
    right: -6,
    top: -8,
    width: 32,
  },
  photoCopy: {
    flex: 1,
    minWidth: 200,
  },
  photoHintTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
  },
  photoHintBody: {
    color: '#64748b',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
  },
  photoAction: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
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
    alignItems: 'flex-end',
    marginTop: 22,
  },
  saveButtonDisabled: {
    minWidth: 170,
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
