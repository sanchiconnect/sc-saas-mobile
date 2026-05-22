import React, {useCallback, useContext, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {ConfirmModal} from '../../../core/components/ConfirmModal';
import {Icon} from '../../../core/components/Icon';
import {colors, withAlpha} from '../../../core/theme/colors';
import {TenantContext} from '../../../core/tenant/TenantProvider';
import {useToast} from '../../../core/toast/ToastProvider';
import type {Conversation} from '../../chat/types';
import {connectionsService} from '../services/connections.service';
import type {Connection, ConnectionCounts} from '../types';

type Props = {
  token: string;
  // The signed-in user's UUID. Used to figure out which `people` entry on a
  // connection belongs to the counterparty so we can show their team-member
  // name + online status (mirrors web's getOnlineStatusConnections).
  currentUserUuid?: string;
  // Called when the user taps "Chat" on a connection. Parent (HomeScreen)
  // wires this to navigate into the chat detail with a synthesized
  // Conversation object — same flow as opening a chat from the list.
  onOpenChat?: (conversation: Conversation) => void;
};

type TabKey = 'active' | 'pending' | 'rejected';

const TABS: Array<{key: TabKey; label: string}> = [
  {key: 'active', label: 'Active'},
  {key: 'pending', label: 'Pending'},
  {key: 'rejected', label: 'Rejected'},
];

const PAGE_SIZE = 20;

// On the /connections endpoint the counterparty fields live at the root
// (companyName, name, avatar, accountType, people[]). On /requests/* they
// live nested under user/otherUser/connectedUser. Normalize both into a
// single shape so the renderer doesn't have to care.
const resolveCounterparty = (c: Connection) => {
  const nested = c.otherUser || c.connectedUser || c.user;
  if (nested && (nested.name || nested.fullName || nested.avatar)) {
    return {
      uuid: nested.uuid,
      name: nested.name || nested.fullName || nested.displayName,
      fullName: nested.fullName,
      avatar: nested.avatar || nested.companyLogo,
      accountType: nested.accountType,
      designation: nested.designation,
    };
  }
  return {
    uuid: c.userUUID,
    name: c.companyName || c.name || c.fullName,
    fullName: c.fullName,
    avatar: c.avatar || c.companyLogo,
    accountType: c.accountType,
    designation: c.designation,
  };
};

const resolveName = (c: Connection): string => {
  const u = resolveCounterparty(c);
  return u.name || 'Member';
};

// Mirrors web's getOnlineStatusConnections: the counterparty's team members
// are the org group whose people don't include the current user. We expose
// the first one's name as the secondary line under the company name.
const resolveOtherTeamMember = (
  c: Connection,
  currentUserUuid?: string,
) => {
  if (c.otherPeople?.teamMembers && c.otherPeople.teamMembers.length > 0) {
    return c.otherPeople.teamMembers[0];
  }
  if (!c.people || !currentUserUuid) return undefined;
  const otherGroup = c.people.find(
    p =>
      !(p.teamMembers || []).some(t => t.uuid === currentUserUuid) &&
      (!c.companyUUID || p.orgUUID === c.companyUUID),
  );
  return otherGroup?.teamMembers?.[0];
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

export function ConnectionsScreen({token, currentUserUuid, onOpenChat}: Props) {
  const {theme, globalSetting} = useContext(TenantContext);
  const primaryColor = theme?.primary || colors.primary;
  const logoBaseUrl =
    globalSetting?.imgKitUrl || globalSetting?.assetsImgKitUrl || '';
  const toast = useToast();

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
  // Card action sheet — opens when the user taps the 3-dot menu on a card.
  const [cardMenuFor, setCardMenuFor] = useState<Connection | null>(null);
  // ConfirmModal state for remove / reject confirmations.
  const [pendingConfirm, setPendingConfirm] = useState<{
    connection: Connection;
    action: 'remove' | 'reject';
  } | null>(null);

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

  // Accept fires immediately (low-stakes positive action) — confirmation
  // would just slow the user down. Reject + Remove go through ConfirmModal.
  const handleAccept = async (c: Connection) => {
    setPendingActionUUID(c.connectionUUID);
    try {
      await connectionsService.accept(token, c.connectionUUID);
      setItems(prev =>
        prev.filter(x => x.connectionUUID !== c.connectionUUID),
      );
      fetchCounts();
      toast.success(`Connected with ${resolveName(c)}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not accept.');
    } finally {
      setPendingActionUUID(null);
    }
  };

  const handleReject = (c: Connection) => {
    setPendingConfirm({connection: c, action: 'reject'});
  };

  const handleRemove = (c: Connection) => {
    setCardMenuFor(null);
    setPendingConfirm({connection: c, action: 'remove'});
  };

  // Runs after the user taps Confirm in the ConfirmModal. We dispatch on the
  // captured action so the same modal can drive both flows.
  const handleConfirmDestructive = async () => {
    if (!pendingConfirm) return;
    const {connection, action} = pendingConfirm;
    setPendingActionUUID(connection.connectionUUID);
    try {
      if (action === 'reject') {
        await connectionsService.reject(token, connection.connectionUUID);
      } else {
        await connectionsService.remove(token, connection.connectionUUID);
      }
      setItems(prev =>
        prev.filter(x => x.connectionUUID !== connection.connectionUUID),
      );
      fetchCounts();
      toast.success(
        action === 'reject'
          ? `Request from ${resolveName(connection)} rejected.`
          : `${resolveName(connection)} removed.`,
      );
      setPendingConfirm(null);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : action === 'reject'
            ? 'Could not reject.'
            : 'Could not remove.',
      );
    } finally {
      setPendingActionUUID(null);
    }
  };

  // Tap "Chat" on a connection card → synthesize a Conversation around the
  // groupChatUUID + counterparty info and hand it to the parent so the chat
  // detail screen can open with the correct room.
  const handleOpenChat = (c: Connection) => {
    setCardMenuFor(null);
    const u = resolveCounterparty(c);
    const convUuid = c.groupChatUUID || u.uuid || c.userUUID;
    if (!convUuid) {
      toast.error('Chat is not available for this connection yet.');
      return;
    }
    if (!onOpenChat) {
      toast.info('Chat will open from here once wiring is complete.');
      return;
    }
    const conversation: Conversation = {
      uuid: convUuid,
      name: u.name || '',
      conversationType: 'user',
      otherUser: {
        uuid: u.uuid || c.userUUID,
        name: u.name,
        avatar: u.avatar || null,
        accountType: u.accountType,
      },
    };
    onOpenChat(conversation);
  };

  const handleScheduleCall = (c: Connection) => {
    setCardMenuFor(null);
    toast.info(
      `Scheduling a call with ${resolveName(c)} will land in a future release.`,
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

  // ---------- Renderers ----------
  // Shared helpers used by both the card (active) and row (pending/rejected)
  // renderings.
  const resolveAvatarUri = (u: ReturnType<typeof resolveCounterparty>) => {
    const raw = u.avatar;
    if (!raw) return null;
    return raw.startsWith('http') ? raw : `${logoBaseUrl}${raw}`;
  };

  // Card layout for active connections — mirrors the web's connection-v4
  // grid: account-type chip + 3-dot menu, centered avatar + name, Chat
  // and Schedule call buttons.
  const renderActiveCard = ({item}: {item: Connection}) => {
    const name = resolveName(item);
    const u = resolveCounterparty(item);
    const avatar = resolveAvatarUri(u);
    const accountType = (u.accountType || '').replace(/_/g, ' ');
    const teamMember = resolveOtherTeamMember(item, currentUserUuid);
    const teamMemberName =
      teamMember?.name && teamMember.name !== name ? teamMember.name : '';
    const isOnline = Boolean(teamMember?.onlineStatus);

    return (
      <View style={styles.card}>
        <View style={styles.cardTopRow}>
          {accountType ? (
            <View
              style={[
                styles.accountChip,
                {
                  backgroundColor: withAlpha(primaryColor, 0.1),
                  borderColor: withAlpha(primaryColor, 0.25),
                },
              ]}>
              <Text style={[styles.accountChipText, {color: primaryColor}]}>
                {accountType.toUpperCase()}
              </Text>
            </View>
          ) : (
            <View />
          )}
          <Pressable
            onPress={() => setCardMenuFor(item)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`More actions for ${name}`}
            style={styles.cardMenuBtn}>
            <Icon name="dots-vertical" size={18} color="#64748b" />
          </Pressable>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardAvatarWrap}>
            <View
              style={[
                styles.cardAvatarFallback,
                {backgroundColor: `${primaryColor}1f`},
              ]}>
              <Text style={[styles.cardAvatarInitials, {color: primaryColor}]}>
                {initials(name) || '?'}
              </Text>
            </View>
            {avatar ? (
              <Image
                source={{uri: avatar}}
                style={[styles.cardAvatar, styles.cardAvatarOverlay]}
              />
            ) : null}
          </View>
          <Text style={styles.cardName} numberOfLines={2}>
            {name}
          </Text>
          {teamMemberName ? (
            <View style={styles.cardSubtitleRow}>
              <Text style={styles.cardSubtitle} numberOfLines={1}>
                {teamMemberName}
              </Text>
              {isOnline ? <View style={styles.onlineDot} /> : null}
            </View>
          ) : null}
          {item.acceptedAt ? (
            <Text style={styles.cardMeta}>
              Connected {formatDate(item.acceptedAt)}
            </Text>
          ) : null}
        </View>

        <View style={styles.cardActions}>
          <Pressable
            style={({pressed}) => [
              styles.cardActionBtn,
              styles.cardActionBtnLeft,
              pressed && styles.cardActionBtnPressed,
            ]}
            onPress={() => handleOpenChat(item)}>
            <Icon
              name="chat-processing-outline"
              size={18}
              color={primaryColor}
            />
            <Text style={[styles.cardActionLabel, {color: primaryColor}]}>
              Chat
            </Text>
          </Pressable>
          <View style={styles.cardActionDivider} />
          <Pressable
            style={({pressed}) => [
              styles.cardActionBtn,
              pressed && styles.cardActionBtnPressed,
            ]}
            onPress={() => handleScheduleCall(item)}>
            <Icon name="calendar-clock" size={18} color={primaryColor} />
            <Text style={[styles.cardActionLabel, {color: primaryColor}]}>
              Schedule call
            </Text>
          </Pressable>
        </View>
      </View>
    );
  };

  // Compact row for pending / rejected — avatar + name + message + side
  // actions (Accept/Reject for pending, none for rejected).
  const renderRequestRow = ({item}: {item: Connection}) => {
    const name = resolveName(item);
    const u = resolveCounterparty(item);
    const avatar = resolveAvatarUri(u);
    const subtitle = [u.accountType?.replace(/_/g, ' '), u.designation]
      .filter(Boolean)
      .join(' • ');
    const isRowBusy = pendingActionUUID === item.connectionUUID;

    return (
      <View style={styles.row}>
        <View style={styles.avatarWrap}>
          <View
            style={[
              styles.avatarFallback,
              {backgroundColor: `${primaryColor}1f`},
            ]}>
            <Text style={[styles.avatarInitials, {color: primaryColor}]}>
              {initials(name) || '?'}
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
        </View>
        {activeTab === 'pending' ? (
          <View style={styles.rowActions}>
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
          </View>
        ) : null}
      </View>
    );
  };

  const renderItem =
    activeTab === 'active' ? renderActiveCard : renderRequestRow;

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

      {/* Bottom action sheet — tapping the 3-dot menu on a card opens this.
          Currently only carries "Remove connection" to match the web's
          single-item dropdown, but the layout is sheet-shaped so we can grow
          it without churn. */}
      <Modal
        transparent
        visible={cardMenuFor !== null}
        animationType="fade"
        onRequestClose={() => setCardMenuFor(null)}>
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setCardMenuFor(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle} numberOfLines={1}>
              {cardMenuFor ? resolveName(cardMenuFor) : ''}
            </Text>
            <Pressable
              style={({pressed}) => [
                styles.sheetItem,
                pressed && styles.sheetItemPressed,
              ]}
              onPress={() => cardMenuFor && handleScheduleCall(cardMenuFor)}>
              <Icon name="calendar-clock" size={18} color="#334155" />
              <Text style={styles.sheetItemLabel}>Schedule a call</Text>
            </Pressable>
            <Pressable
              style={({pressed}) => [
                styles.sheetItem,
                pressed && styles.sheetItemPressed,
              ]}
              onPress={() => cardMenuFor && handleOpenChat(cardMenuFor)}>
              <Icon name="chat-processing-outline" size={18} color="#334155" />
              <Text style={styles.sheetItemLabel}>Open chat</Text>
            </Pressable>
            <View style={styles.sheetDivider} />
            <Pressable
              style={({pressed}) => [
                styles.sheetItem,
                pressed && styles.sheetItemPressed,
              ]}
              onPress={() => cardMenuFor && handleRemove(cardMenuFor)}>
              <Icon name="account-remove-outline" size={18} color="#dc2626" />
              <Text style={[styles.sheetItemLabel, styles.sheetItemDanger]}>
                Remove connection
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <ConfirmModal
        visible={pendingConfirm !== null}
        title={
          pendingConfirm?.action === 'reject'
            ? 'Reject this request?'
            : 'Remove connection?'
        }
        message={
          pendingConfirm
            ? pendingConfirm.action === 'reject'
              ? `${resolveName(pendingConfirm.connection)} won't be notified. You can re-accept them later if they send a new request.`
              : `${resolveName(pendingConfirm.connection)} will be removed from your active connections. They won't be notified.`
            : undefined
        }
        confirmLabel={pendingConfirm?.action === 'reject' ? 'Reject' : 'Remove'}
        cancelLabel="Cancel"
        variant="destructive"
        loading={pendingActionUUID === pendingConfirm?.connection.connectionUUID}
        onConfirm={handleConfirmDestructive}
        onCancel={() => setPendingConfirm(null)}
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
  avatarOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  avatarFallback: {
    alignItems: 'center',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  // ---------- Active connection card ----------
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    marginHorizontal: 16,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  cardTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  accountChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  accountChipText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  cardMenuBtn: {
    alignItems: 'center',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  cardBody: {
    alignItems: 'center',
    gap: 4,
    paddingBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  cardAvatarWrap: {
    height: 72,
    marginBottom: 8,
    width: 72,
  },
  cardAvatar: {
    borderRadius: 36,
    height: 72,
    width: 72,
  },
  cardAvatarOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  cardAvatarFallback: {
    alignItems: 'center',
    borderRadius: 36,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  cardAvatarInitials: {
    fontSize: 22,
    fontWeight: '800',
  },
  cardName: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  cardSubtitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  cardSubtitle: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  onlineDot: {
    backgroundColor: '#16a34a',
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  cardMeta: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  cardActions: {
    borderTopColor: '#e2e8f0',
    borderTopWidth: 1,
    flexDirection: 'row',
  },
  cardActionBtn: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 14,
  },
  cardActionBtnLeft: {},
  cardActionBtnPressed: {
    backgroundColor: '#f8fafc',
  },
  cardActionDivider: {
    backgroundColor: '#e2e8f0',
    width: 1,
  },
  cardActionLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  // ---------- Bottom sheet menu (3-dot) ----------
  sheetBackdrop: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 28,
    paddingHorizontal: 8,
    paddingTop: 10,
  },
  sheetHandle: {
    alignSelf: 'center',
    backgroundColor: '#cbd5e1',
    borderRadius: 2,
    height: 4,
    marginBottom: 14,
    width: 36,
  },
  sheetTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
    paddingBottom: 6,
    paddingHorizontal: 12,
  },
  sheetItem: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  sheetItemPressed: {
    backgroundColor: '#f1f5f9',
  },
  sheetItemLabel: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
  },
  sheetItemDanger: {
    color: '#dc2626',
  },
  sheetDivider: {
    backgroundColor: '#f1f5f9',
    height: 1,
    marginVertical: 4,
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
