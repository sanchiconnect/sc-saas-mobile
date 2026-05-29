import React, {useContext, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {launchImageLibrary} from 'react-native-image-picker';

import {AppButton} from '../../../core/components/AppButton';
import {FormScrollView} from '../../../core/components/FormScrollView';
import {Icon} from '../../../core/components/Icon';
import {colors} from '../../../core/theme/colors';
import {TenantContext} from '../../../core/tenant/TenantProvider';
import {useToast} from '../../../core/toast/ToastProvider';
import {authService} from '../../auth/services/auth.service';
import {BasicInfoForm} from './editProfile/BasicInfoForm';
import {CorporateEngagementTab} from './editProfile/CorporateEngagementTab';
import {
  CustomFormTab,
  CustomFormTabHandle,
  DynamicForm,
  isFormComplete,
  normalizeRawField,
} from './editProfile/CustomFormTab';
import {Documents} from './editProfile/Documents';
import {FinancialsForm} from './editProfile/FinancialsForm';
import {InvestorInvestmentsTab} from './editProfile/InvestorInvestmentsTab';
import {InvestorRepresentativeTab} from './editProfile/InvestorRepresentativeTab';
import {MentorDomainExpertiseTab} from './editProfile/MentorDomainExpertiseTab';
import {Picker} from './editProfile/Picker';
import {PartnerIndustryTab} from './editProfile/PartnerIndustryTab';
import {RoleBasicInfoTab} from './editProfile/RoleBasicInfoTab';
import {ServiceProviderIndustryTab} from './editProfile/ServiceProviderIndustryTab';
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
import type {EditProfileTab} from '../../home/types';

type EditProfileScreenProps = {
  token: string;
  onBack: () => void;
  onPreview?: () => void;
  // Fired after every successful save (basic info / industry / financials /
  // custom form). Parent uses it to refresh dashboard widgets like the
  // profile-completion ring so they reflect the new state immediately.
  onProfileUpdated?: () => void;
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
          uuid: member?.uuid,
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

const countriesEndpoint = (baseUrl: string) =>
  `${baseUrl}api/v1/public/global/countries`;
const statesEndpoint = (baseUrl: string) =>
  `${baseUrl}api/v1/public/global/states`;
const citiesEndpoint = (baseUrl: string) =>
  `${baseUrl}api/v1/public/global/cities`;
const customGlobalEndpoint = (baseUrl: string) =>
  `${baseUrl}api/v1/public/global/custom/industries,technologies,industries_primary,business_models,product_stages`;

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

const arraysEqualUnordered = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
};

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const toIdName = (raw: any): Array<{id: number; name: string}> => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item: any) => ({
      id: Number(item?.id ?? item?.value),
      name: String(item?.name ?? item?.label ?? ''),
    }))
    .filter(
      (item: {id: number; name: string}) =>
        Number.isFinite(item.id) && item.name.length > 0,
    );
};

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

  // Custom forms are appended later via `customForms` (which renders through
  // CustomFormTab). Keep the legacy computation here for parity, but do not
  // include it in the returned tab list — otherwise each dynamic form would
  // appear twice (once as a placeholder, once as the real CustomFormTab).
  void forms
    .filter(form => form?.status && form?.useFormAs === 'form' && form?.programs === null)
    .map(form => ({
      key: `custom-${form.uuid || slugify(form.formTitle || 'form')}`,
      label: form.formTitle || 'Custom Form',
      status: 'incomplete' as const,
      custom: true,
      formUuid: form.uuid,
    }));

  return baseTabs;
};

export function EditProfileScreen({
  token,
  onBack,
  onProfileUpdated,
}: EditProfileScreenProps) {
  const {theme, globalSetting, baseUrl} = useContext(TenantContext);
  const toast = useToast();
  const primaryColor = theme?.primary || colors.primary;
  const logoBaseUrl =
    globalSetting?.imgKitUrl || globalSetting?.assetsImgKitUrl;

  const [activeTab, setActiveTab] = useState<string>('basic');
  const tabsScrollRef = useRef<ScrollView | null>(null);
  // Captured x-offset of each pill, populated by each Pressable's onLayout.
  // Used to scroll the tapped tab into view precisely (no width heuristics).
  const tabPositionsRef = useRef<Record<string, number>>({});
  const [investorSubtype, setInvestorSubtype] =
    useState<InvestorSubtype>('organization');
  // Server-authoritative profile completion. Same endpoint Dashboard reads
  // from, so both screens display the identical number. null = not yet fetched.
  const [backendCompletion, setBackendCompletion] = useState<number | null>(
    null,
  );
  const [customForms, setCustomForms] = useState<DynamicForm[]>([]);
  // Tab-dot status per custom form. Seeded from a prefetch of each form's
  // submission so the dot is accurate before the user opens the tab, and
  // updated live by each CustomFormTab via onCompletionChange.
  const [customFormStatuses, setCustomFormStatuses] = useState<
    Record<string, boolean>
  >({});
  // Extra picker options used by the per-role secondary tabs. Fetched once
  // per session when the user lands on a non-startup role.
  const [investmentStageOptions, setInvestmentStageOptions] = useState<
    Array<{id: number; name: string}>
  >([]);
  const [investmentPreferenceOptions, setInvestmentPreferenceOptions] =
    useState<Array<{id: number; name: string}>>([]);
  const [abilityMetricOptions, setAbilityMetricOptions] = useState<
    Array<{id: number; name: string}>
  >([]);
  const [businessModelOptions, setBusinessModelOptions] = useState<
    Array<{id: number; name: string}>
  >([]);
  const [domainAreaOptions, setDomainAreaOptions] = useState<
    Array<{id: number; name: string}>
  >([]);
  // Investor organization types — fetched once per session when an
  // investor is loaded. Matches /api/v1/public/global/custom/organization_types.
  const [organizationTypeOptions, setOrganizationTypeOptions] = useState<
    Array<{id: number; name: string}>
  >([]);
  // Service-provider catalogues — same pattern as organization_types above.
  const [serviceProviderTypeOptions, setServiceProviderTypeOptions] = useState<
    Array<{id: number; name: string}>
  >([]);
  const [serviceProviderCategoryOptions, setServiceProviderCategoryOptions] =
    useState<Array<{id: number; name: string}>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
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
  // "Other industries / technologies" — free-text fallback for domains the
  // user can't find in the standard list. Mirrors the frontend's optional
  // toggle + comma-separated text input.
  const [otherIndustriesActive, setOtherIndustriesActive] = useState(false);
  const [otherIndustriesText, setOtherIndustriesText] = useState('');
  const [otherTechActive, setOtherTechActive] = useState(false);
  const [otherTechText, setOtherTechText] = useState('');
  const [startupInfo, setStartupInfo] = useState<Record<string, any> | null>(null);
  const [startupForms, setStartupForms] = useState<StartupFormDefinition[]>([]);
  const [accountType, setAccountType] = useState<string | null>(null);
  const [basicInfo, setBasicInfo] =
    useState<BasicInfoFormType>(EMPTY_BASIC_INFO);
  const [financialInfo, setFinancialInfo] =
    useState<FinancialsFormType>(EMPTY_FINANCIALS);
  // Snapshot of basicInfo taken when the profile loads. Used at save time to
  // diff each sub-resource (business models, pitch, product info, advisors,
  // founders) so we only PATCH endpoints whose data the user actually changed.
  const initialBasicInfoRef = useRef<BasicInfoFormType | null>(null);
  // Refs keyed by form uuid for each rendered CustomFormTab. Lets the
  // footer SAVE button drive the active custom form's save() imperatively
  // so we don't need a separate in-card Save inside each tab.
  const customFormRefs = useRef<Record<string, CustomFormTabHandle | null>>({});
  // {id, name} lookup for business models + product stages — fetched from
  // /global/custom so we can resolve the form's stored names to the numeric
  // IDs the sub-resource PATCHes require.
  const [basicBusinessModelOptions, setBasicBusinessModelOptions] = useState<
    Array<{id: number; name: string}>
  >([]);
  const [productStageOptions, setProductStageOptions] = useState<
    Array<{id: number; name: string}>
  >([]);
  // IP fields are not edited in the mobile Basic Info UI — we echo back what
  // the server returned so the product-information PATCH (which carries the
  // updated description / productStageId) doesn't blank them out.
  const initialProductInfoRef = useRef<{
    haveIP: string | null;
    ipStatus: string | null;
    ipCountry: string | null;
  }>({haveIP: null, ipStatus: null, ipCountry: null});

  // `silent` skips the full-screen spinner — used after a successful save so
  // we can pick up server-normalized values without flashing the loading view.
  const loadProfile = async ({silent = false}: {silent?: boolean} = {}) => {
    if (!silent) {
      setIsLoading(true);
    }
    setLoadError(null);
    try {
      const raw = await authService.getStartupInformation(
        token,
        accountType || undefined,
      );
      const extracted = extractProfile(raw, logoBaseUrl);
      const root = raw?.data || raw || null;
      setStartupInfo(root);
      const normalized = ensureBasicInfoDefaults(extracted.basicInfo);
      setBasicInfo(normalized);
      // Capture a snapshot used for per-sub-resource diff detection on save.
      initialBasicInfoRef.current = normalized;
      const productInfo = root?.productInformation || {};
      initialProductInfoRef.current = {
        haveIP: productInfo?.haveIP ?? null,
        ipStatus: productInfo?.ipStatus ?? null,
        ipCountry: productInfo?.ipCountry ?? null,
      };
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
      const otherInds = Array.isArray(root?.startupOtherIndustries)
        ? root.startupOtherIndustries
        : [];
      setOtherIndustriesActive(otherInds.length > 0);
      setOtherIndustriesText(otherInds.join(','));
      const otherTech = Array.isArray(root?.startupOtherTechnologies)
        ? root.startupOtherTechnologies
        : [];
      setOtherTechActive(otherTech.length > 0);
      setOtherTechText(otherTech.join(','));
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Could not load your profile.',
      );
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!baseUrl) {
      return;
    }

    let cancelled = false;

    fetch(countriesEndpoint(baseUrl))
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

  // Fetch tenant-defined custom profile forms for this account type.
  // Fetch backend-authoritative profile completion (matches Dashboard).
  useEffect(() => {
    if (!accountType) return;
    let cancelled = false;
    authService
      .getProfileCompletion(token, accountType, investorSubtype)
      .then(res => {
        if (cancelled) return;
        const raw = (res?.data?.percentage ?? res?.percentage) as
          | number
          | string
          | undefined;
        const num = Number(raw);
        if (Number.isFinite(num)) {
          setBackendCompletion(num);
        }
      })
      .catch(() => {
        // Leave backendCompletion null → local fallback applies.
      });
    return () => {
      cancelled = true;
    };
  }, [token, accountType, investorSubtype]);

  useEffect(() => {
    if (!accountType) {
      return;
    }
    let cancelled = false;
    authService
      .listProfileForms(token, accountType)
      .then(res => {
        if (cancelled) return;
        const items = Array.isArray(res?.data) ? res.data : [];
        // Mirror the web filter for profile forms: only active forms whose
        // useFormAs === 'form' and aren't scoped to a specific program. Forms
        // can ship fields under `fields`, `formFields`, or `schema.fields`
        // depending on backend version — accept any of them.
        const forms: DynamicForm[] = items
          .filter((raw: any) => {
            if (raw?.status === false) return false;
            if (raw?.useFormAs && raw.useFormAs !== 'form') return false;
            if (raw?.programs && Array.isArray(raw.programs) && raw.programs.length > 0) {
              return false;
            }
            return true;
          })
          .map((raw: any) => {
            const rawFields = Array.isArray(raw?.fields)
              ? raw.fields
              : Array.isArray(raw?.formFields)
                ? raw.formFields
                : Array.isArray(raw?.schema?.fields)
                  ? raw.schema.fields
                  : [];
            // Backend sends section children as JSON strings and uses
            // `key` as the identifier with `name` as the label — normalize
            // both into the shape CustomFormTab expects.
            const fields = rawFields
              .map((f: any) => normalizeRawField(f))
              .filter(Boolean);
            return {
              uuid: String(raw?.uuid || raw?.id || ''),
              formTitle: raw?.formTitle || raw?.title,
              formCode: raw?.formCode || raw?.code,
              fields,
            };
          })
          .filter((f: DynamicForm) => f.uuid && f.fields.length > 0);
        setCustomForms(forms);

        // Prefetch each form's submission so the tab dot reflects real
        // completion state on first render — without waiting for the user
        // to open the tab. Independent failures are fine; missing
        // submissions just mean the dot stays red until they save.
        Promise.all(
          forms.map((form: DynamicForm) =>
            authService
              .getProfileFormSubmission(token, form.uuid)
              .then(res => ({form, res}))
              .catch(() => ({form, res: null})),
          ),
        ).then(results => {
          if (cancelled) return;
          const next: Record<string, boolean> = {};
          for (const {form, res} of results) {
            const submissionRecord =
              (res as any)?.data && typeof (res as any).data === 'object'
                ? (res as any).data
                : (res as any) || {};
            const fieldValues =
              submissionRecord?.data &&
              typeof submissionRecord.data === 'object' &&
              !Array.isArray(submissionRecord.data)
                ? submissionRecord.data
                : submissionRecord;
            next[form.uuid] = isFormComplete(form.fields, fieldValues || {});
          }
          setCustomFormStatuses(next);
        });
      })
      .catch(() => {
        if (!cancelled) {
          setCustomForms([]);
          setCustomFormStatuses({});
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, accountType]);

  // Fetch role-specific picker options used by secondary tabs.
  useEffect(() => {
    if (!baseUrl || !accountType) {
      return;
    }
    if (
      accountType !== 'investor' &&
      accountType !== 'mentor' &&
      accountType !== 'service_provider'
    ) {
      return;
    }
    let cancelled = false;

    const keys =
      accountType === 'investor'
        ? 'investment_stages,investment_preferences,investability_metrics,business_models,organization_types'
        : accountType === 'service_provider'
          ? 'service_provider_types,service_provider_categories'
          : 'domain_areas';

    fetch(`${baseUrl}api/v1/public/global/custom/${keys}`)
      .then(res => res.json())
      .then(payload => {
        if (cancelled) return;
        const d = payload?.data || {};
        if (accountType === 'investor') {
          setInvestmentStageOptions(toIdName(d.investment_stages));
          setInvestmentPreferenceOptions(toIdName(d.investment_preferences));
          setAbilityMetricOptions(toIdName(d.investability_metrics));
          setBusinessModelOptions(toIdName(d.business_models));
          setOrganizationTypeOptions(toIdName(d.organization_types));
        } else if (accountType === 'service_provider') {
          setServiceProviderTypeOptions(toIdName(d.service_provider_types));
          setServiceProviderCategoryOptions(
            toIdName(d.service_provider_categories),
          );
        } else {
          setDomainAreaOptions(toIdName(d.domain_areas));
        }
      })
      .catch(() => {
        // Picker options absent — secondary tab will simply hide those sections.
      });

    return () => {
      cancelled = true;
    };
  }, [baseUrl, accountType]);

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
  }, [token, baseUrl]);

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
        // GET /ongoing-commitments returns a bare array (not wrapped in
        // {data: [...]}). Accept either shape for safety.
        const commitments = Array.isArray(commitmentsResponse)
          ? commitmentsResponse
          : Array.isArray(commitmentsResponse?.data)
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
    if (!baseUrl) {
      return;
    }

    let cancelled = false;

    fetch(customGlobalEndpoint(baseUrl))
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
        setBasicBusinessModelOptions(toIdName(payload?.data?.business_models));
        setProductStageOptions(toIdName(payload?.data?.product_stages));
      })
      .catch(() => {
        if (!cancelled) {
          setIndustryOptions([]);
          setTechnologyOptions([]);
          setPrimaryIndustryOptions([]);
          setBasicBusinessModelOptions([]);
          setProductStageOptions([]);
        }
      });

    return () => {
      cancelled = true;
    };
    // baseUrl must be in deps — it arrives asynchronously from TenantContext,
    // and without re-running the effect the productStageOptions /
    // businessModelOptions stay empty. That breaks the productStageId lookup
    // at save time (sends null, which clears the field server-side).
  }, [baseUrl]);

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
        const normalized = ensureBasicInfoDefaults(extracted.basicInfo);
        setBasicInfo(normalized);
        initialBasicInfoRef.current = normalized;
        setFinancialInfo(extracted.financials);
        const root = raw?.data || raw || {};
        const productInfo = root?.productInformation || {};
        initialProductInfoRef.current = {
          haveIP: productInfo?.haveIP ?? null,
          ipStatus: productInfo?.ipStatus ?? null,
          ipCountry: productInfo?.ipCountry ?? null,
        };
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
        const otherInds = Array.isArray(root?.startupOtherIndustries)
          ? root.startupOtherIndustries
          : [];
        setOtherIndustriesActive(otherInds.length > 0);
        setOtherIndustriesText(otherInds.join(','));
        const otherTech = Array.isArray(root?.startupOtherTechnologies)
          ? root.startupOtherTechnologies
          : [];
        setOtherTechActive(otherTech.length > 0);
        setOtherTechText(otherTech.join(','));
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
    // logoBaseUrl deliberately omitted from deps: it changes once when the
    // tenant config finishes loading and would otherwise re-fetch the whole
    // profile. extractProfile only uses it to build image URLs — stale by
    // one tick is acceptable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, accountType]);

  useEffect(() => {
    const countryId = getCountryIdByName(basicInfo.country, countryOptions);

    if (!countryId || !baseUrl) {
      setStateOptions([]);
      return;
    }

    let cancelled = false;

    fetch(`${statesEndpoint(baseUrl)}/${countryId}`)
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
  }, [basicInfo.country, countryOptions, baseUrl]);

  useEffect(() => {
    const stateId =
      stateOptions.find(option => option.name === basicInfo.state)?.id ||
      getStateIdByName(basicInfo.country, basicInfo.state);

    if (!stateId || !baseUrl) {
      setCityOptions([]);
      return;
    }

    let cancelled = false;

    fetch(`${citiesEndpoint(baseUrl)}/${stateId}`)
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
  }, [basicInfo.country, basicInfo.state, stateOptions, baseUrl]);

  const baseTabsForRole: EditProfileTab[] = buildEditTabs(
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

  // Tenant-defined custom profile forms appended after the built-in tabs.
  // Each form is one tab keyed by `custom:<uuid>` so we can dispatch by key.
  const tabs: EditProfileTab[] = [
    ...baseTabsForRole,
    ...customForms.map(form => ({
      key: `custom:${form.uuid}`,
      label: form.formTitle || form.formCode || 'Form',
      status: (customFormStatuses[form.uuid]
        ? 'complete'
        : 'incomplete') as 'complete' | 'incomplete',
    })),
  ];

  useEffect(() => {
    if (!tabs.some(tab => tab.key === activeTab) && tabs.length > 0) {
      setActiveTab(tabs[0].key);
    }
  }, [activeTab, tabs]);

  // Keep the active tab visible in the horizontal tab strip. The onLayout
  // handler on each tab Pressable populates tabPositionsRef; on any
  // activeTab change (tap, Next/Previous, programmatic) we scroll the
  // strip so the active pill is in view. Without this, users on later
  // tabs (Pitch / Financials) couldn't tell which tab was active because
  // the strip stayed pinned at the start.
  useEffect(() => {
    const x = tabPositionsRef.current[activeTab];
    if (typeof x !== 'number') return;
    // Slight delay lets layout settle after activeTab-driven re-render.
    const id = setTimeout(() => {
      tabsScrollRef.current?.scrollTo({
        x: Math.max(0, x - 16),
        animated: true,
      });
    }, 0);
    return () => clearTimeout(id);
  }, [activeTab]);

  // Profile completion comes from the backend's profile_completeness endpoint
  // so this screen matches the Dashboard's number exactly. The local
  // calculateProfileCompletion fallback applies only before the backend value
  // arrives (avoids showing 0% during the brief fetch window).
  const localCompletion = calculateProfileCompletion(basicInfo);
  const profileCompletion =
    backendCompletion != null ? backendCompletion : localCompletion;

  const updateBasic = <K extends keyof BasicInfoFormType>(
    key: K,
    value: BasicInfoFormType[K],
  ) => {
    setBasicInfo(current =>
      ensureBasicInfoDefaults({...current, [key]: value}),
    );
  };

  const updateFinancial = <K extends keyof FinancialsFormType>(
    key: K,
    value: FinancialsFormType[K],
  ) => {
    setFinancialInfo(current => ({...current, [key]: value}));
  };

  // Required-field validator for the active tab. Drives the SAVE button's
  // disabled state so users can't submit an incomplete form. Only enforces
  // tabs whose Save we own (basic/industry/financials); custom forms manage
  // their own completeness via [[customFormStatuses]].
  const isActiveTabValid = () => {
    if (activeTab === 'basic') {
      if (accountType && accountType !== 'startup') return true;
      if (!basicInfo.companyName?.trim()) return false;
      if (!basicInfo.companySize) return false;
      if (basicInfo.isIncorporated === null) return false;
      if (
        basicInfo.isIncorporated === true &&
        (!basicInfo.incorporationYear ||
          basicInfo.incorporationYear.length !== 4)
      ) {
        return false;
      }
      if (!basicInfo.country) return false;
      if (!basicInfo.productStage) return false;
      if (!basicInfo.leadership.some(member => member.name?.trim())) {
        return false;
      }
      return true;
    }
    if (activeTab === 'industry') {
      if (accountType && accountType !== 'startup') return true;
      if (selectedIndustryIds.length === 0) return false;
      if (selectedTechnologyIds.length === 0) return false;
      return true;
    }
    if (activeTab === 'financials') {
      if (
        !financialInfo.fundingStage &&
        !financialInfo.targetFundraise?.trim()
      ) {
        return false;
      }
      return true;
    }
    return true;
  };

  const refreshOngoingCommitments = async () => {
    if (!accountType) return;
    try {
      const res = await authService.getOngoingCommitments(token, accountType);
      // Endpoint returns a bare array; fall back to {data: [...]} just in case.
      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
          ? res.data
          : [];
      setOngoingCommitments(list);
    } catch {
      // Refresh is best-effort — keep whatever we already have on screen.
    }
  };

  const handleSaveCommitment = async (payload: {
    uuid?: string;
    investorName: string;
    amountRaised: string;
    preMoneyValuation: string;
    hideInvestorName: boolean;
  }) => {
    await authService.saveOngoingCommitment(token, payload);
    await refreshOngoingCommitments();
  };

  const handleDeleteCommitment = async (uuid: string) => {
    await authService.deleteOngoingCommitment(token, uuid);
    await refreshOngoingCommitments();
  };

  const handleSave = async () => {
    if (!isActiveTabValid()) {
      toast.error('Please fill all required fields.');
      return;
    }
    setIsSaving(true);
    try {
      // Custom (tenant-defined) profile forms expose an imperative save()
      // via ref. Route the global footer Save there and surface its result
      // through the global toast.
      if (activeTab.startsWith('custom:')) {
        const uuid = activeTab.slice('custom:'.length);
        const handle = customFormRefs.current[uuid];
        if (!handle) {
          toast.error('Form is not ready yet.');
          return;
        }
        const result = await handle.save();
        if (result.ok) {
          toast.success(result.message || 'Saved.');
          onProfileUpdated?.();
        } else {
          toast.error(result.message || 'Could not save.');
        }
        return;
      }
      if (activeTab === 'industry') {
        const otherIndustryList = otherIndustriesActive
          ? otherIndustriesText
              .split(',')
              .map(s => s.trim())
              .filter(Boolean)
          : [];
        const otherTechnologyList = otherTechActive
          ? otherTechText
              .split(',')
              .map(s => s.trim())
              .filter(Boolean)
          : [];
        await authService.updateIndustryTechnologyBusiness(token, {
          industryDomainIds: selectedIndustryIds,
          technologyDomainIds: selectedTechnologyIds,
          industryDomainPrimaryId: selectedPrimaryIndustryId,
          industrySubCategoryDomainIds: [],
          otherIndustryDomains: otherIndustryList,
          otherTechnologyDomains: otherTechnologyList,
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
        // Mirror the web flow: after financials PATCH, also flip the
        // raising-funds master toggle and reload the persisted state so the
        // form (and any commitments list) refreshes with the server's truth.
        try {
          await authService.toggleRaisingFunds(
            token,
            financialInfo.isRaisingFunds,
          );
        } catch {
          // Toggle is best-effort — financials PATCH already succeeded.
        }
        // Silent reload — non-silent flips isLoading and replaces the form
        // with the centered spinner, which unmounts the ScrollView and
        // resets scroll position + active tab.
        await loadProfile({silent: true});
        await refreshOngoingCommitments();
      } else {
        // Always update the core /startup-information record.
        await authService.updateProfile(
          token,
          buildBasicInfoPayload(basicInfo),
          accountType || undefined,
        );

        // For the startup Basic Info tab, fan out updates to the five
        // sub-resources only when their data actually changed. Each sub-PATCH
        // hits a dedicated endpoint and runs in parallel; if any fail we
        // surface the first error but the core save above is already through.
        const initial = initialBasicInfoRef.current;
        if (accountType === 'startup' || !accountType) {
          const subPatches: Array<Promise<unknown>> = [];

          // 1) Business models — resolve names to ids using the
          // server-fetched options. Skip names with no match.
          const businessModelsChanged =
            !initial ||
            !arraysEqualUnordered(
              initial.businessModels,
              basicInfo.businessModels,
            );
          if (businessModelsChanged) {
            const idByName = new Map<string, number>(
              basicBusinessModelOptions.map(opt => [opt.name, opt.id]),
            );
            const businessModelIds = basicInfo.businessModels
              .map(name => idByName.get(name))
              .filter((id): id is number => typeof id === 'number');
            subPatches.push(
              authService.updateIndustryTechnologyBusiness(token, {
                businessModelIds,
              }),
            );
          }

          // 2) Pitch deck — only the elevator pitch lives in the Basic Info
          // form. PATCH /pitch-deck with just that field.
          if (initial && initial.elevatorPitch !== basicInfo.elevatorPitch) {
            subPatches.push(
              authService.updatePitchDeck(token, {
                elevatorPitch: basicInfo.elevatorPitch,
              }),
            );
          }

          // 3) Product information — productStage (resolved to id) +
          // description (companyBrief). IP fields are echoed back from the
          // server snapshot so this PATCH doesn't blank them out.
          const productInfoChanged =
            initial &&
            (initial.productStage !== basicInfo.productStage ||
              initial.companyBrief !== basicInfo.companyBrief);
          if (productInfoChanged) {
            const stageId = productStageOptions.find(
              opt => opt.name === basicInfo.productStage,
            )?.id;
            // Defensive: if the server options haven't loaded yet OR the
            // selected name doesn't map to a known id (legacy data), skip
            // sending productStageId entirely so we don't accidentally
            // wipe the field. The description still goes through.
            const payload: Record<string, unknown> = {
              description: basicInfo.companyBrief,
              haveIP: initialProductInfoRef.current.haveIP,
              ipStatus: initialProductInfoRef.current.ipStatus,
              ipCountry: initialProductInfoRef.current.ipCountry,
            };
            if (stageId != null) {
              payload.productStageId = stageId;
            }
            subPatches.push(
              authService.updateProductInformation(token, payload),
            );
          }

          // 4 & 5) Advisors / Founders — PATCH each existing member (has a
          // server uuid) whose row was edited. Newly-added rows without a
          // uuid are skipped here; they need a POST endpoint to create.
          if (initial) {
            const initialAdvisoryByUuid = new Map(
              initial.advisory
                .filter(m => m.uuid)
                .map(m => [m.uuid as string, m]),
            );
            for (const member of basicInfo.advisory) {
              if (!member.uuid) continue;
              const prev = initialAdvisoryByUuid.get(member.uuid);
              if (
                !prev ||
                prev.name !== member.name ||
                prev.linkedinUrl !== member.linkedinUrl
              ) {
                subPatches.push(
                  authService.updateAdvisoryBoard(token, member.uuid, {
                    uuid: member.uuid,
                    name: member.name,
                    linkedinUrl: member.linkedinUrl,
                  }),
                );
              }
            }

            const initialLeadershipByUuid = new Map(
              initial.leadership
                .filter(m => m.uuid)
                .map(m => [m.uuid as string, m]),
            );
            for (const member of basicInfo.leadership) {
              if (!member.uuid) continue;
              const prev = initialLeadershipByUuid.get(member.uuid);
              if (
                !prev ||
                prev.name !== member.name ||
                prev.linkedinUrl !== member.linkedinUrl ||
                prev.role !== member.role ||
                prev.designation !== member.designation
              ) {
                subPatches.push(
                  authService.updateFounder(token, member.uuid, {
                    uuid: member.uuid,
                    name: member.name,
                    linkedinUrl: member.linkedinUrl,
                    // Send both `role` and `accountRole` — the extractor
                    // reads either, and different deployments store this
                    // under one name or the other. Belt-and-suspenders
                    // ensures the update lands on whichever the server
                    // actually persists.
                    role: member.role,
                    accountRole: member.role,
                    designation: member.designation,
                  }),
                );
              }
            }
          }

          if (subPatches.length > 0) {
            await Promise.all(subPatches);
          }
        }

        // Refetch the profile so the form reflects any server-side
        // normalization (trimmed strings, server-issued IDs/timestamps) and
        // resets the diff baseline. `silent: true` keeps the loading view
        // from flashing over the save success message.
        await loadProfile({silent: true});
      }

      toast.success('Saved successfully.');
      // Refresh the parent's dashboard widgets (profile-completion ring,
      // stat tiles) so they reflect the new state without waiting for the
      // user to navigate back.
      onProfileUpdated?.();
      // Also pull the backend's own profile_completeness number now so the
      // header ring on this screen updates immediately.
      if (accountType) {
        authService
          .getProfileCompletion(token, accountType, investorSubtype)
          .then(res => {
            const raw = (res?.data?.percentage ?? res?.percentage) as
              | number
              | string
              | undefined;
            const num = Number(raw);
            if (Number.isFinite(num)) setBackendCompletion(num);
          })
          .catch(() => {
            /* leave the existing value in place if the refresh fails */
          });
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not save your changes.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleNext = () => {
    const currentIndex = tabs.findIndex(tab => tab.key === activeTab);
    const next = tabs[currentIndex + 1];
    if (next) setActiveTab(next.key);
  };

  const handlePrevious = () => {
    const currentIndex = tabs.findIndex(tab => tab.key === activeTab);
    const prev = tabs[currentIndex - 1];
    if (prev) setActiveTab(prev.key);
  };

  // Tenant-configurable selection caps. Frontend reads the same two settings
  // from globalSettings and applies them per tenant; default = 3.
  const maxIndustries = Math.max(
    1,
    Number(globalSetting?.startupMaxIndustries) || 3,
  );
  const maxTechnologies = Math.max(
    1,
    Number(globalSetting?.startupMaxTechnologies) || 3,
  );

  const toggleLimitedSelection = (
    current: number[],
    id: number,
    setter: (value: number[]) => void,
    label: string,
    max: number,
  ) => {
    const exists = current.includes(id);
    if (exists) {
      setter(current.filter(item => item !== id));
      return;
    }

    if (current.length >= max) {
      Alert.alert('Limit reached', `You can select maximum ${max} ${label}.`);
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

      // Optimistic local preview while the upload runs — the field flips to
      // the server-stored path once the response lands.
      updateBasic('logoUrl', asset.uri);
      try {
        const mime = asset.type || 'image/png';
        const extFromMime = mime.split('/')[1] || 'png';
        const res = await authService.uploadStartupLogo(token, {
          uri: asset.uri,
          name: asset.fileName || `logo-${Date.now()}.${extFromMime}`,
          type: mime,
        });
        // Backend returns the stored path under varying keys depending on
        // version. Grab the first non-empty string we find.
        const record =
          (res as any)?.data && typeof (res as any).data === 'object'
            ? (res as any).data
            : (res as any) || {};
        const storedPath =
          (typeof record === 'string' && record) ||
          (typeof record.logo === 'string' && record.logo) ||
          (typeof record.logoUrl === 'string' && record.logoUrl) ||
          (typeof record.path === 'string' && record.path) ||
          (typeof record.filePath === 'string' && record.filePath) ||
          (typeof record.url === 'string' && record.url) ||
          (typeof record.avatar === 'string' && record.avatar) ||
          '';
        if (storedPath) {
          updateBasic('logoUrl', storedPath);
        }
      } catch (uploadErr) {
        Alert.alert(
          'Logo upload failed',
          uploadErr instanceof Error
            ? uploadErr.message
            : 'Could not upload the logo. Please try again.',
        );
        // Revert the optimistic preview so the user knows the upload didn't
        // persist.
        updateBasic('logoUrl', null);
      }
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
      // The form stores role as the snake_case enum value (e.g. "co_founder")
      // because that's what the /founders PATCH expects. The Picker UI is
      // label-based, so convert at both edges. Prefer the tenant-configured
      // memberRoles from global settings (same source web uses); fall back
      // to the hardcoded FOUNDER_ROLES if the tenant didn't ship it.
      const tenantRoles = Array.isArray(globalSetting?.memberRoles)
        ? globalSetting!.memberRoles!
        : [];
      const roles =
        tenantRoles.length > 0
          ? tenantRoles
          : [
              {name: 'Founder', value: 'founder'},
              {name: 'Co-Founder', value: 'co_founder'},
              {name: 'Executive Leadership', value: 'executive_leadership'},
            ];
      const labelByValue = new Map(roles.map(r => [r.value, r.name]));
      const valueByLabel = new Map(roles.map(r => [r.name, r.value]));
      const currentValue = basicInfo.leadership[picker.index]?.role || '';
      return (
        <Picker
          visible
          title="Select role"
          options={roles.map(r => r.name)}
          selected={labelByValue.get(currentValue) || currentValue}
          primaryColor={primaryColor}
          onClose={closePicker}
          onSelect={label => {
            const member = basicInfo.leadership[picker.index];
            if (!member) {
              closePicker();
              return;
            }

            const nextLeadership = basicInfo.leadership.map((entry, index) =>
              index === picker.index
                ? {...entry, role: valueByLabel.get(label) || label}
                : entry,
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
          searchable
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
          searchable
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
          searchable
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
        // Prefer the server-driven options so the selected name exactly
        // matches an entry in productStageOptions at save time. The
        // productStageId lookup is `find(opt => opt.name === selection)`;
        // if the user picked a static-list name like "MVP" but the server
        // only knows "MVP or POC", the lookup returned undefined and the
        // PATCH cleared the field. Falling back to the static list only
        // while the server response is still loading.
        options={
          productStageOptions.length > 0
            ? productStageOptions.map(opt => opt.name)
            : PRODUCT_STAGES
        }
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
      <View style={styles.headerBlock}>
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
        <ScrollView
          ref={tabsScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          // style constrains the ScrollView to the parent's width — without
          // this, horizontal ScrollViews in RN grow to fit their content and
          // never trigger the scroll mechanism.
          style={styles.tabsStrip}
          contentContainerStyle={styles.tabsRow}>
          {tabs.map(tab => {
            const isActive = tab.key === activeTab;
            const isComplete = tab.status === 'complete';
            return (
              <Pressable
                key={tab.key}
                onLayout={e => {
                  tabPositionsRef.current[tab.key] = e.nativeEvent.layout.x;
                }}
                onPress={() => {
                  setActiveTab(tab.key);
                  const x = tabPositionsRef.current[tab.key] ?? 0;
                  tabsScrollRef.current?.scrollTo({
                    x: Math.max(0, x - 16),
                    animated: true,
                  });
                }}
                style={[
                  styles.tab,
                  isActive && {borderBottomColor: primaryColor},
                ]}>
                <View
                  style={[
                    styles.tabStatusDot,
                    {
                      backgroundColor: isComplete
                        ? colors.success
                        : colors.danger,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.tabText,
                    isActive && styles.tabTextActive,
                    isActive && {color: primaryColor},
                  ]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        </View>
      </View>

      <FormScrollView
        contentContainerStyle={styles.content}
        alwaysBounceVertical={false}
        bounces={false}
        // Default deceleration is "normal" (~0.998 iOS / ~0.985 Android), which
        // feels too slow on a long form. "fast" gives a snappier coast that
        // matches user expectation for a scrollable settings page.
        decelerationRate="fast"
        overScrollMode="never">
        {activeTab === 'basic' ? (
          accountType === 'startup' || !accountType ? (
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
          ) : (
            <RoleBasicInfoTab
              accountType={accountType}
              investorSubtype={investorSubtype}
              initialData={startupInfo}
              primaryColor={primaryColor}
              isSaving={isSaving}
              token={token}
              onLogoUploaded={() => loadProfile({silent: true})}
              industryOptions={industryOptions}
              dropdownData={{
                organization_types: organizationTypeOptions,
                // Tenant-defined company-size buckets for corporate role
                // (e.g. "1-10", "11-50", ...). Comes from
                // globalSetting.CorporateSizes — same source the frontend
                // corporate-intro page reads from.
                corporate_sizes: (globalSetting?.CorporateSizes || []).map(
                  s => ({id: s.value, name: s.name}),
                ),
                service_provider_types: serviceProviderTypeOptions,
                service_provider_categories: serviceProviderCategoryOptions,
                // Static list — frontend's partner-intro page hardcodes the
                // same three values (incubator / accelerator /
                // association-organization). String IDs because the backend
                // stores `partnerType` as a slug, not a numeric id.
                partner_types: [
                  {id: 'incubator', name: 'Incubator'},
                  {id: 'accelerator', name: 'Accelerator'},
                  {
                    id: 'association-organization',
                    name: 'Association / Organization',
                  },
                ],
              }}
              onSave={async payload => {
                try {
                  setIsSaving(true);
                  await authService.updateProfile(
                    token,
                    payload,
                    accountType || undefined,
                  );
                  toast.success('Profile updated.');
                  onProfileUpdated?.();
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : 'Could not save your profile.',
                  );
                } finally {
                  setIsSaving(false);
                }
              }}
            />
          )
        ) : activeTab === 'industry' && accountType === 'service_provider' ? (
          <ServiceProviderIndustryTab
            token={token}
            primaryColor={primaryColor}
            initialData={startupInfo}
            industryOptions={industryOptions}
          />
        ) : activeTab === 'industry' && accountType === 'partner' ? (
          <PartnerIndustryTab
            token={token}
            primaryColor={primaryColor}
            initialData={startupInfo}
            industryOptions={industryOptions}
            technologyOptions={technologyOptions}
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
              <Text style={styles.domainHint}>
                Select maximum {maxIndustries} options
              </Text>
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
                          maxIndustries,
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
              <Text style={styles.domainHint}>
                Select maximum {maxTechnologies} options
              </Text>
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
                          maxTechnologies,
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
              <View style={styles.otherToggleRow}>
                <Text style={styles.domainHeading}>Add other industries</Text>
                <Switch
                  value={otherIndustriesActive}
                  onValueChange={value => {
                    setOtherIndustriesActive(value);
                    if (!value) setOtherIndustriesText('');
                  }}
                  trackColor={{false: '#cbd5e1', true: `${primaryColor}55`}}
                  thumbColor={
                    otherIndustriesActive ? primaryColor : '#f1f5f9'
                  }
                />
              </View>
              {otherIndustriesActive ? (
                <>
                  <Text style={styles.domainHint}>
                    Separate multiple entries with commas.
                  </Text>
                  <TextInput
                    style={styles.otherInput}
                    value={otherIndustriesText}
                    onChangeText={setOtherIndustriesText}
                    placeholder="e.g. AgriTech, ClimateTech"
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="words"
                  />
                </>
              ) : null}
            </View>

            <View style={styles.domainSection}>
              <View style={styles.otherToggleRow}>
                <Text style={styles.domainHeading}>Add other technologies</Text>
                <Switch
                  value={otherTechActive}
                  onValueChange={value => {
                    setOtherTechActive(value);
                    if (!value) setOtherTechText('');
                  }}
                  trackColor={{false: '#cbd5e1', true: `${primaryColor}55`}}
                  thumbColor={otherTechActive ? primaryColor : '#f1f5f9'}
                />
              </View>
              {otherTechActive ? (
                <>
                  <Text style={styles.domainHint}>
                    Separate multiple entries with commas.
                  </Text>
                  <TextInput
                    style={styles.otherInput}
                    value={otherTechText}
                    onChangeText={setOtherTechText}
                    placeholder="e.g. Edge ML, Quantum"
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="words"
                  />
                </>
              ) : null}
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
            onSaveCommitment={handleSaveCommitment}
            onDeleteCommitment={handleDeleteCommitment}
          />
        ) : activeTab === 'pitch' ? (
          <View>
            <YourPitchDeck
              primaryColor={primaryColor}
              pitchDeck={startupInfo?.pitchDeck}
              token={token}
              // Silent reload — keeps the ScrollView mounted so the user
              // stays in the same scroll position and active tab. The pitch
              // deck preview / file card props simply update in place from
              // the new startupInfo.
              onUploaded={() => loadProfile({silent: true})}
            />
            <Documents
              token={token}
              primaryColor={primaryColor}
              onUploaded={() => loadProfile({silent: true})}
            />
          </View>
        ) : activeTab === 'investment_details' ||
          activeTab === 'investment_thesis' ? (
          <InvestorInvestmentsTab
            token={token}
            primaryColor={primaryColor}
            initialData={startupInfo}
            industryOptions={industryOptions}
            mechanismOptions={investmentMechanismOptions}
            stageOptions={investmentStageOptions}
            preferenceOptions={investmentPreferenceOptions}
            abilityMetricOptions={abilityMetricOptions}
            businessModelOptions={businessModelOptions}
            maxIndustries={
              Math.max(1, Number(globalSetting?.investorMaxIndustries) || 5)
            }
            maxAbilityMetrics={
              Math.max(
                1,
                Number(globalSetting?.investorMaxInvestabilityMetrics) || 7,
              )
            }
          />
        ) : activeTab === 'representative' ? (
          <InvestorRepresentativeTab
            token={token}
            primaryColor={primaryColor}
          />
        ) : activeTab === 'domain_expertise' ? (
          <MentorDomainExpertiseTab
            token={token}
            primaryColor={primaryColor}
            initialData={startupInfo}
            industryOptions={industryOptions}
            technologyOptions={technologyOptions}
            domainAreaOptions={domainAreaOptions}
          />
        ) : activeTab === 'engagement' ? (
          <CorporateEngagementTab
            token={token}
            primaryColor={primaryColor}
            initialData={startupInfo}
            reasonOptions={
              Array.isArray(globalSetting?.features?.connect_with_startups)
                ? globalSetting.features.connect_with_startups.map(
                    (item: any, i: number) => ({
                      id: item.id ?? item.value ?? i,
                      name: String(item.name ?? item.label ?? item),
                    }),
                  )
                : []
            }
          />
        ) : activeTab.startsWith('custom:') ? (
          (() => {
            const uuid = activeTab.slice('custom:'.length);
            const form = customForms.find(f => f.uuid === uuid);
            if (!form) {
              return null;
            }
            return (
              <CustomFormTab
                ref={handle => {
                  customFormRefs.current[form.uuid] = handle;
                }}
                token={token}
                form={form}
                primaryColor={primaryColor}
                onCompletionChange={complete =>
                  setCustomFormStatuses(prev =>
                    prev[form.uuid] === complete
                      ? prev
                      : {...prev, [form.uuid]: complete},
                  )
                }
              />
            );
          })()
        ) : (
          <View style={styles.placeholder}>
            <Icon name="hammer-wrench" size={32} color="#94a3b8" />
            <Text style={styles.placeholderTitle}>Available on web</Text>
            <Text style={styles.placeholderBody}>
              This section is part of the upcoming mobile release. Use the web
              app for now.
            </Text>
          </View>
        )}
      </FormScrollView>

      {renderPicker()}

      <View style={styles.footer}>
        {(() => {
          const currentIndex = tabs.findIndex(tab => tab.key === activeTab);
          const isFirst = currentIndex <= 0;
          const isLast = currentIndex >= tabs.length - 1;
          // Pitch Deck has its own upload UI (YourPitchDeck + Documents),
          // not a form to save — hide the global SAVE on that tab entirely.
          const hideSave = activeTab === 'pitch';
          // Global Save handles the startup-flow tabs plus any custom
          // (tenant-defined) form tab. Per-role secondary tabs render
          // their own internal Save button, so disable the global one
          // there.
          const isCustomTab = activeTab.startsWith('custom:');
          const activeCustomUuid = isCustomTab
            ? activeTab.slice('custom:'.length)
            : '';
          const saveDisabled =
            isSaving ||
            (accountType ? accountType !== 'startup' : false) ||
            (activeTab !== 'basic' &&
              activeTab !== 'industry' &&
              activeTab !== 'financials' &&
              !isCustomTab) ||
            // For custom forms: block save until every required field is
            // filled. The status is tracked by CustomFormTab's
            // onCompletionChange callback.
            (isCustomTab && !customFormStatuses[activeCustomUuid]) ||
            // For built-in tabs: block save until the tab's own required
            // fields are filled (companyName/companySize/country/...).
            (!isCustomTab && !isActiveTabValid());
          return (
            <>
              {!isFirst ? (
                <View style={styles.footerSlot}>
                  <AppButton
                    label="PREVIOUS"
                    variant="secondary"
                    onPress={handlePrevious}
                    style={styles.navButton}
                    labelStyle={styles.navButtonLabel}
                  />
                </View>
              ) : null}
              {!hideSave ? (
                <View style={styles.footerSlot}>
                  <AppButton
                    label={isSaving ? 'Saving…' : 'SAVE'}
                    disabled={saveDisabled}
                    loading={isSaving}
                    onPress={handleSave}
                    labelStyle={styles.actionButtonLabel}
                  />
                </View>
              ) : null}
              {!isLast ? (
                <View style={styles.footerSlot}>
                  <AppButton
                    label="NEXT"
                    variant="secondary"
                    onPress={handleNext}
                    style={styles.navButton}
                    labelStyle={styles.navButtonLabel}
                  />
                </View>
              ) : null}
            </>
          );
        })()}
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
  headerBlock: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
  },
  header: {
    alignItems: 'center',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
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
    marginTop: 10,
    marginBottom: 6,
    overflow: 'hidden',
  },
  completionFill: {
    borderRadius: 999,
    height: '100%',
  },
  tabsSection: {
    backgroundColor: '#ffffff',
    // Match the 16px horizontal padding the form cards below use so the tab
    // strip's left/right edges line up with the card edges instead of
    // bleeding to the screen edge.
    paddingHorizontal: 16,
    alignSelf: 'stretch',
  },
  tabsRow: {
    flexDirection: 'row',
  },
  tabsStrip: {
    // Pin the ScrollView's viewport to the parent's width. Without this it
    // sizes to its content and overflow scroll never engages because there's
    // nothing overflowing the visible viewport — finger scroll won't fire.
    width: '100%',
    flexGrow: 0,
  },
  tab: {
    alignItems: 'center',
    borderBottomColor: 'transparent',
    borderBottomWidth: 2,
    flexDirection: 'row',
    flexShrink: 0,
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  tabStatusDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  tabText: {
    color: '#64748b',
    fontSize: 14,
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
  otherToggleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  otherInput: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 10,
    borderWidth: 1,
    color: '#0f172a',
    fontSize: 15,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
  // PREVIOUS / NEXT buttons: black pill (overrides AppButton's secondary
  // outline) to match the design.
  navButton: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  navButtonLabel: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  // Smaller, tighter label for the global action button (SAVE) so it sits
  // comfortably alongside PREVIOUS / NEXT in the footer row.
  actionButtonLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
});
