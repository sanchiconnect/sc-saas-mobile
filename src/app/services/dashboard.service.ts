import type {DashboardStat, DashboardSummary} from '../types';
import {authService} from '../../auth/services/auth.service';

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
  {
    key: 'certificate',
    value: '0',
    title: 'Download Certificate',
    icon: 'download',
  },
];

export const dashboardService = {
  async fetchSummary(token: string): Promise<DashboardSummary> {
    try {
      const completenessData = await authService.getProfileCompletion(token);
      const rawPercentage =
        completenessData?.data?.percentage ?? completenessData?.percentage ?? 0;
      const profileCompletion = Number(rawPercentage);

      return {
        profileCompletion: Number.isFinite(profileCompletion)
          ? profileCompletion
          : 0,
        stats: mockStats,
      };
    } catch (error) {
      console.warn('Dashboard summary load failed:', error);
      return {
        profileCompletion: 0,
        stats: mockStats,
      };
    }
  },
};
