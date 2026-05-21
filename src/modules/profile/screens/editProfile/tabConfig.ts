import type {EditProfileTab} from '../../../home/types';

export type EditProfileTabKey =
  | 'basic'
  | 'industry'
  | 'financials'
  | 'pitch'
  | 'investment_details'
  | 'representative'
  | 'investment_thesis'
  | 'domain_expertise'
  | 'engagement';

export type AccountType =
  | 'startup'
  | 'investor'
  | 'mentor'
  | 'corporate'
  | 'individual'
  // Canonical slug is underscore — matches the backend
  // (api/v1/service_providers/...). The hyphenated string is accepted via
  // normalizeRole() in auth.service.ts for backward compatibility.
  | 'service_provider'
  | string;

export type InvestorSubtype = 'organization' | 'individual';

type TabBlueprint = {key: EditProfileTabKey; label: string};

const BASIC: TabBlueprint = {key: 'basic', label: 'Basic Information'};

const TAB_LAYOUTS: Record<string, TabBlueprint[]> = {
  startup: [
    BASIC,
    {key: 'industry', label: 'Industry / Technology'},
    {key: 'financials', label: 'Financials'},
    {key: 'pitch', label: 'Pitch Deck'},
  ],
  'investor:organization': [
    BASIC,
    {key: 'investment_details', label: 'Investment Details'},
    {key: 'representative', label: 'Representative Details'},
  ],
  'investor:individual': [
    BASIC,
    {key: 'investment_thesis', label: 'Investment Thesis'},
  ],
  mentor: [BASIC, {key: 'domain_expertise', label: 'Domain Expertise'}],
  corporate: [BASIC, {key: 'engagement', label: 'Engagement'}],
  service_provider: [
    BASIC,
    {key: 'industry', label: 'Industry / Vertical Focus'},
  ],
};

const BASIC_ONLY: TabBlueprint[] = [BASIC];

const normalize = (value?: string | null) =>
  String(value || '').trim().toLowerCase();

export const detectInvestorSubtype = (
  profile: Record<string, any> | null | undefined,
): InvestorSubtype => {
  const raw = normalize(
    profile?.investorType ||
      profile?.investor_type ||
      profile?.accountSubType ||
      profile?.subType ||
      profile?.entityType,
  );

  if (raw.includes('individual') || raw.includes('angel')) {
    return 'individual';
  }
  return 'organization';
};

export const getTabLayout = (
  accountType: AccountType,
  investorSubtype: InvestorSubtype = 'organization',
): TabBlueprint[] => {
  // Backend uses underscored slugs (service_provider); legacy callers may
  // pass hyphenated or space-separated variants — fold them all back here so
  // every TAB_LAYOUTS lookup hits the canonical key.
  const type = normalize(accountType).replace(/[-\s]+/g, '_');

  if (type === 'investor') {
    return TAB_LAYOUTS[`investor:${investorSubtype}`] || BASIC_ONLY;
  }

  return TAB_LAYOUTS[type] || BASIC_ONLY;
};

export const buildBaseTabs = (
  accountType: AccountType,
  investorSubtype: InvestorSubtype = 'organization',
): EditProfileTab[] =>
  getTabLayout(accountType, investorSubtype).map(tab => ({
    key: tab.key,
    label: tab.label,
    status: 'incomplete',
  }));
