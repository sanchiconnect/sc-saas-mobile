import {
  getAuthHeader,
  getErrorMessage,
  normalizeTokenValue,
  resolveBaseUrl,
  requestJson,
  safeJsonParse,
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

  // Reply thread — backend stores replies as a separate sub-collection of
  // the parent message. Same shape as the main messages endpoint
  // (data.items + data.meta), so the caller can paginate identically.
  async listReplies(
    token: string,
    conversationId: string,
    messageId: string,
  ): Promise<PaginatedResponse<Message>> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<PaginatedResponse<Message>>(
      `${CHAT_BASE}/${conversationId}/messages/${messageId}/reply`,
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    );
  },

  // Multipart upload — image, document, or any file the user picks. Backend
  // returns the freshly-created message in the response (`data` or `data.message`).
  async uploadAttachment(
    token: string,
    conversationId: string,
    file: {uri: string; name: string; type: string},
  ): Promise<{data?: Message; message?: Message} | unknown> {
    const baseUrl = await resolveBaseUrl();
    const normalizedToken = normalizeTokenValue(token);
    if (!normalizedToken) {
      throw new Error('Missing access token.');
    }
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);
    const response = await fetch(
      `${baseUrl}${CHAT_BASE}/${conversationId}/messages-file`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${normalizedToken}`,
        },
        body: formData as any,
      },
    );
    const raw = await response.text();
    const data = raw ? safeJsonParse(raw) : null;
    if (!response.ok) {
      throw new Error(
        getErrorMessage(data) ||
          `Attachment upload failed (${response.status}).`,
      );
    }
    return data;
  },

  async sendReply(
    token: string,
    conversationId: string,
    messageId: string,
    message: string,
  ): Promise<{data: Message}> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<{data: Message}>(
      `${CHAT_BASE}/${conversationId}/messages/${messageId}/reply`,
      {
        method: 'POST',
        headers: getAuthHeader(token),
        body: JSON.stringify({message, messageType: 'text'}),
      },
      baseUrl,
    );
  },
};
