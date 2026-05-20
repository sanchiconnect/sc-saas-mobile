import {env} from '../config/env';

type ApiResponse<T = any> = {
  status_code?: number;
  message?: string;
  data?: T;
  [key: string]: any;
};

export type TenantVerifyResponse = ApiResponse<{
  apiUrl: string;
  domain: string;
  customDomain: string | null;
  active: boolean;
  subscription_active: boolean;
  features?: Record<string, boolean>;
  users?: Record<string, boolean>;
}>;

export const fetchTenantsSetting = async (): Promise<TenantVerifyResponse> => {
  const url = `${env.apiBaseUrl}api/v1/public/global/verify_tenant/${env.tenantSlug}`;
  const response = await fetch(url);
  return response.json();
};

export const fetchSettingStyle = async (
  baseUrl: string,
): Promise<ApiResponse> => {
  const response = await fetch(`${baseUrl}api/v1/public/global/settings`);
  return response.json();
};

export const fetchFundingStages = async (
  baseUrl: string,
): Promise<ApiResponse> => {
  const response = await fetch(`${baseUrl}api/v1/public/global/funding_stages`);
  return response.json();
};

export const fetchInvestmentMechanisms = async (
  baseUrl: string,
): Promise<ApiResponse> => {
  const response = await fetch(
    `${baseUrl}api/v1/public/global/custom/investment_mechanisms`,
  );
  return response.json();
};

export const verifyEmail = async (
  baseUrl: string,
  email: string,
  userType: string = 'startup',
  investorType: string = '',
): Promise<ApiResponse> => {
  const url = `${baseUrl}api/v1/public/auth/verify/email/${email}?userType=${userType}&investorType=${investorType}`;
  const response = await fetch(url);
  return response.json();
};

export const verifyMobileNumber = async (
  baseUrl: string,
  mobileNumber: string,
  userType: string = 'startup',
  investorType: string = '',
): Promise<ApiResponse> => {
  const url = `${baseUrl}api/v1/public/auth/verify/mobile/${mobileNumber}?userType=${userType}&investorType=${investorType}`;
  const response = await fetch(url);
  return response.json();
};
