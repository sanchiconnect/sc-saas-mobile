import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {Icon} from '../../../core/components/Icon';
import {colors} from '../../../core/theme/colors';
import {TenantContext} from '../../../core/tenant/TenantProvider';
import {chatService} from '../services/chat.service';
import {chatSocket} from '../services/chat.socket';
import type {Conversation, Message} from '../types';

type Props = {
  token: string;
  conversation: Conversation;
  currentUserUuid?: string;
  onBack: () => void;
};

const formatTime = (raw?: string): string => {
  if (!raw) return '';
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return '';
  return new Date(ms).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Resolve the counterparty's display name for header + initials fallback.
const resolveHeaderName = (
  conversation: Conversation,
  currentUserUuid?: string,
): string => {
  if (conversation.name) return conversation.name;
  const other =
    conversation.otherUser ||
    conversation.participants?.find(p => p.uuid !== currentUserUuid);
  return other?.name || 'Conversation';
};

const resolveHeaderAvatar = (
  conversation: Conversation,
  currentUserUuid?: string,
): string | null => {
  if (conversation.logo) return conversation.logo;
  if (conversation.avatar) return conversation.avatar;
  const other =
    conversation.otherUser ||
    conversation.participants?.find(p => p.uuid !== currentUserUuid);
  return other?.avatar || null;
};

// Decide if a message was sent by the current user. Backend either embeds the
// sender uuid directly on `senderUUID` or in a nested sender object.
const isOwnMessage = (m: Message, currentUserUuid?: string): boolean => {
  if (!currentUserUuid) return false;
  return (
    m.senderUUID === currentUserUuid || m.sender?.uuid === currentUserUuid
  );
};

export function ConversationDetailScreen({
  token,
  conversation,
  currentUserUuid,
  onBack,
}: Props) {
  const {theme, globalSetting} = useContext(TenantContext);
  const primaryColor = theme?.primary || colors.primary;
  const logoBaseUrl =
    globalSetting?.imgKitUrl || globalSetting?.assetsImgKitUrl || '';

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track messages we just sent locally so the socket echo doesn't dupe them.
  const sentMessageIdsRef = useRef<Set<string>>(new Set());

  const headerName = resolveHeaderName(conversation, currentUserUuid);
  const headerAvatar = resolveHeaderAvatar(conversation, currentUserUuid);
  const resolvedHeaderAvatar = headerAvatar
    ? headerAvatar.startsWith('http')
      ? headerAvatar
      : `${logoBaseUrl}${headerAvatar}`
    : null;

  const fetchPage = useCallback(
    async (page: number, mode: 'replace' | 'prepend') => {
      try {
        const res = await chatService.listMessages(token, conversation.uuid, {
          page,
        });
        // Backend returns newest-first; UI shows oldest-first top→bottom, so
        // reverse before appending.
        const items = (res?.data?.items || []).slice().reverse();
        const meta = res?.data?.meta || {
          currentPage: 1,
          totalPages: 1,
          itemsPerPage: 20,
        };
        setMessages(prev => {
          if (mode === 'replace') return items;
          // Prepend older messages, dedupe by uuid.
          const seen = new Set(prev.map(m => m.uuid));
          return [...items.filter(m => !seen.has(m.uuid)), ...prev];
        });
        setCurrentPage(meta.currentPage);
        setTotalPages(meta.totalPages);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Could not load messages.',
        );
      }
    },
    [conversation.uuid, token],
  );

  // Initial fetch + room join.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      await fetchPage(1, 'replace');
      if (!cancelled) setIsLoading(false);
    })();
    chatSocket.joinConversation(conversation.uuid).catch(() => {
      // Socket connect failures are silent — the REST messages still load
      // and the user can manually pull-to-refresh to see new content.
    });
    return () => {
      cancelled = true;
      chatSocket.leaveCurrentRoom();
    };
  }, [conversation.uuid, fetchPage]);

  // Live message-received listener. Re-binds whenever the socket reconnects
  // (joinConversation returns the active socket each time).
  useEffect(() => {
    let unsubReceived: (() => void) | undefined;
    let unsubDeleted: (() => void) | undefined;
    let cancelled = false;

    const setup = async () => {
      await chatSocket.joinConversation(conversation.uuid);
      if (cancelled) return;
      unsubReceived = chatSocket.onMessageReceived((payload: any) => {
        // Payload shape mirrors the REST message — extract the new message
        // and append, deduping locally-echoed sends.
        const newMessage: Message | undefined =
          payload?.message || payload?.data?.message || payload;
        if (!newMessage?.uuid) return;
        if (sentMessageIdsRef.current.has(newMessage.uuid)) {
          sentMessageIdsRef.current.delete(newMessage.uuid);
          return;
        }
        setMessages(prev =>
          prev.some(m => m.uuid === newMessage.uuid)
            ? prev
            : [...prev, newMessage],
        );
      });
      unsubDeleted = chatSocket.onMessageDeleted((payload: any) => {
        const deletedId =
          payload?.messageUUID ||
          payload?.message?.uuid ||
          payload?.data?.uuid ||
          payload?.uuid;
        if (!deletedId) return;
        setMessages(prev =>
          prev.map(m =>
            m.uuid === deletedId ? {...m, isDeleted: true} : m,
          ),
        );
      });
    };

    setup();
    return () => {
      cancelled = true;
      unsubReceived?.();
      unsubDeleted?.();
    };
  }, [conversation.uuid]);

  const handleLoadOlder = async () => {
    if (isLoadingMore || currentPage >= totalPages) return;
    setIsLoadingMore(true);
    await fetchPage(currentPage + 1, 'prepend');
    setIsLoadingMore(false);
  };

  const handleSend = async () => {
    const trimmed = draft.trim();
    if (!trimmed || isSending) return;
    setIsSending(true);
    setDraft('');
    try {
      const res = await chatService.sendTextMessage(
        token,
        conversation.uuid,
        trimmed,
      );
      const sent = res?.data;
      if (sent?.uuid) {
        sentMessageIdsRef.current.add(sent.uuid);
        setMessages(prev =>
          prev.some(m => m.uuid === sent.uuid) ? prev : [...prev, sent],
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send message.');
      // Restore draft so the user can retry.
      setDraft(trimmed);
    } finally {
      setIsSending(false);
    }
  };

  const renderMessage = ({item}: {item: Message}) => {
    const own = isOwnMessage(item, currentUserUuid);
    const time = formatTime(item.createdAt);
    const body = item.isDeleted ? 'Message deleted' : item.message || '';
    return (
      <View
        style={[
          styles.bubbleRow,
          own ? styles.bubbleRowOwn : styles.bubbleRowOther,
        ]}>
        <View
          style={[
            styles.bubble,
            own
              ? [styles.bubbleOwn, {backgroundColor: primaryColor}]
              : styles.bubbleOther,
          ]}>
          <Text
            style={[
              styles.bubbleText,
              own ? styles.bubbleTextOwn : styles.bubbleTextOther,
              item.isDeleted && styles.bubbleTextDeleted,
            ]}>
            {body}
          </Text>
          <Text
            style={[
              styles.bubbleTime,
              own ? styles.bubbleTimeOwn : styles.bubbleTimeOther,
            ]}>
            {time}
          </Text>
        </View>
      </View>
    );
  };

  const initials = useMemo(
    () =>
      headerName
        .split(' ')
        .map(n => n[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase(),
    [headerName],
  );

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back">
          <Icon name="arrow-left" size={22} color="#0f172a" />
        </Pressable>
        <View style={styles.headerAvatarWrap}>
          {resolvedHeaderAvatar ? (
            <Image
              source={{uri: resolvedHeaderAvatar}}
              style={styles.headerAvatar}
            />
          ) : (
            <View
              style={[
                styles.headerAvatarFallback,
                {backgroundColor: `${primaryColor}1f`},
              ]}>
              <Text
                style={[styles.headerAvatarInitials, {color: primaryColor}]}>
                {initials || '?'}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.headerName} numberOfLines={1}>
          {headerName}
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={m => m.uuid}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesContent}
          onEndReachedThreshold={0.2}
          ListHeaderComponent={
            isLoadingMore ? (
              <View style={styles.headerLoading}>
                <ActivityIndicator color={primaryColor} />
              </View>
            ) : currentPage < totalPages ? (
              <Pressable onPress={handleLoadOlder} style={styles.loadOlderBtn}>
                <Text style={[styles.loadOlderText, {color: primaryColor}]}>
                  Load older messages
                </Text>
              </Pressable>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Icon
                name="message-text-outline"
                size={42}
                color="#cbd5e1"
              />
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptyBody}>Say hi to start the thread.</Text>
            </View>
          }
        />
      )}

      {error ? (
        <View style={styles.errorBanner}>
          <Icon name="alert-circle-outline" size={16} color="#dc2626" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => setError(null)} hitSlop={6}>
            <Icon name="close" size={16} color="#991b1b" />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.composer}>
        <TextInput
          style={styles.composerInput}
          value={draft}
          onChangeText={setDraft}
          placeholder="Type a message"
          placeholderTextColor="#94a3b8"
          multiline
          editable={!isSending}
        />
        <Pressable
          onPress={handleSend}
          disabled={!draft.trim() || isSending}
          style={[
            styles.sendButton,
            {backgroundColor: primaryColor},
            (!draft.trim() || isSending) && styles.sendButtonDisabled,
          ]}>
          {isSending ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Icon name="send" size={18} color="#ffffff" />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#f1f5f9',
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  headerAvatarWrap: {
    height: 36,
    width: 36,
  },
  headerAvatar: {
    borderRadius: 18,
    height: 36,
    width: 36,
  },
  headerAvatarFallback: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  headerAvatarInitials: {
    fontSize: 14,
    fontWeight: '700',
  },
  headerName: {
    color: '#0f172a',
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  messagesContent: {
    flexGrow: 1,
    padding: 12,
  },
  headerLoading: {
    paddingVertical: 12,
  },
  loadOlderBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  loadOlderText: {
    fontSize: 13,
    fontWeight: '700',
  },
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  bubbleRowOwn: {
    justifyContent: 'flex-end',
  },
  bubbleRowOther: {
    justifyContent: 'flex-start',
  },
  bubble: {
    borderRadius: 14,
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleOwn: {
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
    borderColor: '#e2e8f0',
    borderWidth: 1,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 19,
  },
  bubbleTextOwn: {
    color: '#ffffff',
  },
  bubbleTextOther: {
    color: '#0f172a',
  },
  bubbleTextDeleted: {
    fontStyle: 'italic',
    opacity: 0.6,
  },
  bubbleTime: {
    fontSize: 10,
    marginTop: 4,
  },
  bubbleTimeOwn: {
    color: '#e0e7ff',
    textAlign: 'right',
  },
  bubbleTimeOther: {
    color: '#94a3b8',
  },
  errorBanner: {
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  errorText: {
    color: '#991b1b',
    flex: 1,
    fontSize: 13,
  },
  composer: {
    alignItems: 'flex-end',
    backgroundColor: '#ffffff',
    borderTopColor: '#e2e8f0',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    padding: 10,
  },
  composerInput: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 10,
    borderWidth: 1,
    color: '#0f172a',
    flex: 1,
    fontSize: 15,
    maxHeight: 120,
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sendButton: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  emptyBody: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
});
