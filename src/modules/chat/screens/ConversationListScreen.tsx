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
  onOpenConversation: (conversation: Conversation) => void;
};

const PAGE_SIZE = 20;

// Conversation rows have two flavours — a 1:1 chat shows the counterparty's
// name + avatar, a group shows the conversation name + group logo. Surface
// the right one based on the conversationType/chatType signal.
const resolveDisplayName = (
  conversation: Conversation,
  currentUserUuid?: string,
): string => {
  if (conversation.name) return conversation.name;
  const other =
    conversation.otherUser ||
    conversation.participants?.find(p => p.uuid !== currentUserUuid);
  return other?.name || 'Conversation';
};

const resolveAvatar = (
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
          resolveDisplayName(c, currentUserUuid) +
          ' ' +
          lastMessagePreview(c.lastMessage).text
        ).toLowerCase();
        return haystack.includes(query.trim().toLowerCase());
      })
    : conversations;

  const renderItem = ({item}: {item: Conversation}) => {
    const name = resolveDisplayName(item, currentUserUuid);
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
          {avatar ? (
            <Image source={{uri: avatar}} style={styles.avatar} />
          ) : (
            <View
              style={[
                styles.avatarFallback,
                {backgroundColor: `${primaryColor}1f`},
              ]}>
              <Text style={[styles.avatarInitials, {color: primaryColor}]}>
                {initials || '?'}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.rowBody}>
          <View style={styles.rowTopLine}>
            <Text style={styles.rowName} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.rowTime}>{formatRelative(timeRaw)}</Text>
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
        keyExtractor={item => item.uuid}
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
            <Icon
              name="message-text-outline"
              size={42}
              color="#cbd5e1"
            />
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptyBody}>
              Connections you message will show up here.
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
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    color: '#0f172a',
    flex: 1,
    fontSize: 15,
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
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  avatarWrap: {
    height: 48,
    width: 48,
  },
  avatar: {
    borderRadius: 24,
    height: 48,
    width: 48,
  },
  avatarFallback: {
    alignItems: 'center',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  avatarInitials: {
    fontSize: 16,
    fontWeight: '700',
  },
  rowBody: {
    flex: 1,
    gap: 4,
  },
  rowTopLine: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  rowName: {
    color: '#0f172a',
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  rowTime: {
    color: '#94a3b8',
    fontSize: 12,
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
  },
  rowPreviewUnread: {
    color: '#0f172a',
    fontWeight: '700',
  },
  unreadBadge: {
    alignItems: 'center',
    borderRadius: 10,
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  unreadText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  separator: {
    backgroundColor: '#f1f5f9',
    height: 1,
    marginLeft: 76,
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
