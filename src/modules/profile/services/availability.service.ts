import {
  getAuthHeader,
  requestJson,
  resolveBaseUrl,
} from '../../../core/api/apiClient';

// Mirrors the JSON shape the web frontend posts to / reads from the same
// endpoint. Times are stored as "HH:mm" in UTC; the mapper handles local
// conversion.
export type ApiTime = {startTime: string; endTime: string};

export type ApiAvailabilityDay = {
  closed: boolean;
  dayName: string;
  dayIndex: number;
  times: ApiTime[];
};

export type ApiAvailabilityDate = {
  closed: boolean;
  date: string;
  times: ApiTime[];
};

export type ApiAvailabilityMode =
  | 'anytime'
  | 'temporary_unavailable'
  | 'specific_days'
  | 'specific_dates';

export type ApiAvailability = {
  availabilityHours: ApiAvailabilityMode;
  days: ApiAvailabilityDay[];
  dates: ApiAvailabilityDate[];
};

const BASE = 'api/v1/meetings/users/calendar-availability';

export const availabilityService = {
  async get(token: string): Promise<ApiAvailability | null> {
    const baseUrl = await resolveBaseUrl();
    const res = await requestJson<{data: ApiAvailability | null}>(
      BASE,
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    );
    return res?.data || null;
  },

  async update(token: string, payload: ApiAvailability): Promise<void> {
    const baseUrl = await resolveBaseUrl();
    await requestJson(
      BASE,
      {
        method: 'PATCH',
        headers: getAuthHeader(token),
        body: JSON.stringify(payload),
      },
      baseUrl,
    );
  },
};
