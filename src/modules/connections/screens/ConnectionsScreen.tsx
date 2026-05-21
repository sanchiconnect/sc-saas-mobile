import React, {useCallback, useContext, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
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
import {connectionsService} from '../services/connections.service';
import type {Connection, ConnectionCounts} from '../types';

type Props = {
  token: string;
};

type TabKey = 'active' | 'pending' | 'rejected';

const TABS: Array<{key: TabKey; label: string}> = [
  {key: 'active', label: 'Active'},
  {key: 'pending', label: 'Pending'},
  {key: 'rejected', label: 'Rejected'},
];

const PAGE_SIZE = 20;

// Backend returns the counterparty under a few different keys depending on
// endpoint — resolve once at the row level.
const resolveCounterparty = (c: Connection) =>
  c.otherUser || c.connectedUser || c.user || {};

const resolveName = (c: Connection): string => {
  const u = resolveCounterparty(c);
  return u.name || u.fullName || u.displayName || 'Member';
};

const initials = (name: string): string =>
  name
    .split(' ')
    .map(n => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

const formatDate = (raw?: string): string => {
  if (!raw) return '';
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return '';
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
};

export function ConnectionsScreen({token}: Props) {
  const {theme, globalSetting} = useContext(TenantContext);
  const primaryColor = theme?.primary || colors.primary;
  const logoBaseUrl =
    globalSetting?.imgKitUrl || globalSetting?.assetsImgKitUrl || '';

  const [activeTab, setActiveTab] = useState<TabKey>('active');
  const [items, setItems] = useState<Connection[]>([]);
  const [counts, setCounts] = useState<ConnectionCounts>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Per-row inflight state — keeps the accept/reject/remove button from being
  // tapped twice and gives us per-row loading affordance without a global lock.
  const [pendingActionUUID, setPendingActionUUID] = useState<string | null>(
    null,
  );

  const fetchCounts = useCallback(async () => {
    try {
      const res = await connectionsService.getCounts(token);
      setCounts(res?.data || {});
    } catch {
      // Counts are a nice-to-have; don't disrupt the list flow on failure.
    }
  }, [token]);

  const fetchPage = useCallback(
    async (
      tab: TabKey,
      page: number,
      mode: 'replace' | 'append',
      searchValue: string,
    ) => {
      try {
        const res =
          tab === 'active'
            ? await connectionsService.listActive(token, {
                page,
                limit: PAGE_SIZE,
                searchName: searchValue,
              })
            : await connectionsService.listRequests(
                token,
                tab === 'pending' ? 'received' : 'rejected',
                {page, limit: PAGE_SIZE},
              );
        const next = res?.data?.items || [];
        const meta = res?.data?.meta || {
          currentPage: 1,
          totalPages: 1,
          itemsPerPage: PAGE_SIZE,
        };
        setItems(prev => {
          if (mode === 'replace') return next;
          const seen = new Set(prev.map(c => c.connectionUUID));
          return [...prev, ...next.filter(c => !seen.has(c.connectionUUID))];
        });
        setCurrentPage(meta.currentPage);
        setTotalPages(meta.totalPages);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Could not load connections.',
        );
      }
    },
    [token],
  );

  // Reset + fetch whenever the user switches tabs or runs a new search.
  // Server-side search is only wired for the Active list (frontend parity);
  // pending/rejected fall through to a client-side filter below.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setItems([]);
      await fetchPage(activeTab, 1, 'replace', search);
      if (!cancelled) setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, fetchPage, search]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      fetchPage(activeTab, 1, 'replace', search),
      fetchCounts(),
    ]);
    setIsRefreshing(false);
  };

  const handleEndReached = async () => {
    if (isLoadingMore || currentPage >= totalPages) return;
    setIsLoadingMore(true);
    await fetchPage(activeTab, currentPage + 1, 'append', search);
    setIsLoadingMore(false);
  };

  const handleAccept = (c: Connection) => {
    Alert.alert(
      'Accept connection',
      `Accept the request from ${resolveName(c)}?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Accept',
          onPress: async () => {
            setPendingActionUUID(c.connectionUUID);
            try {
              await connectionsService.accept(token, c.connectionUUID);
              // Move out of the pending tab and refresh counts so badges
              // update before the user navigates away.
              setItems(prev =>
                prev.filter(x => x.connectionUUID !== c.connectionUUID),
              );
              fetchCounts();
            } catch (err) {
              Alert.alert(
                'Accept failed',
                err instanceof Error ? err.message : 'Could not accept.',
              );
            } finally {
              setPendingActionUUID(null);
            }
          },
        },
      ],
    );
  };

  const handleReject = (c: Connection) => {
    Alert.alert(
      'Reject connection',
      `Reject the request from ${resolveName(c)}?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setPendingActionUUID(c.connectionUUID);
            try {
              await connectionsService.reject(token, c.connectionUUID);
              setItems(prev =>
                prev.filter(x => x.connectionUUID !== c.connectionUUID),
              );
              fetchCounts();
            } catch (err) {
              Alert.alert(
                'Reject failed',
                err instanceof Error ? err.message : 'Could not reject.',
              );
            } finally {
              setPendingActionUUID(null);
            }
          },
        },
      ],
    );
  };

  const handleRemove = (c: Connection) => {
    Alert.alert(
      'Remove connection',
      `Remove ${resolveName(c)} from your connections?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setPendingActionUUID(c.connectionUUID);
            try {
              await connectionsService.remove(token, c.connectionUUID);
              setItems(prev =>
                prev.filter(x => x.connectionUUID !== c.connectionUUID),
              );
              fetchCounts();
            } catch (err) {
              Alert.alert(
                'Remove failed',
                err instanceof Error ? err.message : 'Could not remove.',
              );
            } finally {
              setPendingActionUUID(null);
            }
          },
        },
      ],
    );
  };

  // Tabs other than active filter client-side, since the backend doesn't
  // expose a searchName on /requests/* yet.
  const visibleItems =
    activeTab === 'active'
      ? items
      : search.trim()
        ? items.filter(c =>
            resolveName(c)
              .toLowerCase()
              .includes(search.trim().toLowerCase()),
          )
        : items;

  const renderItem = ({item}: {item: Connection}) => {
    const name = resolveName(item);
    const u = resolveCounterparty(item);
    const rawAvatar = u.avatar || u.companyLogo;
    const avatar = rawAvatar
      ? rawAvatar.startsWith('http')
        ? rawAvatar
        : `${logoBaseUrl}${rawAvatar}`
      : null;
    const subtitle = [u.accountType, u.designation].filter(Boolean).join(' • ');
    const isRowBusy = pendingActionUUID === item.connectionUUID;

    return (
      <View style={styles.row}>
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
                {initials(name) || '?'}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowName} numberOfLines={1}>
            {name}
          </Text>
          {subtitle ? (
            <Text style={styles.rowSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
          {activeTab === 'pending' && item.message ? (
            <Text style={styles.rowMessage} numberOfLines={2}>
              "{item.message}"
            </Text>
          ) : null}
          {activeTab === 'rejected' && item.actionMessage ? (
            <Text style={styles.rowMessage} numberOfLines={2}>
              Reason: {item.actionMessage}
            </Text>
          ) : null}
          {activeTab === 'rejected' && item.rejectedAt ? (
            <Text style={styles.rowMeta}>
              Rejected {formatDate(item.rejectedAt)}
            </Text>
          ) : null}
          {activeTab === 'active' && item.acceptedAt ? (
            <Text style={styles.rowMeta}>
              Connected {formatDate(item.acceptedAt)}
            </Text>
          ) : null}
        </View>
        <View style={styles.rowActions}>
          {activeTab === 'pending' ? (
            <>
              <Pressable
                disabled={isRowBusy}
                onPress={() => handleAccept(item)}
                style={[
                  styles.actionButton,
                  {backgroundColor: primaryColor},
                  isRowBusy && styles.actionButtonBusy,
                ]}>
                {isRowBusy ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Icon name="check" size={16} color="#ffffff" />
                )}
              </Pressable>
              <Pressable
                disabled={isRowBusy}
                onPress={() => handleReject(item)}
                style={[
                  styles.actionButton,
                  styles.actionButtonOutline,
                  isRowBusy && styles.actionButtonBusy,
                ]}>
                <Icon name="close" size={16} color="#dc2626" />
              </Pressable>
            </>
          ) : activeTab === 'active' ? (
            <Pressable
              disabled={isRowBusy}
              onPress={() => handleRemove(item)}
              style={[
                styles.actionButton,
                styles.actionButtonOutline,
                isRowBusy && styles.actionButtonBusy,
              ]}>
              {isRowBusy ? (
                <ActivityIndicator color="#dc2626" size="small" />
              ) : (
                <Icon name="account-remove-outline" size={16} color="#dc2626" />
              )}
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  };

  const tabCount = (key: TabKey): number | undefined => {
    if (key === 'active') return counts.myConnection;
    if (key === 'pending') return counts.received;
    return undefined;
  };

  return (
    <View style={styles.page}>
      <View style={styles.tabsRow}>
        {TABS.map(tab => {
          const isActive = tab.key === activeTab;
          const count = tabCount(tab.key);
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[
                styles.tab,
                isActive && {borderBottomColor: primaryColor},
              ]}>
              <Text
                style={[
                  styles.tabText,
                  isActive && {color: primaryColor, fontWeight: '800'},
                ]}>
                {tab.label}
              </Text>
              {count != null && count > 0 ? (
                <View
                  style={[
                    styles.tabBadge,
                    isActive
                      ? {backgroundColor: primaryColor}
                      : styles.tabBadgeInactive,
                  ]}>
                  <Text
                    style={[
                      styles.tabBadgeText,
                      isActive
                        ? styles.tabBadgeTextActive
                        : styles.tabBadgeTextInactive,
                    ]}>
                    {count > 99 ? '99+' : count}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.searchRow}>
        <Icon name="magnify" size={18} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={`Search ${activeTab} connections`}
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

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : (
        <FlatList
          data={visibleItems}
          keyExtractor={c => c.connectionUUID}
          renderItem={renderItem}
          contentContainerStyle={
            visibleItems.length === 0 ? styles.emptyContent : undefined
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
                name={
                  activeTab === 'active'
                    ? 'account-group-outline'
                    : activeTab === 'pending'
                      ? 'inbox-outline'
                      : 'close-circle-outline'
                }
                size={42}
                color="#cbd5e1"
              />
              <Text style={styles.emptyTitle}>
                {activeTab === 'active'
                  ? 'No connections yet'
                  : activeTab === 'pending'
                    ? 'No pending requests'
                    : 'No rejected requests'}
              </Text>
              <Text style={styles.emptyBody}>
                {activeTab === 'active'
                  ? 'When members accept your requests, they\'ll show up here.'
                  : activeTab === 'pending'
                    ? 'You\'re all caught up — nothing waiting for a response.'
                    : 'Rejected requests will appear here for reference.'}
              </Text>
            </View>
          }
        />
      )}
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
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  tabsRow: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 4,
  },
  tab: {
    alignItems: 'center',
    borderBottomColor: 'transparent',
    borderBottomWidth: 2,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  tabText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  },
  tabBadge: {
    alignItems: 'center',
    borderRadius: 10,
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tabBadgeInactive: {
    backgroundColor: '#e2e8f0',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  tabBadgeTextActive: {
    color: '#ffffff',
  },
  tabBadgeTextInactive: {
    color: '#475569',
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
    gap: 2,
  },
  rowName: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
  },
  rowSubtitle: {
    color: '#64748b',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  rowMessage: {
    color: '#475569',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  rowMeta: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 4,
  },
  rowActions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionButton: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  actionButtonOutline: {
    backgroundColor: '#ffffff',
    borderColor: '#fecaca',
    borderWidth: 1,
  },
  actionButtonBusy: {
    opacity: 0.6,
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
