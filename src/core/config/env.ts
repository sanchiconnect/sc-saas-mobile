import Config from 'react-native-config';

type AppEnv = 'development' | 'staging' | 'production';

const isAppEnv = (value: string | undefined): value is AppEnv =>
  value === 'development' || value === 'staging' || value === 'production';

const required = (key: string, value: string | undefined): string => {
  if (!value || value.length === 0) {
    throw new Error(
      `Missing env key "${key}". Check .env.<environment> and rebuild the native app — env values are baked into the binary at build time.`,
    );
  }
  return value;
};

const normaliseBaseUrl = (url: string): string =>
  url.endsWith('/') ? url : `${url}/`;

export const env = {
  apiBaseUrl: normaliseBaseUrl(required('API_BASE_URL', Config.API_BASE_URL)),
  tenantSlug: required('TENANT_SLUG', Config.TENANT_SLUG),
  appEnv: (isAppEnv(Config.APP_ENV) ? Config.APP_ENV : 'development') as AppEnv,
};

export type Env = typeof env;
