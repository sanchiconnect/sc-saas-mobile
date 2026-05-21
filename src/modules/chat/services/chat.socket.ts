import {io, Socket} from 'socket.io-client';

import {resolveBaseUrl} from '../../../core/api/apiClient';
import {SOCKET_EVENTS} from '../types';

// The tenant's REST baseUrl includes an `/api/v1/...` path on some installs
// — socket.io needs the origin only, so trim everything after the host.
const toSocketOrigin = (baseUrl: string): string => {
  try {
    const url = new URL(baseUrl);
    return `${url.protocol}//${url.host}`;
  } catch {
    // Fallback: best-effort strip after the third "/".
    return baseUrl.replace(/^(https?:\/\/[^/]+).*$/, '$1');
  }
};

class ChatSocketManager {
  private socket: Socket | null = null;
  private currentRoom: string | null = null;
  private connectPromise: Promise<Socket> | null = null;

  // Lazy-connect: first caller drives the connection, subsequent callers
  // await the in-flight promise so we never open two sockets.
  async connect(): Promise<Socket> {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }
    if (this.connectPromise) {
      return this.connectPromise;
    }
    this.connectPromise = (async () => {
      const baseUrl = await resolveBaseUrl();
      const origin = toSocketOrigin(baseUrl);
      this.socket = io(origin, {
        transports: ['websocket'],
        // Auto-reconnect; mirror frontend's permissive defaults.
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });
      this.connectPromise = null;
      return this.socket;
    })();
    return this.connectPromise;
  }

  // Subscribe to a single conversation. Leaves the previous one first so
  // we don't pile up listeners when the user switches threads.
  async joinConversation(conversationUuid: string): Promise<Socket> {
    const socket = await this.connect();
    if (this.currentRoom && this.currentRoom !== `conversation_${conversationUuid}`) {
      socket.emit('leaveRoom', this.currentRoom);
    }
    const room = `conversation_${conversationUuid}`;
    socket.emit('joinRoom', room);
    this.currentRoom = room;
    return socket;
  }

  leaveCurrentRoom(): void {
    if (this.socket && this.currentRoom) {
      this.socket.emit('leaveRoom', this.currentRoom);
      this.currentRoom = null;
    }
  }

  // Caller passes the conversation uuid so the handler can dedupe in case
  // it ever runs after a room switch (defensive — the room emit pattern
  // already scopes events).
  onMessageReceived(handler: (payload: any) => void): () => void {
    const socket = this.socket;
    if (!socket) return () => {};
    socket.on(SOCKET_EVENTS.MESSAGE_RECEIVED, handler);
    return () => socket.off(SOCKET_EVENTS.MESSAGE_RECEIVED, handler);
  }

  onMessageDeleted(handler: (payload: any) => void): () => void {
    const socket = this.socket;
    if (!socket) return () => {};
    socket.on(SOCKET_EVENTS.MESSAGE_DELETED, handler);
    return () => socket.off(SOCKET_EVENTS.MESSAGE_DELETED, handler);
  }

  // Tear down on logout / app background so we don't leak the connection.
  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.currentRoom = null;
    }
  }
}

// Singleton — every screen that opens chat shares one socket.
export const chatSocket = new ChatSocketManager();
