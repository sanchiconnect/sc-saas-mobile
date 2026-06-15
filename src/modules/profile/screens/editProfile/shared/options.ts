export const COMPANY_SIZES = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1001+',
];

export const PRODUCT_STAGES = [
  'Idea',
  'Prototype',
  'MVP',
  'Early Revenue',
  'Growth',
  'Scaling',
];

export const BUSINESS_MODELS = [
  'B2B',
  'B2B2C',
  'B2C',
  'B2G',
  'Branding',
  'D2C',
  'Deep Tech',
  'SaaS',
  'Marketplace',
  'Subscription',
];

// Founder roles match the web Edit Profile dropdown. The form stores the
// snake_case `value` (server-side enum) and renders the human-readable
// `label`. Keep this list in sync with the backend's accepted role enum.
export const FOUNDER_ROLES: ReadonlyArray<{label: string; value: string}> = [
  {label: 'Founder', value: 'founder'},
  {label: 'Co-Founder', value: 'co_founder'},
  {label: 'Executive Leadership', value: 'executive_leadership'},
];

export const FOUNDER_ROLE_LABELS = FOUNDER_ROLES.map(r => r.label);

export const getFounderRoleLabel = (value: string): string =>
  FOUNDER_ROLES.find(r => r.value === value)?.label || '';

export const getFounderRoleValue = (label: string): string =>
  FOUNDER_ROLES.find(r => r.label === label)?.value || '';

// Legacy alias — kept so any unrelated consumer compiles. Prefer
// FOUNDER_ROLE_LABELS for new picker call sites.
export const TEAM_ROLES = FOUNDER_ROLE_LABELS;

export const FUNDING_STAGES = [
  'Bootstrapped',
  'Friends & Family',
  'Seed/Angel Funded',
  'Pre Series',
  'Series A or beyond',
  'Starting Stage',
  'Incubation',
  'No Funding',
];

export const INVESTMENT_MECHANISMS = [
  'Convertible Notes',
  'Debt',
  'Digital Tokens',
  'Equity',
];

export const REVENUE_STAGES = [
  {label: 'Pre Revenue', value: 'pre_revenue'},
  {label: 'Post Revenue', value: 'post_revenue'},
];

export const TIME_TO_COMMERCIALIZE_OPTIONS = [
  '0-6 months',
  '6-12 months',
  '12-36 months',
  'More than 36 months',
];

export const INVESTMENT_BANKER_OPTIONS = [
  {label: 'Yes', value: 'yes'},
  {label: 'No', value: 'no'},
  {label: 'Maybe later', value: 'maybe'},
];

// Lightweight cascading geography fallback.
export type Country = {
  id?: number;
  code: string;
  name: string;
  states: State[];
};

export type State = {
  id?: number;
  name: string;
  cities: string[];
};

export const COUNTRIES: Country[] = [
  {
    code: 'AX',
    name: 'Aland Islands',
    states: [
      {name: 'Mariehamn', cities: ['Mariehamn']},
    ],
  },
  {
    id: 106,
    code: 'IN',
    name: 'India',
    states: [
      {
        id: 1368,
        name: 'Telangana',
        cities: ['Hyderabad', 'Warangal', 'Karimnagar'],
      },
      {
        name: 'Karnataka',
        cities: ['Bengaluru', 'Mysuru', 'Mangalore'],
      },
      {
        name: 'Maharashtra',
        cities: ['Mumbai', 'Pune', 'Nagpur'],
      },
      {
        name: 'Delhi',
        cities: ['New Delhi'],
      },
    ],
  },
  {
    code: 'US',
    name: 'United States',
    states: [
      {
        name: 'California',
        cities: ['San Francisco', 'Los Angeles', 'San Diego'],
      },
      {
        name: 'New York',
        cities: ['New York City', 'Buffalo'],
      },
      {
        name: 'Texas',
        cities: ['Austin', 'Houston', 'Dallas'],
      },
    ],
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    states: [
      {
        name: 'England',
        cities: ['London', 'Manchester', 'Birmingham'],
      },
      {
        name: 'Scotland',
        cities: ['Edinburgh', 'Glasgow'],
      },
    ],
  },
  {
    code: 'SG',
    name: 'Singapore',
    states: [
      {name: 'Central Region', cities: ['Singapore']},
    ],
  },
];

export const getCountryNames = () => COUNTRIES.map(c => c.name);

export const getCountryIdByName = (
  countryName: string,
  countries: Country[] = COUNTRIES,
) => countries.find(c => c.name === countryName)?.id;

export const getStatesFor = (countryName: string) => {
  const country = COUNTRIES.find(c => c.name === countryName);
  return country ? country.states.map(s => s.name) : [];
};

export const getStateIdByName = (countryName: string, stateName: string) =>
  COUNTRIES.find(c => c.name === countryName)?.states.find(
    s => s.name === stateName,
  )?.id;

export const getCitiesFor = (countryName: string, stateName: string) => {
  const country = COUNTRIES.find(c => c.name === countryName);
  const state = country?.states.find(s => s.name === stateName);
  return state ? state.cities : [];
};
