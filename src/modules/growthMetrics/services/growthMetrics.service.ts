import {
  getAuthHeader,
  requestJson,
  resolveBaseUrl,
} from '../../../core/api/apiClient';

export type MetricType = {
  id?: number;
  title: string;
  fieldType: string;
  numberFormatType?: string;
  programs?: Array<{uuid: string; programTitle: string}>;
};

export type MetricItem = {
  id?: number;
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

export type MetricTypeDef = {
  id: number;
  title: string;
  fieldType: string;
  numberFormatType?: string;
  chartType?: string;
  isProgramSpecific?: boolean;
  isMandatory?: boolean;
  fieldPlaceholder?: string;
  options?: string;
  programs?: Array<{uuid: string; programTitle: string}>;
};

export type ChartDataPoint = {
  date: string;
  formattedDate: string;
  metricTypeText: string;
  metricValue: string;
};

export type MetricChart = {
  id: number;
  title: string;
  fieldType: string;
  chartType: string;
  data: ChartDataPoint[];
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
      .sort((a, b) => (a.id ?? 0) - (b.id ?? 0)),
    programSpecific: (items || [])
      .filter(e => !!e.metricType?.programs?.length)
      .sort((a, b) => (a.id ?? 0) - (b.id ?? 0)),
  }));

export const growthMetricsService = {
  // GET api/v1/metrics/types/all — all metric type definitions
  async getMetricTypes(token: string): Promise<MetricTypeDef[]> {
    const baseUrl = await resolveBaseUrl();
    const res = await requestJson<unknown>(
      'api/v1/metrics/types/all',
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    );
    const r = res as Record<string, unknown>;
    return ((r?.data ?? res) as MetricTypeDef[]) || [];
  },

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

  // GET api/v2/metrics/charts — chart data for own metrics (startup)
  async getCharts(token: string): Promise<MetricChart[]> {
    const baseUrl = await resolveBaseUrl();
    const res = await requestJson<unknown>(
      'api/v2/metrics/charts',
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    );
    const r = res as Record<string, unknown>;
    return ((r?.data ?? res) as MetricChart[]) || [];
  },

  // GET api/v2/metrics/reviewer/metrics/{uuid}/charts — chart data for a reviewee
  async getRevieweeCharts(
    token: string,
    uuid: string,
  ): Promise<MetricChart[]> {
    const baseUrl = await resolveBaseUrl();
    const res = await requestJson<unknown>(
      `api/v2/metrics/reviewer/metrics/${uuid}/charts`,
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    );
    const r = res as Record<string, unknown>;
    return ((r?.data ?? res) as MetricChart[]) || [];
  },

  // POST api/v1/metrics/ — save new metric entries
  async saveMetrics(
    token: string,
    payload: Array<{metricTypeId: number; date: string; metricValue: string | null}>,
  ): Promise<void> {
    const baseUrl = await resolveBaseUrl();
    await requestJson<unknown>(
      'api/v1/metrics/',
      {
        method: 'POST',
        headers: {...getAuthHeader(token), 'Content-Type': 'application/json'},
        body: JSON.stringify({metrics: payload}),
      },
      baseUrl,
    );
  },

  // PATCH api/v1/metrics/ — update existing metric entries
  async patchMetrics(
    token: string,
    payload: Array<{metricUUID: string; metricValue: string | null}>,
  ): Promise<void> {
    const baseUrl = await resolveBaseUrl();
    await requestJson<unknown>(
      'api/v1/metrics/',
      {
        method: 'PATCH',
        headers: {...getAuthHeader(token), 'Content-Type': 'application/json'},
        body: JSON.stringify({metrics: payload}),
      },
      baseUrl,
    );
  },

  // PATCH api/v1/metrics/request-update — request edit access
  async requestUpdate(
    token: string,
    payload: {message: string; metricsUUID: string[]},
  ): Promise<void> {
    const baseUrl = await resolveBaseUrl();
    await requestJson<unknown>(
      'api/v1/metrics/request-update',
      {
        method: 'PATCH',
        headers: {...getAuthHeader(token), 'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
      },
      baseUrl,
    );
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
