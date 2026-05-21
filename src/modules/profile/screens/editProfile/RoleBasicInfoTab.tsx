import React, {useContext, useEffect, useState} from 'react';
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {launchImageLibrary} from 'react-native-image-picker';
import {pick, types} from '@react-native-documents/picker';

import {AppButton} from '../../../../core/components/AppButton';
import {AppTextField} from '../../../../core/components/AppTextField';
import {Icon} from '../../../../core/components/Icon';
import {useFormValidation} from '../../../../core/form/useFormValidation';
import {
  combine,
  facebookUrl,
  instagramUrl,
  linkedinUrl,
  required,
  twitterUrl,
  url,
  Validator,
  youtubeUrl,
} from '../../../../core/form/validators';
import {TenantContext} from '../../../../core/tenant/TenantProvider';

import {authService} from '../../../auth/services/auth.service';
import {
  MultiSelectField,
  MultiSelectOption,
} from './MultiSelectField';
import {Picker} from './Picker';
import type {InvestorSubtype} from './tabConfig';

// Field key in the API response/payload for this role's "basic info" tab.
type FieldKey =
  | 'companyName'
  | 'organizationName'
  | 'name'
  | 'aboutUs'
  | 'briefDescription'
  | 'shortDescription'
  | 'designation'
  | 'currentOrganization'
  | 'portfolioSize'
  | 'keyInvestments'
  | 'displayWebsite'
  | 'website'
  | 'websiteUrl'
  | 'linkedinUrl'
  | 'twitterUrl'
  | 'facebookUrl'
  | 'instagramUrl'
  | 'youtubeUrl'
  | 'size'
  | 'establishmentYear'
  | 'organizationTypeId'
  | 'registeredCountryId'
  | 'registeredStateId'
  | 'registeredCityId'
  | 'providerTypeId'
  | 'provideCategoryId';

type FieldConfig = {
  key: FieldKey;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'email-address' | 'url' | 'numeric';
  required?: boolean;
  validator?: Validator;
  // 'dropdown' renders a Pressable that opens a Picker; options keyed by
  // `dropdownSource` in the parent-supplied `dropdownData` prop.
  kind?: 'text' | 'dropdown';
  dropdownSource?: string;
};

export type DropdownDataMap = Record<
  string,
  Array<{id: number | string; name: string}>
>;

type RoleKey =
  | 'investor:organization'
  | 'investor:individual'
  | 'corporate'
  | 'mentor'
  | 'service_provider';

// Each role's field list mirrors the primary fields of the corresponding
// frontend basic-info tab. Required + format validators match the frontend's
// FormGroup definitions on each role's edit page.
const ROLE_FIELDS: Record<RoleKey, FieldConfig[]> = {
  'investor:organization': [
    {key: 'organizationName', label: 'Organization Name', required: true},
    {
      key: 'organizationTypeId',
      label: 'Organization Type',
      required: true,
      kind: 'dropdown',
      dropdownSource: 'organization_types',
    },
    {
      key: 'establishmentYear',
      label: 'Establishment Year',
      required: true,
      keyboardType: 'numeric',
    },
    {key: 'aboutUs', label: 'About', multiline: true, required: true},
    {key: 'portfolioSize', label: 'Portfolio Size', keyboardType: 'numeric'},
    {
      key: 'registeredCountryId',
      label: 'Country',
      kind: 'dropdown',
      dropdownSource: 'countries',
      required: true,
    },
    {
      key: 'registeredStateId',
      label: 'State',
      kind: 'dropdown',
      dropdownSource: 'states',
    },
    {
      key: 'registeredCityId',
      label: 'City',
      kind: 'dropdown',
      dropdownSource: 'cities',
    },
    {key: 'displayWebsite', label: 'Website', keyboardType: 'url'},
    {key: 'linkedinUrl', label: 'LinkedIn URL', keyboardType: 'url'},
    {key: 'twitterUrl', label: 'Twitter / X URL', keyboardType: 'url'},
  ],
  'investor:individual': [
    {key: 'organizationName', label: 'Your Name', required: true},
    {key: 'aboutUs', label: 'About', multiline: true, required: true},
    {
      key: 'keyInvestments',
      label: 'Key Investments',
      multiline: true,
      placeholder: 'Brief summary of notable portfolio companies',
      required: true,
    },
    {key: 'portfolioSize', label: 'Portfolio Size', keyboardType: 'numeric'},
    {
      key: 'registeredCountryId',
      label: 'Country',
      kind: 'dropdown',
      dropdownSource: 'countries',
    },
    {
      key: 'registeredStateId',
      label: 'State',
      kind: 'dropdown',
      dropdownSource: 'states',
    },
    {
      key: 'registeredCityId',
      label: 'City',
      kind: 'dropdown',
      dropdownSource: 'cities',
    },
    {key: 'displayWebsite', label: 'Website', keyboardType: 'url'},
    {key: 'linkedinUrl', label: 'LinkedIn URL', keyboardType: 'url', required: true},
    {key: 'twitterUrl', label: 'Twitter / X URL', keyboardType: 'url'},
  ],
  corporate: [
    {key: 'companyName', label: 'Company Name', required: true},
    {
      key: 'size',
      label: 'Company Size',
      kind: 'dropdown',
      dropdownSource: 'corporate_sizes',
      required: true,
    },
    {
      key: 'briefDescription',
      label: 'Brief Description',
      multiline: true,
      required: true,
    },
    {
      key: 'registeredCountryId',
      label: 'Country',
      kind: 'dropdown',
      dropdownSource: 'countries',
      required: true,
    },
    {
      key: 'registeredStateId',
      label: 'State',
      kind: 'dropdown',
      dropdownSource: 'states',
    },
    {
      key: 'registeredCityId',
      label: 'City',
      kind: 'dropdown',
      dropdownSource: 'cities',
    },
    {key: 'website', label: 'Website', keyboardType: 'url'},
    {key: 'linkedinUrl', label: 'LinkedIn URL', keyboardType: 'url'},
    {key: 'twitterUrl', label: 'Twitter / X URL', keyboardType: 'url'},
    {key: 'facebookUrl', label: 'Facebook URL', keyboardType: 'url'},
    {key: 'instagramUrl', label: 'Instagram URL', keyboardType: 'url'},
    {key: 'youtubeUrl', label: 'YouTube URL', keyboardType: 'url'},
  ],
  mentor: [
    {key: 'name', label: 'Full Name', required: true},
    {key: 'shortDescription', label: 'Headline', required: true},
    {key: 'briefDescription', label: 'About you', multiline: true, required: true},
    {key: 'designation', label: 'Designation'},
    {key: 'currentOrganization', label: 'Current Organization'},
    {
      key: 'registeredCountryId',
      label: 'Country',
      kind: 'dropdown',
      dropdownSource: 'countries',
      required: true,
    },
    {
      key: 'registeredStateId',
      label: 'State',
      kind: 'dropdown',
      dropdownSource: 'states',
    },
    {
      key: 'registeredCityId',
      label: 'City',
      kind: 'dropdown',
      dropdownSource: 'cities',
    },
    {key: 'websiteUrl', label: 'Website', keyboardType: 'url'},
    {key: 'linkedinUrl', label: 'LinkedIn URL', keyboardType: 'url', required: true},
    {key: 'twitterUrl', label: 'X URL', keyboardType: 'url'},
    {key: 'facebookUrl', label: 'Facebook URL', keyboardType: 'url'},
    {key: 'instagramUrl', label: 'Instagram URL', keyboardType: 'url'},
    {key: 'youtubeUrl', label: 'YouTube URL', keyboardType: 'url'},
  ],
  service_provider: [
    {key: 'name', label: 'Company Name', required: true},
    {
      key: 'providerTypeId',
      label: 'Profile Type',
      kind: 'dropdown',
      dropdownSource: 'service_provider_types',
      required: true,
    },
    {
      key: 'provideCategoryId',
      label: 'Category',
      kind: 'dropdown',
      dropdownSource: 'service_provider_categories',
      required: true,
    },
    {
      key: 'briefDescription',
      label: 'Brief Description',
      multiline: true,
      required: true,
    },
    {
      key: 'registeredCountryId',
      label: 'Country',
      kind: 'dropdown',
      dropdownSource: 'countries',
      required: true,
    },
    {
      key: 'registeredStateId',
      label: 'State',
      kind: 'dropdown',
      dropdownSource: 'states',
    },
    {
      key: 'registeredCityId',
      label: 'City',
      kind: 'dropdown',
      dropdownSource: 'cities',
    },
    {key: 'website', label: 'Website', keyboardType: 'url'},
    {key: 'linkedinUrl', label: 'LinkedIn URL', keyboardType: 'url'},
    {key: 'twitterUrl', label: 'X URL', keyboardType: 'url'},
    {key: 'facebookUrl', label: 'Facebook URL', keyboardType: 'url'},
    {key: 'instagramUrl', label: 'Instagram URL', keyboardType: 'url'},
    {key: 'youtubeUrl', label: 'YouTube URL', keyboardType: 'url'},
  ],
};

// Platform-specific URL validators (match frontend's shared/constants/regex.ts).
// Falls back to the generic `url` validator for keys we don't have a regex for.
const URL_VALIDATOR_BY_KEY: Record<string, Validator> = {
  linkedinUrl,
  twitterUrl,
  facebookUrl,
  instagramUrl,
  youtubeUrl,
};

// Pre-compute per-field validators based on the FieldConfig flags.
const buildValidators = (
  fields: FieldConfig[],
): Record<string, Validator> => {
  const map: Record<string, Validator> = {};
  fields.forEach(field => {
    const validators: Validator[] = [];
    if (field.required) {
      validators.push(required(field.label));
    }
    if (field.keyboardType === 'url') {
      validators.push(URL_VALIDATOR_BY_KEY[field.key] || url);
    }
    if (field.validator) {
      validators.push(field.validator);
    }
    if (validators.length > 0) {
      map[field.key] = validators.length === 1 ? validators[0] : combine(...validators);
    }
  });
  return map;
};

const resolveRoleKey = (
  accountType: string,
  investorSubtype: InvestorSubtype,
): RoleKey | null => {
  // Fold hyphen + space variants to the canonical underscored slug so the
  // role-key switch below stays single-source-of-truth.
  const type = accountType.toLowerCase().replace(/[-\s]+/g, '_');
  if (type === 'investor') {
    return investorSubtype === 'individual'
      ? 'investor:individual'
      : 'investor:organization';
  }
  if (type === 'corporate') {
    return 'corporate';
  }
  if (type === 'mentor') {
    return 'mentor';
  }
  if (type === 'service_provider') {
    return 'service_provider';
  }
  return null;
};

type Props = {
  accountType: string;
  investorSubtype: InvestorSubtype;
  initialData: Record<string, any> | null;
  primaryColor: string;
  isSaving?: boolean;
  onSave: (payload: Record<string, any>) => Promise<void> | void;
  // Dropdown option lists keyed by `dropdownSource`. Parent fetches these
  // (e.g. organization_types from /api/v1/public/global/custom/...).
  dropdownData?: DropdownDataMap;
  // Optional — only investors currently support logo upload via the
  // /api/v1/investors/upload/logo endpoint. Mentor/corporate omit this prop.
  token?: string;
  onLogoUploaded?: () => void;
  // Corporate role only: industries available to choose from. Each entry may
  // carry nested industrySubCategoryDomains for the sub-category UI gated by
  // globalSetting.features.enable_sub_industries.
  industryOptions?: MultiSelectOption[];
};

export function RoleBasicInfoTab({
  accountType,
  investorSubtype,
  initialData,
  primaryColor,
  isSaving = false,
  onSave,
  dropdownData = {},
  token,
  onLogoUploaded,
  industryOptions = [],
}: Props) {
  const roleKey = resolveRoleKey(accountType, investorSubtype);
  const fields = roleKey ? ROLE_FIELDS[roleKey] : [];

  const form = useFormValidation({
    initial: seedValues(fields, initialData),
    validators: buildValidators(fields),
  });

  // Tracks which dropdown picker is open. null = none.
  const [activeDropdown, setActiveDropdown] = useState<FieldConfig | null>(
    null,
  );

  // Country/State/City — fetched dynamically from the tenant API. State
  // depends on country, city depends on state — same pattern as the startup
  // BasicInfoForm in EditProfileScreen.
  const {baseUrl, globalSetting} = useContext(TenantContext);
  const logoBaseUrl =
    globalSetting?.imgKitUrl || globalSetting?.assetsImgKitUrl || '';

  // Logo upload — investor only. Local URI shows the just-picked image as a
  // preview while the upload is in flight; on success the parent re-fetches
  // the profile and `initialData.companyLogo` (or .avatar) becomes the
  // canonical URL.
  const [localLogoUri, setLocalLogoUri] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  // Connection document — org-investor only. Toggle controls whether the
  // investor requires startups to upload a one-pager when reaching out;
  // when on, the investor uploads a sample/template doc as reference.
  const initialAskForConnDoc = Boolean(initialData?.askForConnectionDocument);
  const [askForConnDoc, setAskForConnDoc] = useState(initialAskForConnDoc);
  const [connDocName, setConnDocName] = useState<string>(
    initialData?.connectionRequestDocument?.fileName ||
      initialData?.connectionRequestDocument ||
      '',
  );
  const [connDocUploading, setConnDocUploading] = useState(false);

  useEffect(() => {
    setAskForConnDoc(Boolean(initialData?.askForConnectionDocument));
    setConnDocName(
      initialData?.connectionRequestDocument?.fileName ||
        initialData?.connectionRequestDocument ||
        '',
    );
  }, [initialData]);

  // Corporate industries / sub-categories / "others" — all saved as part of
  // the corporate-information PATCH (frontend submits these in the same
  // payload as basic info).
  const features = globalSetting?.features || {};
  const industriesSectionEnabled = Boolean(
    features.industries_technologies_section,
  );
  const subIndustriesEnabled = Boolean(features.enable_sub_industries);
  const [selectedIndustryIds, setSelectedIndustryIds] = useState<
    Array<number | string>
  >([]);
  const [selectedSubCategoryIds, setSelectedSubCategoryIds] = useState<
    Array<number | string>
  >([]);
  const [otherIndustriesActive, setOtherIndustriesActive] = useState(false);
  const [otherIndustriesText, setOtherIndustriesText] = useState('');

  useEffect(() => {
    const inds = Array.isArray(initialData?.sectoralInterestIds)
      ? initialData.sectoralInterestIds
          .map((id: any) => Number(id))
          .filter((n: number) => Number.isFinite(n))
      : [];
    setSelectedIndustryIds(inds);
    const subs = Array.isArray(initialData?.sectoralInterestSubIds)
      ? initialData.sectoralInterestSubIds
          .map((id: any) => Number(id))
          .filter((n: number) => Number.isFinite(n))
      : [];
    setSelectedSubCategoryIds(subs);
    const others = Array.isArray(initialData?.sectoralInterestOthers)
      ? initialData.sectoralInterestOthers
      : [];
    setOtherIndustriesActive(others.length > 0);
    setOtherIndustriesText(others.join(','));
  }, [initialData]);
  const investorLogo =
    initialData?.companyLogo || initialData?.avatar || initialData?.logo || '';
  const resolvedLogo = localLogoUri
    ? localLogoUri
    : investorLogo
      ? investorLogo.startsWith('http')
        ? investorLogo
        : `${logoBaseUrl}${investorLogo}`
      : null;
  const isInvestor = roleKey?.startsWith('investor');
  const isCorporate = roleKey === 'corporate';
  const isMentor = roleKey === 'mentor';
  const isServiceProvider = roleKey === 'service_provider';
  // Investor (org + individual), corporate, mentor, and service-provider
  // roles all support a logo / profile-photo upload — same UI, different
  // endpoint chosen at upload time.
  const supportsLogoUpload =
    isInvestor || isCorporate || isMentor || isServiceProvider;
  const [countryOptions, setCountryOptions] = useState<
    Array<{id: number; name: string}>
  >([]);
  const [stateOptions, setStateOptions] = useState<
    Array<{id: number; name: string}>
  >([]);
  const [cityOptions, setCityOptions] = useState<
    Array<{id: number; name: string}>
  >([]);

  useEffect(() => {
    if (!baseUrl) return;
    let cancelled = false;
    fetch(`${baseUrl}api/v1/public/global/countries`)
      .then(r => r.json())
      .then(payload => {
        if (cancelled) return;
        const list = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.results)
            ? payload.results
            : [];
        setCountryOptions(
          list
            .map((item: any) => ({
              id: Number(item?.id),
              name: String(item?.name || ''),
            }))
            .filter((c: any) => Number.isFinite(c.id) && c.name),
        );
      })
      .catch(() => setCountryOptions([]));
    return () => {
      cancelled = true;
    };
  }, [baseUrl]);

  const countryId = Number(form.values.registeredCountryId);
  useEffect(() => {
    if (!baseUrl || !Number.isFinite(countryId) || countryId === 0) {
      setStateOptions([]);
      return;
    }
    let cancelled = false;
    fetch(`${baseUrl}api/v1/public/global/states/${countryId}`)
      .then(r => r.json())
      .then(payload => {
        if (cancelled) return;
        const list = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.results)
            ? payload.results
            : [];
        setStateOptions(
          list
            .map((item: any) => ({
              id: Number(item?.id),
              name: String(item?.name || ''),
            }))
            .filter((c: any) => Number.isFinite(c.id) && c.name),
        );
      })
      .catch(() => setStateOptions([]));
    return () => {
      cancelled = true;
    };
  }, [baseUrl, countryId]);

  const stateId = Number(form.values.registeredStateId);
  useEffect(() => {
    if (!baseUrl || !Number.isFinite(stateId) || stateId === 0) {
      setCityOptions([]);
      return;
    }
    let cancelled = false;
    fetch(`${baseUrl}api/v1/public/global/cities/${stateId}`)
      .then(r => r.json())
      .then(payload => {
        if (cancelled) return;
        const list = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.results)
            ? payload.results
            : [];
        setCityOptions(
          list
            .map((item: any) => ({
              id: Number(item?.id),
              name: String(item?.name || ''),
            }))
            .filter((c: any) => Number.isFinite(c.id) && c.name),
        );
      })
      .catch(() => setCityOptions([]));
    return () => {
      cancelled = true;
    };
  }, [baseUrl, stateId]);

  useEffect(() => {
    form.reset(seedValues(fields, initialData));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData, roleKey]);

  if (!roleKey) {
    return null;
  }

  const handleLogoPress = async () => {
    if (!supportsLogoUpload || !token) return;
    try {
      if (typeof launchImageLibrary !== 'function') {
        Alert.alert(
          'Logo upload unavailable',
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
          'Logo upload failed',
          result.errorMessage || 'Could not open the image picker.',
        );
        return;
      }
      const asset = result.assets?.[0];
      if (!asset?.uri) {
        Alert.alert('Logo upload failed', 'No image was selected.');
        return;
      }
      const fileSize = asset.fileSize ?? 0;
      if (fileSize > 512 * 1024) {
        Alert.alert(
          'Image too large',
          'Please choose an image smaller than 512kb.',
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

      setLocalLogoUri(asset.uri);
      setLogoUploading(true);
      try {
        const file = {
          uri: asset.uri,
          name: asset.fileName || `logo-${Date.now()}.jpg`,
          type: mimeType || 'image/jpeg',
        };
        if (isCorporate) {
          await authService.uploadCorporateLogo(token, file);
        } else if (isMentor) {
          await authService.uploadMentorLogo(token, file);
        } else if (isServiceProvider) {
          await authService.uploadServiceProviderLogo(token, file);
        } else {
          await authService.uploadInvestorLogo(token, file);
        }
        onLogoUploaded?.();
      } catch (uploadError) {
        setLocalLogoUri(null);
        Alert.alert(
          'Logo upload failed',
          uploadError instanceof Error
            ? uploadError.message
            : 'Could not upload your logo.',
        );
      } finally {
        setLogoUploading(false);
      }
    } catch (error) {
      Alert.alert(
        'Logo upload failed',
        error instanceof Error ? error.message : 'Could not select the image.',
      );
    }
  };

  const handleConnDocPick = async () => {
    if (!token) return;
    try {
      const [picked] = await pick({type: [types.pdf, types.allFiles]});
      if (!picked?.uri) return;
      const name = picked.name || `connection-doc-${Date.now()}.pdf`;
      const mimeType = picked.type || 'application/pdf';
      setConnDocUploading(true);
      try {
        await authService.uploadInvestorConnectionDocument(token, {
          uri: picked.uri,
          name,
          type: mimeType,
        });
        setConnDocName(name);
        onLogoUploaded?.();
      } catch (uploadError) {
        Alert.alert(
          'Upload failed',
          uploadError instanceof Error
            ? uploadError.message
            : 'Could not upload the document.',
        );
      } finally {
        setConnDocUploading(false);
      }
    } catch (e: any) {
      if (e?.code !== 'DOCUMENT_PICKER_CANCELED') {
        Alert.alert(
          'Upload failed',
          e instanceof Error ? e.message : 'Could not pick a file.',
        );
      }
    }
  };

  // Pulls dropdown options either from the parent-supplied map (e.g.
  // organization_types, corporate_sizes) or from the locally-fetched
  // location lists. Values may be numeric IDs or string codes (e.g. "1-10"
  // for company sizes) — see labelForDropdown for the string-safe match.
  const optionsForDropdown = (
    field: FieldConfig,
  ): Array<{id: number | string; name: string}> => {
    if (!field.dropdownSource) return [];
    if (field.dropdownSource === 'countries') return countryOptions;
    if (field.dropdownSource === 'states') return stateOptions;
    if (field.dropdownSource === 'cities') return cityOptions;
    return dropdownData[field.dropdownSource] || [];
  };

  const labelForDropdown = (field: FieldConfig): string => {
    const raw = form.values[field.key];
    if (!raw) return '';
    const option = optionsForDropdown(field).find(
      opt => String(opt.id) === String(raw),
    );
    return option?.name || '';
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Basic Information</Text>
      <Text style={styles.subtitle}>
        Keep these details up to date so the rest of the platform can recognise
        your profile.
      </Text>

      {supportsLogoUpload && token ? (
        <View style={styles.logoSection}>
          <Pressable
            onPress={handleLogoPress}
            style={[styles.logoBox, {borderColor: `${primaryColor}40`}]}>
            {resolvedLogo ? (
              <Image source={{uri: resolvedLogo}} style={styles.logoImage} />
            ) : (
              <Icon name="image-plus" size={28} color="#94a3b8" />
            )}
          </Pressable>
          <View style={styles.logoCopy}>
            <Text style={styles.logoLabel}>
              {isCorporate || isServiceProvider
                ? 'Company logo'
                : isMentor
                  ? 'Profile photo'
                  : investorSubtype === 'individual'
                    ? 'Profile photo'
                    : 'Organization logo'}
            </Text>
            <Text style={styles.logoHint}>
              {logoUploading
                ? 'Uploading…'
                : 'PNG, JPG, or JPEG up to 512kb.'}
            </Text>
            <Pressable
              onPress={handleLogoPress}
              disabled={logoUploading}
              style={styles.logoChangeBtn}>
              <Text style={[styles.logoChangeText, {color: primaryColor}]}>
                {resolvedLogo ? 'Change' : 'Upload'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {fields.map(field => {
        if (field.kind === 'dropdown') {
          const display = labelForDropdown(field);
          const errorText = form.errors[field.key];
          return (
            <View key={field.key} style={styles.dropdownField}>
              <Text style={styles.dropdownLabel}>
                {field.label}
                {field.required ? (
                  <Text style={styles.requiredMark}> *</Text>
                ) : null}
              </Text>
              <Pressable
                style={[
                  styles.dropdownInput,
                  errorText ? styles.dropdownInputError : null,
                ]}
                onPress={() => {
                  form.setTouched(field.key);
                  setActiveDropdown(field);
                }}>
                <Text
                  style={[
                    styles.dropdownText,
                    !display && styles.dropdownPlaceholder,
                  ]}>
                  {display || `Choose ${field.label.toLowerCase()}`}
                </Text>
                <Icon name="chevron-down" size={18} color="#64748b" />
              </Pressable>
              {errorText ? (
                <Text style={styles.dropdownError}>{errorText}</Text>
              ) : null}
            </View>
          );
        }

        return (
          <AppTextField
            key={field.key}
            label={field.label}
            required={field.required}
            error={form.errors[field.key]}
            placeholder={field.placeholder}
            keyboardType={field.keyboardType}
            multiline={field.multiline}
            autoCapitalize={
              field.keyboardType === 'url' ||
              field.keyboardType === 'email-address'
                ? 'none'
                : undefined
            }
            value={form.values[field.key] || ''}
            onChangeText={text => {
              const next =
                field.key === 'establishmentYear'
                  ? text.replace(/[^0-9]/g, '').slice(0, 4)
                  : text;
              form.setValue(field.key, next);
            }}
            onBlur={() => form.setTouched(field.key)}
          />
        );
      })}

      {isCorporate && industriesSectionEnabled && industryOptions.length > 0 ? (
        <View style={styles.industriesSection}>
          <Text style={styles.industriesTitle}>Industry / Vertical Focus</Text>
          <Text style={styles.industriesHint}>
            Which sectors do you actively engage with?
          </Text>

          <MultiSelectField
            label="Industries"
            options={industryOptions}
            selected={selectedIndustryIds}
            primaryColor={primaryColor}
            onChange={next => {
              // Drop sub-category picks whose parent industry just got
              // deselected, so the payload stays consistent.
              const visibleSubIds = new Set<number>();
              industryOptions
                .filter(opt => next.includes(opt.id))
                .forEach(opt => {
                  opt.industrySubCategoryDomains?.forEach(sub =>
                    visibleSubIds.add(sub.id),
                  );
                });
              setSelectedIndustryIds(next);
              setSelectedSubCategoryIds(prev =>
                prev.filter(id => visibleSubIds.has(Number(id))),
              );
            }}
            initiallyExpanded
          />

          {subIndustriesEnabled
            ? (() => {
                const subs: Array<{id: number; name: string}> = [];
                const seen = new Set<number>();
                industryOptions
                  .filter(opt => selectedIndustryIds.includes(opt.id))
                  .forEach(opt => {
                    opt.industrySubCategoryDomains?.forEach(sub => {
                      if (!seen.has(sub.id)) {
                        seen.add(sub.id);
                        subs.push(sub);
                      }
                    });
                  });
                if (subs.length === 0) return null;
                return (
                  <MultiSelectField
                    label="Sub-categories"
                    hint="Pick the sub-areas inside your selected industries."
                    options={subs}
                    selected={selectedSubCategoryIds}
                    primaryColor={primaryColor}
                    onChange={setSelectedSubCategoryIds}
                  />
                );
              })()
            : null}

          <View style={styles.otherToggleRow}>
            <Text style={styles.otherToggleLabel}>Add other sectors</Text>
            <Switch
              value={otherIndustriesActive}
              onValueChange={val => {
                setOtherIndustriesActive(val);
                if (!val) setOtherIndustriesText('');
              }}
              trackColor={{false: '#cbd5e1', true: `${primaryColor}55`}}
              thumbColor={otherIndustriesActive ? primaryColor : '#f1f5f9'}
            />
          </View>
          {otherIndustriesActive ? (
            <TextInput
              style={styles.otherInput}
              value={otherIndustriesText}
              onChangeText={setOtherIndustriesText}
              placeholder="Separate multiple entries with commas"
              placeholderTextColor="#94a3b8"
              autoCapitalize="words"
            />
          ) : null}
        </View>
      ) : null}

      {isInvestor && investorSubtype === 'organization' && token ? (
        <View style={styles.connDocSection}>
          <View style={styles.connDocHeader}>
            <View style={styles.connDocHeaderText}>
              <Text style={styles.connDocLabel}>
                Ask for connection document?
              </Text>
              <Text style={styles.connDocHint}>
                Require startups to upload a one-pager before they can reach
                out to you.
              </Text>
            </View>
            <Switch
              value={askForConnDoc}
              onValueChange={setAskForConnDoc}
              trackColor={{false: '#cbd5e1', true: `${primaryColor}55`}}
              thumbColor={askForConnDoc ? primaryColor : '#f1f5f9'}
            />
          </View>
          {askForConnDoc ? (
            <Pressable
              onPress={handleConnDocPick}
              disabled={connDocUploading}
              style={[styles.connDocPicker, {borderColor: `${primaryColor}40`}]}>
              <Icon name="file-document-outline" size={22} color={primaryColor} />
              <Text style={styles.connDocPickerText} numberOfLines={1}>
                {connDocUploading
                  ? 'Uploading…'
                  : connDocName
                    ? connDocName
                    : 'Tap to upload a PDF template'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <AppButton
        label={isSaving ? 'Saving…' : 'Save'}
        disabled={isSaving}
        loading={isSaving}
        onPress={() =>
          form.handleSubmit(values => {
            const otherList = otherIndustriesActive
              ? otherIndustriesText
                  .split(',')
                  .map(s => s.trim())
                  .filter(Boolean)
              : [];
            const corporateExtras =
              isCorporate && industriesSectionEnabled
                ? {
                    sectoralInterestIds: selectedIndustryIds.map(Number),
                    sectoralInterestSubIds: selectedSubCategoryIds.map(Number),
                    sectoralInterestOthers: otherList,
                  }
                : {};
            onSave({
              ...buildPayload(values),
              askForConnectionDocument: askForConnDoc,
              ...corporateExtras,
            });
          })
        }
        style={{backgroundColor: primaryColor}}
      />

      {activeDropdown ? (
        <Picker
          visible
          title={`Select ${activeDropdown.label.toLowerCase()}`}
          options={optionsForDropdown(activeDropdown).map(o => o.name)}
          selected={labelForDropdown(activeDropdown)}
          primaryColor={primaryColor}
          emptyMessage={
            activeDropdown.key === 'registeredStateId'
              ? 'Select a country first'
              : activeDropdown.key === 'registeredCityId'
                ? 'Select a state first'
                : undefined
          }
          onClose={() => setActiveDropdown(null)}
          onSelect={name => {
            const option = optionsForDropdown(activeDropdown).find(
              o => o.name === name,
            );
            if (option) {
              form.setValue(activeDropdown.key, String(option.id));
              // Clear dependent location fields when the parent changes.
              if (activeDropdown.key === 'registeredCountryId') {
                form.setValue('registeredStateId', '');
                form.setValue('registeredCityId', '');
              } else if (activeDropdown.key === 'registeredStateId') {
                form.setValue('registeredCityId', '');
              }
            }
            setActiveDropdown(null);
          }}
        />
      ) : null}
    </View>
  );
}

const seedValues = (
  fields: FieldConfig[],
  data: Record<string, any> | null,
): Record<string, string> => {
  const seed: Record<string, string> = {};
  fields.forEach(field => {
    // For dropdown ID fields, the API returns a nested object — e.g.
    // `organizationType: { id, name }`. Look there first, then fall back to
    // the flat `<key>` (already an id) or `<key without 'Id' suffix>R`.
    if (field.key === 'organizationTypeId') {
      const nested =
        data?.organizationType?.id ??
        data?.organizationTypeId ??
        data?.organizationTypeR?.id;
      seed[field.key] = nested == null ? '' : String(nested);
      return;
    }
    if (field.key === 'registeredCountryId') {
      const nested =
        data?.registeredCountryR?.id ??
        data?.registeredCountry?.id ??
        data?.registeredCountryId;
      seed[field.key] = nested == null ? '' : String(nested);
      return;
    }
    if (field.key === 'registeredStateId') {
      const nested =
        data?.registeredStateR?.id ??
        data?.registeredState?.id ??
        data?.registeredStateId;
      seed[field.key] = nested == null ? '' : String(nested);
      return;
    }
    if (field.key === 'registeredCityId') {
      const nested =
        data?.registeredCityR?.id ??
        data?.registeredCity?.id ??
        data?.registeredCityId;
      seed[field.key] = nested == null ? '' : String(nested);
      return;
    }
    if (field.key === 'providerTypeId') {
      const nested =
        data?.providerType?.id ??
        data?.providerTypeR?.id ??
        data?.providerTypeId;
      seed[field.key] = nested == null ? '' : String(nested);
      return;
    }
    if (field.key === 'provideCategoryId') {
      const nested =
        data?.provideCategory?.id ??
        data?.provideCategoryR?.id ??
        data?.provideCategoryId;
      seed[field.key] = nested == null ? '' : String(nested);
      return;
    }
    const raw = data?.[field.key];
    seed[field.key] = raw == null ? '' : String(raw);
  });
  return seed;
};

// Field keys that should be sent as numbers in the API payload.
const NUMERIC_PAYLOAD_KEYS = new Set([
  'portfolioSize',
  'establishmentYear',
  'organizationTypeId',
  'registeredCountryId',
  'registeredStateId',
  'registeredCityId',
  'providerTypeId',
  'provideCategoryId',
]);

const buildPayload = (
  values: Record<string, string>,
): Record<string, any> => {
  // Only include non-empty fields so we don't blow away existing values
  // the user didn't touch.
  const payload: Record<string, any> = {};
  Object.entries(values).forEach(([key, value]) => {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      payload[key] = NUMERIC_PAYLOAD_KEYS.has(key) ? Number(trimmed) : trimmed;
    }
  });
  return payload;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    gap: 16,
    marginBottom: 24,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 4},
    elevation: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  dropdownField: {
    gap: 6,
  },
  dropdownLabel: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
  },
  requiredMark: {
    color: '#ef4444',
  },
  dropdownInput: {
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
  dropdownInputError: {
    borderColor: '#ef4444',
  },
  dropdownText: {
    color: '#0f172a',
    flex: 1,
    fontSize: 15,
  },
  dropdownPlaceholder: {
    color: '#94a3b8',
  },
  dropdownError: {
    color: '#ef4444',
    fontSize: 12,
  },
  logoSection: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  logoBox: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderStyle: 'dashed',
    borderWidth: 2,
    height: 84,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 84,
  },
  logoImage: {
    height: '100%',
    width: '100%',
  },
  logoCopy: {
    flex: 1,
    gap: 4,
  },
  logoLabel: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
  logoHint: {
    color: '#64748b',
    fontSize: 12,
  },
  logoChangeBtn: {
    marginTop: 4,
  },
  logoChangeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  connDocSection: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    gap: 12,
    padding: 14,
  },
  connDocHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  connDocHeaderText: {
    flex: 1,
    gap: 2,
  },
  connDocLabel: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
  connDocHint: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 16,
  },
  connDocPicker: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderStyle: 'dashed',
    borderWidth: 2,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  connDocPickerText: {
    color: '#0f172a',
    flex: 1,
    fontSize: 14,
  },
  industriesSection: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    gap: 12,
    padding: 14,
  },
  industriesTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
  },
  industriesHint: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 16,
  },
  otherToggleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  otherToggleLabel: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
  otherInput: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 10,
    borderWidth: 1,
    color: '#0f172a',
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
