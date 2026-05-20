export type TeamMember = {
  id: string;
  name: string;
  linkedinUrl: string;
  role: string;
  designation: string;
};

export type AdvisoryMember = {
  id: string;
  name: string;
  linkedinUrl: string;
};

export type SocialLinks = {
  website: string;
  linkedin: string;
  twitter: string;
  youtube: string;
  facebook: string;
  instagram: string;
};

export type FinancialsForm = {
  fundingStage: string;
  isRaisingFunds: boolean;
  targetFundraise: string;
  tentativeValuation: string;
  investmentMechanisms: string[];
  totalFundRaised: string;
  pastFunding: string;
  revenueStage: string;
  grossRevenues: string;
  grossRevenuesQ1: string;
  grossRevenuesQ2: string;
  grossRevenuesQ3: string;
  timeToCommercialize: string;
  investmentBankerOpportunity: string;
};

export type BasicInfoForm = {
  // Company Information
  companyName: string;
  companySize: string;
  isIncorporated: boolean | null;
  incorporationYear: string;
  logoUrl: string | null;
  servicesLookingFor: string[];

  // Headquartered in
  countryId: number | null;
  country: string;
  stateId: number | null;
  state: string;
  cityId: number | null;
  city: string;

  // Pitch & Brief
  elevatorPitch: string;
  companyBrief: string;

  // Product / Business
  productStage: string;
  businessModels: string[];

  // Team
  leadership: TeamMember[];
  advisory: AdvisoryMember[];

  // Social
  social: SocialLinks;
};

export const ELEVATOR_PITCH_LIMIT = 300;

export const EMPTY_LEADERSHIP: TeamMember = {
  id: '',
  name: '',
  linkedinUrl: '',
  role: '',
  designation: '',
};

export const EMPTY_ADVISORY: AdvisoryMember = {
  id: '',
  name: '',
  linkedinUrl: '',
};

export const EMPTY_SOCIAL: SocialLinks = {
  website: '',
  linkedin: '',
  twitter: '',
  youtube: '',
  facebook: '',
  instagram: '',
};

export const EMPTY_FINANCIALS: FinancialsForm = {
  fundingStage: '',
  isRaisingFunds: false,
  targetFundraise: '',
  tentativeValuation: '',
  investmentMechanisms: [],
  totalFundRaised: '',
  pastFunding: '',
  revenueStage: '',
  grossRevenues: '',
  grossRevenuesQ1: '',
  grossRevenuesQ2: '',
  grossRevenuesQ3: '',
  timeToCommercialize: '',
  investmentBankerOpportunity: '',
};

export const EMPTY_BASIC_INFO: BasicInfoForm = {
  companyName: '',
  companySize: '',
  isIncorporated: null,
  incorporationYear: '',
  logoUrl: null,
  servicesLookingFor: [],

  countryId: null,
  country: '',
  stateId: null,
  state: '',
  cityId: null,
  city: '',

  elevatorPitch: '',
  companyBrief: '',

  productStage: '',
  businessModels: [],

  leadership: [],
  advisory: [],

  social: {...EMPTY_SOCIAL},
};
