import {env} from '../config/env';
import type {IFeatureUsers, IFeatures} from './tenantTypes';

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
  // Verify-tenant may return basic boolean feature/user flags as an early gate
  // before the full /settings response is loaded.
  features?: Partial<IFeatures>;
  users?: Partial<IFeatureUsers>;
}>;

const requireOk = async (response: Response): Promise<Response> => {
  if (!response.ok) {
    throw new Error(`Tenant API ${response.status}: ${response.statusText}`);
  }
  return response;
};

export const fetchTenantsSetting = async (): Promise<TenantVerifyResponse> => {
  const url = `${env.apiBaseUrl}api/v1/public/global/verify_tenant/${env.tenantSlug}`;
  const response = await fetch(url);
  await requireOk(response);
  return response.json();
};

export const fetchSettingStyle = async (
  baseUrl: string,
): Promise<ApiResponse> => {
  const response = await fetch(`${baseUrl}api/v1/public/global/settings`);
  await requireOk(response);
  return response.json();
};

export const fetchFundingStages = async (
  baseUrl: string,
): Promise<ApiResponse> => {
  const response = await fetch(`${baseUrl}api/v1/public/global/funding_stages`);
  await requireOk(response);
  return response.json();
};

export const fetchInvestmentMechanisms = async (
  baseUrl: string,
): Promise<ApiResponse> => {
  const response = await fetch(
    `${baseUrl}api/v1/public/global/custom/investment_mechanisms`,
  );
  await requireOk(response);
  return response.json();
};

export const verifyEmail = async (
  baseUrl: string,
  email: string,
  userType: string = 'startup',
  investorType: string = '',
): Promise<ApiResponse> => {
  const url = `${baseUrl}api/v1/public/auth/verify/email/${encodeURIComponent(email)}?userType=${encodeURIComponent(userType)}&investorType=${encodeURIComponent(investorType)}`;
  const response = await fetch(url);
  await requireOk(response);
  return response.json();
};

export const verifyMobileNumber = async (
  baseUrl: string,
  mobileNumber: string,
  userType: string = 'startup',
  investorType: string = '',
): Promise<ApiResponse> => {
  const url = `${baseUrl}api/v1/public/auth/verify/mobile/${encodeURIComponent(mobileNumber)}?userType=${encodeURIComponent(userType)}&investorType=${encodeURIComponent(investorType)}`;
  const response = await fetch(url);
  await requireOk(response);
  return response.json();
};
