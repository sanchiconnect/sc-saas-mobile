import type {ApiAvailability} from './services/availability.service';

// Mobile-side shapes. Kept local to the mapper so the screen file doesn't
// need to import service-layer types.
export type ScreenAvailabilityMode =
  | 'anytime'
  | 'temporary-unavailable'
  | 'specific-days';

export type ScreenWeeklyRow = {
  dayKey: string;
  label: string;
  unavailable: boolean;
  fromTime: string;
  toTime: string;
};

export type ScreenSpecificDateRow = {
  id: string;
  dateLabel: string;
  unavailable: boolean;
  fromTime: string;
  toTime: string;
};

const DAY_INDEX_TO_KEY = ['', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_INDEX_TO_LABEL = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// "HH:mm" / "HH:mm:ss" in UTC → "hh:mm AM/PM" in the device's local timezone.
export const utcToDisplay = (utcHHmm: string): string => {
  if (!utcHHmm) return '';
  const m = utcHHmm.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return '';
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  // getTimezoneOffset returns minutes WEST of UTC (positive for the Americas,
  // negative for IST/Europe), so we *subtract* it to convert UTC → local.
  const offset = new Date().getTimezoneOffset();
  let total = h * 60 + min - offset;
  total = ((total % 1440) + 1440) % 1440;
  let hh = Math.floor(total / 60);
  const mm = total % 60;
  const ampm = hh >= 12 ? 'PM' : 'AM';
  if (hh === 0) hh = 12;
  else if (hh > 12) hh -= 12;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${ampm}`;
};

// "hh:mm AM/PM" local → "HH:mm" UTC.
export const displayToUtc = (display: string): string => {
  if (!display) return '';
  const m = display.trim().match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);
  if (!m) return '';
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const isPM = m[3].toUpperCase() === 'PM';
  if (isPM && h !== 12) h += 12;
  else if (!isPM && h === 12) h = 0;
  const offset = new Date().getTimezoneOffset();
  let total = h * 60 + min + offset;
  total = ((total % 1440) + 1440) % 1440;
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

const API_MODE_TO_SCREEN: Record<string, ScreenAvailabilityMode> = {
  anytime: 'anytime',
  temporary_unavailable: 'temporary-unavailable',
  specific_days: 'specific-days',
  // Server has a "specific_dates" enum but the UI treats it the same as
  // "specific_days" — the dates table is shown for both anytime and
  // specific-days modes.
  specific_dates: 'specific-days',
};

const SCREEN_MODE_TO_API: Record<
  ScreenAvailabilityMode,
  ApiAvailability['availabilityHours']
> = {
  anytime: 'anytime',
  'temporary-unavailable': 'temporary_unavailable',
  'specific-days': 'specific_days',
};

export const fromApi = (
  data: ApiAvailability,
): {
  mode: ScreenAvailabilityMode;
  weekly: ScreenWeeklyRow[];
  specificDates: ScreenSpecificDateRow[];
} => {
  const mode = API_MODE_TO_SCREEN[data.availabilityHours] || 'anytime';

  // Build a fixed 7-row weekly list keyed by dayIndex so missing days from
  // the server still surface as empty rows in the UI.
  const weekly: ScreenWeeklyRow[] = [1, 2, 3, 4, 5, 6, 7].map(idx => {
    const apiDay = data.days?.find(d => d.dayIndex === idx);
    const time = apiDay?.times?.[0];
    return {
      dayKey: DAY_INDEX_TO_KEY[idx],
      label: DAY_INDEX_TO_LABEL[idx],
      unavailable: Boolean(apiDay?.closed),
      fromTime: time?.startTime ? utcToDisplay(time.startTime) : '',
      toTime: time?.endTime ? utcToDisplay(time.endTime) : '',
    };
  });

  const specificDates: ScreenSpecificDateRow[] = (data.dates || []).map(
    (d, i) => {
      const time = d.times?.[0];
      return {
        id: `api_${d.date}_${i}`,
        dateLabel: d.date,
        unavailable: Boolean(d.closed),
        fromTime: time?.startTime ? utcToDisplay(time.startTime) : '',
        toTime: time?.endTime ? utcToDisplay(time.endTime) : '',
      };
    },
  );

  return {mode, weekly, specificDates};
};

export const toApi = (
  mode: ScreenAvailabilityMode,
  weekly: ScreenWeeklyRow[],
  specificDates: ScreenSpecificDateRow[],
): ApiAvailability => ({
  availabilityHours: SCREEN_MODE_TO_API[mode],
  days: weekly.map((row, i) => ({
    closed: row.unavailable,
    dayName: row.label,
    dayIndex: i + 1,
    times: [
      {
        startTime: displayToUtc(row.fromTime),
        endTime: displayToUtc(row.toTime),
      },
    ],
  })),
  dates: specificDates.map(row => ({
    closed: row.unavailable,
    date: row.dateLabel,
    times: [
      {
        startTime: displayToUtc(row.fromTime),
        endTime: displayToUtc(row.toTime),
      },
    ],
  })),
});
