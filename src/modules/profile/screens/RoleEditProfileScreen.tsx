import React, {useContext, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {AppButton} from '../../../core/components/AppButton';
import {colors} from '../../../core/theme/colors';
import {TenantContext} from '../../../core/tenant/TenantProvider';
import {useToast} from '../../../core/toast/ToastProvider';
import {authService} from '../../auth/services/auth.service';
import {CorporateEngagementTab} from './editProfile/corporate/CorporateEngagementTab';
import {
  CustomFormTab,
  CustomFormTabHandle,
  DynamicForm,
  isFormComplete,
  normalizeRawField,
} from './editProfile/shared/CustomFormTab';
import {InvestorInvestmentsTab} from './editProfile/investor/InvestorInvestmentsTab';
import {InvestorRepresentativeTab} from './editProfile/investor/InvestorRepresentativeTab';
import {
  MentorDomainExpertiseTab,
  SecondaryTabHandle,
} from './editProfile/mentor/MentorDomainExpertiseTab';
import {PartnerIndustryTab} from './editProfile/partner/PartnerIndustryTab';
import {RoleBasicInfoTab, RoleBasicInfoTabHandle} from './editProfile/shared/RoleBasicInfoTab';
import {ServiceProviderIndustryTab} from './editProfile/service_provider/ServiceProviderIndustryTab';
import {
  detectInvestorSubtype,
  getTabLayout,
  InvestorSubtype,
} from './editProfile/shared/tabConfig';
import type {EditProfileTab} from '../../home/types';
import type {MultiSelectOption} from './editProfile/shared/MultiSelectField';

// ─── helpers ─────────────────────────────────────────────────────────────────

type DomainOption = {
  id: number;
  name: string;
  isActive?: boolean;
  industrySubCategoryDomains?: Array<{id: number; name: string}>;
};

const toIdName = (raw: any): Array<{id: number; name: string}> => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item: any) => ({
      id: Number(item?.id ?? item?.value ?? item?._id),
      name: String(item?.name ?? item?.label ?? '').trim(),
    }))
    .filter((item: {id: number; name: string}) =>
      Number.isFinite(item.id) && Boolean(item.name),
    );
};

// Build MultiSelectOption[] from the flat domain_areas API response.
// Items with primaryDomainAreaId === null are parents; others are children.
// When newLayout is true we nest children under their parent (as domainAreas[]).
// When false we return a flat list (old layout — all items selectable directly).
const buildDomainAreaOptions = (
  raw: any[],
  newLayout: boolean,
): MultiSelectOption[] => {
  if (!Array.isArray(raw)) { return []; }
  const active = raw.filter(
    item =>
      item.isActive !== false &&
      String(item?.name ?? '').trim() &&
      Number.isFinite(Number(item?.id)),
  );
  if (!newLayout) {
    return active.map(item => ({
      id: Number(item.id),
      name: String(item.name).trim(),
    }));
  }
  // New layout: group leaf items under their parents.
  const parents = active.filter(
    item =>
      item.primaryDomainAreaId === null ||
      item.primaryDomainAreaId === undefined,
  );
  return parents.map(p => ({
    id: Number(p.id),
    name: String(p.name).trim(),
    domainAreas: active
      .filter(c => c.primaryDomainAreaId === p.id)
      .map(c => ({id: Number(c.id), name: String(c.name).trim()}))
      .filter(c => c.name),
  }));
};

// Maps each investor tab key to the corresponding key in data.forms from the
// profile_completeness API response.
const INVESTOR_TAB_FORM_KEYS: Record<string, string> = {
  basic: 'investorInformation',
  investment_details: 'investmentDetails',
  investment_thesis: 'investmentThesis',
  representative: 'representativeDetails',
};

// ─── types ────────────────────────────────────────────────────────────────────

type CompletionForm = {
  total: number;
  completed: number;
  percentage: number;
  missingFields: string[];
};

type Props = {
  token: string;
  onBack: () => void;
  onPreview?: () => void;
  onProfileUpdated?: () => void;
  // Pass the already-known accountType from HomeScreen's dashboard summary so
  // we don't need to call getProfile() and deal with its response structure.
  initialAccountType?: string;
};

// ─── component ───────────────────────────────────────────────────────────────

export function RoleEditProfileScreen({
  token,
  onBack,
  onPreview,
  onProfileUpdated,
  initialAccountType,
}: Props) {
  const {theme, globalSetting, baseUrl} = useContext(TenantContext);
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const primaryColor = theme?.primary || colors.primary;

  // ── profile / role state ──────────────────────────────────────────────────
  const [accountType, setAccountType] = useState<string | null>(
    initialAccountType ? initialAccountType.toLowerCase() : null,
  );
  const [investorSubtype, setInvestorSubtype] =
    useState<InvestorSubtype>('organization');
  const [profileData, setProfileData] = useState<Record<string, any> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [backendCompletion, setBackendCompletion] = useState<number | null>(null);
  const [completionForms, setCompletionForms] = useState<Record<string, CompletionForm> | null>(null);
  const [canRequestApproval, setCanRequestApproval] = useState(false);
  const [canToggleStatus, setCanToggleStatus] = useState(false);
  const [isApprovalRequested, setIsApprovalRequested] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);

  // ── tab navigation ────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<string>('basic');
  const tabsScrollRef = useRef<ScrollView | null>(null);
  const tabPositionsRef = useRef<Record<string, number>>({});
  const contentScrollRef = useRef<ScrollView | null>(null);

  // ── custom (tenant-defined) forms ─────────────────────────────────────────
  const [customForms, setCustomForms] = useState<DynamicForm[]>([]);
  const [customFormStatuses, setCustomFormStatuses] = useState<
    Record<string, boolean>
  >({});
  const customFormRefs = useRef<Record<string, CustomFormTabHandle | null>>({});

  // ── shared SAVE button gating for RoleBasicInfoTab ────────────────────────
  const [roleFormValid, setRoleFormValid] = useState(false);
  const roleBasicTabRef = useRef<RoleBasicInfoTabHandle>(null);

  // ── investor tab local validity (drives dot colour in real-time) ──────────
  const [investorInvestmentsValid, setInvestorInvestmentsValid] = useState(false);
  const [investorRepresentativeValid, setInvestorRepresentativeValid] = useState(false);

  // ── secondary tab refs ────────────────────────────────────────────────────
  const mentorTabRef = useRef<SecondaryTabHandle>(null);
  const corporateTabRef = useRef<SecondaryTabHandle>(null);
  const investorInvestmentsTabRef = useRef<SecondaryTabHandle>(null);
  const investorRepresentativeTabRef = useRef<SecondaryTabHandle>(null);
  const serviceProviderTabRef = useRef<SecondaryTabHandle>(null);
  const partnerTabRef = useRef<SecondaryTabHandle>(null);

  // ── role-specific secondary tab options ───────────────────────────────────
  const [industryOptions, setIndustryOptions] = useState<DomainOption[]>([]);
  const [technologyOptions, setTechnologyOptions] = useState<DomainOption[]>([]);
  const [investmentStageOptions, setInvestmentStageOptions] = useState<
    Array<{id: number; name: string}>
  >([]);
  const [investmentMechanismOptions, setInvestmentMechanismOptions] = useState<
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
  const [organizationTypeOptions, setOrganizationTypeOptions] = useState<
    Array<{id: number; name: string}>
  >([]);
  const [domainAreaOptions, setDomainAreaOptions] = useState<MultiSelectOption[]>([]);
  const [serviceProviderTypeOptions, setServiceProviderTypeOptions] = useState<
    Array<{id: number; name: string}>
  >([]);
  const [serviceProviderCategoryOptions, setServiceProviderCategoryOptions] =
    useState<Array<{id: number; name: string}>>([]);

  // ── profile load ──────────────────────────────────────────────────────────

  const loadProfile = async ({silent = false}: {silent?: boolean} = {}) => {
    if (!silent) setIsLoading(true);
    setLoadError(null);
    try {
      const raw = await authService.getStartupInformation(
        token,
        accountType || undefined,
      );
      const root = raw?.data || raw || null;
      setProfileData(root);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Could not load your profile.',
      );
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  // Determine role first, then load profile data.
  // Skip when initialAccountType was passed in — the caller already knows the role.
  useEffect(() => {
    if (initialAccountType) return;
    let cancelled = false;
    authService
      .getProfile(token)
      .then(raw => {
        if (cancelled) return;
        const rawUser = raw?.data?.user || raw?.data || {};
        const type = String(rawUser?.accountType || '').toLowerCase();
        const resolved = type || 'mentor';
        setAccountType(resolved);
        setInvestorSubtype(detectInvestorSubtype(rawUser));
      })
      .catch(() => {
        if (!cancelled) setAccountType('mentor');
      });
    return () => {
      cancelled = true;
    };
  }, [token, initialAccountType]);

  useEffect(() => {
    if (!accountType) return;
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountType]);


  // ── custom forms ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!accountType) return;
    let cancelled = false;
    authService
      .listProfileForms(token, accountType)
      .then(res => {
        if (cancelled) return;
        const items = Array.isArray(res?.data) ? res.data : [];
        const forms: DynamicForm[] = items
          .filter((raw: any) => {
            if (raw?.status === false) return false;
            if (raw?.useFormAs && raw.useFormAs !== 'form') return false;
            if (raw?.programs?.length > 0) return false;
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
            const sub =
              (res as any)?.data && typeof (res as any).data === 'object'
                ? (res as any).data
                : (res as any) || {};
            const vals =
              sub?.data && typeof sub.data === 'object' && !Array.isArray(sub.data)
                ? sub.data
                : sub;
            next[form.uuid] = isFormComplete(form.fields, vals || {});
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

  // ── backend completion % ──────────────────────────────────────────────────

  useEffect(() => {
    if (!accountType) return;
    let cancelled = false;
    authService
      .getProfileCompletion(token, accountType, investorSubtype)
      .then(res => {
        if (cancelled) return;
        const d = res?.data ?? res ?? {};
        const num = Number(d.percentage);
        if (Number.isFinite(num)) setBackendCompletion(num);
        const forms = d.forms;
        if (forms && typeof forms === 'object') {
          setCompletionForms(forms as Record<string, CompletionForm>);
        }
        setCanRequestApproval(Boolean(d.canRequestApproval));
        setCanToggleStatus(Boolean(d.canToggleStatus));
        setIsApprovalRequested(Boolean(d.isApprovalRequested));
        setIsApproved(Boolean(d.isApproved));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token, accountType, investorSubtype]);

  // ── role-specific option loading ──────────────────────────────────────────

  useEffect(() => {
    if (!baseUrl || !accountType) return;
    let cancelled = false;

    // Mentor gets a single combined call that includes domain_areas.
    // All other roles with secondary tabs get the standard industries+technologies call.
    if (accountType === 'mentor') {
      const newLayout = Boolean(globalSetting?.features?.mentorship_areas_new_layout);
      fetch(`${baseUrl}api/v1/public/global/custom/industries,technologies,domain_areas`)
        .then(r => r.json())
        .then(payload => {
          if (cancelled) return;
          const d = payload?.data || {};
          setIndustryOptions(toIdName(d.industries));
          setTechnologyOptions(toIdName(d.technologies));
          setDomainAreaOptions(buildDomainAreaOptions(d.domain_areas, newLayout));
        })
        .catch(() => {});
    } else if (['investor', 'service_provider', 'partner', 'corporate'].includes(accountType)) {
      fetch(`${baseUrl}api/v1/public/global/custom/industries,technologies`)
        .then(r => r.json())
        .then(payload => {
          if (cancelled) return;
          const d = payload?.data || {};
          setIndustryOptions(toIdName(d.industries));
          setTechnologyOptions(toIdName(d.technologies));
        })
        .catch(() => {});
    }

    // Role-specific extra options (investor / service_provider only; mentor handled above).
    const extraKeys: string =
      accountType === 'investor'
        ? 'investment_mechanisms,investment_stages,investment_preferences,investability_metrics,business_models,organization_types'
        : accountType === 'service_provider'
          ? 'service_provider_types,service_provider_categories'
          : '';

    if (extraKeys) {
      fetch(`${baseUrl}api/v1/public/global/custom/${extraKeys}`)
        .then(r => r.json())
        .then(payload => {
          if (cancelled) return;
          const d = payload?.data || {};
          if (accountType === 'investor') {
            setInvestmentMechanismOptions(toIdName(d.investment_mechanisms));
            setInvestmentStageOptions(toIdName(d.investment_stages));
            setInvestmentPreferenceOptions(toIdName(d.investment_preferences));
            setAbilityMetricOptions(toIdName(d.investability_metrics));
            setBusinessModelOptions(toIdName(d.business_models));
            setOrganizationTypeOptions(toIdName(d.organization_types));
          } else if (accountType === 'service_provider') {
            setServiceProviderTypeOptions(toIdName(d.service_provider_types));
            setServiceProviderCategoryOptions(toIdName(d.service_provider_categories));
          }
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [baseUrl, accountType]);

  // ── tab dot completion (from loaded profile data) ─────────────────────────

  // Derives basic-tab completion from server data so the dot is correct on
  // first load (before the user has touched any field). roleFormValid takes
  // over once the form fires onValidityChange.
  const basicTabComplete = (d: Record<string, any> | null): boolean => {
    if (!d) return false;
    const hasCountry = Boolean(
      d.registeredCountryId ||
      d.registeredCountry?.id ||
      d.registeredCountry,
    );
    switch (accountType) {
      case 'corporate':
        return (
          Boolean(d.companyName) &&
          Boolean(d.size || d.companySize) &&
          Boolean(d.briefDescription) &&
          hasCountry
        );
      case 'service_provider':
        return (
          Boolean(d.name) &&
          Boolean(d.providerType?.id || d.serviceProviderType) &&
          Boolean(d.providerCategory?.id || d.serviceProviderCategory) &&
          Boolean(d.briefDescription) &&
          hasCountry
        );
      case 'partner':
        return Boolean(d.name) && Boolean(d.partnerType) && hasCountry;
      case 'investor':
        return (
          Boolean(d.name || d.companyName) &&
          Boolean(d.organizationType || d.organization_type) &&
          hasCountry
        );
      case 'mentor':
        return (
          Boolean(d.name || d.fullName) &&
          Boolean(d.briefDescription || d.bio) &&
          hasCountry
        );
      default:
        return Boolean(d.name || d.companyName) && hasCountry;
    }
  };

  const secondaryTabComplete = (key: string): boolean => {
    if (accountType === 'investor') {
      if (key === 'investment_details') return investorInvestmentsValid;
      if (key === 'representative') return investorRepresentativeValid;
    }
    const d = profileData;
    if (!d) return false;
    switch (key) {
      case 'domain_expertise':
        return (
          (Array.isArray(d.sectoralInterestIds) && d.sectoralInterestIds.length > 0) ||
          (Array.isArray(d.sectoralInterests) && d.sectoralInterests.length > 0) ||
          (Array.isArray(d.domainAreas) && d.domainAreas.length > 0) ||
          (Array.isArray(d.domainAreasPrimary) && d.domainAreasPrimary.length > 0)
        );
      case 'engagement':
        // Require actual selections — not just the field being present.
        return (
          (Array.isArray(d.wantToConnectWithStartups) && d.wantToConnectWithStartups.length > 0) ||
          (Array.isArray(d.connectionRequirements) && d.connectionRequirements.length > 0) ||
          (typeof d.connectWithStartups === 'boolean')
        );
      case 'investment_details':
      case 'investment_thesis': {
        const inv = d.investmentDetails || d;
        return Boolean(inv.ticketSizeMin != null && inv.ticketSizeMin !== '');
      }
      case 'representative':
        return Boolean(d.personName || d.representative?.personName);
      case 'industry':
        return (
          (Array.isArray(d.sectoralInterestIds) && d.sectoralInterestIds.length > 0) ||
          (Array.isArray(d.industryDomainIds) && d.industryDomainIds.length > 0) ||
          (Array.isArray(d.partnerIndustries) && d.partnerIndustries.length > 0) ||
          (Array.isArray(d.industries) && d.industries.length > 0)
        );
      default:
        return false;
    }
  };

  // ── tabs ──────────────────────────────────────────────────────────────────

  const baseTabs: EditProfileTab[] = accountType
    ? getTabLayout(accountType, investorSubtype).map(t => ({
        ...t,
        status: (
          t.key === 'basic'
            // roleFormValid drives live form state; fall back to server data
            // for the initial render so the dot is correct before any interaction.
            ? (roleFormValid || basicTabComplete(profileData))
            : secondaryTabComplete(t.key)
        ) ? 'complete' as const : 'incomplete' as const,
      }))
    : [];

  const customTabItems: EditProfileTab[] = customForms.map(form => ({
    key: `custom-${form.uuid}`,
    label: form.formTitle || 'Custom Form',
    status: (customFormStatuses[form.uuid] ? 'complete' : 'incomplete') as
      | 'complete'
      | 'incomplete',
  }));

  const tabs: EditProfileTab[] = [...baseTabs, ...customTabItems];

  // ── active secondary tab ref ──────────────────────────────────────────────

  const activeSecondaryRef = (): SecondaryTabHandle | null => {
    switch (activeTab) {
      case 'domain_expertise': return mentorTabRef.current;
      case 'engagement':       return corporateTabRef.current;
      case 'investment_details':
      case 'investment_thesis': return investorInvestmentsTabRef.current;
      case 'representative':   return investorRepresentativeTabRef.current;
      case 'industry':
        return accountType === 'service_provider'
          ? serviceProviderTabRef.current
          : partnerTabRef.current;
      default: return null;
    }
  };

  // ── validity / save ───────────────────────────────────────────────────────
  const [domainTabValid, setDomainTabValid] = useState(false);

  const isActiveTabValid = (): boolean => {
    if (activeTab === 'basic') return roleFormValid;
    if (activeTab === 'domain_expertise') return domainTabValid;
    if (activeTab === 'investment_details' || activeTab === 'investment_thesis') return investorInvestmentsValid;
    if (activeTab === 'representative') return investorRepresentativeValid;
    return true;
  };

  const handleRequestApproval = async () => {
    if (!accountType) return;
    setIsSubmittingApproval(true);
    try {
      await authService.requestApproval(token, accountType);
      setShowApprovalModal(false);
      setIsApprovalRequested(true);
      setCanRequestApproval(false);
      toast.success('Profile submitted for approval!');
      onProfileUpdated?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not submit for approval.',
      );
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const handleSave = async () => {
    if (activeTab === 'basic') {
      roleBasicTabRef.current?.triggerSubmit();
      return;
    }

    if (activeTab.startsWith('custom-')) {
      const uuid = activeTab.slice('custom-'.length);
      const handle = customFormRefs.current[uuid];
      if (!handle) {
        toast.error('Form is not ready yet.');
        return;
      }
      setIsSaving(true);
      try {
        const result = await handle.save();
        if (result.ok) {
          toast.success(result.message || 'Saved.');
          onProfileUpdated?.();
        } else {
          toast.error(result.message || 'Could not save.');
        }
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // Secondary role tabs — delegate to the active tab's triggerSave.
    const secondaryRef = activeSecondaryRef();
    if (secondaryRef) {
      setIsSaving(true);
      try {
        await secondaryRef.triggerSave();
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleNext = () => {
    const idx = tabs.findIndex(t => t.key === activeTab);
    const next = tabs[idx + 1];
    if (next) {
      setActiveTab(next.key);
      contentScrollRef.current?.scrollTo({y: 0, animated: false});
    }
  };

  const handlePrevious = () => {
    const idx = tabs.findIndex(t => t.key === activeTab);
    const prev = tabs[idx - 1];
    if (prev) {
      setActiveTab(prev.key);
      contentScrollRef.current?.scrollTo({y: 0, animated: false});
    }
  };

  // ── render ────────────────────────────────────────────────────────────────

  const profileCompletion = backendCompletion ?? 0;
  const isUnderApproval =
    isApprovalRequested && !canToggleStatus && !isApproved;
  const isSubmitDisabled = !canRequestApproval && profileCompletion < 95;

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={primaryColor} size="large" />
        <Text style={styles.loadingText}>Loading your profile…</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Could not load profile</Text>
        <Text style={styles.errorBody}>{loadError}</Text>
        <AppButton
          label="Retry"
          onPress={() => loadProfile()}
          style={{backgroundColor: primaryColor, marginTop: 16}}
        />
      </View>
    );
  }

  const currentIndex = tabs.findIndex(t => t.key === activeTab);
  const isFirst = currentIndex <= 0;
  const isLast = currentIndex >= tabs.length - 1;
  const isCustomTab = activeTab.startsWith('custom-');
  const activeCustomUuid = isCustomTab ? activeTab.slice('custom-'.length) : '';
  const saveDisabled =
    isSaving ||
    (isCustomTab && !customFormStatuses[activeCustomUuid]) ||
    (!isCustomTab && !isActiveTabValid());

  const onSecondaryTabSaveSuccess = () => {
    loadProfile({silent: true});
    if (accountType) {
      authService
        .getProfileCompletion(token, accountType, investorSubtype)
        .then(res => {
          const d = res?.data ?? res ?? {};
          const num = Number(d.percentage);
          if (Number.isFinite(num)) setBackendCompletion(num);
          const forms = d.forms;
          if (forms && typeof forms === 'object') {
            setCompletionForms(forms as Record<string, CompletionForm>);
          }
          setCanRequestApproval(Boolean(d.canRequestApproval));
          setIsApprovalRequested(Boolean(d.isApprovalRequested));
        })
        .catch(() => {});
    }
    onProfileUpdated?.();
  };

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={onBack} style={styles.backBtn} accessibilityRole="button">
            <Text style={styles.backArrow}>{'‹'}</Text>
          </Pressable>
          <Text style={styles.screenTitle}>Edit Profile</Text>
          <View style={styles.completionBadge}>
            <Text style={[styles.completionPct, {color: primaryColor}]}>
              {backendCompletion !== null ? `${Math.round(backendCompletion)}%` : '—'}
            </Text>
          </View>
          {isUnderApproval ? (
            <View style={[styles.submitHeaderBtn, {backgroundColor: '#64748b'}]}>
              <Text style={styles.submitHeaderBtnLabel}>SUBMITTED</Text>
            </View>
          ) : !isApproved ? (
            <Pressable
              style={[
                styles.submitHeaderBtn,
                {backgroundColor: isSubmitDisabled ? '#94a3b8' : colors.success},
              ]}
              onPress={() => !isSubmitDisabled && setShowApprovalModal(true)}
              accessibilityRole="button"
              disabled={isSubmitDisabled}>
              <Text style={styles.submitHeaderBtnLabel}>SUBMIT</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Progress bar — hidden once profile is 100% complete */}
        {profileCompletion < 100 ? (
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
        ) : null}

        {/* Tab pills */}
        <ScrollView
          ref={tabsScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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
                  contentScrollRef.current?.scrollTo({y: 0, animated: false});
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

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <ScrollView
        ref={contentScrollRef}
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {activeTab === 'basic' ? (
          <RoleBasicInfoTab
            ref={roleBasicTabRef}
            accountType={accountType || ''}
            investorSubtype={investorSubtype}
            initialData={profileData}
            primaryColor={primaryColor}
            onValidityChange={setRoleFormValid}
            dropdownData={{
              organization_types: organizationTypeOptions,
              corporate_sizes: (globalSetting?.CorporateSizes || []).map(
                (s: any) => ({id: s.value, name: s.name}),
              ),
              service_provider_types: serviceProviderTypeOptions,
              service_provider_categories: serviceProviderCategoryOptions,
              partner_types: [
                {id: 'incubator', name: 'Incubator'},
                {id: 'accelerator', name: 'Accelerator'},
                {id: 'association-organization', name: 'Association / Organization'},
              ],
            }}
            token={token}
            onLogoUploaded={() => loadProfile({silent: true})}
            industryOptions={industryOptions}
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
                await loadProfile({silent: true});
                if (accountType) {
                  authService
                    .getProfileCompletion(token, accountType, investorSubtype)
                    .then(res => {
                      const d = res?.data ?? res ?? {};
                      const num = Number(d.percentage);
                      if (Number.isFinite(num)) setBackendCompletion(num);
                      setCanRequestApproval(Boolean(d.canRequestApproval));
                      setIsApprovalRequested(Boolean(d.isApprovalRequested));
                      setIsApproved(Boolean(d.isApproved));
                    })
                    .catch(() => {});
                }
              } catch (err) {
                toast.error(
                  err instanceof Error
                    ? err.message
                    : 'Could not save your profile.',
                );
              } finally {
                setIsSaving(false);
              }
            }}
          />
        ) : activeTab === 'investment_details' ||
          activeTab === 'investment_thesis' ? (
          <InvestorInvestmentsTab
            ref={investorInvestmentsTabRef}
            token={token}
            primaryColor={primaryColor}
            initialData={profileData}
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
              Math.max(1, Number(globalSetting?.investorMaxInvestabilityMetrics) || 7)
            }
            onSaveSuccess={onSecondaryTabSaveSuccess}
            onValidChange={setInvestorInvestmentsValid}
          />
        ) : activeTab === 'representative' ? (
          <InvestorRepresentativeTab
            ref={investorRepresentativeTabRef}
            token={token}
            primaryColor={primaryColor}
            initialData={profileData}
            onSaveSuccess={onSecondaryTabSaveSuccess}
            onValidChange={setInvestorRepresentativeValid}
          />
        ) : activeTab === 'domain_expertise' ? (
          <MentorDomainExpertiseTab
            ref={mentorTabRef}
            token={token}
            primaryColor={primaryColor}
            initialData={profileData}
            industryOptions={industryOptions}
            technologyOptions={technologyOptions}
            domainAreaOptions={domainAreaOptions}
            maxDomainAreas={Math.max(1, Number(globalSetting?.mentorMaxDomainAreas) || 5)}
            maxIndustries={Math.max(1, Number(globalSetting?.mentorMaxIndustries) || 5)}
            maxTechnologies={Math.max(1, Number(globalSetting?.mentorMaxTechnologies) || 5)}
            onSaveSuccess={onSecondaryTabSaveSuccess}
            onValidChange={setDomainTabValid}
          />
        ) : activeTab === 'engagement' ? (
          <CorporateEngagementTab
            ref={corporateTabRef}
            token={token}
            primaryColor={primaryColor}
            initialData={profileData}
            onSaveSuccess={onSecondaryTabSaveSuccess}
          />
        ) : activeTab === 'industry' ? (
          accountType === 'service_provider' ? (
            <ServiceProviderIndustryTab
              ref={serviceProviderTabRef}
              token={token}
              primaryColor={primaryColor}
              initialData={profileData}
              industryOptions={industryOptions}
              onSaveSuccess={onSecondaryTabSaveSuccess}
            />
          ) : (
            <PartnerIndustryTab
              ref={partnerTabRef}
              token={token}
              primaryColor={primaryColor}
              initialData={profileData}
              industryOptions={industryOptions}
              technologyOptions={technologyOptions}
              onSaveSuccess={onSecondaryTabSaveSuccess}
            />
          )
        ) : isCustomTab ? (
          (() => {
            const uuid = activeTab.slice('custom-'.length);
            const form = customForms.find(f => f.uuid === uuid);
            if (!form) return null;
            return (
              <CustomFormTab
                ref={handle => {
                  customFormRefs.current[form.uuid] = handle;
                }}
                key={form.uuid}
                form={form}
                token={token}
                primaryColor={primaryColor}
                onCompletionChange={complete => {
                  setCustomFormStatuses(prev => ({
                    ...prev,
                    [form.uuid]: complete,
                  }));
                }}
              />
            );
          })()
        ) : null}
      </ScrollView>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <View style={[styles.footer, {paddingBottom: Math.max(insets.bottom, 8) + 16}]}>
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
        <View style={styles.footerSlot}>
          <AppButton
            label={isSaving ? 'Saving…' : 'SAVE'}
            disabled={saveDisabled}
            loading={isSaving}
            onPress={handleSave}
            labelStyle={styles.actionButtonLabel}
          />
        </View>
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
      </View>

      {/* ── Profile Approval Modal ───────────────────────────────────────── */}
      <Modal
        visible={showApprovalModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowApprovalModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={[styles.modalIconWrap, {borderColor: colors.success}]}>
              <Text style={[styles.modalCheckmark, {color: colors.success}]}>✓</Text>
            </View>
            <Text style={styles.modalTitle}>
              Awesome! your profile is ready to go live.
            </Text>
            <Text style={styles.modalSubtitle}>
              Submit to start connecting with the community.
            </Text>
            <View style={styles.modalButtons}>
              <AppButton
                label={isSubmittingApproval ? 'Submitting…' : 'Submit'}
                loading={isSubmittingApproval}
                disabled={isSubmittingApproval}
                onPress={handleRequestApproval}
                style={{flex: 1, backgroundColor: primaryColor}}
                labelStyle={styles.modalBtnLabel}
              />
              {onPreview ? (
                <AppButton
                  label="Preview"
                  disabled={isSubmittingApproval}
                  onPress={() => {
                    setShowApprovalModal(false);
                    onPreview();
                  }}
                  style={[styles.modalPreviewBtn, {flex: 1}]}
                  labelStyle={styles.modalBtnLabel}
                />
              ) : null}
              <AppButton
                label="Cancel"
                disabled={isSubmittingApproval}
                onPress={() => setShowApprovalModal(false)}
                style={[styles.modalCancelBtn, {flex: 1}]}
                labelStyle={styles.modalBtnLabel}
              />
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {flex: 1, backgroundColor: '#f1f5f9'},
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f1f5f9',
  },
  loadingText: {color: '#64748b', fontSize: 15, marginTop: 12},
  errorTitle: {color: '#0f172a', fontSize: 18, fontWeight: '700', marginTop: 12},
  errorBody: {color: '#475569', fontSize: 14, marginTop: 6, textAlign: 'center'},
  header: {backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0'},
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {fontSize: 22, color: '#0f172a', lineHeight: 28, marginTop: -2},
  screenTitle: {flex: 1, fontSize: 17, fontWeight: '700', color: '#0f172a'},
  completionBadge: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  completionPct: {fontSize: 13, fontWeight: '700'},
  completionTrack: {
    height: 4,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 16,
    borderRadius: 2,
    marginBottom: 8,
  },
  completionFill: {height: 4, borderRadius: 2},
  tabsStrip: {borderTopWidth: 1, borderTopColor: '#f1f5f9'},
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 0,
    gap: 4,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: 6,
  },
  tabStatusDot: {width: 7, height: 7, borderRadius: 4},
  tabText: {fontSize: 13, fontWeight: '500', color: '#64748b'},
  tabTextActive: {fontWeight: '700'},
  content: {flex: 1},
  contentInner: {paddingBottom: 24},
  footer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    padding: 12,
    gap: 10,
  },
  footerSlot: {flex: 1},
  navButton: {backgroundColor: '#f1f5f9'},
  navButtonLabel: {color: '#475569', fontSize: 13, fontWeight: '700'},
  actionButtonLabel: {fontSize: 13, fontWeight: '700'},
  submitHeaderBtn: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  submitHeaderBtnLabel: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    gap: 12,
  },
  modalIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  modalCheckmark: {
    fontSize: 36,
    fontWeight: '700',
    lineHeight: 44,
  },
  modalTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 26,
  },
  modalSubtitle: {
    color: '#475569',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    width: '100%',
  },
  modalPreviewBtn: {
    backgroundColor: '#0f172a',
  },
  modalCancelBtn: {
    backgroundColor: '#94a3b8',
  },
  modalBtnLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
});
