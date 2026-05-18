import React, {useContext, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {launchImageLibrary} from 'react-native-image-picker';

import {AppButton} from '../../shared/components/AppButton';
import {Icon} from '../../shared/components/Icon';
import {colors} from '../../shared/theme/colors';
import {TenantContext} from '../../context/TenantProvider';
import {authService} from '../../auth/services/auth.service';
import {BasicInfoForm} from './editProfile/BasicInfoForm';
import {Documents} from './editProfile/Documents';
import {FinancialsForm} from './editProfile/FinancialsForm';
import {Picker} from './editProfile/Picker';
import {YourPitchDeck} from './editProfile/YourPitchDeck';
import {
  buildBaseTabs,
  detectInvestorSubtype,
  InvestorSubtype,
} from './editProfile/tabConfig';
import {
  COMPANY_SIZES,
  COUNTRIES,
  Country,
  PRODUCT_STAGES,
  TEAM_ROLES,
  getCitiesFor,
  getCountryIdByName,
  getStateIdByName,
  getStatesFor,
} from './editProfile/options';
import {
  buildBasicInfoPayload,
  buildFinancialsPayload,
  extractProfile,
} from './editProfile/extractProfile';
import {
  BasicInfoForm as BasicInfoFormType,
  FinancialsForm as FinancialsFormType,
  EMPTY_LEADERSHIP,
  EMPTY_BASIC_INFO,
  EMPTY_FINANCIALS,
} from './editProfile/types';
import type {EditProfileTab} from '../types';

type EditProfileScreenProps = {
  token: string;
  onBack: () => void;
};

type PickerKind =
  | 'companySize'
  | 'country'
  | 'state'
  | 'city'
  | 'productStage'
  | {kind: 'leadershipRole'; index: number};

type LocationOption = {
  id: number;
  name: string;
};

type DomainOption = {
  id: number;
  name: string;
  isActive?: boolean;
  industrySubCategoryDomains?: Array<{id: number; name: string; isActive?: boolean}>;
};

type FinancialOption = {
  id: number;
  name: string;
  isActive?: boolean;
};

type OngoingCommitment = {
  id?: number | string;
  investorName?: string;
  amount?: string | number;
};

type StartupFormDefinition = {
  uuid?: string;
  formTitle?: string;
  status?: boolean;
  useFormAs?: string;
  programs?: Array<{id?: number}> | null;
};

type CompletionFlags = {
  basic: boolean;
  industry: boolean;
  financials: boolean;
  pitch: boolean;
};

const tabCompletion = (
  key: string,
  flags: CompletionFlags,
): 'complete' | 'incomplete' => {
  switch (key) {
    case 'basic':
      return flags.basic ? 'complete' : 'incomplete';
    case 'industry':
      return flags.industry ? 'complete' : 'incomplete';
    case 'financials':
      return flags.financials ? 'complete' : 'incomplete';
    case 'pitch':
      return flags.pitch ? 'complete' : 'incomplete';
    default:
      return 'incomplete';
  }
};

const calculateProfileCompletion = (basicInfo: BasicInfoFormType) => {
  const safeSocial = basicInfo.social || EMPTY_BASIC_INFO.social;
  const checks = [
    Boolean(basicInfo.logoUrl),
    Boolean((basicInfo.companyName || '').trim()),
    Boolean(basicInfo.companySize),
    basicInfo.isIncorporated !== null,
    Boolean(basicInfo.country),
    Boolean(basicInfo.state),
    Boolean(basicInfo.city),
    Boolean((basicInfo.elevatorPitch || '').trim()),
    Boolean((basicInfo.companyBrief || '').trim()),
    Boolean(basicInfo.productStage),
    (basicInfo.businessModels || []).length > 0,
    (basicInfo.leadership || []).length > 0,
    Object.values(safeSocial).some(link => String(link || '').trim().length > 0),
  ];

  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
};

const ensureBasicInfoDefaults = (
  basicInfo: BasicInfoFormType,
): BasicInfoFormType => {
  const safeLeadership = Array.isArray(basicInfo?.leadership)
    ? basicInfo.leadership
        .filter(Boolean)
        .map(member => ({
          ...EMPTY_LEADERSHIP,
          ...member,
          id: member?.id || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: String(member?.name || ''),
          linkedinUrl: String(member?.linkedinUrl || ''),
          role: String(member?.role || ''),
          designation: String(member?.designation || ''),
        }))
    : [];

  return {
    ...EMPTY_BASIC_INFO,
    ...basicInfo,
    companyName: String(basicInfo?.companyName || ''),
    companySize: String(basicInfo?.companySize || ''),
    incorporationYear: String(basicInfo?.incorporationYear || ''),
    country: String(basicInfo?.country || ''),
    state: String(basicInfo?.state || ''),
    city: String(basicInfo?.city || ''),
    elevatorPitch: String(basicInfo?.elevatorPitch || ''),
    companyBrief: String(basicInfo?.companyBrief || ''),
    productStage: String(basicInfo?.productStage || ''),
    logoUrl: basicInfo?.logoUrl || null,
    servicesLookingFor: Array.isArray(basicInfo?.servicesLookingFor)
      ? basicInfo.servicesLookingFor
      : [],
    businessModels: Array.isArray(basicInfo?.businessModels)
      ? basicInfo.businessModels
      : [],
    leadership:
      safeLeadership.length > 0
        ? safeLeadership
        : [{...EMPTY_LEADERSHIP, id: `${Date.now()}_leadership`}],
    advisory: Array.isArray(basicInfo?.advisory)
      ? basicInfo.advisory.filter(Boolean).map(member => ({
          id:
            member?.id || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: String(member?.name || ''),
          linkedinUrl: String(member?.linkedinUrl || ''),
        }))
      : [],
    social: {
      ...EMPTY_BASIC_INFO.social,
      ...(basicInfo?.social || {}),
      website: String(basicInfo?.social?.website || ''),
      linkedin: String(basicInfo?.social?.linkedin || ''),
      twitter: String(basicInfo?.social?.twitter || ''),
      youtube: String(basicInfo?.social?.youtube || ''),
      facebook: String(basicInfo?.social?.facebook || ''),
      instagram: String(basicInfo?.social?.instagram || ''),
    },
  };
};

const COUNTRIES_API =
  'https://api.thub.sanchidev.in/api/v1/public/global/countries';
const STATES_API = 'https://api.thub.sanchidev.in/api/v1/public/global/states';
const CITIES_API = 'https://api.thub.sanchidev.in/api/v1/public/global/cities';
const CUSTOM_GLOBAL_API =
  'https://api.thub.sanchidev.in/api/v1/public/global/custom/industries,technologies,industries_primary';

const readLocationList = (payload: any): LocationOption[] => {
  const list = payload?.data || payload?.results || payload || [];
  if (!Array.isArray(list)) {
    return [];
  }

  return list
    .map(item => ({
      id: Number(item?.id ?? item?.value ?? item?._id),
      name: String(item?.name ?? item?.label ?? '').trim(),
    }))
    .filter(item => Number.isFinite(item.id) && Boolean(item.name));
};

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const buildEditTabs = (
  basicInfo: BasicInfoFormType,
  startupInfo: Record<string, any> | null,
  forms: StartupFormDefinition[],
  accountType: string,
  investorSubtype: InvestorSubtype,
): EditProfileTab[] => {
  const flags: CompletionFlags = {
    basic:
      Boolean(basicInfo.companyName) &&
      Boolean(basicInfo.companySize) &&
      Boolean(basicInfo.country) &&
      Boolean(basicInfo.productStage) &&
      basicInfo.isIncorporated !== null,
    industry:
      Array.isArray(startupInfo?.startupIndustries) &&
      startupInfo.startupIndustries.length > 0 &&
      Array.isArray(startupInfo?.startupTechnologies) &&
      startupInfo.startupTechnologies.length > 0,
    financials: Boolean(
      startupInfo?.financials?.fundingStageId ||
        startupInfo?.financials?.targetFundraise ||
        startupInfo?.financials?.tentativeValuation,
    ),
    pitch: Boolean(
      startupInfo?.pitchDeck?.elevatorPitch ||
        startupInfo?.pitchDeck?.pitchDocument,
    ),
  };

  const baseTabs: EditProfileTab[] = buildBaseTabs(
    accountType,
    investorSubtype,
  ).map(tab => ({...tab, status: tabCompletion(tab.key, flags)}));

  const customTabs = forms
    .filter(form => form?.status && form?.useFormAs === 'form' && form?.programs === null)
    .map(form => ({
      key: `custom-${form.uuid || slugify(form.formTitle || 'form')}`,
      label: form.formTitle || 'Custom Form',
      status: 'incomplete' as const,
      custom: true,
      formUuid: form.uuid,
    }));

  return [...baseTabs, ...customTabs];
};

export function EditProfileScreen({token, onBack}: EditProfileScreenProps) {
  const {theme, globalSetting} = useContext(TenantContext);
  const primaryColor = theme?.primary || colors.primary;
  const logoBaseUrl =
    globalSetting?.imgKitUrl || globalSetting?.assetsImgKitUrl;

  const [activeTab, setActiveTab] = useState<string>('basic');
  const [investorSubtype, setInvestorSubtype] =
    useState<InvestorSubtype>('organization');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<{
    text: string;
    tone: 'success' | 'error';
  } | null>(null);
  const [picker, setPicker] = useState<PickerKind | null>(null);
  const [countryOptions, setCountryOptions] = useState<Country[]>(COUNTRIES);
  const [stateOptions, setStateOptions] = useState<LocationOption[]>([]);
  const [cityOptions, setCityOptions] = useState<LocationOption[]>([]);
  const [industryOptions, setIndustryOptions] = useState<DomainOption[]>([]);
  const [technologyOptions, setTechnologyOptions] = useState<DomainOption[]>([]);
  const [primaryIndustryOptions, setPrimaryIndustryOptions] = useState<DomainOption[]>([]);
  const [fundingStageOptions, setFundingStageOptions] = useState<FinancialOption[]>([]);
  const [investmentMechanismOptions, setInvestmentMechanismOptions] = useState<
    FinancialOption[]
  >([]);
  const [ongoingCommitments, setOngoingCommitments] = useState<
    OngoingCommitment[]
  >([]);
  const [selectedIndustryIds, setSelectedIndustryIds] = useState<number[]>([]);
  const [selectedTechnologyIds, setSelectedTechnologyIds] = useState<number[]>([]);
  const [selectedPrimaryIndustryId, setSelectedPrimaryIndustryId] = useState<number | null>(null);
  const [startupInfo, setStartupInfo] = useState<Record<string, any> | null>(null);
  const [startupForms, setStartupForms] = useState<StartupFormDefinition[]>([]);
  const [accountType, setAccountType] = useState<string | null>(null);
  const [basicInfo, setBasicInfo] =
    useState<BasicInfoFormType>(EMPTY_BASIC_INFO);
  const [financialInfo, setFinancialInfo] =
    useState<FinancialsFormType>(EMPTY_FINANCIALS);

  const loadProfile = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const raw = await authService.getStartupInformation(
        token,
        accountType || undefined,
      );
      const extracted = extractProfile(raw, logoBaseUrl);
      const root = raw?.data || raw || null;
      setStartupInfo(root);
      setBasicInfo(ensureBasicInfoDefaults(extracted.basicInfo));
      setFinancialInfo(extracted.financials);
      setSelectedIndustryIds(
        Array.isArray(root?.startupIndustries)
          ? root.startupIndustries
              .map((item: Record<string, any>) => Number(item?.id))
              .filter((id: number) => Number.isFinite(id))
          : [],
      );
      setSelectedTechnologyIds(
        Array.isArray(root?.startupTechnologies)
          ? root.startupTechnologies
              .map((item: Record<string, any>) => Number(item?.id))
              .filter((id: number) => Number.isFinite(id))
          : [],
      );
      setSelectedPrimaryIndustryId(
        Number(root?.startupIndustryPrimary?.id) || null,
      );
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Could not load your profile.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    fetch(COUNTRIES_API)
      .then(response => response.json())
      .then(payload => {
        if (cancelled) {
          return;
        }

        const countries = readLocationList(payload).map(item => ({
          id: item.id,
          code: '',
          name: item.name,
          states: [],
        }));

        if (countries.length > 0) {
          setCountryOptions(countries);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCountryOptions(COUNTRIES);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    authService
      .getProfile(token)
      .then(raw => {
        if (cancelled) return;
        const type = String(raw?.data?.accountType || '').toLowerCase();
        setAccountType(type || 'startup');
        setInvestorSubtype(detectInvestorSubtype(raw?.data));
      })
      .catch(() => {
        if (!cancelled) {
          setAccountType('startup');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    if (!accountType) {
      return;
    }

    Promise.all([
      authService.getFundingStages(),
      authService.getInvestmentMechanisms(),
      authService
        .getOngoingCommitments(token, accountType)
        .catch(() => ({data: []})),
    ])
      .then(([fundingStagesResponse, mechanismsResponse, commitmentsResponse]) => {
        if (cancelled) {
          return;
        }

        const fundingStages = Array.isArray(fundingStagesResponse?.data)
          ? fundingStagesResponse.data
          : [];
        const mechanisms = Array.isArray(
          mechanismsResponse?.data?.investment_mechanisms,
        )
          ? mechanismsResponse.data.investment_mechanisms
          : [];
        const commitments = Array.isArray(commitmentsResponse?.data)
          ? commitmentsResponse.data
          : [];

        setFundingStageOptions(
          fundingStages.filter((item: FinancialOption) => item?.isActive !== false),
        );
        setInvestmentMechanismOptions(
          mechanisms.filter((item: FinancialOption) => item?.isActive !== false),
        );
        setOngoingCommitments(commitments);
      })
      .catch(() => {
        if (!cancelled) {
          setFundingStageOptions([]);
          setInvestmentMechanismOptions([]);
          setOngoingCommitments([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, accountType]);

  useEffect(() => {
    let cancelled = false;

    fetch(CUSTOM_GLOBAL_API)
      .then(response => response.json())
      .then(payload => {
        if (cancelled) {
          return;
        }

        setIndustryOptions(
          Array.isArray(payload?.data?.industries) ? payload.data.industries : [],
        );
        setTechnologyOptions(
          Array.isArray(payload?.data?.technologies) ? payload.data.technologies : [],
        );
        setPrimaryIndustryOptions(
          Array.isArray(payload?.data?.industries_primary)
            ? payload.data.industries_primary
            : Array.isArray(payload?.data?.industries)
              ? payload.data.industries
              : [],
        );
      })
      .catch(() => {
        if (!cancelled) {
          setIndustryOptions([]);
          setTechnologyOptions([]);
          setPrimaryIndustryOptions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!accountType) {
      return;
    }

    authService
      .getStartupFormList(token, accountType)
      .then(raw => {
        if (cancelled) return;
        const forms = Array.isArray(raw?.data)
          ? raw.data
          : Array.isArray(raw)
            ? raw
            : [];
        setStartupForms(forms);
      })
      .catch(() => {
        if (!cancelled) {
          setStartupForms([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, accountType]);

  useEffect(() => {
    let cancelled = false;
    if (!accountType) {
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    authService
      .getStartupInformation(token, accountType)
      .then(raw => {
        if (cancelled) return;
        const extracted = extractProfile(raw, logoBaseUrl);
        setStartupInfo(raw?.data || raw || null);
        setBasicInfo(ensureBasicInfoDefaults(extracted.basicInfo));
        setFinancialInfo(extracted.financials);
        const root = raw?.data || raw || {};
        setSelectedIndustryIds(
          Array.isArray(root?.startupIndustries)
            ? root.startupIndustries
                .map((item: Record<string, any>) => Number(item?.id))
                .filter((id: number) => Number.isFinite(id))
            : [],
        );
        setSelectedTechnologyIds(
          Array.isArray(root?.startupTechnologies)
            ? root.startupTechnologies
                .map((item: Record<string, any>) => Number(item?.id))
                .filter((id: number) => Number.isFinite(id))
            : [],
        );
        setSelectedPrimaryIndustryId(
          Number(root?.startupIndustryPrimary?.id) || null,
        );
      })
      .catch(error => {
        if (cancelled) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : 'Could not load your profile.',
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, logoBaseUrl, accountType]);

  useEffect(() => {
    const countryId = getCountryIdByName(basicInfo.country, countryOptions);

    if (!countryId) {
      setStateOptions([]);
      return;
    }

    let cancelled = false;

    fetch(`${STATES_API}/${countryId}`)
      .then(response => response.json())
      .then(payload => {
        if (cancelled) {
          return;
        }

        setStateOptions(readLocationList(payload));
      })
      .catch(() => {
        if (!cancelled) {
          setStateOptions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [basicInfo.country, countryOptions]);

  useEffect(() => {
    const stateId =
      stateOptions.find(option => option.name === basicInfo.state)?.id ||
      getStateIdByName(basicInfo.country, basicInfo.state);

    if (!stateId) {
      setCityOptions([]);
      return;
    }

    let cancelled = false;

    fetch(`${CITIES_API}/${stateId}`)
      .then(response => response.json())
      .then(payload => {
        if (cancelled) {
          return;
        }

        setCityOptions(readLocationList(payload));
      })
      .catch(() => {
        if (!cancelled) {
          setCityOptions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [basicInfo.country, basicInfo.state, stateOptions]);

  const tabs: EditProfileTab[] = buildEditTabs(
    basicInfo,
    {
      ...startupInfo,
      startupIndustries: selectedIndustryIds,
      startupTechnologies: selectedTechnologyIds,
    },
    startupForms,
    accountType || 'startup',
    investorSubtype,
  );

  useEffect(() => {
    if (!tabs.some(tab => tab.key === activeTab) && tabs.length > 0) {
      setActiveTab(tabs[0].key);
    }
  }, [activeTab, tabs]);

  const profileCompletion = calculateProfileCompletion(basicInfo);

  const updateBasic = <K extends keyof BasicInfoFormType>(
    key: K,
    value: BasicInfoFormType[K],
  ) => {
    setBasicInfo(current =>
      ensureBasicInfoDefaults({...current, [key]: value}),
    );
    setSaveMessage(null);
  };

  const updateFinancial = <K extends keyof FinancialsFormType>(
    key: K,
    value: FinancialsFormType[K],
  ) => {
    setFinancialInfo(current => ({...current, [key]: value}));
    setSaveMessage(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      if (activeTab === 'industry') {
        await authService.updateIndustryTechnologyBusiness(token, {
          industryDomainIds: selectedIndustryIds,
          technologyDomainIds: selectedTechnologyIds,
          industryDomainPrimaryId: selectedPrimaryIndustryId,
          industrySubCategoryDomainIds: [],
          otherIndustryDomains: [],
          otherTechnologyDomains: [],
        });
        setStartupInfo(current =>
          current
            ? {
                ...current,
                startupIndustries: selectedIndustryIds,
                startupTechnologies: selectedTechnologyIds,
                startupIndustryPrimary: selectedPrimaryIndustryId,
              }
            : current,
        );
      } else if (activeTab === 'financials') {
        const payload = buildFinancialsPayload(financialInfo);
        await authService.updateFinancialsInformation(token, payload);
        setStartupInfo(current =>
          current
            ? {
                ...current,
                isRaisingFunds: financialInfo.isRaisingFunds,
                financials: {
                  ...(current.financials || {}),
                  ...payload.financials,
                },
              }
            : current,
        );
      } else {
        await authService.updateProfile(
          token,
          buildBasicInfoPayload(basicInfo),
        );
      }

      setSaveMessage({text: 'Saved successfully.', tone: 'success'});
    } catch (error) {
      setSaveMessage({
        text:
          error instanceof Error
            ? error.message
            : 'Could not save your changes.',
        tone: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleNext = () => {
    const currentIndex = tabs.findIndex(tab => tab.key === activeTab);
    const next = tabs[currentIndex + 1];
    if (next) setActiveTab(next.key);
  };

  const toggleLimitedSelection = (
    current: number[],
    id: number,
    setter: (value: number[]) => void,
    label: string,
  ) => {
    const exists = current.includes(id);
    if (exists) {
      setter(current.filter(item => item !== id));
      return;
    }

    if (current.length >= 3) {
      Alert.alert('Limit reached', `You can select maximum 3 ${label}.`);
      return;
    }

    setter([...current, id]);
  };

  const handleLogoPress = async () => {
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

      if (result.didCancel) {
        return;
      }

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
      const maxSize = 512 * 1024;
      if (fileSize > maxSize) {
        Alert.alert(
          'Image too large',
          'Please choose an image smaller than 512kb.',
        );
        return;
      }

      const type = (asset.type || '').toLowerCase();
      if (
        type &&
        !['image/png', 'image/jpg', 'image/jpeg'].includes(type)
      ) {
        Alert.alert(
          'Unsupported format',
          'Please choose a png, jpg, or jpeg image.',
        );
        return;
      }

      updateBasic('logoUrl', asset.uri);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not select the image.';

      if (
        message.includes('launchImageLibrary') ||
        message.includes('ImagePicker') ||
        message.includes('null')
      ) {
        Alert.alert(
          'Logo upload unavailable',
          'The image picker native module needs a fresh app rebuild. Please restart the Android app and try again.',
        );
        return;
      }

      Alert.alert(
        'Logo upload failed',
        message,
      );
    }
  };

  const closePicker = () => setPicker(null);

  const renderPicker = () => {
    if (!picker) return null;

    if (typeof picker === 'object' && picker.kind === 'leadershipRole') {
      return (
        <Picker
          visible
          title="Select role"
          options={TEAM_ROLES}
          selected={basicInfo.leadership[picker.index]?.role}
          primaryColor={primaryColor}
          onClose={closePicker}
          onSelect={role => {
            const member = basicInfo.leadership[picker.index];
            if (!member) {
              closePicker();
              return;
            }

            const nextLeadership = basicInfo.leadership.map((entry, index) =>
              index === picker.index ? {...entry, role} : entry,
            );
            updateBasic('leadership', nextLeadership);
            closePicker();
          }}
        />
      );
    }

    if (picker === 'companySize') {
      return (
        <Picker
          visible
          title="Choose a team size"
          options={COMPANY_SIZES}
          selected={basicInfo.companySize}
          primaryColor={primaryColor}
          onClose={closePicker}
          onSelect={selection => {
            updateBasic('companySize', selection);
            closePicker();
          }}
        />
      );
    }

    if (picker === 'country') {
      return (
        <Picker
          visible
          title="Choose a country"
          options={countryOptions.map(country => country.name)}
          selected={basicInfo.country}
          primaryColor={primaryColor}
          onClose={closePicker}
          onSelect={selection => {
            const selectedCountry =
              countryOptions.find(country => country.name === selection) ||
              null;
            updateBasic('country', selection);
            updateBasic('countryId', selectedCountry?.id ?? null);
            updateBasic('state', '');
            updateBasic('stateId', null);
            updateBasic('city', '');
            updateBasic('cityId', null);
            closePicker();
          }}
        />
      );
    }

    if (picker === 'state') {
      const options =
        stateOptions.length > 0
          ? stateOptions.map(option => option.name)
          : getStatesFor(basicInfo.country);

      return (
        <Picker
          visible
          title="Choose a state"
          options={options}
          selected={basicInfo.state}
          primaryColor={primaryColor}
          onClose={closePicker}
          emptyMessage="Select a country first"
          onSelect={selection => {
            const selectedState =
              stateOptions.find(option => option.name === selection) || null;
            updateBasic('state', selection);
            updateBasic('stateId', selectedState?.id ?? null);
            updateBasic('city', '');
            updateBasic('cityId', null);
            closePicker();
          }}
        />
      );
    }

    if (picker === 'city') {
      const options =
        cityOptions.length > 0
          ? cityOptions.map(option => option.name)
          : getCitiesFor(basicInfo.country, basicInfo.state);

      return (
        <Picker
          visible
          title="Choose a city"
          options={options}
          selected={basicInfo.city}
          primaryColor={primaryColor}
          onClose={closePicker}
          emptyMessage="Select a state first"
          onSelect={selection => {
            const selectedCity =
              cityOptions.find(option => option.name === selection) || null;
            updateBasic('city', selection);
            updateBasic('cityId', selectedCity?.id ?? null);
            closePicker();
          }}
        />
      );
    }

    return (
      <Picker
        visible
        title="Product stage"
        options={PRODUCT_STAGES}
        selected={basicInfo.productStage}
        primaryColor={primaryColor}
        onClose={closePicker}
        onSelect={selection => {
          updateBasic('productStage', selection);
          closePicker();
        }}
      />
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={primaryColor} />
        <Text style={styles.loadingText}>Loading your profile…</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.centered}>
        <Icon name="alert-circle-outline" size={36} color={colors.danger} />
        <Text style={styles.errorTitle}>Couldn't load profile</Text>
        <Text style={styles.errorBody}>{loadError}</Text>
        <View style={styles.errorActions}>
          <AppButton label="Try again" onPress={loadProfile} />
          <AppButton label="Back" variant="secondary" onPress={onBack} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={onBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back">
          <Icon name="arrow-left" size={22} color="#0f172a" />
        </Pressable>
        <Text style={styles.title}>Edit Startup Details</Text>
      </View>

      <View style={styles.completionRow}>
        <Text style={styles.completionLabel}>Profile completion</Text>
        <Text style={[styles.completionValue, {color: primaryColor}]}>
          {profileCompletion}%
        </Text>
      </View>
      <View style={styles.completionTrack}>
        <View
          style={[
            styles.completionFill,
            {
              backgroundColor: primaryColor,
              width: `${Math.min(100, Math.max(0, profileCompletion))}%`,
            },
          ]}
        />
      </View>

      <View style={styles.tabsSection}>
        <View style={styles.tabsShell}>
          <View style={styles.tabsRow}>
            {tabs.map(tab => {
              const isActive = tab.key === activeTab;
              const isComplete = tab.status === 'complete';
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  style={[
                    styles.tab,
                    isActive && {
                      backgroundColor: `${primaryColor}12`,
                      borderColor: `${primaryColor}2e`,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.tabText,
                      isActive && styles.tabTextActive,
                      isActive && {color: primaryColor},
                    ]}>
                    {tab.label}
                  </Text>
                  <Icon
                    name={isComplete ? 'check-circle' : 'alert-circle-outline'}
                    size={16}
                    color={isComplete ? colors.success : colors.danger}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        alwaysBounceVertical={false}
        bounces={false}
        decelerationRate={0.75}
        disableIntervalMomentum
        overScrollMode="never"
        keyboardShouldPersistTaps="handled">
        {activeTab === 'basic' ? (
          <BasicInfoForm
            primaryColor={primaryColor}
            value={basicInfo}
            onLogoPress={handleLogoPress}
            onOpenCompanySize={() => setPicker('companySize')}
            onOpenCountry={() => setPicker('country')}
            onOpenState={() => setPicker('state')}
            onOpenCity={() => setPicker('city')}
            onOpenProductStage={() => setPicker('productStage')}
            onOpenLeadershipRole={index =>
              setPicker({kind: 'leadershipRole', index})
            }
            onChange={updateBasic}
          />
        ) : activeTab === 'industry' ? (
          <View style={styles.industryCard}>
            <Text style={styles.industryTitle}>Industry / Technology</Text>

            {primaryIndustryOptions.length > 0 ? (
              <View style={styles.domainSection}>
                <Text style={styles.domainHeading}>Choose Primary Industry</Text>
                <Text style={styles.domainHint}>Select one option</Text>
                <View style={styles.domainGrid}>
                  {primaryIndustryOptions.map(option => {
                    const isSelected = selectedPrimaryIndustryId === option.id;
                    return (
                      <Pressable
                        key={`primary-${option.id}`}
                        style={styles.domainOption}
                        onPress={() => setSelectedPrimaryIndustryId(option.id)}>
                        <View
                          style={[
                            styles.checkbox,
                            isSelected && {
                              backgroundColor: primaryColor,
                              borderColor: primaryColor,
                            },
                          ]}>
                          {isSelected ? (
                            <Icon name="check" size={14} color="#ffffff" />
                          ) : null}
                        </View>
                        <Text style={styles.domainLabel}>{option.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View style={styles.domainSection}>
              <Text style={styles.domainHeading}>Choose Industry Domains</Text>
              <Text style={styles.domainHint}>Select maximum 3 options</Text>
              <View style={styles.domainGrid}>
                {industryOptions.map(option => {
                  const isSelected = selectedIndustryIds.includes(option.id);
                  return (
                    <Pressable
                      key={`industry-${option.id}`}
                      style={styles.domainOption}
                      onPress={() =>
                        toggleLimitedSelection(
                          selectedIndustryIds,
                          option.id,
                          setSelectedIndustryIds,
                          'industries',
                        )
                      }>
                      <View
                        style={[
                          styles.checkbox,
                          isSelected && {
                            backgroundColor: primaryColor,
                            borderColor: primaryColor,
                          },
                        ]}>
                        {isSelected ? (
                          <Icon name="check" size={14} color="#ffffff" />
                        ) : null}
                      </View>
                      <Text style={styles.domainLabel}>{option.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.domainSection}>
              <Text style={styles.domainHeading}>Choose Technology Domains</Text>
              <Text style={styles.domainHint}>Select maximum 3 options</Text>
              <View style={styles.domainGrid}>
                {technologyOptions.map(option => {
                  const isSelected = selectedTechnologyIds.includes(option.id);
                  return (
                    <Pressable
                      key={`technology-${option.id}`}
                      style={styles.domainOption}
                      onPress={() =>
                        toggleLimitedSelection(
                          selectedTechnologyIds,
                          option.id,
                          setSelectedTechnologyIds,
                          'technologies',
                        )
                      }>
                      <View
                        style={[
                          styles.checkbox,
                          isSelected && {
                            backgroundColor: primaryColor,
                            borderColor: primaryColor,
                          },
                        ]}>
                        {isSelected ? (
                          <Icon name="check" size={14} color="#ffffff" />
                        ) : null}
                      </View>
                      <Text style={styles.domainLabel}>{option.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        ) : activeTab === 'financials' ? (
          <FinancialsForm
            primaryColor={primaryColor}
            value={financialInfo}
            currency={globalSetting?.features?.currency || 'INR'}
            showInvestmentBankingSection={
              globalSetting?.features?.investment_banking_section === true
            }
            fundingStages={fundingStageOptions}
            investmentMechanisms={investmentMechanismOptions}
            ongoingCommitments={ongoingCommitments}
            onChange={updateFinancial}
          />
        ) : activeTab === 'pitch' ? (
          <View>
            <YourPitchDeck
              primaryColor={primaryColor}
              pitchDeck={startupInfo?.pitchDeck}
              token={token}
              onUploaded={() => loadProfile()}
            />
            <Documents
              token={token}
              primaryColor={primaryColor}
              onUploaded={() => loadProfile()}
            />
          </View>
        ) : (
          <View style={styles.placeholder}>
            <Icon name="hammer-wrench" size={32} color="#94a3b8" />
            <Text style={styles.placeholderTitle}>Coming soon</Text>
            <Text style={styles.placeholderBody}>
              This section is part of the upcoming release.
            </Text>
          </View>
        )}

        {saveMessage ? (
          <Text
            style={[
              styles.saveMessage,
              saveMessage.tone === 'success'
                ? styles.saveMessageSuccess
                : styles.saveMessageError,
            ]}>
            {saveMessage.text}
          </Text>
        ) : null}
      </ScrollView>

      {renderPicker()}

      <View style={styles.footer}>
        <View style={styles.footerSlot}>
          <AppButton
            label={isSaving ? 'Saving…' : 'SAVE'}
            disabled={
              isSaving ||
              (activeTab !== 'basic' &&
                activeTab !== 'industry' &&
                activeTab !== 'financials')
            }
            loading={isSaving}
            onPress={handleSave}
          />
        </View>
        <View style={styles.footerSlot}>
          <AppButton
            label="NEXT STEP"
            variant="secondary"
            onPress={handleNext}
            disabled={
              tabs.findIndex(tab => tab.key === activeTab) === tabs.length - 1
            }
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  centered: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#64748b',
    fontSize: 15,
    marginTop: 12,
  },
  errorTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
  },
  errorBody: {
    color: '#475569',
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  errorActions: {
    gap: 10,
    marginTop: 18,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  backButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  title: {
    color: '#0f172a',
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
  },
  completionRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  completionLabel: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
  },
  completionValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  completionTrack: {
    backgroundColor: '#e2e8f0',
    borderRadius: 999,
    height: 6,
    marginHorizontal: 16,
    marginTop: 8,
    overflow: 'hidden',
  },
  completionFill: {
    borderRadius: 999,
    height: '100%',
  },
  tabsSection: {
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  tabsShell: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  tabsStrip: {
    flexGrow: 0,
    minHeight: 72,
    width: '100%',
  },
  tab: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    flexShrink: 1,
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tabText: {
    color: '#64748b',
    fontSize: 13,
    flexShrink: 1,
    fontWeight: '600',
  },
  tabTextActive: {
    fontWeight: '700',
  },
  content: {
    padding: 16,
    paddingBottom: 112,
  },
  industryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
  },
  industryTitle: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '800',
  },
  domainSection: {
    marginTop: 22,
  },
  domainHeading: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '700',
  },
  domainHint: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 4,
  },
  domainGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 14,
    rowGap: 14,
  },
  domainOption: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingRight: 12,
    width: '50%',
  },
  checkbox: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 6,
    borderWidth: 1,
    height: 22,
    justifyContent: 'center',
    marginRight: 10,
    width: 22,
  },
  domainLabel: {
    color: '#0f172a',
    flex: 1,
    fontSize: 15,
  },
  placeholder: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  placeholderTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
  },
  placeholderBody: {
    color: '#64748b',
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  saveMessage: {
    fontSize: 13,
    marginTop: 14,
    textAlign: 'center',
  },
  saveMessageSuccess: {
    color: colors.success,
  },
  saveMessageError: {
    color: colors.danger,
  },
  footer: {
    backgroundColor: '#ffffff',
    borderTopColor: '#e2e8f0',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  footerSlot: {
    flex: 1,
  },
});
