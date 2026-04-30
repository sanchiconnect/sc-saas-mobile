import type {DashboardStat, DashboardSummary} from '../types';

const mockStats: DashboardStat[] = [
  {
    key: 'connect-requests',
    value: '0',
    title: 'Connect Requests',
    icon: 'account-plus',
  },
  {
    key: 'unread-messages',
    value: '0',
    title: 'Unread Messages',
    icon: 'message-text',
  },
  {
    key: 'mentor-hours',
    value: '0',
    title: 'Mentor Hours',
    icon: 'clock-outline',
  },
  {
    key: 'document-requests',
    value: '0',
    title: 'Document Requests',
    icon: 'file-document-outline',
  },
  // {
  //   key: 'affiliation',
  //   value: 'Active',
  //   title: 'Affiliation Tier 1',
  //   icon: 'shield-check',
  //   accent: true,
  // },
  {
    key: 'certificate',
    value: '0',
    title: 'Download Certificate',
    icon: 'download',
  },
];

export const dashboardService = {
  async fetchSummary(): Promise<DashboardSummary> {
    // Simulate network latency. Replace with a real API call.
    await new Promise<void>(resolve => setTimeout(() => resolve(), 600));
    return {
      profileCompletion: 100,
      stats: mockStats,
    };
  },
};
