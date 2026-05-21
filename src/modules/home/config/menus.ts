import type {MenuItem} from '../types';

// `userKey` matches the frontend's `brandDetails.users.<key>` flag for each
// role. If the tenant has disabled investors, the Investors row is hidden, etc.
// `featureKey` (where present) matches a flag in `brandDetails.features.*`.
export const connectItems: MenuItem[] = [
  {
    key: 'startups',
    label: 'Startups',
    icon: 'rocket-launch',
    userKey: 'startups',
    excludeAccountTypes: ['startup'],
  },
  {
    key: 'investors',
    label: 'Investors',
    icon: 'cash-multiple',
    userKey: 'investors',
    excludeAccountTypes: ['investor'],
  },
  {
    key: 'corporates',
    label: 'Corporates',
    icon: 'office-building',
    userKey: 'corporates',
    excludeAccountTypes: ['corporate'],
  },
  {
    key: 'mentors',
    label: 'Mentors',
    icon: 'account-tie',
    userKey: 'mentors',
    excludeAccountTypes: ['mentor'],
  },
  {
    key: 'service-providers',
    label: 'Service Providers',
    icon: 'briefcase',
    userKey: 'service_providers',
    excludeAccountTypes: ['service_provider'],
  },
  {
    key: 'partners',
    label: 'Partners',
    icon: 'handshake',
    userKey: 'partners',
    excludeAccountTypes: ['partner'],
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
  {key: 'my-actions', label: 'My Actions', icon: 'tools'},
  {key: 'tasks', label: 'Tasks', icon: 'check-decagram-outline'},
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
  if (item.userKey && !ctx.users?.[item.userKey]) {
    return false;
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
