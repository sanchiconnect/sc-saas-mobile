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
  | 'edit-profile'
  | 'profile'
  | 'chat'
  | 'connections';

export type AppMenuSelection = {
  section: AppSection;
  item?: string;
};

export type IconName = string;

export type MenuItem = {
  key: string;
  label: string;
  icon?: IconName;
  // Mirrors frontend nav-link gates. Item is rendered only when ALL applicable
  // gates pass.
  // - featureKey: shown when `brandDetails.features[featureKey]` is truthy.
  // - userKey: shown when `brandDetails.users[userKey]` is truthy (used by
  //   the Connect submenu to hide roles the tenant doesn't enable).
  // - accountTypes: if present, only shown for users whose accountType is in
  //   the array.
  // - excludeAccountTypes: if present, hidden for users whose accountType is in
  //   the array (useful for items that apply to everyone except one role).
  featureKey?: string;
  userKey?: string;
  accountTypes?: string[];
  excludeAccountTypes?: string[];
};

export type DashboardStat = {
  key: string;
  value: string;
  title: string;
  icon: IconName;
  accent?: boolean;
};

export type DashboardSummary = {
  // Resolved at fetch-time so the rest of the home surface (sidebar filtering,
  // role-specific tiles, redirect logic) doesn't need a second profile call.
  accountType: string;
  // Backend UUID for the signed-in user. Chat / connections compare against
  // this; the auth session's `id` is the numeric primary key and won't match
  // `message.user.uuid`.
  userUuid?: string;
  investorType?: string;
  profileCompletion: number;
  stats: DashboardStat[];
  // Raw role-specific dashboard payload (recently added lists, trending,
  // upcoming meetings, etc.). Shape varies per role — consumers pick fields.
  roleDashboard?: Record<string, any>;
  // Whether the tenant's `show_dashboard` feature flag wants this user to
  // see a dashboard at all. False → redirect to Edit Profile.
  showDashboard?: boolean;
  // Approval / limited-access state, used to gate widgets and badges.
  isApproved?: boolean;
  isRejected?: boolean;
  approvalStatus?: string;
  // Role-keyed `canToggleStatus` from the completeness response.
  canToggleStatus?: boolean;
  // Raw avatar value from /users/profile (typically a relative S3 path like
  // `users/abc/xyz.png`, or already-absolute). Consumers resolve it against
  // the tenant's imgKitUrl when they render the image.
  avatar?: string;
};

export type EditProfileTab = {
  key: string;
  label: string;
  status: 'complete' | 'incomplete';
  custom?: boolean;
  formUuid?: string;
};
