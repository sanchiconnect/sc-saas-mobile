export type AppSection =
  | 'dashboard'
  | 'connect'
  | 'program'
  | 'community'
  | 'business-challenges'
  | 'actions'
  | 'events'
  | 'startup-booster-kit'
  | 'resources'
  | 'tickets'
  | 'account-settings'
  | 'edit-profile';

export type AppMenuSelection = {
  section: AppSection;
  item?: string;
};

export type IconName = string;

export type MenuItem = {
  key: string;
  label: string;
  icon?: IconName;
};

export type DashboardStat = {
  key: string;
  value: string;
  title: string;
  icon: IconName;
  accent?: boolean;
};

export type DashboardSummary = {
  profileCompletion: number;
  stats: DashboardStat[];
};

export type EditProfileTab = {
  key: string;
  label: string;
  status: 'complete' | 'incomplete';
};
