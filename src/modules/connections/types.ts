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

export type Connection = {
  connectionUUID: string;
  // Embedded counterparty record — backend uses several field names
  // depending on the endpoint (`user`, `otherUser`, `connectedUser`).
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
  groupChatUUID?: string;
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
