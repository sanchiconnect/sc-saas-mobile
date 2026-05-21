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
  // 1:1 chats expose the counterparty; group chats won't.
  otherUser?: ConversationParticipant | null;
  // Tag used by the frontend to distinguish group vs DM.
  chatType?: 'private' | 'group' | string;
  conversationType?: string;
};

export type Message = {
  uuid: string;
  message?: string;
  messageType?: 'text' | 'image' | 'file' | string;
  fileUrl?: string;
  // Backend either embeds `senderUUID` directly or a nested user object.
  senderUUID?: string;
  sender?: ConversationParticipant;
  createdAt?: string;
  isRead?: boolean;
  isDeleted?: boolean;
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
