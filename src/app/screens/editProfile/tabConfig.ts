import type {EditProfileTab} from '../../types';

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
  | 'service-provider'
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
  const type = normalize(accountType);

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
