import {
  getAuthHeader,
  requestJson,
  resolveBaseUrl,
} from '../../../core/api/apiClient';

// Reviewer / connection row used by the Schedule-meeting modal's
// "Who would you prefer to schedule a meeting with?" dropdown. Shape
// mirrors what `/api/v1/milestones/reviewers` returns; we keep extra
// fields loose so callers can render them without forcing a schema.
export type Reviewer = {
  uuid?: string;
  otherUser?: {
    uuid?: string;
    name?: string;
    accountType?: string;
  } | null;
  [key: string]: unknown;
};

// Calendar availability summary for a user (no date) — drives the date
// disable logic and reveals the `temporary_unavailable` short-circuit.
export type AvailabilitySummary = {
  // 'anytime' | 'specific_days' | 'temporary_unavailable'
  availabilityHours?: string;
  days?: Array<{
    dayIndex: number;
    closed?: boolean;
    times?: Array<{from?: string; to?: string}>;
  }>;
  [key: string]: unknown;
};

// Time slot served by /meetings/users/calendar-availability/{user}/{date}.
// Backend ships either bare strings ("09:00") or wrapped objects with
// timeFrom/timeTo. The service normalizes both into this shape.
export type CalendarSlot = {
  timeFrom: string;
  timeTo: string;
  // Some backends mark already-booked slots; we surface the flag so the
  // UI can grey them out (defaulting to available when omitted).
  available?: boolean;
};

export type CreateMeetingPayload = {
  // YYYY-MM-DD
  date: string;
  // 24-hour HH:mm
  timeFrom: string;
  timeTo: string;
  meetingTitle: string;
  // Agenda field (web names it meetingDescription on the form, sends
  // it under the same key).
  meetingDescription?: string;
  otherUserUUID: string;
  // String — backend stores as text. The web also sends a string.
  duration: string;
  // Mirror of the meetingToolType radio — web ships this bool alongside
  // for legacy reasons. true → external URL, false → inbuilt.
  useExternalTool?: boolean;
  // External meeting URL (Google Meet / Zoom / etc.). null when
  // meetingToolType === 'inbuilt'.
  meetingExternalUrl?: string | null;
  // Physical venue address when meetingLocationType === 'inperson'.
  // null otherwise.
  meetingInPersonLocation?: string | null;
  // Constants the web app always sends. Surfaced as defaults so callers
  // don't have to repeat them.
  meetingTimeType?: string;
  meetingLocationType?: string;
  meetingToolType?: string;
  offset?: string;
  timeZone?: string;
};

// Public profile shape — used by the Schedule modal to derive the
// recipient's `org_name` for the meeting title prefix. Backend ships
// extra fields we don't need, kept loose so they pass through.
export type PublicProfile = {
  uuid?: string;
  name?: string;
  fullName?: string;
  org_name?: string;
  organizationName?: string;
  companyName?: string;
  accountType?: string;
  [key: string]: unknown;
};

const stringifySlot = (raw: unknown): CalendarSlot | null => {
  if (!raw) return null;
  if (typeof raw === 'string') {
    // Bare "HH:mm" from older backends — assume a 30-minute window so
    // the meeting payload has a timeTo. If the picker overrides
    // duration, we recompute timeTo at submit time anyway.
    return {timeFrom: raw, timeTo: '', available: true};
  }
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const timeFrom =
      (typeof o.timeFrom === 'string' && o.timeFrom) ||
      (typeof o.startTime === 'string' && o.startTime) ||
      (typeof o.from === 'string' && o.from) ||
      (typeof o.time === 'string' && o.time) ||
      '';
    const timeTo =
      (typeof o.timeTo === 'string' && o.timeTo) ||
      (typeof o.endTime === 'string' && o.endTime) ||
      (typeof o.to === 'string' && o.to) ||
      '';
    if (!timeFrom) return null;
    const available =
      typeof o.available === 'boolean'
        ? o.available
        : typeof o.isAvailable === 'boolean'
          ? o.isAvailable
          : !(o.booked || o.isBooked);
    return {timeFrom, timeTo, available};
  }
  return null;
};

// Server's meeting row — fields we read from /meetings/. Loose typing
// because the backend ships slightly different shapes across tenants;
// we resolve display fields defensively at render time.
export type MeetingRow = {
  uuid?: string;
  meetingTitle?: string;
  date?: string;
  timeFrom?: string;
  timeTo?: string;
  duration?: string | number;
  meetingTimeType?: string;
  status?: string;
  acceptanceStatus?: string;
  isAccepted?: boolean;
  // Direction signal from /pending-acceptance: `true` means the signed-in
  // user is the receiver and CAN accept/reject (= Meeting Request /
  // incoming). `false` means it was sent by the user (= Sent Request /
  // outgoing).
  canReceiverAcceptReject?: boolean;
  // Counterparty info
  receiver?: {
    uuid?: string;
    name?: string;
    fullName?: string;
    avatar?: string | null;
    companyName?: string;
  } | null;
  // Some endpoints alias to `otherUser`.
  otherUser?: {
    uuid?: string;
    name?: string;
    avatar?: string | null;
  } | null;
  // Surface anything extra the server ships so the detail sheet can use it.
  [key: string]: unknown;
};

export const meetingsService = {
  // Public profile by UUID. Web's `profileService.getUserPublicProfile`
  // — used by the Schedule modal to read the recipient's `org_name`
  // for the meeting title prefix (web template:
  // `userProfileData.org_name || modalData.otherUser.name`).
  async getUserPublicProfile(
    token: string,
    userUUID: string,
  ): Promise<PublicProfile> {
    const baseUrl = await resolveBaseUrl();
    const res = await requestJson<unknown>(
      `api/v1/users/public_profile/${userUUID}`,
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    );
    const r = res as Record<string, unknown>;
    const data = (r?.data as PublicProfile) || (r as PublicProfile);
    return data || {};
  },

  // User-level availability summary (no date). Web calls this from the
  // Schedule modal on open to surface `temporary_unavailable` and to
  // know which weekday indexes are disabled.
  async getUserAvailability(
    token: string,
    userUUID: string,
  ): Promise<AvailabilitySummary> {
    const baseUrl = await resolveBaseUrl();
    const res = await requestJson<unknown>(
      `api/v1/meetings/users/calendar-availability/${userUUID}`,
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    );
    const r = res as Record<string, unknown>;
    const data = (r?.data as AvailabilitySummary) || (r as AvailabilitySummary);
    return data || {};
  },

  // Connections eligible to receive a meeting invite — same list the web
  // Schedule modal binds to. Returns the raw rows so callers can pick
  // off `otherUser.{uuid,name,accountType}`.
  async listReviewers(token: string): Promise<Reviewer[]> {
    const baseUrl = await resolveBaseUrl();
    const res = await requestJson<unknown>(
      'api/v1/milestones/reviewers',
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    );
    return this._flatten(res) as unknown as Reviewer[];
  },

  // Calendar availability for `otherUserUUID` on `date` (yyyy-mm-dd).
  // Used by the connection-accept "Schedule video call" flow to populate
  // the start-time picker with the slots the recipient hasn't already
  // booked.
  async getCalendarAvailability(
    token: string,
    otherUserUUID: string,
    date: string,
  ): Promise<CalendarSlot[]> {
    const baseUrl = await resolveBaseUrl();
    const res = await requestJson<unknown>(
      `api/v1/meetings/users/calendar-availability/${otherUserUUID}/${date}`,
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    );
    // Backend response shapes vary by tenant; accept any of:
    //   { data: { slots: [...] } }
    //   { data: [...] }
    //   [...]
    //   { slots: [...] }
    const r = res as Record<string, unknown>;
    const list =
      (Array.isArray(r?.data) && (r.data as unknown[])) ||
      (Array.isArray((r?.data as Record<string, unknown>)?.slots) &&
        ((r.data as Record<string, unknown>).slots as unknown[])) ||
      (Array.isArray(r?.slots) && (r.slots as unknown[])) ||
      (Array.isArray(res) && (res as unknown[])) ||
      [];
    return list
      .map(stringifySlot)
      .filter((s): s is CalendarSlot => s !== null);
  },

  // Generic response unpacker for /meetings endpoints. Walks every wrapper
  // shape we've seen (`{data:[]}`, `{data:{items:[]}}`, bare array, etc.)
  // and returns a clean MeetingRow[].
  _flatten(res: unknown): MeetingRow[] {
    const r = res as Record<string, unknown>;
    const list =
      (Array.isArray(r?.data) && (r.data as unknown[])) ||
      (Array.isArray((r?.data as Record<string, unknown>)?.items) &&
        ((r.data as Record<string, unknown>).items as unknown[])) ||
      (Array.isArray(r?.items) && (r.items as unknown[])) ||
      (Array.isArray(res) && (res as unknown[])) ||
      [];
    return list.filter(
      (m): m is MeetingRow => !!m && typeof m === 'object',
    );
  },

  // All of the signed-in user's meetings. Source for the calendar /
  // "Meetings this week" list — `canReceiverAcceptReject` won't be set
  // here, so this list is used for week filtering and accepted meetings.
  async listMeetings(token: string): Promise<MeetingRow[]> {
    const baseUrl = await resolveBaseUrl();
    const res = await requestJson<unknown>(
      'api/v1/meetings/',
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    );
    return this._flatten(res);
  },

  // Pending-acceptance meetings — the source for the Meeting Requests /
  // Sent Requests tabs. Backend sets `canReceiverAcceptReject: true` on
  // rows the current user can accept (incoming), and `false` on rows
  // they themselves created (outgoing, awaiting the other side).
  async fetchPendingAcceptance(token: string): Promise<MeetingRow[]> {
    const baseUrl = await resolveBaseUrl();
    const res = await requestJson<unknown>(
      'api/v1/meetings/pending-acceptance',
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    );
    return this._flatten(res);
  },

  // Schedule a meeting. Called after the connection accept PATCH so the
  // chat thread starts with a server-emitted "meeting" message.
  async createMeeting(
    token: string,
    payload: CreateMeetingPayload,
  ): Promise<unknown> {
    const baseUrl = await resolveBaseUrl();
    const body = {
      meetingTimeType: 'schedule_later',
      meetingLocationType: 'virtual',
      meetingToolType: 'inbuilt',
      ...payload,
    };
    return requestJson(
      'api/v2/meetings/',
      {
        method: 'POST',
        headers: getAuthHeader(token),
        body: JSON.stringify(body),
      },
      baseUrl,
    );
  },
};
