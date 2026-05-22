import React, {useCallback, useContext, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {Icon} from '../../../core/components/Icon';
import {colors} from '../../../core/theme/colors';
import {TenantContext} from '../../../core/tenant/TenantProvider';
import {chatService} from '../services/chat.service';
import type {Conversation, Message} from '../types';
import {stripHtml} from '../utils';

type Props = {
  token: string;
  currentUserUuid?: string;
  // Used to strip our own name out of "Counterparty/Me" joined names that
  // some tenants return for 1:1 chats.
  currentUserName?: string;
  onOpenConversation: (conversation: Conversation) => void;
};

const PAGE_SIZE = 20;

// Conversation rows have two flavours — a 1:1 chat shows the counterparty's
// name + avatar, a group shows the conversation name + group logo. Mirrors
// the web's getConversationTitle/getAvatarImage: prefer the other member
// when the type signals a 1:1, OR when there are exactly two members (some
// tenants don't set conversationType and store the join as "A/B" in name).
const isDirectChat = (conversation: Conversation): boolean => {
  if (conversation.conversationType === 'user') return true;
  if (conversation.chatType === 'private') return true;
  const pool =
    conversation.members && conversation.members.length > 0
      ? conversation.members
      : conversation.participants;
  if (pool && pool.length === 2) return true;
  return false;
};

const findOtherMember = (
  conversation: Conversation,
  currentUserUuid?: string,
) => {
  if (conversation.otherUser) return conversation.otherUser;
  const pool =
    conversation.members && conversation.members.length > 0
      ? conversation.members
      : conversation.participants;
  return pool?.find(p => p.uuid !== currentUserUuid);
};

// Some tenants store 1:1 chat names as "Counterparty/CurrentUser" — slash-
// joined. When we can't find an explicit member, fall back to stripping our
// own name out of the joined string so the row still shows just the other
// person.
const stripOwnFromJoinedName = (
  joined: string,
  currentUserName?: string,
): string => {
  if (!joined.includes('/')) return joined;
  const parts = joined.split('/').map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) return joined;
  if (currentUserName) {
    const lower = currentUserName.toLowerCase();
    const counter = parts.find(p => p.toLowerCase() !== lower);
    if (counter) return counter;
  }
  return parts[0];
};

const resolveDisplayName = (
  conversation: Conversation,
  currentUserUuid?: string,
  currentUserName?: string,
): string => {
  if (isDirectChat(conversation)) {
    const other = findOtherMember(conversation, currentUserUuid);
    if (other?.name) return other.name;
    if (conversation.name) {
      return stripOwnFromJoinedName(conversation.name, currentUserName);
    }
  }
  return conversation.name || 'Conversation';
};

const resolveAvatar = (
  conversation: Conversation,
  currentUserUuid?: string,
): string | null => {
  if (isDirectChat(conversation)) {
    const other = findOtherMember(conversation, currentUserUuid);
    if (other?.avatar) return other.avatar;
  }
  return conversation.logo || conversation.avatar || null;
};

// Backend returns `lastMessage` as either a plain string (legacy shape) or
// the full Message entity (current shape: `{uuid, message, messageType, ...}`).
// Pull the user-facing preview out without ever rendering an object.
const lastMessagePreview = (
  raw: Conversation['lastMessage'],
): {text: string; createdAt?: string} => {
  if (!raw) return {text: ''};
  if (typeof raw === 'string') return {text: stripHtml(raw)};
  const m = raw as Message;
  if (m.isDeleted) return {text: 'Message deleted', createdAt: m.createdAt};
  if (m.messageType && m.messageType !== 'text') {
    const label =
      m.messageType === 'image'
        ? '📷 Photo'
        : m.messageType === 'file'
          ? '📎 Attachment'
          : 'New message';
    return {text: stripHtml(m.message) || label, createdAt: m.createdAt};
  }
  return {text: stripHtml(m.message), createdAt: m.createdAt};
};

const formatRelative = (raw?: string): string => {
  if (!raw) return '';
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return '';
  const diff = Date.now() - ms;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(ms).toLocaleDateString();
};

export function ConversationListScreen({
  token,
  currentUserUuid,
  currentUserName,
  onOpenConversation,
}: Props) {
  const {theme, globalSetting} = useContext(TenantContext);
  const primaryColor = theme?.primary || colors.primary;
  const logoBaseUrl =
    globalSetting?.imgKitUrl || globalSetting?.assetsImgKitUrl || '';

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const fetchPage = useCallback(
    async (page: number, mode: 'replace' | 'append' = 'replace') => {
      try {
        const res = await chatService.listConversations(token, {
          page,
          limit: PAGE_SIZE,
        });
        const items = res?.data?.items || [];
        const meta = res?.data?.meta || {
          currentPage: 1,
          totalPages: 1,
          itemsPerPage: PAGE_SIZE,
        };
        setConversations(prev => {
          if (mode === 'replace') return items;
          // Append with dedupe — backend can re-emit the same uuid if a new
          // message bumps the conversation between pages.
          const seen = new Set(prev.map(c => c.uuid));
          return [...prev, ...items.filter(c => !seen.has(c.uuid))];
        });
        setCurrentPage(meta.currentPage);
        setTotalPages(meta.totalPages);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Could not load conversations.',
        );
      }
    },
    [token],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      await fetchPage(1, 'replace');
      if (!cancelled) setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchPage(1, 'replace');
    setIsRefreshing(false);
  };

  const handleEndReached = async () => {
    if (isLoadingMore || currentPage >= totalPages) return;
    setIsLoadingMore(true);
    await fetchPage(currentPage + 1, 'append');
    setIsLoadingMore(false);
  };

  // Client-side search across the loaded pages. Matches frontend's behaviour
  // — the backend doesn't expose a search param on this endpoint yet.
  const visibleConversations = query.trim()
    ? conversations.filter(c => {
        const haystack = (
          resolveDisplayName(c, currentUserUuid, currentUserName) +
          ' ' +
          lastMessagePreview(c.lastMessage).text
        ).toLowerCase();
        return haystack.includes(query.trim().toLowerCase());
      })
    : conversations;

  const renderItem = ({item}: {item: Conversation}) => {
    const name = resolveDisplayName(item, currentUserUuid, currentUserName);
    const rawAvatar = resolveAvatar(item, currentUserUuid);
    const avatar = rawAvatar
      ? rawAvatar.startsWith('http')
        ? rawAvatar
        : `${logoBaseUrl}${rawAvatar}`
      : null;
    const initials = name
      .split(' ')
      .map(n => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
    const {text: previewText, createdAt: previewCreatedAt} = lastMessagePreview(
      item.lastMessage,
    );
    const preview = previewText || 'No messages yet';
    const timeRaw = item.lastMessageAt || previewCreatedAt;
    const unread = item.unreadCount || 0;
    return (
      <Pressable
        style={styles.row}
        onPress={() => onOpenConversation(item)}
        accessibilityRole="button"
        accessibilityLabel={`Open conversation with ${name}`}>
        <View style={styles.avatarWrap}>
          {/* Initials fallback always renders behind the Image so a broken
              avatar URL still surfaces something visible instead of an empty
              circle (e.g. the "ofileima" placeholder we see on web). */}
          <View
            style={[
              styles.avatarFallback,
              {backgroundColor: `${primaryColor}1f`},
            ]}>
            <Text style={[styles.avatarInitials, {color: primaryColor}]}>
              {initials || '?'}
            </Text>
          </View>
          {avatar ? (
            <Image
              source={{uri: avatar}}
              style={[styles.avatar, styles.avatarOverlay]}
            />
          ) : null}
        </View>
        <View style={styles.rowBody}>
          <View style={styles.rowTopLine}>
            <Text
              style={[styles.rowName, unread > 0 && styles.rowNameUnread]}
              numberOfLines={1}>
              {name}
            </Text>
            <Text
              style={[
                styles.rowTime,
                unread > 0 && [
                  styles.rowTimeUnread,
                  {color: primaryColor},
                ],
              ]}>
              {formatRelative(timeRaw)}
            </Text>
          </View>
          <View style={styles.rowBottomLine}>
            <Text
              style={[styles.rowPreview, unread > 0 && styles.rowPreviewUnread]}
              numberOfLines={1}>
              {preview}
            </Text>
            {unread > 0 ? (
              <View
                style={[styles.unreadBadge, {backgroundColor: primaryColor}]}>
                <Text style={styles.unreadText}>
                  {unread > 99 ? '99+' : unread}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={primaryColor} />
        <Text style={styles.loadingText}>Loading conversations…</Text>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.searchRow}>
        <Icon name="magnify" size={18} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search conversations"
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Icon name="alert-circle-outline" size={16} color="#dc2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={visibleConversations}
        keyExtractor={(item, index) => item.uuid || `idx-${index}`}
        renderItem={renderItem}
        contentContainerStyle={
          visibleConversations.length === 0 ? styles.emptyContent : undefined
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[primaryColor]}
            tintColor={primaryColor}
          />
        }
        onEndReachedThreshold={0.4}
        onEndReached={handleEndReached}
        ListFooterComponent={
          isLoadingMore ? (
            <View style={styles.footerLoading}>
              <ActivityIndicator color={primaryColor} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View
              style={[
                styles.emptyIconWrap,
                {backgroundColor: `${primaryColor}1a`},
              ]}>
              <Icon
                name="chat-outline"
                size={32}
                color={primaryColor}
              />
            </View>
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptyBody}>
              Start chatting with your connections from their profile to see
              the conversation here.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#64748b',
    fontSize: 14,
    marginTop: 10,
  },
  searchRow: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    color: '#0f172a',
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    padding: 0,
  },
  errorBanner: {
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorText: {
    color: '#991b1b',
    flex: 1,
    fontSize: 13,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  avatarWrap: {
    height: 42,
    width: 42,
  },
  avatar: {
    borderRadius: 21,
    height: 42,
    width: 42,
  },
  avatarOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  avatarFallback: {
    alignItems: 'center',
    borderRadius: 21,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  avatarInitials: {
    fontSize: 14,
    fontWeight: '800',
  },
  rowBody: {
    flex: 1,
    gap: 4,
    justifyContent: 'center',
  },
  rowTopLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  rowName: {
    color: '#0f172a',
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  rowNameUnread: {
    fontWeight: '800',
  },
  rowTime: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  rowTimeUnread: {
    fontWeight: '800',
  },
  rowBottomLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  rowPreview: {
    color: '#64748b',
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  rowPreviewUnread: {
    color: '#0f172a',
    fontWeight: '700',
  },
  unreadBadge: {
    alignItems: 'center',
    borderRadius: 11,
    height: 22,
    minWidth: 22,
    paddingHorizontal: 7,
  },
  unreadText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 22,
  },
  separator: {
    backgroundColor: '#f1f5f9',
    height: 1,
    marginLeft: 72,
  },
  footerLoading: {
    paddingVertical: 18,
  },
  emptyContent: {
    flexGrow: 1,
  },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyIconWrap: {
    alignItems: 'center',
    borderRadius: 32,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  emptyTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 16,
  },
  emptyBody: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    maxWidth: 280,
    textAlign: 'center',
  },
});
