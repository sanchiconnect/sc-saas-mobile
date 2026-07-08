import {
  getAuthHeader,
  requestJson,
  resolveBaseUrl,
} from '../../../core/api/apiClient';

export type MetricType = {
  title: string;
  fieldType: string;
  numberFormatType?: string;
  programs?: Array<{uuid: string; programTitle: string}>;
};

export type MetricItem = {
  uuid: string;
  metricValue: string | number | null;
  metricType: MetricType;
  canEdit?: boolean;
  requestEdit?: boolean;
};

export type MetricBlock = {
  date: string;
  list: MetricItem[];
  programSpecific: MetricItem[];
};

export type ReviewConnection = {
  uuid: string;
  companyName?: string;
  name?: string;
  accountType?: string;
  programs?: string[];
};

const toBlocks = (data: Record<string, MetricItem[]>): MetricBlock[] =>
  Object.entries(data || {}).map(([date, items]) => ({
    date,
    list: (items || [])
      .filter(e => !e.metricType?.programs?.length)
      .sort((a, b) => (a as any).id - (b as any).id),
    programSpecific: (items || [])
      .filter(e => !!e.metricType?.programs?.length)
      .sort((a, b) => (a as any).id - (b as any).id),
  }));

export const growthMetricsService = {
  // GET api/v1/metrics/all — startup's own metrics (keyed by period)
  async getMetrics(token: string): Promise<MetricBlock[]> {
    const baseUrl = await resolveBaseUrl();
    const res = await requestJson<unknown>(
      'api/v1/metrics/all',
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    );
    const r = res as Record<string, unknown>;
    const data = (r?.data ?? res) as Record<string, MetricItem[]>;
    return toBlocks(data);
  },

  // GET api/v1/metrics/reviewer/metrics-list — connections whose metrics were shared
  async getReviews(token: string): Promise<ReviewConnection[]> {
    const baseUrl = await resolveBaseUrl();
    const res = await requestJson<unknown>(
      'api/v1/metrics/reviewer/metrics-list',
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    );
    const r = res as Record<string, unknown>;
    return ((r?.data ?? res) as ReviewConnection[]) || [];
  },

  // GET api/v1/metrics/reviewer/metrics/{uuid}/details — metrics of a specific connection
  async getMetricsOfReviewee(
    token: string,
    uuid: string,
  ): Promise<MetricBlock[]> {
    const baseUrl = await resolveBaseUrl();
    const res = await requestJson<unknown>(
      `api/v1/metrics/reviewer/metrics/${uuid}/details`,
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    );
    const r = res as Record<string, unknown>;
    const payload = (r?.data ?? res) as Record<string, unknown>;
    const data = (payload?.metrics ?? payload) as Record<string, MetricItem[]>;
    return toBlocks(data);
  },
};
