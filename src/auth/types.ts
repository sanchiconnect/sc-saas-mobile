export const AUTH_SCREENS = {
  LOGIN: 'login',
  ROLE: 'role',
  SIGNUP: 'signup',
  OTP: 'otp',
} as const;

export type AuthScreen =
  typeof AUTH_SCREENS[keyof typeof AUTH_SCREENS];