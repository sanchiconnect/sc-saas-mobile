import {
  getAuthHeader,
  requestJson,
  resolveBaseUrl,
} from '../../../core/api/apiClient';
import type {
  Conversation,
  Message,
  PaginatedResponse,
} from '../types';

const CHAT_BASE = 'api/v1/chat/conversation';

export const chatService = {
  async listConversations(
    token: string,
    {page = 1, limit = 20}: {page?: number; limit?: number} = {},
  ): Promise<PaginatedResponse<Conversation>> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<PaginatedResponse<Conversation>>(
      `${CHAT_BASE}?page=${page}&limit=${limit}`,
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    );
  },

  async listMessages(
    token: string,
    conversationId: string,
    {page = 1}: {page?: number} = {},
  ): Promise<PaginatedResponse<Message>> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<PaginatedResponse<Message>>(
      `${CHAT_BASE}/${conversationId}/messages?page=${page}`,
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    );
  },

  async sendTextMessage(
    token: string,
    conversationId: string,
    message: string,
  ): Promise<{data: Message}> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<{data: Message}>(
      `${CHAT_BASE}/${conversationId}/messages`,
      {
        method: 'POST',
        headers: getAuthHeader(token),
        body: JSON.stringify({message, messageType: 'text'}),
      },
      baseUrl,
    );
  },

  async markMessageRead(
    token: string,
    conversationId: string,
    messageId: string,
  ): Promise<unknown> {
    const baseUrl = await resolveBaseUrl();
    return requestJson(
      `${CHAT_BASE}/${conversationId}/messages/${messageId}/mark-read`,
      {
        method: 'PATCH',
        headers: getAuthHeader(token),
        body: JSON.stringify({}),
      },
      baseUrl,
    );
  },
};
