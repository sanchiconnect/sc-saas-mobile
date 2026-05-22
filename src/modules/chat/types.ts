// Conversation list item — shape from GET /api/v1/chat/conversation.
// Backend wraps the array in `data.items`, with `data.meta` for pagination.
export type ConversationParticipant = {
  uuid?: string;
  name?: string;
  avatar?: string | null;
  accountType?: string;
};

export type Conversation = {
  uuid: string;
  name?: string;
  // Latest message preview for the list row. Backend returns either a plain
  // string (legacy / some tenants) OR the full Message object — handle both.
  lastMessage?: string | Message;
  lastMessageType?: string;
  lastMessageAt?: string;
  // Server-side unread count for the current user.
  unreadCount?: number;
  // Avatar can live at the conversation level (group chats) or on the
  // "other" participant for 1:1 chats — surface either at the type level
  // and let the list resolver pick the right one.
  logo?: string | null;
  avatar?: string | null;
  participants?: ConversationParticipant[];
  // Backend uses `members` on the conversation-details endpoint; treat both
  // as aliases.
  members?: ConversationParticipant[];
  // 1:1 chats expose the counterparty; group chats won't.
  otherUser?: ConversationParticipant | null;
  // Tag used by the frontend to distinguish group vs DM. The web treats
  // 'user' as 1:1 and anything else as group.
  chatType?: 'private' | 'group' | string;
  conversationType?: string;
};

export type Message = {
  uuid: string;
  message?: string;
  messageType?: 'text' | 'image' | 'file' | string;
  fileUrl?: string;
  // Backend shape for sender info. The frontend uses `user` (uuid/name/avatar)
  // — keep `sender`/`senderUUID` aliases for resilience against older payloads
  // and our own optimistic-send entries.
  user?: ConversationParticipant;
  senderUUID?: string;
  sender?: ConversationParticipant;
  createdAt?: string;
  isRead?: boolean;
  isDeleted?: boolean;
  // Server-counted child replies. Drives the "Reply (N)" indicator under each
  // bubble and bumps optimistically after the user posts in the thread sheet.
  replyCount?: number;
};

export type PaginationMeta = {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  totalItems?: number;
};

export type PaginatedResponse<T> = {
  data: {
    items: T[];
    meta: PaginationMeta;
  };
};

// Socket event names — exact strings the backend emits.
export const SOCKET_EVENTS = {
  MESSAGE_RECEIVED: 'message_received',
  REPLY_MESSAGE_RECEIVED: 'reply_message_received',
  MESSAGE_DELETED: 'message_deleted',
} as const;
