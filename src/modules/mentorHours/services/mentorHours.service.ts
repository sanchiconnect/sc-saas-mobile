import {
  getAuthHeader,
  requestJson,
  resolveBaseUrl,
} from '../../../core/api/apiClient';

// Contract confirmed against the web app's MentorshipService
// (sc-saas-frontend/src/app/core/service/mentorship.service.ts) and a live
// network capture:
//   GET   api/v1/mentorship               -> {items, meta} list of entries
//   GET   api/v1/mentorship/startups      -> mentor account's mentee startups
//   GET   api/v1/mentorship/mentors       -> startup account's connected mentors
//   GET   api/v1/mentorship/stats         -> {total_approved_minutes, avg_ratings, ...}
//   POST  api/v1/mentorship/manual-entry  -> {startupId, mentorId, mode, date, timeFrom, timeTo}
//   PATCH api/v1/mentorship/approve-hours/{uuid} -> {actionType: 'approve'|'reject', rejectMessage}
//   PATCH api/v1/mentorship/ratings/{uuid}       -> {rating, comments}
// All endpoints below are wired for real, including manual-entry — the
// caller supplies both the current user's own id (startupId for a startup
// account, mentorId for a mentor account) and the selected other party's id.
const BASE = 'api/v1/mentorship';

type ApiEnvelope<T> = {
  status_code?: number;
  message?: string;
  data?: T;
};

export type MentorshipPersonRef = {
  id?: number;
  uuid?: string;
  name?: string;
  avatar?: string | null;
};

export type MentorshipStartupRef = {
  id?: number;
  uuid?: string;
  companyName?: string;
  companyLogo?: string | null;
  user?: {name?: string}[];
};

export type MentorHourEntry = {
  uuid?: string;
  id?: number;
  mentorId?: number;
  startupId?: number;
  type?: EntryType;
  mode?: EntryMode;
  date?: string;
  timeFrom?: string;
  timeTo?: string;
  totalDuration?: number;
  approvalPending?: boolean;
  approvalStatus?: ApprovalStatus;
  mentorRatings?: number | null;
  mentorComments?: string | null;
  startupRatings?: number | null;
  startupComments?: string | null;
  ratedByStartup?: boolean;
  ratedByMentor?: boolean;
  mentor?: MentorshipPersonRef;
  startup?: MentorshipStartupRef;
  [key: string]: unknown;
};

export type MentorHoursSummary = {
  timeMeterMinutes: number;
  avgRating: number;
};

// The "other party" to log hours against — a startup (for a mentor account)
// or a mentor (for a startup account). Same shape either way.
export type MentorshipParty = {
  id: number | string;
  uuid?: string;
  name: string;
};

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type EntryType = 'manual' | 'auto';
// Matches MentorshipMode in the web app: OFFLINE = 'offline', ONLINE = 'online'.
export type EntryMode = 'offline' | 'online';

export type MentorHoursFilters = {
  approvalStatus?: ApprovalStatus | null;
  entryType?: EntryType | null;
  mode?: EntryMode | null;
};

export type LogHoursInput = {
  startupId: number | string;
  mentorId: number | string;
  mode: EntryMode;
  date: string;
  startTime: string;
  endTime: string;
};

export type ApproveRejectAction = 'approve' | 'reject';

export const APPROVAL_STATUS_OPTIONS: ApprovalStatus[] = ['pending', 'approved', 'rejected'];
export const ENTRY_TYPE_OPTIONS: EntryType[] = ['manual', 'auto'];
export const ENTRY_MODE_OPTIONS: EntryMode[] = ['offline', 'online'];
export const ENTRY_MODE_LABELS: Record<EntryMode, string> = {
  offline: 'In-person',
  online: 'Virtual',
};

// Backend was captured accepting non-zero-padded "yyyy-M-d" (e.g. "2026-7-10")
// — matches what the web app's NgbDateStruct sends. Our own date state is
// zero-padded ISO, so strip leading zeros only for the wire payload.
const toWireDate = (iso: string): string => iso.replace(/-0(\d)/g, '-$1');

const unwrapList = async (
  path: string,
  token: string,
): Promise<MentorshipParty[]> => {
  const baseUrl = await resolveBaseUrl();
  const res = await requestJson<ApiEnvelope<MentorshipParty[]> | MentorshipParty[]>(
    path,
    {method: 'GET', headers: getAuthHeader(token)},
    baseUrl,
  );
  return Array.isArray(res) ? res : res?.data ?? [];
};

export const mentorHoursService = {
  async listMentorHours(token: string, filters?: MentorHoursFilters): Promise<{
    entries: MentorHourEntry[];
    summary: MentorHoursSummary;
  }> {
    const baseUrl = await resolveBaseUrl();
    const params = new URLSearchParams();
    params.set('pageSize', '1000');
    params.set('pageNumber', '1');
    if (filters?.approvalStatus) params.set('approvalStatus', filters.approvalStatus);
    if (filters?.entryType) params.set('type', filters.entryType);
    if (filters?.mode) params.set('mode', filters.mode);

    const [listRes, statsRes] = await Promise.all([
      requestJson<ApiEnvelope<{items?: MentorHourEntry[]}>>(
        `${BASE}?${params.toString()}`,
        {method: 'GET', headers: getAuthHeader(token)},
        baseUrl,
      ),
      requestJson<ApiEnvelope<{total_approved_minutes?: number; avg_ratings?: number | null}>>(
        `${BASE}/stats`,
        {method: 'GET', headers: getAuthHeader(token)},
        baseUrl,
      ),
    ]);

    return {
      entries: listRes?.data?.items ?? [],
      summary: {
        timeMeterMinutes: statsRes?.data?.total_approved_minutes ?? 0,
        avgRating: statsRes?.data?.avg_ratings ?? 0,
      },
    };
  },

  // A mentor account's mentee startups — who a mentor logs hours against.
  async getStartups(token: string): Promise<MentorshipParty[]> {
    return unwrapList(`${BASE}/startups`, token);
  },

  // A startup account's connected mentors — who a startup logs hours against.
  async getMentors(token: string): Promise<MentorshipParty[]> {
    return unwrapList(`${BASE}/mentors`, token);
  },

  async approveOrReject(
    token: string,
    entryUuid: string,
    action: ApproveRejectAction,
    rejectMessage = '',
  ): Promise<void> {
    const baseUrl = await resolveBaseUrl();
    await requestJson(
      `${BASE}/approve-hours/${entryUuid}`,
      {
        method: 'PATCH',
        headers: getAuthHeader(token),
        body: JSON.stringify({actionType: action, rejectMessage}),
      },
      baseUrl,
    );
  },

  async rate(
    token: string,
    entryUuid: string,
    rating: number,
    comments = '',
  ): Promise<void> {
    const baseUrl = await resolveBaseUrl();
    await requestJson(
      `${BASE}/ratings/${entryUuid}`,
      {
        method: 'PATCH',
        headers: getAuthHeader(token),
        body: JSON.stringify({rating, comments}),
      },
      baseUrl,
    );
  },

  async logHours(token: string, input: LogHoursInput): Promise<void> {
    const baseUrl = await resolveBaseUrl();
    await requestJson(
      `${BASE}/manual-entry`,
      {
        method: 'POST',
        headers: getAuthHeader(token),
        body: JSON.stringify({
          startupId: input.startupId,
          mentorId: input.mentorId,
          mode: input.mode,
          date: toWireDate(input.date),
          timeFrom: input.startTime,
          timeTo: input.endTime,
        }),
      },
      baseUrl,
    );
  },
};
