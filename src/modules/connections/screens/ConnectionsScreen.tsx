import React, {useCallback, useContext, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
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
import {stripHtml} from '../../chat/utils';
import {connectionsService} from '../services/connections.service';
import type {Connection, ConnectionCounts} from '../types';

type Props = {
  token: string;
  // The signed-in user's UUID. Used to figure out which `people` entry on a
  // connection belongs to the counterparty so we can show their team-member
  // name + online status (mirrors web's getOnlineStatusConnections).
  currentUserUuid?: string;
  // The current user's account type. Drives the reject-reason option set —
  // mentors / investors / corporates each get a tailored picklist.
  currentUserAccountType?: string;
  // Called when the user taps "Chat" on a connection. Parent (HomeScreen)
  // wires this to navigate into the chat detail with a synthesized
  // Conversation object — same flow as opening a chat from the list.
  onOpenChat?: (conversation: Conversation) => void;
};

type TabKey = 'active' | 'pending' | 'rejected';
type PendingSubTab = 'received' | 'sent';
type RejectedSubTab = 'all' | 'received' | 'sent';

const TABS: Array<{key: TabKey; label: string}> = [
  {key: 'active', label: 'Active'},
  {key: 'pending', label: 'Pending'},
  {key: 'rejected', label: 'Rejected'},
];

const PENDING_SUBTABS: Array<{key: PendingSubTab; label: string}> = [
  {key: 'received', label: 'Received'},
  {key: 'sent', label: 'Sent'},
];

const REJECTED_SUBTABS: Array<{key: RejectedSubTab; label: string}> = [
  {key: 'all', label: 'All'},
  {key: 'received', label: 'Received'},
  {key: 'sent', label: 'Sent'},
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

// "23400" → "23.4K", "1500000" → "1.5M". Mirrors the web's numberFormatter
// pipe used on Target fundraise / Tentative valuation lines.
const formatNumber = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return 'N/A';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  if (Math.abs(num) >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (Math.abs(num) >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
};

// Stringify a value that might be a string, comma-joined string, or array.
const joinList = (value: unknown): string => {
  if (!value) return 'N/A';
  if (Array.isArray(value)) return value.filter(Boolean).join(', ') || 'N/A';
  return String(value);
};

const formatDate = (raw?: string): string => {
  if (!raw) return '';
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return '';
  return new Date(ms).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export function ConnectionsScreen({
  token,
  currentUserUuid,
  currentUserAccountType,
  onOpenChat,
}: Props) {
  const {theme, globalSetting} = useContext(TenantContext);
  const primaryColor = theme?.primary || colors.primary;
  const logoBaseUrl =
    globalSetting?.imgKitUrl || globalSetting?.assetsImgKitUrl || '';
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<TabKey>('active');
  const [pendingSubTab, setPendingSubTab] =
    useState<PendingSubTab>('received');
  // Rejected has All / Received / Sent sub-tabs. The backend ships them as
  // one unified list, so the direction filter (received vs sent) is client-
  // side using each connection's userUUID against currentUserUuid.
  const [rejectedSubTab, setRejectedSubTab] = useState<RejectedSubTab>('all');
  // Tapping a row in the pending list opens this detail sheet — mirrors the
  // web's right-side detail panel (message + profile snapshot + Accept/Reject).
  const [detailFor, setDetailFor] = useState<Connection | null>(null);
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
    action: 'accept' | 'remove';
  } | null>(null);
  // Reject-reason modal — open when the user taps Reject. Holds the
  // currently-selected option value and a free-text body for "Other reason".
  const [rejectFor, setRejectFor] = useState<Connection | null>(null);
  const [rejectOption, setRejectOption] = useState<string>('Other reason');
  const [rejectMessage, setRejectMessage] = useState<string>('');
  const [isRejecting, setIsRejecting] = useState(false);

  const fetchCounts = useCallback(async () => {
    try {
      // /types/counts only ships active/sent/received. Pull the rejected
      // total off the rejected list's meta in parallel so all four tab
      // badges have numbers.
      const [countsRes, rejectedRes] = await Promise.all([
        connectionsService.getCounts(token),
        connectionsService
          .listRequests(token, 'rejected', {page: 1, limit: 1})
          .catch(() => null),
      ]);
      const raw = countsRes?.data?.counts || {};
      const rejectedTotal =
        rejectedRes?.data?.meta?.totalItems ??
        rejectedRes?.data?.items?.length ??
        undefined;
      setCounts({
        myConnection: raw.myConnections,
        sent: raw.sentConnections,
        received: raw.receivedConnections,
        rejected: rejectedTotal,
      });
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
      subTab: PendingSubTab,
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
                tab === 'pending' ? subTab : 'rejected',
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
      await fetchPage(activeTab, 1, 'replace', search, pendingSubTab);
      if (!cancelled) setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, fetchPage, search, pendingSubTab]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      fetchPage(activeTab, 1, 'replace', search, pendingSubTab),
      fetchCounts(),
    ]);
    setIsRefreshing(false);
  };

  const handleEndReached = async () => {
    if (isLoadingMore || currentPage >= totalPages) return;
    setIsLoadingMore(true);
    await fetchPage(
      activeTab,
      currentPage + 1,
      'append',
      search,
      pendingSubTab,
    );
    setIsLoadingMore(false);
  };

  // All three actions (accept, reject, remove) route through the ConfirmModal
  // so the user always gets a chance to back out before we hit the API.
  const handleAccept = (c: Connection) => {
    setPendingConfirm({connection: c, action: 'accept'});
  };

  // Reject goes through a dedicated reason picker — title + radio options +
  // free-text textarea. Confirm calls the API with the chosen reason as the
  // actionMessage.
  const handleReject = (c: Connection) => {
    setRejectFor(c);
    // Pre-select "Other reason" so the free-text textarea is visible up
    // front — the most common path is users typing a custom reason.
    setRejectOption('Other reason');
    setRejectMessage('');
  };

  // Reject options vary by the user's account type — same list the web ships
  // in reject-connection-modal.component.ts. "Other reason" is the universal
  // fallback that activates the free-text textarea.
  const rejectOptions = (() => {
    const baseType = (currentUserAccountType || '').toLowerCase();
    const opts: string[] = [];
    if (baseType === 'mentor') {
      opts.push('I have a conflict of interest');
      opts.push('Not sure if I would be relevant here');
    } else if (baseType === 'investor' || baseType === 'corporate') {
      opts.push('Stage mismatch');
      opts.push('Sector mismatch');
      if (baseType === 'investor') {
        opts.push('Business case or market size not compelling enough');
      }
    }
    opts.push('Other reason');
    return opts;
  })();

  const rejectIsValid =
    rejectOption !== 'Other reason' || rejectMessage.trim().length > 0;

  const handleConfirmReject = async () => {
    if (!rejectFor || !rejectIsValid) return;
    const reason =
      rejectOption === 'Other reason' ? rejectMessage.trim() : rejectOption;
    setIsRejecting(true);
    setPendingActionUUID(rejectFor.connectionUUID);
    try {
      await connectionsService.reject(token, rejectFor.connectionUUID, reason);
      setItems(prev =>
        prev.filter(x => x.connectionUUID !== rejectFor.connectionUUID),
      );
      fetchCounts();
      toast.success(`Request from ${resolveName(rejectFor)} rejected.`);
      setRejectFor(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not reject.');
    } finally {
      setIsRejecting(false);
      setPendingActionUUID(null);
    }
  };

  const handleRemove = (c: Connection) => {
    setCardMenuFor(null);
    setPendingConfirm({connection: c, action: 'remove'});
  };

  // Runs after the user taps Confirm in the ConfirmModal. Accept and Remove
  // share this flow; Reject has its own reason-picker modal.
  const handleConfirmAction = async () => {
    if (!pendingConfirm) return;
    const {connection, action} = pendingConfirm;
    setPendingActionUUID(connection.connectionUUID);
    try {
      if (action === 'accept') {
        await connectionsService.accept(token, connection.connectionUUID);
      } else {
        await connectionsService.remove(token, connection.connectionUUID);
      }
      setItems(prev =>
        prev.filter(x => x.connectionUUID !== connection.connectionUUID),
      );
      fetchCounts();
      toast.success(
        action === 'accept'
          ? `Connected with ${resolveName(connection)}.`
          : `${resolveName(connection)} removed.`,
      );
      setPendingConfirm(null);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : action === 'accept'
            ? 'Could not accept.'
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
  // expose a searchName on /requests/* yet. Rejected also splits by
  // direction (received vs sent) using the connection's userUUID — that's
  // the initiator's uuid, so a match against currentUserUuid means we sent.
  let visibleItems = items;
  if (activeTab === 'rejected' && rejectedSubTab !== 'all') {
    const isSentByMe = (c: Connection) =>
      Boolean(c.userUUID && currentUserUuid && c.userUUID === currentUserUuid);
    visibleItems = items.filter(c =>
      rejectedSubTab === 'sent' ? isSentByMe(c) : !isSentByMe(c),
    );
  }
  if (activeTab !== 'active' && search.trim()) {
    const q = search.trim().toLowerCase();
    visibleItems = visibleItems.filter(c =>
      resolveName(c).toLowerCase().includes(q),
    );
  }

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
  // actions. Pending-Received shows Accept/Reject side buttons inline;
  // Pending-Sent has no actions (the request is out of our hands) but the
  // whole row is tappable so users can review what they sent.
  const renderRequestRow = ({item}: {item: Connection}) => {
    const name = resolveName(item);
    const u = resolveCounterparty(item);
    const avatar = resolveAvatarUri(u);
    const subtitle = [u.accountType?.replace(/_/g, ' '), u.designation]
      .filter(Boolean)
      .join(' • ');
    const isRowBusy = pendingActionUUID === item.connectionUUID;
    const showActions =
      activeTab === 'pending' && pendingSubTab === 'received';

    return (
      <Pressable
        style={({pressed}) => [styles.row, pressed && styles.rowPressed]}
        onPress={() => setDetailFor(item)}>
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
              "{stripHtml(item.message)}"
            </Text>
          ) : null}
          {activeTab === 'rejected' && item.actionMessage ? (
            <Text style={styles.rowMessage} numberOfLines={2}>
              Reason: {item.actionMessage}
            </Text>
          ) : null}
          {activeTab === 'rejected' ? (() => {
            // Backend serializes the rejection timestamp as `rejected_at`
            // (snake_case) on this endpoint — not `rejectedAt`. Try the
            // snake_case alias first, then the camelCase one, then fall
            // back to the row's createdAt so something always renders.
            const ts =
              (item as any).rejected_at ||
              item.rejectedAt ||
              (item as any).actionAt ||
              item.createdAt ||
              null;
            if (!ts) return null;
            return (
              <View style={styles.rejectedMeta}>
                <Icon
                  name="calendar-remove-outline"
                  size={12}
                  color="#dc2626"
                />
                <Text style={styles.rejectedMetaText}>
                  Rejected on {formatDate(ts)}
                </Text>
              </View>
            );
          })() : null}
        </View>
        {showActions ? (
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
        ) : (
          <Icon name="chevron-right" size={20} color="#cbd5e1" />
        )}
      </Pressable>
    );
  };

  const renderItem =
    activeTab === 'active' ? renderActiveCard : renderRequestRow;

  // Two-column "About + key facts" grid for the detail sheet. Picks the
  // right field set per accountType — matches the web's connection-other-
  // details template. Falls back to a generic "no extra details" line for
  // account types we don't have a layout for yet.
  const renderProfileDetails = (c: Connection) => {
    const u = resolveCounterparty(c);
    const accountType = (u.accountType || c.accountType || '').toLowerCase();
    const d = c.otherDetails || {};
    // Bios come back as Quill HTML — strip down to plain text so the bubble
    // doesn't render raw <p>/<span> markup.
    const description = stripHtml(d.description as string | undefined);

    let fields: Array<{label: string; value: string}> = [];
    if (accountType === 'startup') {
      fields = [
        {label: 'Funding Type', value: d.fundingType || 'N/A'},
        {label: 'Business Model', value: joinList(d.businessModel)},
        {
          label: 'Target fundraise (INR)',
          value: formatNumber(d.targetFundRaise),
        },
        {
          label: 'Tentative valuation (INR)',
          value: formatNumber(d.tentativeValuation),
        },
        {
          label: 'Investment Instruments',
          value: joinList(d.investmentInstruments),
        },
        {label: 'Revenue (INR)', value: formatNumber(d.revenue)},
      ];
    } else if (accountType === 'investor') {
      fields = [
        {label: 'Organization Type', value: d.organizationType || 'N/A'},
        {label: 'Portfolio Size', value: formatNumber(d.portfolioSize)},
        {
          label: 'Min Ticket (INR)',
          value: formatNumber(d.ticketSizeMin),
        },
        {
          label: 'Max Ticket (INR)',
          value: formatNumber(d.ticketSizeMax),
        },
        {label: 'Invest Ability', value: joinList(d.investAbilityMetrics)},
        {
          label: 'Investment Instruments',
          value: joinList(d.investmentInstruments),
        },
      ];
    } else if (accountType === 'corporate') {
      fields = [
        {label: 'Company Size', value: d.companySize || 'N/A'},
        {label: 'Program Name', value: d.programName || 'N/A'},
        {
          label: 'Reason to Connect',
          value: d.reasonToConnectWithStartup || 'N/A',
        },
        {
          label: 'Startups Supported',
          value: formatNumber(d.totalStartupSupported),
        },
      ];
    }

    if (!description && fields.length === 0) return null;

    const accountTypeLabel = accountType
      ? accountType.charAt(0).toUpperCase() + accountType.slice(1)
      : 'Profile';

    return (
      <>
        {description ? (
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionLabel}>
              About {accountTypeLabel}
            </Text>
            <View style={styles.detailAboutBox}>
              <Text style={styles.detailAbout}>{description}</Text>
            </View>
          </View>
        ) : null}
        {fields.length > 0 ? (
          <View style={styles.detailSection}>
            <View style={styles.detailGrid}>
              {fields.map(f => (
                <View key={f.label} style={styles.detailGridItem}>
                  <Text style={styles.detailFieldLabel}>{f.label}</Text>
                  <Text style={styles.detailFieldValue} numberOfLines={3}>
                    {f.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </>
    );
  };

  const tabCount = (key: TabKey): number | undefined => {
    if (key === 'active') return counts.myConnection;
    // Pending tab badge sums received + sent so it reflects all outstanding
    // requests, not just incoming.
    if (key === 'pending')
      return (counts.received || 0) + (counts.sent || 0);
    if (key === 'rejected') return counts.rejected;
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

      {activeTab === 'pending' ? (
        <View style={styles.subTabRow}>
          {PENDING_SUBTABS.map(sub => {
            const isActive = sub.key === pendingSubTab;
            // Counts come from /connections/types/counts. We always render a
            // badge (even 0) so the layout doesn't jump as data loads.
            const count =
              (sub.key === 'received' ? counts.received : counts.sent) || 0;
            return (
              <Pressable
                key={sub.key}
                onPress={() => setPendingSubTab(sub.key)}
                style={[
                  styles.subTabPill,
                  isActive && {backgroundColor: primaryColor},
                ]}>
                <Text
                  style={[
                    styles.subTabLabel,
                    isActive && styles.subTabLabelActive,
                  ]}>
                  {sub.label}
                </Text>
                <View
                  style={[
                    styles.subTabBadge,
                    isActive && styles.subTabBadgeActive,
                  ]}>
                  <Text
                    style={[
                      styles.subTabBadgeText,
                      isActive && styles.subTabBadgeTextActive,
                    ]}>
                    {count > 99 ? '99+' : count}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {activeTab === 'rejected' ? (
        <View style={styles.subTabRow}>
          {REJECTED_SUBTABS.map(sub => {
            const isActive = sub.key === rejectedSubTab;
            // "All" reads the server total; per-direction badges count what's
            // currently loaded (the backend doesn't expose direction-split
            // totals for rejected).
            let count: number;
            if (sub.key === 'all') {
              count = counts.rejected || 0;
            } else {
              const isSentByMe = (c: Connection) =>
                Boolean(
                  c.userUUID &&
                    currentUserUuid &&
                    c.userUUID === currentUserUuid,
                );
              count = items.filter(c =>
                sub.key === 'sent' ? isSentByMe(c) : !isSentByMe(c),
              ).length;
            }
            return (
              <Pressable
                key={sub.key}
                onPress={() => setRejectedSubTab(sub.key)}
                style={[
                  styles.subTabPill,
                  isActive && {backgroundColor: primaryColor},
                ]}>
                <Text
                  style={[
                    styles.subTabLabel,
                    isActive && styles.subTabLabelActive,
                  ]}>
                  {sub.label}
                </Text>
                <View
                  style={[
                    styles.subTabBadge,
                    isActive && styles.subTabBadgeActive,
                  ]}>
                  <Text
                    style={[
                      styles.subTabBadgeText,
                      isActive && styles.subTabBadgeTextActive,
                    ]}>
                    {count > 99 ? '99+' : count}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}

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

      {/* Detail sheet — opens when a pending/rejected request row is tapped.
          Mirrors the web's right-side panel: avatar + name + message, plus
          Accept/Reject for received pending. Profile preview fields are
          stubbed for now since they need a separate profile-by-uuid fetch. */}
      <Modal
        transparent
        visible={detailFor !== null}
        animationType="slide"
        onRequestClose={() => setDetailFor(null)}>
        <View style={styles.detailOverlay}>
          <Pressable
            style={styles.detailBackdrop}
            onPress={() => setDetailFor(null)}
          />
          <View style={styles.detailSheet}>
            <View style={styles.detailHandle} />
            {detailFor ? (
              <>
                <View style={styles.detailHeader}>
                  <View style={styles.detailAvatarWrap}>
                    <View
                      style={[
                        styles.detailAvatarFallback,
                        {backgroundColor: `${primaryColor}1f`},
                      ]}>
                      <Text
                        style={[
                          styles.detailAvatarInitials,
                          {color: primaryColor},
                        ]}>
                        {initials(resolveName(detailFor)) || '?'}
                      </Text>
                    </View>
                    {(() => {
                      const u = resolveCounterparty(detailFor);
                      const av = resolveAvatarUri(u);
                      return av ? (
                        <Image
                          source={{uri: av}}
                          style={[styles.detailAvatar, styles.cardAvatarOverlay]}
                        />
                      ) : null;
                    })()}
                  </View>
                  <View style={styles.detailHeaderCopy}>
                    <Text style={styles.detailName} numberOfLines={1}>
                      {resolveName(detailFor)}
                    </Text>
                    {(() => {
                      const u = resolveCounterparty(detailFor);
                      const type = u.accountType?.replace(/_/g, ' ');
                      if (!type) return null;
                      return (
                        <View
                          style={[
                            styles.accountChip,
                            {
                              backgroundColor: withAlpha(primaryColor, 0.1),
                              borderColor: withAlpha(primaryColor, 0.25),
                              alignSelf: 'flex-start',
                              marginTop: 4,
                            },
                          ]}>
                          <Text
                            style={[
                              styles.accountChipText,
                              {color: primaryColor},
                            ]}>
                            {type.toUpperCase()}
                          </Text>
                        </View>
                      );
                    })()}
                  </View>
                  <Pressable
                    onPress={() => setDetailFor(null)}
                    hitSlop={6}
                    style={styles.detailCloseBtn}>
                    <Icon name="close" size={18} color="#475569" />
                  </Pressable>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.detailScrollContent}>
                  {detailFor.message ? (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionLabel}>Message</Text>
                      <View style={styles.detailMessageBox}>
                        <Text style={styles.detailMessageText}>
                          {stripHtml(detailFor.message)}
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {renderProfileDetails(detailFor)}

                  {activeTab === 'rejected' && detailFor.actionMessage ? (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionLabel}>Reason</Text>
                      <View style={styles.detailMessageBox}>
                        <Text style={styles.detailMessageText}>
                          {detailFor.actionMessage}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </ScrollView>

                {activeTab === 'pending' &&
                pendingSubTab === 'received' ? (
                  <View style={styles.detailActions}>
                    <Pressable
                      disabled={
                        pendingActionUUID === detailFor.connectionUUID
                      }
                      onPress={() => {
                        const target = detailFor;
                        setDetailFor(null);
                        handleAccept(target);
                      }}
                      style={[
                        styles.detailActionBtn,
                        styles.detailAcceptBtn,
                      ]}>
                      <Icon name="check" size={16} color="#ffffff" />
                      <Text style={styles.detailAcceptLabel}>Accept</Text>
                    </Pressable>
                    <Pressable
                      disabled={
                        pendingActionUUID === detailFor.connectionUUID
                      }
                      onPress={() => {
                        const target = detailFor;
                        setDetailFor(null);
                        handleReject(target);
                      }}
                      style={[
                        styles.detailActionBtn,
                        styles.detailRejectBtn,
                      ]}>
                      <Icon name="close" size={16} color="#dc2626" />
                      <Text style={styles.detailRejectLabel}>Reject</Text>
                    </Pressable>
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Reject reason modal — opens when the user taps Reject. Mirrors the
          web's reject-connection-modal: radio picklist + textarea, with the
          option set varying by the current user's account type. */}
      <Modal
        transparent
        visible={rejectFor !== null}
        animationType="fade"
        onRequestClose={() => (isRejecting ? undefined : setRejectFor(null))}>
        <View style={styles.rejectOverlay}>
          <Pressable
            style={styles.rejectBackdrop}
            onPress={() => (isRejecting ? undefined : setRejectFor(null))}
          />
          <View style={styles.rejectCard}>
            <View style={styles.rejectHeader}>
              <Text style={styles.rejectTitle}>
                Would like to pass, because
              </Text>
              <Pressable
                accessibilityLabel="Close"
                hitSlop={6}
                disabled={isRejecting}
                onPress={() => setRejectFor(null)}
                style={styles.rejectCloseBtn}>
                <Icon name="close" size={18} color="#475569" />
              </Pressable>
            </View>

            <ScrollView
              style={styles.rejectOptionsList}
              showsVerticalScrollIndicator={false}>
              {rejectOptions.map(opt => {
                const isActive = rejectOption === opt;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => setRejectOption(opt)}
                    style={[
                      styles.rejectOption,
                      isActive && {borderColor: primaryColor},
                    ]}>
                    <View
                      style={[
                        styles.rejectRadio,
                        isActive && {borderColor: primaryColor},
                      ]}>
                      {isActive ? (
                        <View
                          style={[
                            styles.rejectRadioDot,
                            {backgroundColor: primaryColor},
                          ]}
                        />
                      ) : null}
                    </View>
                    <Text style={styles.rejectOptionLabel}>{opt}</Text>
                  </Pressable>
                );
              })}

              {rejectOption === 'Other reason' ? (
                <TextInput
                  multiline
                  numberOfLines={4}
                  maxLength={300}
                  value={rejectMessage}
                  onChangeText={setRejectMessage}
                  placeholder="Share your reason to decline"
                  placeholderTextColor="#94a3b8"
                  editable={!isRejecting}
                  style={styles.rejectTextarea}
                />
              ) : null}
            </ScrollView>

            <View style={styles.rejectActions}>
              <Pressable
                disabled={isRejecting}
                onPress={() => setRejectFor(null)}
                style={[styles.rejectActionBtn, styles.rejectCancelBtn]}>
                <Text style={styles.rejectCancelLabel}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={isRejecting || !rejectIsValid}
                onPress={handleConfirmReject}
                style={[
                  styles.rejectActionBtn,
                  styles.rejectConfirmBtn,
                  {backgroundColor: primaryColor},
                  (!rejectIsValid || isRejecting) &&
                    styles.rejectConfirmBtnDisabled,
                ]}>
                {isRejecting ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.rejectConfirmLabel}>Reject</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmModal
        visible={pendingConfirm !== null}
        title={
          pendingConfirm?.action === 'accept'
            ? 'Accept this connection?'
            : 'Remove connection?'
        }
        message={
          pendingConfirm
            ? pendingConfirm.action === 'accept'
              ? `${resolveName(pendingConfirm.connection)} will be added to your active connections and you'll be able to chat and schedule calls.`
              : `${resolveName(pendingConfirm.connection)} will be removed from your active connections. They won't be notified.`
            : undefined
        }
        confirmLabel={pendingConfirm?.action === 'accept' ? 'Accept' : 'Remove'}
        cancelLabel="Cancel"
        variant={pendingConfirm?.action === 'accept' ? 'default' : 'destructive'}
        loading={pendingActionUUID === pendingConfirm?.connection.connectionUUID}
        onConfirm={handleConfirmAction}
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
  rowPressed: {
    backgroundColor: '#f8fafc',
  },
  // ---------- Pending sub-tabs (Received / Sent) ----------
  // Pills split the row 50/50 so the toggle reads as a proper segmented
  // control instead of two floating chips on the left.
  subTabRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  subTabPill: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 999,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  subTabLabel: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  subTabLabelActive: {
    color: '#ffffff',
  },
  subTabBadge: {
    alignItems: 'center',
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    height: 20,
    justifyContent: 'center',
    minWidth: 24,
    paddingHorizontal: 6,
  },
  subTabBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  subTabBadgeText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '800',
  },
  subTabBadgeTextActive: {
    color: '#ffffff',
  },
  // ---------- Detail bottom sheet ----------
  detailOverlay: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  detailBackdrop: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  detailSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: 28,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  detailScrollContent: {
    paddingBottom: 4,
  },
  detailAboutBox: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  detailAbout: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 20,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  detailGridItem: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 12,
    borderWidth: 1,
    flexBasis: '48%',
    flexGrow: 1,
    padding: 12,
  },
  detailFieldLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  detailFieldValue: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  detailHandle: {
    alignSelf: 'center',
    backgroundColor: '#cbd5e1',
    borderRadius: 2,
    height: 4,
    marginBottom: 16,
    width: 36,
  },
  detailHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  detailAvatarWrap: {
    height: 56,
    width: 56,
  },
  detailAvatar: {
    borderRadius: 28,
    height: 56,
    width: 56,
  },
  detailAvatarFallback: {
    alignItems: 'center',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  detailAvatarInitials: {
    fontSize: 18,
    fontWeight: '800',
  },
  detailHeaderCopy: {
    flex: 1,
  },
  detailName: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
  detailCloseBtn: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  detailSection: {
    gap: 6,
    marginBottom: 14,
  },
  detailSectionLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  detailMessageBox: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  detailMessageText: {
    color: '#0f172a',
    fontSize: 13,
    lineHeight: 19,
  },
  detailActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  detailActionBtn: {
    alignItems: 'center',
    borderRadius: 12,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 13,
  },
  detailAcceptBtn: {
    backgroundColor: '#16a34a',
  },
  detailAcceptLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  detailRejectBtn: {
    backgroundColor: '#ffffff',
    borderColor: '#fecaca',
    borderWidth: 1,
  },
  detailRejectLabel: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '700',
  },
  // ---------- Reject reason modal ----------
  rejectOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  rejectBackdrop: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  rejectCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    maxHeight: '85%',
    paddingBottom: 16,
    paddingHorizontal: 18,
    paddingTop: 16,
    width: '100%',
  },
  rejectHeader: {
    alignItems: 'center',
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 14,
  },
  rejectTitle: {
    color: '#0f172a',
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
  },
  rejectCloseBtn: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  rejectOptionsList: {
    marginTop: 14,
  },
  rejectOption: {
    alignItems: 'center',
    borderColor: '#e2e8f0',
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rejectRadio: {
    alignItems: 'center',
    borderColor: '#cbd5e1',
    borderRadius: 10,
    borderWidth: 2,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  rejectRadioDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  rejectOptionLabel: {
    color: '#0f172a',
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  rejectTextarea: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 12,
    borderWidth: 1,
    color: '#0f172a',
    fontSize: 14,
    marginBottom: 8,
    marginTop: 4,
    minHeight: 96,
    padding: 12,
    textAlignVertical: 'top',
  },
  rejectActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  rejectActionBtn: {
    alignItems: 'center',
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 13,
  },
  rejectCancelBtn: {
    backgroundColor: '#f1f5f9',
  },
  rejectCancelLabel: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
  },
  rejectConfirmBtn: {},
  rejectConfirmBtnDisabled: {
    opacity: 0.5,
  },
  rejectConfirmLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
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
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    marginHorizontal: 12,
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
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  accountChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  accountChipText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  cardMenuBtn: {
    alignItems: 'center',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  cardBody: {
    alignItems: 'center',
    gap: 2,
    paddingBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  cardAvatarWrap: {
    height: 56,
    marginBottom: 6,
    width: 56,
  },
  cardAvatar: {
    borderRadius: 28,
    height: 56,
    width: 56,
  },
  cardAvatarOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  cardAvatarFallback: {
    alignItems: 'center',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  cardAvatarInitials: {
    fontSize: 18,
    fontWeight: '800',
  },
  cardName: {
    color: '#0f172a',
    fontSize: 15,
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
    fontSize: 12,
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
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
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
    paddingVertical: 11,
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
    fontSize: 12,
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
  // Rejection date chip — same row-meta line but with a red calendar icon
  // so the date reads as part of the rejection metadata, not just a generic
  // grey footnote.
  rejectedMeta: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#fef2f2',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  rejectedMetaText: {
    color: '#b91c1c',
    fontSize: 11,
    fontWeight: '600',
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
