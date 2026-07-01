import {
  getAuthHeader,
  requestJson,
  resolveBaseUrl,
} from '../../../core/api/apiClient';

export type Milestone = {
  uuid?: string;
  title?: string;
  description?: string;
  // 'active' | 'completed' | 'pending' | 'in_progress' etc.
  status?: string;
  deadline?: string;  // YYYY-MM-DD
  reviewer?: {
    uuid?: string;
    name?: string;
    fullName?: string;
    avatar?: string | null;
  } | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

export type QuantitativeTask = {
  parameter: string;
  quantifiedValue: string;
  unit: string;
};

export type CreateMilestonePayload = {
  title: string;
  description: string;
  reviewerIds?: string[];
  startDate: string;
  targetDate: string;
  progressReporting: 'weekly' | 'monthly' | 'quarterly';
  qualitativeTasks: string[];
  quantitativeTasks: QuantitativeTask[];
};

export const milestonesService = {
  _flatten(res: unknown): Milestone[] {
    const r = res as Record<string, unknown>;
    const list =
      (Array.isArray(r?.data) && (r.data as unknown[])) ||
      (Array.isArray((r?.data as Record<string, unknown>)?.items) &&
        ((r.data as Record<string, unknown>).items as unknown[])) ||
      (Array.isArray(r?.items) && (r.items as unknown[])) ||
      (Array.isArray(res) && (res as unknown[])) ||
      [];
    return list.filter(
      (m): m is Milestone => !!m && typeof m === 'object',
    );
  },

  async listMilestones(token: string): Promise<Milestone[]> {
    const baseUrl = await resolveBaseUrl();
    const res = await requestJson<unknown>(
      'api/v1/milestones/',
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    );
    return this._flatten(res);
  },

  async createMilestone(
    token: string,
    payload: CreateMilestonePayload,
  ): Promise<unknown> {
    const baseUrl = await resolveBaseUrl();
    return requestJson(
      'api/v1/milestones/',
      {
        method: 'POST',
        headers: getAuthHeader(token),
        body: JSON.stringify(payload),
      },
      baseUrl,
    );
  },

  async deleteMilestone(token: string, uuid: string): Promise<unknown> {
    const baseUrl = await resolveBaseUrl();
    return requestJson(
      `api/v1/milestones/${uuid}`,
      {method: 'DELETE', headers: getAuthHeader(token)},
      baseUrl,
    );
  },

  // Reviewers list — reuses the same endpoint as the Schedule Meeting modal.
  async listReviewers(token: string): Promise<Array<{uuid?: string; name?: string; otherUser?: {uuid?: string; name?: string} | null}>> {
    const baseUrl = await resolveBaseUrl();
    const res = await requestJson<unknown>(
      'api/v1/milestones/reviewers',
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    );
    return this._flatten(res) as any[];
  },
};
