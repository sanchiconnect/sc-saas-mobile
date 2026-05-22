// Shapes mirror the frontend's connections-v4 module. Active connections come
// from GET /connections (paginated), pending/rejected/sent come from
// GET /connections/requests/{type}. The user record is nested inside the
// connection row; field names vary slightly across endpoints.

export type ConnectionRequestType = 'received' | 'sent' | 'rejected';

export type ConnectionUser = {
  uuid?: string;
  name?: string;
  fullName?: string;
  displayName?: string;
  avatar?: string | null;
  companyLogo?: string | null;
  accountType?: string;
  designation?: string;
};

// Per-org grouping returned on the connection root. Each `people` entry
// represents a side of the connection (yours vs theirs); the team-members
// inside list the actual contact people.
export type ConnectionTeamMember = {
  uuid?: string;
  name?: string;
  designation?: string;
  onlineStatus?: boolean;
};

export type ConnectionPeopleGroup = {
  orgUUID?: string;
  teamMembers?: ConnectionTeamMember[];
};

export type Connection = {
  connectionUUID: string;

  // Counterparty identity lives at the ROOT of the connection on the
  // /connections endpoint (web's connection-v4). The nested `user`/`otherUser`
  // shape is only used by /connections/requests/*, so we surface both here.
  companyName?: string;
  name?: string;
  fullName?: string;
  avatar?: string | null;
  companyLogo?: string | null;
  accountType?: string;
  designation?: string;
  // UUIDs needed for opening chat / navigating to the profile.
  userUUID?: string;
  companyUUID?: string;
  groupChatUUID?: string;

  // people[] is keyed by org, with the other org's team members exposed as
  // otherPeople once we know which org belongs to the current user.
  people?: ConnectionPeopleGroup[];
  otherPeople?: ConnectionPeopleGroup;

  // Embedded counterparty record — present on request-list endpoints
  // (pending/rejected). Mobile maps these onto the root-style fields above
  // through resolveCounterparty so the renderer can stay shape-agnostic.
  user?: ConnectionUser;
  otherUser?: ConnectionUser;
  connectedUser?: ConnectionUser;

  userAccountType?: string;
  connectionStatus?: 'pending' | 'accepted' | 'rejected' | string;
  message?: string;
  actionMessage?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  createdAt?: string;
};

export type ConnectionCounts = {
  myConnection?: number;
  sent?: number;
  received?: number;
  rejected?: number;
};

export type ConnectionCountsResponse = {
  data: ConnectionCounts;
};

export type PaginationMeta = {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  totalItems?: number;
};

export type PaginatedConnections = {
  data: {
    items: Connection[];
    meta: PaginationMeta;
  };
};
