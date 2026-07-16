import type {MenuItem} from '../types';

// `userKey` matches the frontend's `brandDetails.users.<key>` flag for each
// role. If the tenant has disabled investors, the Investors row is hidden, etc.
// `featureKey` (where present) matches a flag in `brandDetails.features.*`.
// Note: the web Connect directory lists every stakeholder type to every user
// (including your own type), so these items are NOT gated by account type —
// only by the tenant's `users.<key>` enable flag. Adding excludeAccountTypes
// here would hide e.g. the Startups tab from a startup account, which is the
// opposite of the web behavior.
export const connectItems: MenuItem[] = [
  {
    key: 'startups',
    label: 'Startups',
    icon: 'rocket-launch',
    userKey: 'startups',
  },
  {
    key: 'investors',
    label: 'Investors',
    icon: 'cash-multiple',
    userKey: 'investors',
  },
  {
    key: 'corporates',
    label: 'Corporates',
    icon: 'office-building',
    userKey: 'corporates',
  },
  {
    key: 'mentors',
    label: 'Mentors',
    icon: 'account-tie',
    userKey: 'mentors',
  },
  {
    key: 'service-providers',
    label: 'Service Providers',
    icon: 'briefcase',
    userKey: 'service_providers',
  },
  {
    key: 'partners',
    label: 'Partners',
    icon: 'handshake',
    userKey: 'partners',
  },
  {
    key: 'program-office-team',
    label: 'Program Office Team',
    icon: 'account-group',
    userKey: 'program_offices',
  },
  {
    key: 'individuals',
    label: 'Individuals',
    icon: 'account',
    userKey: 'individuals',
  },
];

export const programItems: MenuItem[] = [
  {
    key: 'all-programs',
    label: 'All Programs',
    icon: 'view-grid',
    featureKey: 'programs_menu_enabled',
  },
];

export const communityItems: MenuItem[] = [
  {
    key: 'community-wall',
    label: 'Community Wall',
    icon: 'account-group-outline',
    featureKey: 'community_feed',
  },
];

export const businessChallengeItems: MenuItem[] = [
  {
    key: 'active-challenges',
    label: 'Business Challenges',
    icon: 'briefcase-outline',
    featureKey: 'business_challenges',
  },
];

export const actionItems: MenuItem[] = [
  {key: 'my-meetings', label: 'My Meetings', icon: 'video-outline'},
  {key: 'my-connections', label: 'My Connections', icon: 'account-multiple-outline'},
  {key: 'milestones', label: 'Milestones', icon: 'flag-outline'},
  {
    key: 'growth-metrics',
    label: 'Growth Metrics',
    icon: 'chart-line',
    accountTypes: ['startup', 'mentor', 'investor', 'corporate', 'partner'],
  },
  {
    key: 'mentor-hours',
    label: 'Mentor Hours',
    icon: 'clock-outline',
    featureKey: 'mentor_hours',
    accountTypes: ['startup', 'mentor'],
  },
];

export const eventItems: MenuItem[] = [
  {
    key: 'all-events',
    label: 'Events',
    icon: 'calendar-month-outline',
    featureKey: 'events',
  },
];

export const startupBoosterKitItems: MenuItem[] = [
  {
    key: 'startup-booster-kit',
    label: 'Startup Booster Kit',
    icon: 'currency-usd',
    featureKey: 'startup_kit',
    accountTypes: ['startup'],
  },
];

export const resourceItems: MenuItem[] = [
  {key: 'resource-library', label: 'Resources', icon: 'book-open-page-variant-outline'},
  {key: 'guides', label: 'Guides', icon: 'file-document-multiple-outline'},
];

export const ticketItems: MenuItem[] = [
  // Tickets is universally available — every tenant has a support flow.
  // Frontend has a `ticket_management` feature gate but the mobile build
  // always exposes the link so the menu doesn't silently hide on tenants
  // whose verify_tenant response omits the flag.
  {
    key: 'support-tickets',
    label: 'Tickets',
    icon: 'ticket-confirmation-outline',
  },
];

export const accountSettingItems: MenuItem[] = [
  {key: 'account-settings', label: 'Account Settings', icon: 'account-outline'},
];

export const editorTools: MenuItem[] = [
  {key: 'bold', label: 'Bold', icon: 'format-bold'},
  {key: 'italic', label: 'Italic', icon: 'format-italic'},
  {key: 'underline', label: 'Underline', icon: 'format-underline'},
  {key: 'link', label: 'Link', icon: 'link'},
];

// Predicate: returns true when this item should be visible to the current user
// given the tenant config and account type. Mirrors the frontend's combined
// `filterByFeatures` + `filterDiscover` checks (navMenus.ts:856-914).
export const isMenuItemVisible = (
  item: MenuItem,
  ctx: {
    features?: Record<string, any> | null;
    users?: Record<string, any> | null;
    accountType?: string | null;
  },
): boolean => {
  const at = (ctx.accountType || '').toLowerCase();
  if (item.accountTypes && !item.accountTypes.includes(at)) {
    return false;
  }
  if (item.excludeAccountTypes && item.excludeAccountTypes.includes(at)) {
    return false;
  }
  if (item.featureKey && !ctx.features?.[item.featureKey]) {
    return false;
  }
  if (item.userKey) {
    // Per-role tenant gate (drives the Connect submenu). Only enforce it when
    // the tenant settings actually shipped a non-empty `users` map. If that
    // config is missing entirely — which would otherwise filter out every
    // Connect role and hide the whole group from the drawer — fall back to
    // showing the role. When the map IS present we honor it as before, so a
    // tenant that explicitly disables a role still hides it.
    const usersMap = ctx.users;
    const hasUsersConfig = !!usersMap && Object.keys(usersMap).length > 0;
    if (hasUsersConfig && !usersMap[item.userKey]) {
      return false;
    }
  }
  return true;
};

// Convenience: filter a list and return only visible items.
export const filterMenuItems = (
  items: MenuItem[],
  ctx: {
    features?: Record<string, any> | null;
    users?: Record<string, any> | null;
    accountType?: string | null;
  },
): MenuItem[] => items.filter(item => isMenuItemVisible(item, ctx));
