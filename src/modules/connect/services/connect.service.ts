import {
  getAuthHeader,
  requestJson,
  resolveBaseUrl,
} from '../../../core/api/apiClient';
import {resolveNumericId, resolveProfileUuid, resolveUserUuid} from '../utils';
import {
  ConnectionState,
  ConnectRoleKey,
  DirectoryResponse,
  DirectoryUser,
  FilterGroup,
  FilterSelection,
  InvestorType,
  PaginationMeta,
  ROLE_API_FRAGMENT,
  ROLE_ENDPOINT_SEGMENT,
} from '../types';

// ---------------------------------------------------------------------------
// Endpoint map (all confirmed from the web app's network tab)
//
// Listing / filters:
//   GET  api/v1/public/search/{type}?pageNumber&sortBy&orderBy&partnerId&…
//   GET  api/v1/public/global/custom/{comma,separated,keys}
//
// Profile detail (keyed on the ACCOUNT/profile uuid):
//   GET  api/v1/{plural}/public/{singular}-information/{profileUuid}
//   GET  api/v1/forms-management/profile/data/{singular}/{profileUuid}
//   GET  api/v1/{plural}/increment_views/{profileUuid}
//
// Connections (keyed on the USER uuid):
//   POST api/v1/connections/check/request/{userUuid}   (relationship status)
//   POST api/v1/connections/send/request   {toUserUUID, message}
//
// Saved profiles:
//   GET  api/v1/wishlist/{ownerId}/{singular}
//   POST/DELETE wishlist mutations — see notes on those methods.
// ---------------------------------------------------------------------------

const PUBLIC_SEARCH = 'api/v1/public/search';
const GLOBAL_CUSTOM = 'api/v1/public/global/custom';
const FORMS_DATA = 'api/v1/forms-management/profile/data';
const WISHLIST = 'api/v1/wishlist';
const CONNECTIONS = 'api/v1/connections';

// Filter groups we request from the global-custom endpoint. The key here is
// BOTH the path segment we ask for AND the query-param name we send back on
// search (the backend uses matching slugs). Labels are display-only.
const FILTER_KEYS: Array<{key: string; label: string}> = [
  {key: 'industries', label: 'Industries'},
  {key: 'investment_stages', label: 'Investment Stages'},
  {key: 'investment_mechanisms', label: 'Investment Mechanisms'},
  {key: 'investment_preferences', label: 'Investment Preferences'},
];

const normalizeMeta = (raw: any, fallbackCount: number): PaginationMeta => ({
  currentPage: Number(raw?.currentPage) || 1,
  totalPages: Number(raw?.totalPages) || 1,
  itemsPerPage: Number(raw?.itemsPerPage) || fallbackCount || 20,
  totalItems:
    raw?.totalItems != null ? Number(raw.totalItems) : undefined,
});

// The search envelope isn't perfectly consistent across roles, so pull the
// items array from the first shape that matches.
const extractItems = (data: any): any[] => {
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data?.items)) return data.data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
};

const toDirectoryUser = (raw: Record<string, any>): DirectoryUser => ({
  uuid: resolveUserUuid(raw),
  profileUuid: resolveProfileUuid(raw),
  id: resolveNumericId(raw) || undefined,
  accountType: raw?.accountType || raw?.account_type,
  raw,
});

export const connectService = {
  // Paginated public listing for a role. `searchName` and the chosen filter
  // selection are folded into the query string. `partnerId` is sent as the
  // literal "null" to match the confirmed web call (no partner context on the
  // mobile build).
  async searchUsers(
    token: string,
    role: ConnectRoleKey,
    {
      page = 1,
      searchName = '',
      sortBy = 'priority',
      orderBy = 'ASC',
      investorType,
      filters,
    }: {
      page?: number;
      searchName?: string;
      sortBy?: string;
      orderBy?: 'ASC' | 'DESC';
      investorType?: InvestorType;
      filters?: FilterSelection;
    } = {},
  ): Promise<DirectoryResponse> {
    const baseUrl = await resolveBaseUrl();
    const segment = ROLE_ENDPOINT_SEGMENT[role];
    const params = new URLSearchParams();
    params.set('pageNumber', String(page));
    params.set('sortBy', sortBy);
    params.set('orderBy', orderBy);
    params.set('partnerId', 'null');
    if (searchName.trim()) params.set('searchName', searchName.trim());
    if (role === 'investors' && investorType) {
      params.set('investorType', investorType);
    }
    // Each selected filter group becomes a comma-joined query param keyed by
    // the group slug (e.g. industries=fintech,healthtech).
    if (filters) {
      for (const [key, values] of Object.entries(filters)) {
        if (values && values.length) params.set(key, values.join(','));
      }
    }

    const res = await requestJson<any>(
      `${PUBLIC_SEARCH}/${segment}?${params.toString()}`,
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    );
    const payload = res?.data ?? res;
    const items = extractItems(payload).map(toDirectoryUser);
    return {items, meta: normalizeMeta(payload?.meta, items.length)};
  },

  // Filter option groups for the filter sheet. The global-custom endpoint
  // returns an object keyed by each requested slug, each an array of option
  // objects ({name,value} / {label,uuid} / …) we normalize.
  async getFilterGroups(token: string): Promise<FilterGroup[]> {
    const baseUrl = await resolveBaseUrl();
    const keys = FILTER_KEYS.map(f => f.key).join(',');
    const res = await requestJson<any>(
      `${GLOBAL_CUSTOM}/${keys}`,
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    );
    const data = res?.data ?? res ?? {};
    return FILTER_KEYS.map(({key, label}) => {
      const rawList = Array.isArray(data?.[key]) ? data[key] : [];
      const options = rawList
        .map((opt: any) => {
          const optLabel =
            opt?.name || opt?.label || opt?.title || String(opt ?? '');
          const value =
            opt?.value || opt?.slug || opt?.uuid || opt?.id || optLabel;
          return {label: String(optLabel), value: String(value)};
        })
        .filter((o: {label: string}) => o.label);
      return {key, label, options};
    }).filter(group => group.options.length > 0);
  },

  // The user's saved profiles for a given role. Path:
  //   GET api/v1/wishlist/{ownerId}/{singular}     (e.g. /wishlist/12/startup)
  // `ownerId` is the signed-in user's numeric id. Returns the set of saved
  // USER uuids so the directory can mark cards as saved.
  async getWishlist(
    token: string,
    ownerId: string,
    role: ConnectRoleKey,
  ): Promise<{savedUuids: Set<string>; items: DirectoryUser[]}> {
    const baseUrl = await resolveBaseUrl();
    const {singular} = ROLE_API_FRAGMENT[role];
    const res = await requestJson<any>(
      `${WISHLIST}/${ownerId}/${singular}`,
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    );
    const data = res?.data ?? res;
    const list = extractItems(data);
    const items = list.map((entry: any) =>
      // A wishlist row may wrap the saved profile under `user`/`profile`, or be
      // the profile itself. Unwrap so cards render the same as in search.
      toDirectoryUser(
        entry?.user || entry?.profile || entry?.wishlistUser || entry,
      ),
    );
    const savedUuids = new Set(items.map(i => i.uuid).filter(Boolean));
    return {savedUuids, items};
  },

  // Save a member. The wishlist is keyed on the user uuid + account type
  // (matching the per-type GET); exact mutation body is best-effort.
  async addToWishlist(token: string, target: DirectoryUser): Promise<unknown> {
    const baseUrl = await resolveBaseUrl();
    return requestJson(
      WISHLIST,
      {
        method: 'POST',
        headers: getAuthHeader(token),
        body: JSON.stringify({
          userUUID: target.uuid,
          accountType: target.accountType,
        }),
      },
      baseUrl,
    );
  },

  async removeFromWishlist(
    token: string,
    target: DirectoryUser,
    role: ConnectRoleKey,
  ): Promise<unknown> {
    const baseUrl = await resolveBaseUrl();
    const {singular} = ROLE_API_FRAGMENT[role];
    return requestJson(
      `${WISHLIST}/${target.uuid}/${singular}`,
      {method: 'DELETE', headers: getAuthHeader(token)},
      baseUrl,
    );
  },

  // Full public profile for the detail screen. Two endpoints, both keyed on the
  // ACCOUNT/profile uuid (NOT the user uuid), merged into one object:
  //   1. {plural}/public/{singular}-information/{profileUuid}  — core profile
  //   2. forms-management/profile/data/{singular}/{profileUuid} — form answers
  // Each is best-effort; the screen still renders from the search row if both
  // fail.
  async getPublicProfile(
    token: string,
    role: ConnectRoleKey,
    profileUuid: string,
  ): Promise<Record<string, any>> {
    const baseUrl = await resolveBaseUrl();
    const {plural, singular} = ROLE_API_FRAGMENT[role];
    const [info, forms] = await Promise.all([
      requestJson<any>(
        `api/v1/${plural}/public/${singular}-information/${profileUuid}`,
        {method: 'GET', headers: getAuthHeader(token)},
        baseUrl,
      ).catch(() => null),
      requestJson<any>(
        `${FORMS_DATA}/${singular}/${profileUuid}`,
        {method: 'GET', headers: getAuthHeader(token)},
        baseUrl,
      ).catch(() => null),
    ]);
    const infoData = info?.data ?? info ?? {};
    const formsData = forms?.data ?? forms ?? {};
    // Core profile fields win over form-answer fields on key collisions.
    return {...formsData, ...infoData};
  },

  // Fire-and-forget profile-view increment. Keyed on the account/profile uuid.
  async incrementViews(
    token: string,
    role: ConnectRoleKey,
    profileUuid: string,
  ): Promise<void> {
    const baseUrl = await resolveBaseUrl();
    const {plural} = ROLE_API_FRAGMENT[role];
    await requestJson(
      `api/v1/${plural}/increment_views/${profileUuid}`,
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    ).catch(() => undefined);
  },

  // Relationship status with a member, keyed on the USER uuid. Drives the
  // Connect button (Connect / Request Sent / Connected).
  //   POST api/v1/connections/check/request/{userUuid}
  async checkConnectionState(
    token: string,
    userUuid: string,
  ): Promise<ConnectionState> {
    const baseUrl = await resolveBaseUrl();
    const res = await requestJson<any>(
      `${CONNECTIONS}/check/request/${userUuid}`,
      {
        method: 'POST',
        headers: getAuthHeader(token),
        body: JSON.stringify(userUuid),
      },
      baseUrl,
    );
    const d = res?.data ?? res ?? {};
    const status = String(
      d?.connectionStatus || d?.status || d?.requestStatus || '',
    ).toLowerCase();
    if (
      d?.isConnected === true ||
      d?.connected === true ||
      status === 'accepted' ||
      status === 'connected'
    ) {
      return 'connected';
    }
    if (
      d?.requestExist === true ||
      d?.requestSent === true ||
      d?.alreadyRequested === true ||
      d?.isPending === true ||
      status === 'pending' ||
      status === 'sent' ||
      status === 'received'
    ) {
      return 'pending';
    }
    return 'none';
  },

  // Send a connection request. Confirmed:
  //   POST api/v1/connections/send/request   {toUserUUID, message}
  async sendConnectRequest(
    token: string,
    target: DirectoryUser,
    message: string,
  ): Promise<unknown> {
    const baseUrl = await resolveBaseUrl();
    return requestJson(
      `${CONNECTIONS}/send/request`,
      {
        method: 'POST',
        headers: getAuthHeader(token),
        body: JSON.stringify({
          toUserUUID: target.uuid,
          message: message?.trim() || '',
        }),
      },
      baseUrl,
    );
  },
};
