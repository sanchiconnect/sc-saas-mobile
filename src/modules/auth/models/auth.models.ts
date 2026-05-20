export type SignupDraft = {
  companyName: string;
  organizationName?: string;
  fullName: string;
  email: string;
  mobile: string;
  designation?: string;
  website?: string;
  acceptedTerms: boolean;
  role?: string;
  investorType?: string;
  emailVerificationId?: string;
};

export type SignupPayload = SignupDraft & {
  otp: string;
  countryCode?: number;
};

export type LoginPayload = {
  email: string;
  otp: string;
  countryCode?: number;
};

export type LoginRequestPayload = {
  email: string;
};

export type OtpRequestPayload = {
  email: string;
  mobile?: string;
  countryCode?: number;
  type?: 'email' | 'mobile';
  flow?: 'login' | 'signup';
  fullName?: string;
  role?: string;
  investorType?: string;
};

export type OtpRequestResult = {
  emailVerificationId?: string;
};

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};

export type ForgotPasswordPayload = {
  email: string;
};

export type ForgotPasswordResult = {
  message: string;
};
