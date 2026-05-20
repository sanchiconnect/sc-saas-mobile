import {getBaseUrl, saveBaseUrl} from '../storage/tenantStorage';
import {fetchTenantsSetting} from '../tenant/tenant.service';

// Mirrors the frontend's "Session expired" behavior in ProfileService — any
// authenticated 401 from the backend tears down the session. App.tsx registers
// a handler on mount that clears Keychain and routes back to login.
type SessionInvalidHandler = () => void;
let sessionInvalidHandler: SessionInvalidHandler | null = null;

export const setSessionInvalidHandler = (
  handler: SessionInvalidHandler | null,
): void => {
  sessionInvalidHandler = handler;
};

export const normalizeBaseUrl = (url: string): string =>
  url.endsWith('/') ? url : `${url}/`;

export const safeJsonParse = (value: string): any => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export const getErrorMessage = (data: any): string | undefined =>
  data?.message ||
  data?.error?.message ||
  data?.errors?.[0]?.message ||
  data?.data?.message ||
  data?.response?.message;

export const normalizeTokenValue = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.replace(/^Bearer\s+/i, '');
};

export const getAuthHeader = (token: string): {Authorization: string} => {
  const normalizedToken = normalizeTokenValue(token);
  if (!normalizedToken) {
    throw new Error('Missing access token.');
  }
  return {Authorization: `Bearer ${normalizedToken}`};
};

export const resolveBaseUrl = async (): Promise<string> => {
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
};

export const requestJson = async <T>(
  path: string,
  options: RequestInit,
  baseUrl?: string,
): Promise<T> => {
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
    if (response.status === 401 && sessionInvalidHandler) {
      sessionInvalidHandler();
    }
    throw new Error(
      getErrorMessage(data) || `Request failed with status ${response.status}.`,
    );
  }

  return data as T;
};
