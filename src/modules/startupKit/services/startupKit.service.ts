import {
  getAuthHeader,
  requestJson,
  resolveBaseUrl,
} from '../../../core/api/apiClient';

export type StartupKitService = {
  uuid: string;
  name: string;
  shortDescription?: string;
  logo?: string | null;
  isActive?: boolean;
  // injected client-side — category this service belongs to
  type?: string;
  [key: string]: unknown;
};

export type StartupKitCategory = {
  id: number;
  name: string;
  description?: string;
  isActive?: boolean;
  services: StartupKitService[];
};

export type FlatStartupKitData = {
  categories: string[];          // category names for filter tabs
  services: StartupKitService[]; // flattened active services with .type set
};

export type StartupKitServiceDetail = {
  uuid: string;
  name: string;
  shortDescription?: string;
  longDescription?: string;
  logo?: string | null;
  isActive?: boolean;
  category?: {id: number; name: string};
  allowedProfileStatuses?: string[];
  incubationStages?: number[] | null;
  totalCreditsAmount?: number;
  totalDiscountPercentage?: number;
  totalDiscountAmount?: number;
  creditType?: string;
  discountType?: string;
  [key: string]: unknown;
};

const resolveLogo = (raw: string | undefined | null, imgKitUrl?: string): string | null => {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return `${raw}?tr=w-150,h-150,cm-pad_resize`;
  if (!imgKitUrl) return null;
  const base = imgKitUrl.replace(/\/$/, '');
  const path = raw.replace(/^\//, '');
  return `${base}/${path}?tr=w-150,h-150,cm-pad_resize`;
};

const extractCategories = (res: unknown): StartupKitCategory[] => {
  const r = res as Record<string, unknown>;
  const list =
    (Array.isArray(r?.data) && r.data) ||
    (Array.isArray(res) && res) ||
    [];
  return (list as unknown[]).filter(Boolean) as StartupKitCategory[];
};

export const startupKitService = {
  async getData(imgKitUrl?: string): Promise<FlatStartupKitData> {
    const baseUrl = await resolveBaseUrl();
    const res = await requestJson<unknown>(
      'api/v1/public/startup-kit',
      {method: 'GET'},
      baseUrl,
    );

    const raw: StartupKitCategory[] = extractCategories(res);

    const categories: string[] = [];
    const services: StartupKitService[] = [];

    raw.forEach(category => {
      if (!category?.name || category.isActive === false) return;
      const activeServices = (category.services || []).filter(s => s.isActive !== false);
      if (activeServices.length === 0) return;

      categories.push(category.name);
      activeServices.forEach(service => {
        services.push({
          ...service,
          type: category.name,
          logo: resolveLogo(service.logo as string | undefined, imgKitUrl),
        });
      });
    });

    return {categories, services};
  },

  async getDetail(uuid: string, imgKitUrl?: string): Promise<StartupKitServiceDetail> {
    const baseUrl = await resolveBaseUrl();
    const res = await requestJson<unknown>(
      `api/v1/public/startup-kit/service/${uuid}`,
      {method: 'GET'},
      baseUrl,
    );
    const r = res as Record<string, unknown>;
    const detail: StartupKitServiceDetail =
      (r?.data as StartupKitServiceDetail) ?? (res as StartupKitServiceDetail);
    return {
      ...detail,
      logo: resolveLogo(detail.logo as string | undefined, imgKitUrl)
        ?.replace('?tr=w-150,h-150,cm-pad_resize', '?tr=w-200,h-200,cm-pad_resize') ?? null,
    };
  },

  async checkApplied(token: string, uuid: string): Promise<boolean> {
    const baseUrl = await resolveBaseUrl();
    const res = await requestJson<unknown>(
      `api/v1/public/startup-kit/service/${uuid}/check`,
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    );
    const r = res as Record<string, unknown>;
    const payload = (r?.data ?? res) as Record<string, unknown>;
    return !!(payload?.isServiceSubmitted);
  },

  async apply(token: string, uuid: string): Promise<string> {
    const baseUrl = await resolveBaseUrl();
    const res = await requestJson<unknown>(
      `api/v1/public/startup-kit/service/${uuid}`,
      {method: 'POST', headers: getAuthHeader(token), body: JSON.stringify({})},
      baseUrl,
    );
    const r = res as Record<string, unknown>;
    return (
      (r?.message as Record<string, unknown>)?.message as string ||
      (r?.message as string) ||
      'Your application has been submitted successfully.'
    );
  },
};
