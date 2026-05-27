import {
  getAuthHeader,
  getErrorMessage,
  normalizeTokenValue,
  requestJson,
  resolveBaseUrl,
  safeJsonParse,
} from '../../../core/api/apiClient';
import {
  fetchFundingStages,
  fetchInvestmentMechanisms,
  verifyEmail,
  verifyMobileNumber,
} from '../../../core/tenant/tenant.service';
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
  mentor: 'mentors',
  service_provider: 'service_providers',
  partner: 'partners',
  individual: 'individuals',
  program_office: 'program_office_members',
  job_seeker: 'job_seekers',
};

const SELF_INFORMATION_PATH_OVERRIDES: Record<string, string> = {
  individual: 'api/v1/individuals/information',
  investor: 'api/v1/investors/organization-information',
  program_office:
    'api/v1/program_office_members/program-office-member-information',
};

const buildInformationPath = (accountType?: string) => {
  const type = (accountType || 'startup').toLowerCase();
  const override = SELF_INFORMATION_PATH_OVERRIDES[type];
  if (override) {
    return override;
  }
  const plural = ACCOUNT_TYPE_TO_PLURAL[type] || `${type}s`;
  const actionType = type.replace(/_/g, '-');
  return `api/v1/${plural}/${actionType}-information`;
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

const PROFILE_COMPLETENESS_PATH_OVERRIDES: Record<string, string> = {
  investor: 'api/v1/investors/organization/profile_completeness',
  // Frontend dispatches a separate `GetIndividualProfileCompleteness` action
  // when `investorType === 'individual'`. Mirror via this override key —
  // resolved by `getProfileCompletion(token, accountType, investorType)`.
  'investor:individual': 'api/v1/investors/profile_completeness',
};

const buildDashboardPath = (accountType?: string): string => {
  const type = (accountType || 'startup').toLowerCase();
  const plural = ACCOUNT_TYPE_TO_PLURAL[type] || `${type}s`;
  return `api/v1/${plural}/dashboard`;
};

const NOTIFICATIONS_COUNT_PATH = 'api/v1/notifications/count';

const buildProfileCompletenessPath = (
  accountType?: string,
  investorType?: string,
) => {
  const type = (accountType || 'startup').toLowerCase();
  // Investor individual gets its own completeness endpoint.
  if (type === 'investor' && (investorType || '').toLowerCase() === 'individual') {
    return PROFILE_COMPLETENESS_PATH_OVERRIDES['investor:individual'];
  }
  const override = PROFILE_COMPLETENESS_PATH_OVERRIDES[type];
  if (override) {
    return override;
  }
  const plural = ACCOUNT_TYPE_TO_PLURAL[type] || `${type}s`;
  return `api/v1/${plural}/profile_completeness`;
};
const FINANCIALS_INFORMATION_PATH = 'api/v1/startups/financials-information';
const INDUSTRY_TECHNOLOGY_BUSINESS_PATH =
  'api/v1/startups/industry-technology-business';
const PITCH_DECK_PATH = 'api/v1/startups/pitch-deck';
const PRODUCT_INFORMATION_PATH = 'api/v1/startups/product-information';
const ADVISORY_BOARDS_PATH = 'api/v1/startups/advisory-boards';
const FOUNDERS_PATH = 'api/v1/startups/founders';
const DOCUMENT_TYPES_PATH = 'api/v1/public/global/document_types';
const SUPPORTING_DOCUMENTS_PATH = 'api/v1/startups/supporting-documents';
const STARTUP_DOCUMENT_SAVE_PATH = 'api/v1/startup/documents';
const STARTUP_DOCUMENTS_LIST_PATH = 'api/v1/startup/documents/';
const PITCH_TYPE_PATH = 'api/v1/startups/pitch-deck/default/pitch-type';
const PITCH_FILE_UPLOAD_PATH = 'api/v1/startups/pitch-deck/upload/pitch-file';
const INVESTOR_LOGO_UPLOAD_PATH = 'api/v1/investors/upload/logo';
const INVESTOR_CONNECTION_DOC_UPLOAD_PATH =
  'api/v1/investors/upload/connection-document';
const CORPORATE_LOGO_UPLOAD_PATH = 'api/v1/corporates/upload/logo';
const MENTOR_LOGO_UPLOAD_PATH = 'api/v1/mentors/upload/logo';
const SERVICE_PROVIDER_LOGO_UPLOAD_PATH =
  'api/v1/service_providers/upload/logo';
const PARTNER_LOGO_UPLOAD_PATH = 'api/v1/partners/upload/logo';
const PROGRAM_OFFICE_LOGO_UPLOAD_PATH =
  'api/v1/program_office_members/upload/logo';
const INDIVIDUAL_LOGO_UPLOAD_PATH = 'api/v1/individuals/upload/logo';
const PITCH_VIDEO_UPLOAD_PATH = 'api/v1/startups/pitch-deck/upload/pitch-video';
const POWER_PITCH_VIDEO_PATH = 'api/v1/power-pitch/video';
const POWER_PITCH_CONNECT_PATH = 'api/v1/power-pitch/connect';
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
const CORPORATE_PUBLIC_INFORMATION_PATH =
  'api/v1/corporates/public/corporate-information';
const INVESTOR_PUBLIC_INFORMATION_PATH =
  'api/v1/investors/public/profile';
const MENTOR_PUBLIC_INFORMATION_PATH =
  'api/v1/mentors/public/mentor-information';
const SERVICE_PROVIDER_PUBLIC_INFORMATION_PATH =
  'api/v1/service_providers/public/service-provider-information';
const PARTNER_PUBLIC_INFORMATION_PATH =
  'api/v1/partners/public/partners-information';
const INDIVIDUAL_PUBLIC_INFORMATION_PATH =
  'api/v1/individuals/public/individual-information';
const PROGRAM_OFFICE_PUBLIC_INFORMATION_PATH =
  'api/v1/program_office_members/public/program-office-member-information';

type ApiResponse = Record<string, any>;


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
    // Tolerate hyphen + space variants that some legacy callers (UI types,
    // older API responses) still emit — the canonical slug is underscored.
    case 'service provider':
    case 'service-provider':
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
  const normalizedToken = normalizeTokenValue(token);
  if (!normalizedToken) {
    // Without a real token every authenticated call 401s on the next screen
    // — surface the failure loud rather than silently entering Home with a stub.
    throw new Error(
      'Authentication succeeded but the server did not return a token. Please try again.',
    );
  }

  const user = profile?.data?.user || profile?.data || profile?.user || {};
  const fullName =
    user?.fullName ||
    user?.name ||
    user?.displayName ||
    fallback.fullName ||
    fallback.email.split('@')[0];

  return {
    token: normalizedToken,
    user: {
      id: String(user?.id || user?._id || fallback.email),
      uuid: user?.uuid ? String(user.uuid) : undefined,
      email: user?.email || user?.emailAddress || fallback.email,
      fullName,
    },
  };
};

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
// Endpoints for secondary tabs + custom forms (Phase H).
const INVESTOR_INVESTMENTS_PATH = 'api/v1/investors/investments-information';
const INVESTOR_REPRESENTATIVE_PATH =
  'api/v1/investors/representative-information';
const CORPORATE_ENGAGEMENT_PATH = 'api/v1/corporates/engagement-information';
const buildFormsListPath = (accountType?: string) =>
  `api/v1/forms-management/list/${(accountType || 'startup').toLowerCase()}`;
const buildFormSubmissionPath = (formUuid: string) =>
  `api/v1/forms-management/submission/${formUuid}`;

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

  // Frontend auto-saves the newsletter toggle on change — no batching with
  // other profile fields. Same PATCH shape (`{subscribeToNewsletter: boolean}`).
  async updateNewsletterSubscription(
    token: string,
    subscribe: boolean,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      'api/v1/users/profile/subscribe-to-newsletter',
      {
        method: 'PATCH',
        headers: getAuthHeader(token),
        body: JSON.stringify({subscribeToNewsletter: subscribe}),
      },
      baseUrl,
    );
  },

  // Sleep mode / reactivate — feature-gated by `can_deactivate_profile`.
  // Single endpoint flips the deactivation state via a boolean payload.
  async setAccountDeactivated(
    token: string,
    deactivated: boolean,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      'api/v1/users/deactivate_account',
      {
        method: 'PATCH',
        headers: getAuthHeader(token),
        body: JSON.stringify({isDeactivated: deactivated}),
      },
      baseUrl,
    );
  },

  async updateUserSocialLinks(
    token: string,
    links: {linkedinUrl?: string; twitterUrl?: string},
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      'api/v1/users/profile/social-links',
      {
        method: 'PATCH',
        headers: getAuthHeader(token),
        body: JSON.stringify(links),
      },
      baseUrl,
    );
  },

  async uploadUserAvatar(
    token: string,
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

    const response = await fetch(`${baseUrl}api/v1/users/upload/avatar`, {
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
          `Avatar upload failed (${response.status}).`,
      );
    }
    return data as ApiResponse;
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

  async getCorporatePublicInformation(
    token: string,
    uuid: string,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      `${CORPORATE_PUBLIC_INFORMATION_PATH}/${uuid}`,
      {
        method: 'GET',
        headers: getAuthHeader(token),
      },
      baseUrl,
    );
  },

  async getInvestorPublicInformation(
    token: string,
    uuid: string,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      `${INVESTOR_PUBLIC_INFORMATION_PATH}/${uuid}`,
      {
        method: 'GET',
        headers: getAuthHeader(token),
      },
      baseUrl,
    );
  },

  async getMentorPublicInformation(
    token: string,
    uuid: string,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      `${MENTOR_PUBLIC_INFORMATION_PATH}/${uuid}`,
      {
        method: 'GET',
        headers: getAuthHeader(token),
      },
      baseUrl,
    );
  },

  async getServiceProviderPublicInformation(
    token: string,
    uuid: string,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      `${SERVICE_PROVIDER_PUBLIC_INFORMATION_PATH}/${uuid}`,
      {
        method: 'GET',
        headers: getAuthHeader(token),
      },
      baseUrl,
    );
  },

  async getPartnerPublicInformation(
    token: string,
    uuid: string,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      `${PARTNER_PUBLIC_INFORMATION_PATH}/${uuid}`,
      {
        method: 'GET',
        headers: getAuthHeader(token),
      },
      baseUrl,
    );
  },

  async getIndividualPublicInformation(
    token: string,
    uuid: string,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      `${INDIVIDUAL_PUBLIC_INFORMATION_PATH}/${uuid}`,
      {
        method: 'GET',
        headers: getAuthHeader(token),
      },
      baseUrl,
    );
  },

  async getProgramOfficePublicInformation(
    token: string,
    uuid: string,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      `${PROGRAM_OFFICE_PUBLIC_INFORMATION_PATH}/${uuid}`,
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
    investorType?: string,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      buildProfileCompletenessPath(accountType, investorType),
      {
        method: 'GET',
        headers: getAuthHeader(token),
      },
      baseUrl,
    );
  },

  async getRoleDashboard(
    token: string,
    accountType?: string,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      buildDashboardPath(accountType),
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    );
  },

  async getNotificationsCount(token: string): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      NOTIFICATIONS_COUNT_PATH,
      {method: 'GET', headers: getAuthHeader(token)},
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

  async getTicketDetail(token: string, uuid: string): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      `api/v1/tickets/${uuid}/detail`,
      {
        method: 'GET',
        headers: getAuthHeader(token),
      },
      baseUrl,
    );
  },

  async addTicketConversation(
    token: string,
    uuid: string,
    payload: {description: string; attachments?: string[]},
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      `api/v1/tickets/${uuid}/conversation`,
      {
        method: 'POST',
        headers: getAuthHeader(token),
        body: JSON.stringify(payload),
      },
      baseUrl,
    );
  },

  // Patches editable ticket metadata (status, priority, title, description).
  // The frontend uses this for status changes; mobile just needs status flips
  // (open ↔ closed) for now but the method takes a free-form payload.
  async updateTicket(
    token: string,
    uuid: string,
    payload: Record<string, any>,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      `api/v1/tickets/${uuid}`,
      {
        method: 'PATCH',
        headers: getAuthHeader(token),
        body: JSON.stringify(payload),
      },
      baseUrl,
    );
  },

  async deleteTicket(token: string, uuid: string): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      `api/v1/tickets/${uuid}`,
      {method: 'DELETE', headers: getAuthHeader(token)},
      baseUrl,
    );
  },

  async deleteTicketComment(
    token: string,
    ticketUuid: string,
    commentUuid: string,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      `api/v1/tickets/${ticketUuid}/conversation/${commentUuid}`,
      {method: 'DELETE', headers: getAuthHeader(token)},
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
    accountType?: string,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      buildInformationPath(accountType),
      {
        method: 'PATCH',
        headers: getAuthHeader(token),
        body: JSON.stringify(payload),
      },
      baseUrl,
    );
  },

  // ── Investor: Investment Details ──
  async updateInvestorInvestments(
    token: string,
    payload: Record<string, any>,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      INVESTOR_INVESTMENTS_PATH,
      {
        method: 'PATCH',
        headers: getAuthHeader(token),
        body: JSON.stringify(payload),
      },
      baseUrl,
    );
  },

  // ── Investor: Representative Details ──
  async getInvestorRepresentative(token: string): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      INVESTOR_REPRESENTATIVE_PATH,
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    );
  },

  async updateInvestorRepresentative(
    token: string,
    payload: Record<string, any>,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      INVESTOR_REPRESENTATIVE_PATH,
      {
        method: 'PATCH',
        headers: getAuthHeader(token),
        body: JSON.stringify(payload),
      },
      baseUrl,
    );
  },

  // ── Corporate: Engagement ──
  async updateCorporateEngagement(
    token: string,
    payload: Record<string, any>,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      CORPORATE_ENGAGEMENT_PATH,
      {
        method: 'PATCH',
        headers: getAuthHeader(token),
        body: JSON.stringify(payload),
      },
      baseUrl,
    );
  },

  // ── Custom (tenant-defined) profile forms ──
  async listProfileForms(
    token: string,
    accountType?: string,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      buildFormsListPath(accountType),
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    );
  },

  async getProfileFormSubmission(
    token: string,
    formUuid: string,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      buildFormSubmissionPath(formUuid),
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    );
  },

  async submitProfileForm(
    token: string,
    formUuid: string,
    payload: Record<string, any>,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      buildFormSubmissionPath(formUuid),
      {
        method: 'POST',
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

  async uploadInvestorLogo(
    token: string,
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

    const response = await fetch(`${baseUrl}${INVESTOR_LOGO_UPLOAD_PATH}`, {
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
          `Logo upload failed (${response.status}).`,
      );
    }
    return data as ApiResponse;
  },

  async uploadCorporateLogo(
    token: string,
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

    const response = await fetch(`${baseUrl}${CORPORATE_LOGO_UPLOAD_PATH}`, {
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
          `Logo upload failed (${response.status}).`,
      );
    }
    return data as ApiResponse;
  },

  async uploadMentorLogo(
    token: string,
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

    const response = await fetch(`${baseUrl}${MENTOR_LOGO_UPLOAD_PATH}`, {
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
          `Logo upload failed (${response.status}).`,
      );
    }
    return data as ApiResponse;
  },

  async uploadServiceProviderLogo(
    token: string,
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
      `${baseUrl}${SERVICE_PROVIDER_LOGO_UPLOAD_PATH}`,
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
          `Logo upload failed (${response.status}).`,
      );
    }
    return data as ApiResponse;
  },

  async uploadPartnerLogo(
    token: string,
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

    const response = await fetch(`${baseUrl}${PARTNER_LOGO_UPLOAD_PATH}`, {
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
          `Logo upload failed (${response.status}).`,
      );
    }
    return data as ApiResponse;
  },

  async uploadProgramOfficeLogo(
    token: string,
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
      `${baseUrl}${PROGRAM_OFFICE_LOGO_UPLOAD_PATH}`,
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
          `Logo upload failed (${response.status}).`,
      );
    }
    return data as ApiResponse;
  },

  async uploadIndividualLogo(
    token: string,
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

    const response = await fetch(`${baseUrl}${INDIVIDUAL_LOGO_UPLOAD_PATH}`, {
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
          `Logo upload failed (${response.status}).`,
      );
    }
    return data as ApiResponse;
  },

  async uploadInvestorConnectionDocument(
    token: string,
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
      `${baseUrl}${INVESTOR_CONNECTION_DOC_UPLOAD_PATH}`,
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
          `Connection document upload failed (${response.status}).`,
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

  async uploadPitchVideo(
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

    const response = await fetch(`${baseUrl}${PITCH_VIDEO_UPLOAD_PATH}`, {
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
          `Pitch video upload failed (${response.status}).`,
      );
    }
    return data as ApiResponse;
  },

  async connectPowerPitch(token: string): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      POWER_PITCH_CONNECT_PATH,
      {
        method: 'POST',
        headers: getAuthHeader(token),
        body: JSON.stringify({}),
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

  async updatePitchDeck(
    token: string,
    payload: Record<string, any>,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      PITCH_DECK_PATH,
      {
        method: 'PATCH',
        headers: getAuthHeader(token),
        body: JSON.stringify(payload),
      },
      baseUrl,
    );
  },

  async updateProductInformation(
    token: string,
    payload: Record<string, any>,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      PRODUCT_INFORMATION_PATH,
      {
        method: 'PATCH',
        headers: getAuthHeader(token),
        body: JSON.stringify(payload),
      },
      baseUrl,
    );
  },

  async updateAdvisoryBoard(
    token: string,
    uuid: string,
    payload: Record<string, any>,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      `${ADVISORY_BOARDS_PATH}/${uuid}`,
      {
        method: 'PATCH',
        headers: getAuthHeader(token),
        body: JSON.stringify(payload),
      },
      baseUrl,
    );
  },

  async getAdvisoryBoardByUuid(
    token: string,
    uuid: string,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      `${ADVISORY_BOARDS_PATH}/${uuid}`,
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    );
  },

  async updateFounder(
    token: string,
    uuid: string,
    payload: Record<string, any>,
  ): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      `${FOUNDERS_PATH}/${uuid}`,
      {
        method: 'PATCH',
        headers: getAuthHeader(token),
        body: JSON.stringify(payload),
      },
      baseUrl,
    );
  },

  async getFounderByUuid(token: string, uuid: string): Promise<ApiResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ApiResponse>(
      `${FOUNDERS_PATH}/${uuid}`,
      {method: 'GET', headers: getAuthHeader(token)},
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

      // On resend, skip the email/mobile availability pre-flight — those were
      // already validated when the user first hit "Send OTP", and re-running
      // them against a now-taken number would (incorrectly) reject the resend.
      // Mirrors the frontend: pre-flight runs only on input-change.
      let emailVerificationId: string | undefined;

      if (!payload.resend) {
        const userType = normalizeRole(payload.role);
        const investorType = normalizeInvestorType(payload.investorType);

        const [emailCheck, mobileCheck] = await Promise.all([
          verifyEmail(baseUrl, email, userType, investorType),
          verifyMobileNumber(
            baseUrl,
            payload.mobile.trim(),
            userType,
            investorType,
          ),
        ]);

        if (isFailureResponse(emailCheck)) {
          throw new Error(
            getErrorMessage(emailCheck) || 'Email verification failed.',
          );
        }

        if (isFailureResponse(mobileCheck)) {
          throw new Error(
            getErrorMessage(mobileCheck) || 'Mobile verification failed.',
          );
        }

        emailVerificationId = getEmailVerificationId(emailCheck);
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

      return {emailVerificationId};
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
          name: payload.fullName || payload.companyName || 'User',
          emailAddress: email,
          countryCode: payload.countryCode || DEFAULT_COUNTRY_CODE,
          mobileNumber: Number(payload.mobile),
          userType,
          investorType:
            userType === 'investor' ? payload.investorType || 'organization' : '',
          companyName: payload.companyName || 'Organization',
          organizationName:
            payload.organizationName ||
            payload.companyName ||
            'Organization',
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
