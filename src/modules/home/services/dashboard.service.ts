import type {DashboardStat, DashboardSummary} from '../types';
import {authService} from '../../auth/services/auth.service';

// Per-role stat tile definitions. Keys are field names we expect in the
// notifications-count response; titles + icons are tenant-agnostic. Mirrors
// the frontend's `countBoxes` structure on each dashboard component.
type StatBlueprint = {
  key: string;
  countField: string;
  title: string;
  icon: string;
};

const COMMON_STATS: StatBlueprint[] = [
  {
    key: 'connect-requests',
    countField: 'pendingConnectionCount',
    title: 'Connect Requests',
    icon: 'account-plus',
  },
  {
    key: 'unread-messages',
    countField: 'unreadMessageCount',
    title: 'Unread Messages',
    icon: 'message-text',
  },
  {
    key: 'pending-meetings',
    countField: 'pendingAcceptanceMeetingCount',
    title: 'Pending Meetings',
    icon: 'calendar-clock',
  },
];

const STATS_BY_ROLE: Record<string, StatBlueprint[]> = {
  startup: [
    ...COMMON_STATS,
    {
      key: 'document-requests',
      countField: 'pendingDocumentsUploadCount',
      title: 'Document Requests',
      icon: 'file-document-outline',
    },
    {
      key: 'mentor-hours',
      countField: 'pendingAcceptanceMentorHoursCount',
      title: 'Mentor Hours',
      icon: 'clock-outline',
    },
  ],
  investor: [
    ...COMMON_STATS,
    {
      key: 'program-submissions',
      countField: 'pendingProgramFormSubmissionCount',
      title: 'Program Submissions',
      icon: 'file-document-outline',
    },
  ],
  corporate: [
    ...COMMON_STATS,
    {
      key: 'program-submissions',
      countField: 'pendingProgramFormSubmissionCount',
      title: 'Program Submissions',
      icon: 'file-document-outline',
    },
  ],
  mentor: [
    ...COMMON_STATS,
    {
      key: 'mentor-hours',
      countField: 'pendingAcceptanceMentorHoursCount',
      title: 'Mentor Hours',
      icon: 'clock-outline',
    },
  ],
};

const safeNumber = (raw: any): number => {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
};

const detectInvestorType = (profileData: Record<string, any>): string => {
  const raw = String(
    profileData?.investorType ||
      profileData?.investor_type ||
      profileData?.accountSubType ||
      '',
  ).toLowerCase();
  if (raw.includes('individual') || raw.includes('angel')) {
    return 'individual';
  }
  return raw || 'organization';
};

const buildStatsFor = (
  accountType: string,
  counts: Record<string, any>,
): DashboardStat[] => {
  const blueprint = STATS_BY_ROLE[accountType] || COMMON_STATS;
  return blueprint.map(b => ({
    key: b.key,
    title: b.title,
    icon: b.icon,
    value: String(safeNumber(counts?.[b.countField])),
  }));
};

export const dashboardService = {
  async fetchSummary(token: string): Promise<DashboardSummary> {
    let accountType = 'startup';
    let investorType: string | undefined;
    let profileData: Record<string, any> = {};

    try {
      const profile = await authService.getProfile(token);
      profileData = profile?.data?.user || profile?.data || {};
      accountType =
        String(profileData?.accountType || 'startup').toLowerCase() ||
        'startup';
      if (accountType === 'investor') {
        investorType = detectInvestorType(profileData);
      }
    } catch (error) {
      console.warn('Dashboard: profile fetch failed:', error);
    }

    // Fire the three remaining calls in parallel — none of them blocks the
    // dashboard rendering; a failure in one just means an empty section.
    const [completenessRes, dashboardRes, countsRes] = await Promise.all([
      authService
        .getProfileCompletion(token, accountType, investorType)
        .catch(() => null),
      authService.getRoleDashboard(token, accountType).catch(() => null),
      authService.getNotificationsCount(token).catch(() => null),
    ]);

    const completeness = completenessRes?.data || completenessRes || {};
    const rawPercentage = completeness?.percentage;
    const profileCompletion = safeNumber(rawPercentage);

    const counts = countsRes?.data || countsRes || {};

    return {
      accountType,
      userUuid: profileData?.uuid ? String(profileData.uuid) : undefined,
      investorType,
      profileCompletion,
      stats: buildStatsFor(accountType, counts),
      roleDashboard: dashboardRes?.data || dashboardRes || undefined,
      // `show_dashboard` is a tenant feature flag, but the completeness
      // response often also carries flow flags. We surface both so the caller
      // can decide which gate to apply.
      showDashboard:
        completeness?.showDashboard ??
        completeness?.show_dashboard ??
        undefined,
      isApproved: Boolean(completeness?.isApproved),
      isRejected: Boolean(completeness?.isRejected),
      approvalStatus:
        completeness?.approvalStatus || completeness?.approval_status,
      canToggleStatus: Boolean(completeness?.canToggleStatus),
    };
  },
};
