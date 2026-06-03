import {
  getAuthHeader,
  requestJson,
  resolveBaseUrl,
} from '../../../core/api/apiClient';

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
  otherUserUUID: string;
  // String — backend stores as text. The web also sends a string.
  duration: string;
  // Constants the web app always sends. Surfaced as defaults so callers
  // don't have to repeat them.
  meetingTimeType?: string;
  meetingLocationType?: string;
  meetingToolType?: string;
  offset?: string;
  timeZone?: string;
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

export const meetingsService = {
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
