import {
  fetchFundingStages,
  fetchInvestmentMechanisms,
  fetchTenantsSetting,
  verifyEmail,
  verifyMobileNumber,
} from '../../api/fetchSetting';
import {getBaseUrl, saveBaseUrl} from '../../storage/tenantStorage';
import {
  AuthSession,
  LoginPayload,
  OtpRequestPayload,
  OtpRequestResult,
  SignupPayload,
} from '../models/auth.models';
import {md5} from './md5';

const DEFAULT_COUNTRY_CODE = 91;
const LOGIN_INIT_PATH = 'api/v1/public/auth/mobile/login';
const LOGIN_VERIFY_PATH = 'api/v1/public/auth/mobile/login/verify';
const SEND_OTP_PATH = 'api/v1/public/otp_verifications/send';
const SIGNUP_VERIFY_PATH = 'api/v1/public/otp_verifications/verify';
const REGISTER_PATH = 'api/v1/public/auth/register/';
const PROFILE_PATH = 'api/v1/users/profile';
const STARTUP_INFORMATION_PATH = 'api/v1/startups/startup-information';
const FINANCIALS_INFORMATION_PATH = 'api/v1/startups/financials-information';
const INDUSTRY_TECHNOLOGY_BUSINESS_PATH =
  'api/v1/startups/industry-technology-business';
const PROFILE_COMPLETENESS_PATH = 'api/v1/startups/profile_completeness';
const STARTUP_FORM_LIST_PATH = 'api/v1/forms-management/list/startup';
const ONGOING_COMMITMENTS_PATH = 'api/v1/startups/ongoing-commitments';

type ApiResponse = Record<string, any>;

const normalizeBaseUrl = (url: string) =>
  url.endsWith('/') ? url : `${url}/`;

const safeJsonParse = (value: string) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const getErrorMessage = (data: any) =>
  data?.message ||
  data?.error?.message ||
  data?.errors?.[0]?.message ||
  data?.data?.message ||
  data?.response?.message;

const normalizeTokenValue = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  return trimmed.replace(/^Bearer\s+/i, '');
};

const findNestedToken = (data: any): string | undefined => {
  if (!data || typeof data !== 'object') {
    return undefined;
  }

  const directKeys = [
    'token',
    'accessToken',
    'access_token',
    'authToken',
    'idToken',
    'jwt',
    'authorization',
    'Authorization',
  ];

  for (const key of directKeys) {
    const normalized = normalizeTokenValue(data?.[key]);
    if (normalized) {
      return normalized;
    }
  }

  for (const value of Object.values(data)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const nested = findNestedToken(item);
        if (nested) {
          return nested;
        }
      }
      continue;
    }

    if (value && typeof value === 'object') {
      const nested = findNestedToken(value);
      if (nested) {
        return nested;
      }
    }
  }

  return undefined;
};

const getToken = (data: any) =>
  normalizeTokenValue(data?.data?.token) ||
  normalizeTokenValue(data?.data?.accessToken) ||
  normalizeTokenValue(data?.token) ||
  normalizeTokenValue(data?.accessToken) ||
  findNestedToken(data);

const getAuthHeader = (token: string) => {
  const normalizedToken = normalizeTokenValue(token);

  if (!normalizedToken) {
    throw new Error('Missing access token.');
  }

  return {
    Authorization: `Bearer ${normalizedToken}`,
  };
};

const getEmailVerificationId = (data: any) =>
  data?.data?.emailVerificationId ||
  data?.data?.verificationId ||
  data?.data?.id ||
  data?.emailVerificationId ||
  data?.verificationId ||
  data?.id;

const isFailureResponse = (data: any) => {
  if (!data) {
    return false;
  }

  if (data.success === false || data.status === false) {
    return true;
  }

  if (typeof data.code === 'number' && data.code >= 400) {
    return true;
  }

  const message = String(getErrorMessage(data) || '').toLowerCase();
  return (
    message.includes('already') ||
    message.includes('exists') ||
    message.includes('invalid') ||
    message.includes('not found') ||
    message.includes('not registered')
  );
};

const normalizeRole = (role?: string) => {
  const normalizedRole = (role || 'startup').trim().toLowerCase();

  switch (normalizedRole) {
    case 'service provider':
      return 'service_provider';
    default:
      return normalizedRole;
  }
};

const normalizeInvestorType = (investorType?: string) =>
  (investorType || '').trim().toLowerCase();

const buildSession = (
  profile: ApiResponse | null,
  token: string | undefined,
  fallback: {email: string; fullName?: string},
): AuthSession => {
  const user = profile?.data?.user || profile?.data || profile?.user || {};
  const fullName =
    user?.fullName ||
    user?.name ||
    user?.displayName ||
    fallback.fullName ||
    fallback.email.split('@')[0];

  return {
    token: normalizeTokenValue(token) || 'pending-token',
    user: {
      id: String(user?.id || user?._id || fallback.email),
      email: user?.email || user?.emailAddress || fallback.email,
      fullName,
    },
  };
};

async function resolveBaseUrl() {
  const storedBaseUrl = await getBaseUrl();
  if (storedBaseUrl) {
    return normalizeBaseUrl(storedBaseUrl);
  }

  const tenantResponse = await fetchTenantsSetting();
  const nextBaseUrl = tenantResponse?.data?.apiUrl || tenantResponse?.apiUrl;

  if (!nextBaseUrl) {
    throw new Error('Unable to resolve tenant API URL.');
  }

  const normalizedBaseUrl = normalizeBaseUrl(nextBaseUrl);
  await saveBaseUrl(normalizedBaseUrl);
  return normalizedBaseUrl;
}

async function requestJson<T>(
  path: string,
  options: RequestInit,
  baseUrl?: string,
): Promise<T> {
  const resolvedBaseUrl = baseUrl || (await resolveBaseUrl());
  const response = await fetch(`${resolvedBaseUrl}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const raw = await response.text();
  const data = raw ? safeJsonParse(raw) : null;

  if (!response.ok) {
    throw new Error(
      getErrorMessage(data) || `Request failed with status ${response.status}.`,
    );
  }

  return data as T;
}

async function fetchProfile(baseUrl: string, token: string) {
  return requestJson<ApiResponse>(
    PROFILE_PATH,
    {
      method: 'GET',
      headers: getAuthHeader(token),
    },
    baseUrl,
  );
}

async function fetchStartupInformation(baseUrl: string, token: string) {
  return requestJson<ApiResponse>(
    STARTUP_INFORMATION_PATH,
    {
      method: 'GET',
      headers: getAuthHeader(token),
    },
    baseUrl,
  );
}

// async function verifyOtpAndFetchProfile(
//   payload: LoginPayload | SignupPayload,
//   fallbackFullName?: string,
// ) {
//   const baseUrl = await resolveBaseUrl();
//   const email = payload.email.trim().toLowerCase();
//   const hashedOtp = md5(payload.otp);
//   const verifyPayload: Record<string, any> = {
//     countryCode: payload.countryCode || DEFAULT_COUNTRY_CODE,
//     code: hashedOtp,
//   };

//   if ('mobile' in payload) {
//     verifyPayload.type = 'email';
//     verifyPayload.emailAddress = email;
//     verifyPayload.mobileNumber = Number(payload.mobile?.trim());
//   }else{
//     verifyPayload.email = email;
//   }
  
//   const PATH= 'mobile' in payload ? SIGNUP_VERIFY_PATH : LOGIN_VERIFY_PATH;
//   const verifyData = await requestJson<ApiResponse>(
//     PATH,
//     {
//       method: 'POST',
//       body: JSON.stringify(verifyPayload),
//     },
//     baseUrl,
//   );
//   const token = getToken(verifyData);

//   if (!token) {
//     throw new Error('Login verification succeeded but token was missing.');
//   }

//   const profile = await fetchProfile(baseUrl, token);

//   return {
//     baseUrl,
//     email,
//     token,
//     verifyData,
//     session: buildSession(profile, token, {
//       email,
//       fullName: fallbackFullName,
//     }),
//   };
// }
async function verifyOtpAndFetchProfile(
  payload: LoginPayload | SignupPayload,
  fallbackFullName?: string,
) {
  const baseUrl = await resolveBaseUrl();

  const email = payload.email.trim().toLowerCase();
  const hashedOtp = md5(payload.otp);

  const isSignup = 'mobile' in payload;

  const verifyPayload: Record<string, any> = {
    countryCode: payload.countryCode || DEFAULT_COUNTRY_CODE,
    code: hashedOtp,
    ...(isSignup
      ? {
          type: 'email',
          emailAddress: email,
          mobileNumber: Number(payload.mobile?.trim()),
        }
      : {
          email,
        }),
  };

  const path = isSignup ? SIGNUP_VERIFY_PATH : LOGIN_VERIFY_PATH;

  const verifyData = await requestJson<ApiResponse>(
    path,
    {
      method: 'POST',
      body: JSON.stringify(verifyPayload),
    },
    baseUrl,
  );

  const token = getToken(verifyData);

  if (!token && !isSignup) {
    throw new Error('OTP verification succeeded but token is missing.');
  }

  let profile: any = null;
  let session: any;

  // Only login flow needs profile + session
  if (!isSignup) {
    if (!token) {
      throw new Error('OTP verification succeeded but token is missing.');
    }

    profile = await fetchProfile(baseUrl, token);

    session = buildSession(profile, token, {
      email,
      fullName: fallbackFullName,
    });
  }

  return {
    baseUrl,
    email,
    token,
    verifyData,
    profile,
    session,
  };
}
export const authService = {
  async getProfile(token: string): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return fetchProfile(baseUrl, token);
  },

  async getStartupInformation(token: string): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return fetchStartupInformation(baseUrl, token);
  },

  async getProfileCompletion(token: string): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      PROFILE_COMPLETENESS_PATH,
      {
        method: 'GET',
        headers: getAuthHeader(token),
      },
      baseUrl,
    );
  },

  async getFundingStages(): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return fetchFundingStages(baseUrl);
  },

  async getInvestmentMechanisms(): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return fetchInvestmentMechanisms(baseUrl);
  },

  async getStartupFormList(token: string): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      STARTUP_FORM_LIST_PATH,
      {
        method: 'GET',
        headers: getAuthHeader(token),
      },
      baseUrl,
    );
  },

  async getOngoingCommitments(token: string): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      ONGOING_COMMITMENTS_PATH,
      {
        method: 'GET',
        headers: getAuthHeader(token),
      },
      baseUrl,
    );
  },

  async updateProfile(
    token: string,
    payload: Record<string, any>,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      STARTUP_INFORMATION_PATH,
      {
        method: 'PATCH',
        headers: getAuthHeader(token),
        body: JSON.stringify(payload),
      },
      baseUrl,
    );
  },

  async updateFinancialsInformation(
    token: string,
    payload: Record<string, any>,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      FINANCIALS_INFORMATION_PATH,
      {
        method: 'PATCH',
        headers: getAuthHeader(token),
        body: JSON.stringify(payload),
      },
      baseUrl,
    );
  },

  async updateIndustryTechnologyBusiness(
    token: string,
    payload: Record<string, any>,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      INDUSTRY_TECHNOLOGY_BUSINESS_PATH,
      {
        method: 'PATCH',
        headers: getAuthHeader(token),
        body: JSON.stringify(payload),
      },
      baseUrl,
    );
  },

  async sendOtp(payload: OtpRequestPayload): Promise<OtpRequestResult> {
    const email = payload.email.trim().toLowerCase();

    if (!email) {
      throw new Error('Email is required.');
    }

    const baseUrl = await resolveBaseUrl();

    if (payload.flow === 'login') {
      await requestJson(
        LOGIN_INIT_PATH,
        {
          method: 'POST',
          body: JSON.stringify({
            countryCode: payload.countryCode || DEFAULT_COUNTRY_CODE,
            email,
          }),
        },
        baseUrl,
      );

      return {};
    }

    if (payload.flow === 'signup') {
      if (!payload.mobile?.trim()) {
        throw new Error('Mobile number is required.');
      }

      const userType = normalizeRole(payload.role);
      const investorType = normalizeInvestorType(payload.investorType);

      const [emailCheck, mobileCheck] = await Promise.all([
        verifyEmail(baseUrl, email, userType, investorType),
        verifyMobileNumber(baseUrl, payload.mobile.trim(), userType, investorType),
      ]);

      if (isFailureResponse(emailCheck)) {
        throw new Error(getErrorMessage(emailCheck) || 'Email verification failed.');
      }

      if (isFailureResponse(mobileCheck)) {
        throw new Error(
          getErrorMessage(mobileCheck) || 'Mobile verification failed.',
        );
      }

      await requestJson(
        SEND_OTP_PATH,
        {
          method: 'POST',
          body: JSON.stringify({
            type: payload.type || 'email',
            countryCode: payload.countryCode || DEFAULT_COUNTRY_CODE,
            mobileNumber: Number(payload.mobile.trim()),
            emailAddress: email,
          }),
        },
        baseUrl,
      );

      return {
        emailVerificationId: getEmailVerificationId(emailCheck),
      };
    }

    await requestJson(
      SEND_OTP_PATH,
      {
        method: 'POST',
        body: JSON.stringify({
          type: payload.type || 'email',
          countryCode: payload.countryCode || DEFAULT_COUNTRY_CODE,
          mobileNumber: payload.mobile ? Number(payload.mobile.trim()) : undefined,
          emailAddress: email,
        }),
      },
      baseUrl,
    );

    return {};
  },

  async login(payload: LoginPayload) {
    const {session} = await verifyOtpAndFetchProfile(payload);
    return session;
  },

  async verifySignupMobile(
    mobile: string,
    role?: string,
    investorType?: string,
  ): Promise<string | null> {
    const nextMobile = mobile.trim();

    if (!nextMobile) {
      return null;
    }

    const baseUrl = await resolveBaseUrl();
    const response = await verifyMobileNumber(
      baseUrl,
      nextMobile,
      normalizeRole(role),
      normalizeInvestorType(investorType),
    );

    if (isFailureResponse(response)) {
      return getErrorMessage(response) || 'This mobile number is already registered.';
    }

    return null;
  },

  async signup(payload: SignupPayload) {
    const {baseUrl, email, token, verifyData} =
      await verifyOtpAndFetchProfile(payload, payload.fullName);
    const userType = normalizeRole(payload.role);
    const registerData = await requestJson<ApiResponse>(
      REGISTER_PATH,
      {
        method: 'POST',
        headers: token ? getAuthHeader(token) : undefined,
        body: JSON.stringify({
          name: payload.fullName || payload.companyName || 'THUB User',
          emailAddress: email,
          countryCode: payload.countryCode || DEFAULT_COUNTRY_CODE,
          mobileNumber: Number(payload.mobile),
          userType,
          investorType:
            userType === 'investor' ? payload.investorType || 'organization' : '',
          companyName: payload.companyName || 'THUB Organization',
          organizationName:
            payload.organizationName ||
            payload.companyName ||
            'THUB Organization',
          howDidYouFindUs: '',
          emailVerificationId:
            payload.emailVerificationId || getEmailVerificationId(verifyData) || '',
          designation: payload.designation || '',
          website: payload.website || '',
          servicesLookingFor: [
            'fundraising',
            'tech_hiring',
            'customer_access',
            'mentorship',
            'business_services',
          ],
          referralCode: null,
          applyingForSpecificEvent: false,
          programs: [],
          programCodes: [],
        }),
      },
      baseUrl,
    );
    const sessionToken = getToken(registerData) || getToken(verifyData) || token;

    if (sessionToken) {
      const profile = await fetchProfile(baseUrl, sessionToken);

      return buildSession(profile, sessionToken, {
        email,
        fullName: payload.fullName,
      });
    }

    return buildSession(registerData, sessionToken, {
      email,
      fullName: payload.fullName,
    });
  },
};
