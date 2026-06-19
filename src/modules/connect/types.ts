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

// Each role's URL segment for the public-search endpoint.
// A few differ from the menu key (kebab → snake/plural the backend expects).
export const ROLE_ENDPOINT_SEGMENT: Record<ConnectRoleKey, string> = {
  startups: 'startups',
  investors: 'investors',
  corporates: 'corporates',
  mentors: 'mentors',
  'service-providers': 'service-providers',
  partners: 'partners',
  'program-office-team': 'program-office-members',
  individuals: 'individuals',
};

// Plural + singular path fragments used by the role-specific detail endpoints:
//   GET api/v1/{plural}/public/{profileInfoPath}/{profileUuid}
//   GET api/v1/forms-management/profile/data/{singular}/{profileUuid}
//   GET api/v1/{plural}/increment_views/{profileUuid}
//   GET api/v1/wishlist/{ownerId}/{singular}
// `profileInfoPath` overrides the default `${singular}-information` segment when
// the backend uses a different path (e.g. investors use "profile").
export const ROLE_API_FRAGMENT: Record<
  ConnectRoleKey,
  {plural: string; singular: string; profileInfoPath?: string}
> = {
  startups: {plural: 'startups', singular: 'startup'},
  investors: {plural: 'investors', singular: 'investor', profileInfoPath: 'profile'},
  corporates: {plural: 'corporates', singular: 'corporate'},
  mentors: {plural: 'mentors', singular: 'mentor'},
  'service-providers': {
    plural: 'service_providers',
    singular: 'service_provider',
    profileInfoPath: 'service-provider-information',
  },
  partners: {plural: 'partners', singular: 'partner', profileInfoPath: 'partners-information'},
  'program-office-team': {
    plural: 'program_office_members',
    singular: 'program_office',
    profileInfoPath: 'program-office-member-information',
  },
  individuals: {plural: 'individuals', singular: 'individual'},
};

// The relationship between the signed-in user and a directory member, derived
// from POST connections/check/request/{userUuid}. Drives the Connect button.
export type ConnectionState =
  | 'none' // can send a request
  | 'pending' // a request is already outstanding (sent or received)
  | 'connected'; // already connected

// A single directory entry. Field names vary a lot across roles and backend
// versions (companyName vs organizationName vs name; companyLogo vs avatar; …)
// so the raw payload is kept intact under `raw` and the renderer reads it
// through the resolvers in utils.ts. The handful of fields below are the ones
// we always normalize up-front because the list/saved logic depends on them.
export type DirectoryUser = {
  // The USER uuid — the identity connect / wishlist / chat key on
  // (e.g. POST connections/send/request → toUserUUID). Prefer userUUID; fall
  // back to the account uuid only when no user uuid is present.
  uuid: string;
  // The account/profile uuid — what the role-specific detail endpoints key on
  // (startup-information, forms-management, increment_views). Distinct from the
  // user uuid: a startup row carries both.
  profileUuid: string;
  // Numeric id when present — some write endpoints key on it.
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
