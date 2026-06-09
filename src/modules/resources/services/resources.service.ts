import {
  getAuthHeader,
  requestJson,
  resolveBaseUrl,
} from '../../../core/api/apiClient';
import type {DashboardContentResponse} from '../types';

const BASE = 'api/v1/dashboards';

export const resourcesService = {
  // Fetches the dashboard "Resources" payload — news, report/download library
  // and (when present) videos — in a single call.
  async getDashboardContent(token: string): Promise<DashboardContentResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<DashboardContentResponse>(
      `${BASE}/content`,
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    );
  },
};
