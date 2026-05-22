import {
  getAuthHeader,
  requestJson,
  resolveBaseUrl,
} from '../../../core/api/apiClient';
import type {
  ConnectionCountsResponse,
  ConnectionRequestType,
  PaginatedConnections,
} from '../types';

const BASE = 'api/v1/connections';

export const connectionsService = {
  // Active (mutually accepted) connections. Frontend includes sortBy/orderBy
  // but the backend tolerates omission — keep the surface small here.
  async listActive(
    token: string,
    {
      page = 1,
      limit = 20,
      searchName = '',
    }: {page?: number; limit?: number; searchName?: string} = {},
  ): Promise<PaginatedConnections> {
    const baseUrl = await resolveBaseUrl();
    const params = new URLSearchParams();
    if (searchName) params.set('searchName', searchName);
    // Backend accepts: connectedAt | name | investor. createdAt isn't valid.
    params.set('sortBy', 'connectedAt');
    params.set('orderBy', 'DESC');
    params.set('pageNumber', String(page));
    params.set('limit', String(limit));
    return requestJson<PaginatedConnections>(
      `${BASE}?${params.toString()}`,
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    );
  },

  // Type-keyed request lists. 'received' = incoming pending, 'sent' = outgoing,
  // 'rejected' = past rejections (either side).
  async listRequests(
    token: string,
    type: ConnectionRequestType,
    {page = 1, limit = 20}: {page?: number; limit?: number} = {},
  ): Promise<PaginatedConnections> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<PaginatedConnections>(
      `${BASE}/requests/${type}?pageNumber=${page}&limit=${limit}`,
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    );
  },

  async getCounts(token: string): Promise<ConnectionCountsResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<ConnectionCountsResponse>(
      `${BASE}/types/counts`,
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    );
  },

  async accept(
    token: string,
    connectionUUID: string,
    actionMessage?: string,
  ): Promise<unknown> {
    const baseUrl = await resolveBaseUrl();
    return requestJson(
      `${BASE}/accept/${connectionUUID}`,
      {
        method: 'PATCH',
        headers: getAuthHeader(token),
        body: JSON.stringify({actionMessage: actionMessage || ''}),
      },
      baseUrl,
    );
  },

  async reject(
    token: string,
    connectionUUID: string,
    actionMessage?: string,
  ): Promise<unknown> {
    const baseUrl = await resolveBaseUrl();
    return requestJson(
      `${BASE}/reject/${connectionUUID}`,
      {
        method: 'PATCH',
        headers: getAuthHeader(token),
        body: JSON.stringify({actionMessage: actionMessage || ''}),
      },
      baseUrl,
    );
  },

  async remove(token: string, connectionUUID: string): Promise<unknown> {
    const baseUrl = await resolveBaseUrl();
    return requestJson(
      `${BASE}/${connectionUUID}`,
      {method: 'DELETE', headers: getAuthHeader(token)},
      baseUrl,
    );
  },
};
