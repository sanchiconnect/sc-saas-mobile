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

const ACCOUNT_TYPE_TO_PLURAL: Record<string, string> = {
  startup: 'startups',
  corporate: 'corporates',
  investor: 'investors',
};

const buildInformationPath = (accountType?: string) => {
  const type = (accountType || 'startup').toLowerCase();
  const plural = ACCOUNT_TYPE_TO_PLURAL[type] || `${type}s`;
  return `api/v1/${plural}/${type}-information`;
};

const buildFormListPath = (accountType?: string) => {
  const type = (accountType || 'startup').toLowerCase();
  return `api/v1/forms-management/list/${type}`;
};

const buildOngoingCommitmentsPath = (accountType?: string) => {
  const type = (accountType || 'startup').toLowerCase();
  const plural = ACCOUNT_TYPE_TO_PLURAL[type] || `${type}s`;
  return `api/v1/${plural}/ongoing-commitments`;
};

const buildProfileCompletenessPath = (accountType?: string) => {
  const type = (accountType || 'startup').toLowerCase();
  const plural = ACCOUNT_TYPE_TO_PLURAL[type] || `${type}s`;
  return `api/v1/${plural}/profile_completeness`;
};
const FINANCIALS_INFORMATION_PATH = 'api/v1/startups/financials-information';
const INDUSTRY_TECHNOLOGY_BUSINESS_PATH =
  'api/v1/startups/industry-technology-business';
const DOCUMENT_TYPES_PATH = 'api/v1/public/global/document_types';
const SUPPORTING_DOCUMENTS_PATH = 'api/v1/startups/supporting-documents';
const STARTUP_DOCUMENT_SAVE_PATH = 'api/v1/startup/documents';
const STARTUP_DOCUMENTS_LIST_PATH = 'api/v1/startup/documents/';
const PITCH_TYPE_PATH = 'api/v1/startups/pitch-deck/default/pitch-type';
const PITCH_FILE_UPLOAD_PATH = 'api/v1/startups/pitch-deck/upload/pitch-file';
const POWER_PITCH_VIDEO_PATH = 'api/v1/power-pitch/video';
const PROGRAMS_PATH = 'api/v1/programs-management/?includeExternal=true';
const VS_PROGRAMS_PATH = 'api/v1/vs-programs-management/?includeExternal=true';
const APPLICATION_PROGRAMS_PATH =
  'api/v1/application-programs-management/?partnerId=null&includeExternal=true';
const CORPORATE_PROFILE_DATA_PATH =
  'api/v1/forms-management/profile/data/corporate';
const INVESTOR_PROFILE_DATA_PATH =
  'api/v1/forms-management/profile/data/investor';
const STARTUP_PUBLIC_INFORMATION_PATH =
  'api/v1/startups/public/startup-information';

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

async function fetchStartupInformation(
  baseUrl: string,
  token: string,
  accountType?: string,
) {
  return requestJson<ApiResponse>(
    buildInformationPath(accountType),
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
  async getApiBaseUrl(): Promise<string> {
    return resolveBaseUrl();
  },

  async getProfile(token: string): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return fetchProfile(baseUrl, token);
  },

  async updateUserProfile(
    token: string,
    payload: Record<string, any>,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      PROFILE_PATH,
      {
        method: 'PATCH',
        headers: getAuthHeader(token),
        body: JSON.stringify(payload),
      },
      baseUrl,
    );
  },

  async deleteUserAccount(token: string): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      'api/v1/users/delete_account',
      {
        method: 'DELETE',
        headers: getAuthHeader(token),
      },
      baseUrl,
    );
  },

  async getStartupInformation(
    token: string,
    accountType?: string,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return fetchStartupInformation(baseUrl, token, accountType);
  },

  async getCorporateProfileData(
    token: string,
    uuid: string,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      `${CORPORATE_PROFILE_DATA_PATH}/${uuid}`,
      {
        method: 'GET',
        headers: getAuthHeader(token),
      },
      baseUrl,
    );
  },

  async getInvestorProfileData(
    token: string,
    uuid: string,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      `${INVESTOR_PROFILE_DATA_PATH}/${uuid}`,
      {
        method: 'GET',
        headers: getAuthHeader(token),
      },
      baseUrl,
    );
  },

  async getStartupPublicInformation(
    token: string,
    uuid: string,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      `${STARTUP_PUBLIC_INFORMATION_PATH}/${uuid}`,
      {
        method: 'GET',
        headers: getAuthHeader(token),
      },
      baseUrl,
    );
  },

  async getProfileCompletion(
    token: string,
    accountType?: string,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      buildProfileCompletenessPath(accountType),
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

  async getStartupFormList(
    token: string,
    accountType?: string,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      buildFormListPath(accountType),
      {
        method: 'GET',
        headers: getAuthHeader(token),
      },
      baseUrl,
    );
  },

  async getOngoingCommitments(
    token: string,
    accountType?: string,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      buildOngoingCommitmentsPath(accountType),
      {
        method: 'GET',
        headers: getAuthHeader(token),
      },
      baseUrl,
    );
  },

  async getPrograms(token: string): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      PROGRAMS_PATH,
      {
        method: 'GET',
        headers: getAuthHeader(token),
      },
      baseUrl,
    );
  },

  async getVentureStudioPrograms(token: string): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      VS_PROGRAMS_PATH,
      {
        method: 'GET',
        headers: getAuthHeader(token),
      },
      baseUrl,
    );
  },

  async getApplicationPrograms(token: string): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      APPLICATION_PROGRAMS_PATH,
      {
        method: 'GET',
        headers: getAuthHeader(token),
      },
      baseUrl,
    );
  },

  async getTicketIssueTypes(): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      'api/v1/public/global/ticket_issue_types',
      {method: 'GET'},
      baseUrl,
    );
  },

  async getDocumentTypes(): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      DOCUMENT_TYPES_PATH,
      {method: 'GET'},
      baseUrl,
    );
  },

  async getTickets(
    token: string,
    page = 1,
    limit = 500,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      `api/v1/tickets/?page=${page}&limit=${limit}`,
      {
        method: 'GET',
        headers: getAuthHeader(token),
      },
      baseUrl,
    );
  },

  async createTicket(
    token: string,
    payload: {
      title: string;
      description: string;
      issueTypeId: number;
      attachments?: string[];
    },
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      'api/v1/tickets/',
      {
        method: 'POST',
        headers: getAuthHeader(token),
        body: JSON.stringify(payload),
      },
      baseUrl,
    );
  },

  async uploadTicketAttachments(
    token: string,
    files: Array<{uri: string; name: string; type: string}>,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', {
        uri: file.uri,
        name: file.name,
        type: file.type,
      } as any);
    });

    const response = await fetch(`${baseUrl}api/v1/tickets/add-attachments`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: formData as any,
    });
    const raw = await response.text();
    const data = raw ? safeJsonParse(raw) : null;
    if (!response.ok) {
      throw new Error(
        data?.message || `Attachment upload failed (${response.status}).`,
      );
    }
    return data as ApiResponse;
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

  async getSupportingDocuments(token: string): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    const response = await fetch(`${baseUrl}${SUPPORTING_DOCUMENTS_PATH}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...getAuthHeader(token),
      },
    });

    const raw = await response.text();
    const data = raw ? safeJsonParse(raw) : null;

    // Some tenants expose document-types but not the saved-documents list route.
    // In that case we still want to render the dynamic upload rows.
    if (response.status === 404) {
      return {data: []};
    }

    if (!response.ok) {
      throw new Error(
        getErrorMessage(data) ||
          raw ||
          `Supporting documents request failed (${response.status}).`,
      );
    }

    return (data || {data: []}) as ApiResponse;
  },

  async uploadSupportingDocument(
    token: string,
    file: {uri: string; name: string; type: string},
    documentTypeId: string | number,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    const normalizedToken = normalizeTokenValue(token);

    if (!normalizedToken) {
      throw new Error('Missing access token.');
    }

    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);
    formData.append('documentType', String(documentTypeId));

    const response = await fetch(`${baseUrl}${SUPPORTING_DOCUMENTS_PATH}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${normalizedToken}`,
      },
      body: formData as any,
    });
    const raw = await response.text();
    const data = raw ? safeJsonParse(raw) : null;
    if (!response.ok) {
      throw new Error(
        getErrorMessage(data) ||
          `Supporting document upload failed (${response.status}).`,
      );
    }
    return data as ApiResponse;
  },

  async saveStartupDocument(
    token: string,
    documentTypeId: string | number,
    file: {uri: string; name: string; type: string},
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    const normalizedToken = normalizeTokenValue(token);

    if (!normalizedToken) {
      throw new Error('Missing access token.');
    }

    if (!documentTypeId && documentTypeId !== 0) {
      throw new Error('Document type id is required.');
    }

    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);

    const response = await fetch(
      `${baseUrl}${STARTUP_DOCUMENT_SAVE_PATH}/${documentTypeId}/save`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${normalizedToken}`,
        },
        body: formData as any,
      },
    );
    const raw = await response.text();
    const data = raw ? safeJsonParse(raw) : null;
    if (!response.ok) {
      throw new Error(
        getErrorMessage(data) ||
          `Document save failed (${response.status}).`,
      );
    }
    return data as ApiResponse;
  },

  async getStartupDocuments(token: string): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    const response = await fetch(`${baseUrl}${STARTUP_DOCUMENTS_LIST_PATH}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...getAuthHeader(token),
      },
    });

    const raw = await response.text();
    const data = raw ? safeJsonParse(raw) : null;

    if (response.status === 404) {
      return {data: []};
    }

    if (!response.ok) {
      throw new Error(
        getErrorMessage(data) ||
          raw ||
          `Startup documents request failed (${response.status}).`,
      );
    }

    return (data || {data: []}) as ApiResponse;
  },

  async updatePitchType(
    token: string,
    pitchType: string,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      PITCH_TYPE_PATH,
      {
        method: 'PATCH',
        headers: getAuthHeader(token),
        body: JSON.stringify({pitchType}),
      },
      baseUrl,
    );
  },

  async uploadPitchFile(
    token: string,
    file: {uri: string; name: string; type: string},
    documentType: string = 'fundraising-pitch',
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    const normalizedToken = normalizeTokenValue(token);

    if (!normalizedToken) {
      throw new Error('Missing access token.');
    }

    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);
    formData.append('documentType', documentType);

    const response = await fetch(`${baseUrl}${PITCH_FILE_UPLOAD_PATH}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${normalizedToken}`,
      },
      body: formData as any,
    });
    const raw = await response.text();
    const data = raw ? safeJsonParse(raw) : null;
    if (!response.ok) {
      throw new Error(
        getErrorMessage(data) ||
          `Pitch file upload failed (${response.status}).`,
      );
    }
    return data as ApiResponse;
  },

  async getPowerPitchVideo(token: string): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      POWER_PITCH_VIDEO_PATH,
      {
        method: 'GET',
        headers: getAuthHeader(token),
      },
      baseUrl,
    );
  },

  async deleteStartupDocument(
    token: string,
    uuid: string,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      `${STARTUP_DOCUMENT_SAVE_PATH}/${uuid}`,
      {
        method: 'DELETE',
        headers: getAuthHeader(token),
      },
      baseUrl,
    );
  },

  async editStartupDocument(
    token: string,
    uuid: string,
    file: {uri: string; name: string; type: string},
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    const normalizedToken = normalizeTokenValue(token);

    if (!normalizedToken) {
      throw new Error('Missing access token.');
    }

    if (!uuid) {
      throw new Error('Document uuid is required.');
    }

    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);

    const response = await fetch(
      `${baseUrl}${STARTUP_DOCUMENT_SAVE_PATH}/${uuid}`,
      {
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${normalizedToken}`,
        },
        body: formData as any,
      },
    );
    const raw = await response.text();
    const data = raw ? safeJsonParse(raw) : null;
    if (!response.ok) {
      throw new Error(
        getErrorMessage(data) ||
          `Document update failed (${response.status}).`,
      );
    }
    return data as ApiResponse;
  },

  async updateSupportingDocument(
    token: string,
    uuid: string,
    file: {uri: string; name: string; type: string},
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    const normalizedToken = normalizeTokenValue(token);

    if (!normalizedToken) {
      throw new Error('Missing access token.');
    }

    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);

    const response = await fetch(
      `${baseUrl}${SUPPORTING_DOCUMENTS_PATH}/${uuid}`,
      {
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${normalizedToken}`,
        },
        body: formData as any,
      },
    );
    const raw = await response.text();
    const data = raw ? safeJsonParse(raw) : null;
    if (!response.ok) {
      throw new Error(
        getErrorMessage(data) ||
          `Supporting document update failed (${response.status}).`,
      );
    }
    return data as ApiResponse;
  },

  async deleteSupportingDocument(
    token: string,
    uuid: string,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      `${SUPPORTING_DOCUMENTS_PATH}/${uuid}`,
      {
        method: 'DELETE',
        headers: getAuthHeader(token),
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
