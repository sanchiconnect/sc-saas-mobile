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

export const getErrorMessage = (data: any): string | undefined => {
  // NestJS-style validation errors come back as either a string or a string[]
  // depending on the validator. Join arrays so the toast doesn't read like
  // "[object Object]" or a single comma-mashed run-on.
  const flatten = (value: any): string | undefined => {
    if (!value) return undefined;
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
      const parts = value
        .map(v => (typeof v === 'string' ? v : v?.message || ''))
        .filter(Boolean);
      return parts.length ? parts.join('\n') : undefined;
    }
    return undefined;
  };
  return (
    flatten(data?.message) ||
    flatten(data?.error?.message) ||
    flatten(data?.errors) ||
    flatten(data?.data?.message) ||
    flatten(data?.response?.message)
  );
};

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
    // Surface failed payloads to Metro for in-the-loop debugging. Kept simple
    // (no token, just method/path/status/body) to avoid leaking secrets.
    // eslint-disable-next-line no-console
    console.warn(
      `[API ${response.status}] ${options.method || 'GET'} ${path} | request: ${
        options.body ? String(options.body).slice(0, 500) : 'n/a'
      } | response: ${raw.slice(0, 500)}`,
    );
    throw new Error(
      getErrorMessage(data) || `Request failed with status ${response.status}.`,
    );
  }

  return data as T;
};
