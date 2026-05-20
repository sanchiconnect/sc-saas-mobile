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
  // Set to true when re-sending an OTP for an already-validated signup.
  // Skips the email/mobile availability pre-flight (mirrors frontend behavior:
  // pre-flight runs on input-change in the signup form, not on every send).
  resend?: boolean;
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
