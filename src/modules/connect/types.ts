// Types for the Connect directory — the public, paginated listings of other
// members (startups, investors, mentors, …) the user can browse and connect
// with. Backed by the `api/v1/public/search/{type}` endpoints, which return
// the same `{data: {items, meta}}` envelope the connections module uses.

// The role keys the Connect submenu exposes. These map 1:1 to the `{type}`
// path segment on the public-search endpoint (startups → /public/search/startups).
export type ConnectRoleKey =
  | 'startups'
  | 'investors'
  | 'corporates'
  | 'mentors'
  | 'service-providers'
  | 'partners'
  | 'program-office-team'
  | 'individuals';

// Each role's URL segment for the public-search + public-profile endpoints.
// A few differ from the menu key (kebab → snake/plural the backend expects).
export const ROLE_ENDPOINT_SEGMENT: Record<ConnectRoleKey, string> = {
  startups: 'startups',
  investors: 'investors',
  corporates: 'corporates',
  mentors: 'mentors',
  'service-providers': 'service-providers',
  partners: 'partners',
  'program-office-team': 'program-offices',
  individuals: 'individuals',
};

// A single directory entry. Field names vary a lot across roles and backend
// versions (companyName vs organizationName vs name; companyLogo vs avatar; …)
// so the raw payload is kept intact under `raw` and the renderer reads it
// through the resolvers in utils.ts. The handful of fields below are the ones
// we always normalize up-front because the list/saved logic depends on them.
export type DirectoryUser = {
  // Stable identity used for keys, wishlist, profile navigation. We prefer the
  // user UUID; fall back to the account-specific uuid or numeric id.
  uuid: string;
  // Numeric id when present — some write endpoints (wishlist) key on it.
  id?: string;
  accountType?: string;
  raw: Record<string, any>;
};

export type DirectorySort = {
  key: string;
  label: string;
  sortBy: string;
  orderBy: 'ASC' | 'DESC';
};

// Investors are split organization vs individual on the backend; the tab
// shows a small segmented toggle that drives the `investorType` query param.
export type InvestorType = 'organization' | 'individual';

// One selectable value inside a filter group (e.g. an industry, a stage).
export type FilterOption = {
  label: string;
  // The value sent to the search endpoint. Backends key filters on the slug /
  // uuid, so we keep whatever the options endpoint shipped.
  value: string;
};

// A group of filter options, e.g. "Industries", "Investment Stages". `key` is
// the query-param name the search endpoint expects for this group.
export type FilterGroup = {
  key: string;
  label: string;
  options: FilterOption[];
};

// The user's current filter picks: group key → set of selected option values.
export type FilterSelection = Record<string, string[]>;

export type PaginationMeta = {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  totalItems?: number;
};

export type DirectoryResponse = {
  items: DirectoryUser[];
  meta: PaginationMeta;
};
