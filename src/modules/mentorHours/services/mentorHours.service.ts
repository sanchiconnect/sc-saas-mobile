// API contract (list/create endpoints, filter option values) is not
// confirmed yet — this service is a stub the screen renders against safely
// (empty list, zeroed stats) until the real backend endpoints are provided.

export type MentorHourEntry = {
  uuid?: string;
  date?: string;
  durationMinutes?: number;
  entryType?: string;
  mode?: string;
  approvalStatus?: string;
  rating?: number;
  [key: string]: unknown;
};

export type MentorHoursSummary = {
  timeMeterMinutes: number;
  avgRating: number;
};

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type EntryType = 'manual' | 'auto';
export type EntryMode = 'in-person' | 'virtual';

export type MentorHoursFilters = {
  approvalStatus?: ApprovalStatus | null;
  entryType?: EntryType | null;
  mode?: EntryMode | null;
};

export const APPROVAL_STATUS_OPTIONS: ApprovalStatus[] = ['pending', 'approved', 'rejected'];
export const ENTRY_TYPE_OPTIONS: EntryType[] = ['manual', 'auto'];
export const ENTRY_MODE_OPTIONS: EntryMode[] = ['in-person', 'virtual'];

export const mentorHoursService = {
  async listMentorHours(_token: string, _filters?: MentorHoursFilters): Promise<{
    entries: MentorHourEntry[];
    summary: MentorHoursSummary;
  }> {
    return {
      entries: [],
      summary: {timeMeterMinutes: 0, avgRating: 0},
    };
  },
};
