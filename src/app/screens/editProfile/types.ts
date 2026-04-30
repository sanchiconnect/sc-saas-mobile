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

export type BasicInfoForm = {
  // Company Information
  companyName: string;
  companySize: string;
  isIncorporated: boolean | null;
  logoUrl: string | null;

  // Headquartered in
  country: string;
  state: string;
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

export const EMPTY_BASIC_INFO: BasicInfoForm = {
  companyName: '',
  companySize: '',
  isIncorporated: null,
  logoUrl: null,

  country: '',
  state: '',
  city: '',

  elevatorPitch: '',
  companyBrief: '',

  productStage: '',
  businessModels: [],

  leadership: [],
  advisory: [],

  social: {...EMPTY_SOCIAL},
};
