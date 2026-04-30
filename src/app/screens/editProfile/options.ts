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

export const TEAM_ROLES = [
  'Founder',
  'Co-Founder',
  'CEO',
  'CTO',
  'CFO',
  'CMO',
  'COO',
  'Advisor',
  'Investor',
];

// Lightweight cascading geography. Replace with API data when available.
type Country = {
  code: string;
  name: string;
  states: State[];
};

type State = {
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
    code: 'IN',
    name: 'India',
    states: [
      {
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

export const getStatesFor = (countryName: string) => {
  const country = COUNTRIES.find(c => c.name === countryName);
  return country ? country.states.map(s => s.name) : [];
};

export const getCitiesFor = (countryName: string, stateName: string) => {
  const country = COUNTRIES.find(c => c.name === countryName);
  const state = country?.states.find(s => s.name === stateName);
  return state ? state.cities : [];
};
