import {
  getAuthHeader,
  getErrorMessage,
  requestJson,
  resolveBaseUrl,
  safeJsonParse,
} from '../../../core/api/apiClient';

export type Milestone = {
  uuid?: string;
  title?: string;
  description?: string;
  // API returns a boolean (active/inactive) — use `completedOnDate` for completion.
  status?: boolean | string;
  completedOnDate?: string | null;
  deadline?: string;  // YYYY-MM-DD
  startDate?: string;
  targetDate?: string;
  reviewerIds?: string[];
  reviewer?: {
    uuid?: string;
    name?: string;
    fullName?: string;
    avatar?: string | null;
  } | null;
  progressFrequency?: string;
  notifyProgress?: boolean;
  qualitativePercent?: number;
  quantitativeStats?: number;
  qualitativeMilestonePercent?: number;
  quantitativeMilestoneStats?: number;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

export type QuantitativeTask = {
  parameter: string;
  unit: string;
  value: number;
};

export type MilestoneQualitativeItem = {
  id?: number;
  uuid?: string;
  title?: string;
  isCompleted?: boolean;
  completedOn?: string | null;
};

export type MilestoneQuantitativeUpdateLog = {
  value?: number;
  createdAt?: string;
  [key: string]: unknown;
};

export type MilestoneQuantitativeItem = {
  id?: number;
  uuid?: string;
  parameter?: string;
  unit?: string;
  value?: number;
  valueCompleted?: number;
  updateLogs?: MilestoneQuantitativeUpdateLog[] | null;
};

export type MilestoneDetail = Milestone & {
  milestoneQualitative?: MilestoneQualitativeItem[];
  milestoneQuantitative?: MilestoneQuantitativeItem[];
};

export type MilestoneNoteFile = {
  url?: string;
  name?: string;
  [key: string]: unknown;
};

export type MilestoneNote = {
  uuid?: string;
  text?: string;
  files?: MilestoneNoteFile[];
  createdAt?: string;
  user?: {name?: string; uuid?: string; accountType?: string} | null;
  [key: string]: unknown;
};

export type CreateMilestonePayload = {
  title: string;
  description: string;
  reviewersIds?: string[];
  startDate: string;
  targetDate: string;
  progressFrequency: 'every_week' | 'every_month' | 'every_quarter';
  qualitativeMilestones: {title: string}[];
  quantitativeMilestones: QuantitativeTask[];
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

  async getMilestoneDetail(token: string, uuid: string): Promise<MilestoneDetail> {
    const baseUrl = await resolveBaseUrl();
    const res = await requestJson<unknown>(
      `api/v1/milestones/${uuid}/info`,
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    );
    const r = res as Record<string, unknown>;
    return (r?.data || {}) as MilestoneDetail;
  },

  async markQualitativeCompleted(
    token: string,
    milestoneUuid: string,
    qualitativeUuid: string,
  ): Promise<unknown> {
    const baseUrl = await resolveBaseUrl();
    return requestJson(
      `api/v1/milestones/${milestoneUuid}/qualitative/${qualitativeUuid}/completed`,
      {method: 'PATCH', headers: getAuthHeader(token)},
      baseUrl,
    );
  },

  async updateTargetDate(
    token: string,
    milestoneUuid: string,
    targetDate: string,
  ): Promise<unknown> {
    const baseUrl = await resolveBaseUrl();
    return requestJson(
      `api/v1/milestones/${milestoneUuid}/target-date`,
      {
        method: 'PATCH',
        headers: getAuthHeader(token),
        body: JSON.stringify({targetDate}),
      },
      baseUrl,
    );
  },

  async toggleNotification(token: string, milestoneUuid: string): Promise<unknown> {
    const baseUrl = await resolveBaseUrl();
    return requestJson(
      `api/v1/milestones/${milestoneUuid}/toggle-notification`,
      {
        method: 'PATCH',
        headers: getAuthHeader(token),
        body: JSON.stringify({}),
      },
      baseUrl,
    );
  },

  async updateQuantitativeValue(
    token: string,
    milestoneUuid: string,
    quantitativeUuid: string,
    value: number,
  ): Promise<unknown> {
    const baseUrl = await resolveBaseUrl();
    return requestJson(
      `api/v1/milestones/${milestoneUuid}/quantitative/${quantitativeUuid}/update-value`,
      {
        method: 'PATCH',
        headers: getAuthHeader(token),
        body: JSON.stringify({value}),
      },
      baseUrl,
    );
  },

  async listNotes(token: string, milestoneUuid: string): Promise<MilestoneNote[]> {
    const baseUrl = await resolveBaseUrl();
    const res = await requestJson<unknown>(
      `api/v1/milestones/${milestoneUuid}/notes`,
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    );
    return this._flatten(res) as unknown as MilestoneNote[];
  },

  async createNote(
    token: string,
    milestoneUuid: string,
    payload: {text: string; files?: MilestoneNoteFile[]},
  ): Promise<unknown> {
    const baseUrl = await resolveBaseUrl();
    return requestJson(
      `api/v1/milestones/${milestoneUuid}/notes`,
      {
        method: 'POST',
        headers: getAuthHeader(token),
        // Backend accepts both keys for the note body; send both defensively.
        body: JSON.stringify({description: payload.text, text: payload.text, files: payload.files}),
      },
      baseUrl,
    );
  },

  async updateNote(
    token: string,
    milestoneUuid: string,
    noteUuid: string,
    payload: {text: string; files?: MilestoneNoteFile[]},
  ): Promise<unknown> {
    const baseUrl = await resolveBaseUrl();
    return requestJson(
      `api/v1/milestones/${milestoneUuid}/notes/${noteUuid}`,
      {
        method: 'PATCH',
        headers: getAuthHeader(token),
        body: JSON.stringify({description: payload.text, text: payload.text, files: payload.files}),
      },
      baseUrl,
    );
  },

  async deleteNote(token: string, milestoneUuid: string, noteUuid: string): Promise<unknown> {
    const baseUrl = await resolveBaseUrl();
    return requestJson(
      `api/v1/milestones/${milestoneUuid}/notes/${noteUuid}`,
      {method: 'DELETE', headers: getAuthHeader(token)},
      baseUrl,
    );
  },

  async uploadNoteFile(
    token: string,
    milestoneUuid: string,
    file: {uri: string; name: string; type: string},
  ): Promise<any> {
    const baseUrl = await resolveBaseUrl();
    const formData = new FormData();
    formData.append('files', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);
    const response = await fetch(
      `${baseUrl}api/v1/milestones/${milestoneUuid}/notes/upload-files`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          ...getAuthHeader(token),
        },
        body: formData as any,
      },
    );
    const raw = await response.text();
    const data = raw ? safeJsonParse(raw) : null;
    if (!response.ok) {
      throw new Error(getErrorMessage(data) || `Attachment upload failed (${response.status}).`);
    }
    return data;
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
