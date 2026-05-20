import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {authService} from '../../auth/services/auth.service';
import {Icon} from '../../shared/components/Icon';
import {StartupDetailScreen} from './StartupDetailScreen';

type ConnectionsTab = 'active' | 'pending' | 'rejected';

type ConnectionPerson = {
  uuid?: string | null;
  name?: string | null;
  avatar?: string | null;
  accountType?: string | null;
};

type ConnectionItem = {
  id?: number | string;
  uuid?: string;
  connectionUUID?: string | null;
  companyName?: string | null;
  companyUUID?: string | null;
  status?: string | null;
  otherUserAccountType?: string | null;
  otherUser?: ConnectionPerson | null;
  user?: ConnectionPerson | null;
};

type ConnectionsScreenProps = {
  token: string;
  primaryColor: string;
  logoBaseUrl?: string | null;
  onBack?: () => void;
};

const TABS: Array<{key: ConnectionsTab; label: string}> = [
  {key: 'active', label: 'Active'},
  {key: 'pending', label: 'Pending'},
  {key: 'rejected', label: 'Rejected'},
];

const resolveAssetUri = (
  assetPath: string | null | undefined,
  logoBaseUrl?: string | null,
) => {
  if (!assetPath) return null;
  if (/^https?:\/\//i.test(assetPath)) return assetPath;
  if (!logoBaseUrl) return null;
  return `${logoBaseUrl.replace(/\/$/, '')}/${assetPath.replace(/^\//, '')}`;
};

const getInitials = (name?: string | null) =>
  (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0]?.toUpperCase() || '')
    .join('') || 'C';

const getCompanyTitle = (item: ConnectionItem) =>
  item.companyName ||
  item.otherUser?.name ||
  item.user?.name ||
  'Unknown';

const getSubtitle = (item: ConnectionItem) =>
  item.otherUser?.name && item.companyName !== item.otherUser?.name
    ? item.otherUser.name
    : null;

const getAccountTypeLabel = (item: ConnectionItem) => {
  const raw =
    item.otherUserAccountType ||
    item.otherUser?.accountType ||
    item.user?.accountType ||
    '';
  return raw.toString().replace(/_/g, ' ').toUpperCase();
};

export function ConnectionsScreen({
  token,
  primaryColor,
  logoBaseUrl,
  onBack,
}: ConnectionsScreenProps) {
  const [tab, setTab] = useState<ConnectionsTab>('active');
  const [selectedStartupUuid, setSelectedStartupUuid] = useState<string | null>(
    null,
  );
  const [itemsByTab, setItemsByTab] = useState<
    Record<ConnectionsTab, ConnectionItem[]>
  >({active: [], pending: [], rejected: []});
  const [loadingByTab, setLoadingByTab] = useState<
    Record<ConnectionsTab, boolean>
  >({active: false, pending: false, rejected: false});
  const [errorByTab, setErrorByTab] = useState<
    Record<ConnectionsTab, string | null>
  >({active: null, pending: null, rejected: null});
  const [searchText, setSearchText] = useState('');

  const loadTab = useCallback(
    async (next: ConnectionsTab) => {
      setLoadingByTab(prev => ({...prev, [next]: true}));
      setErrorByTab(prev => ({...prev, [next]: null}));
      try {
        let response;
        if (next === 'active') {
          response = await authService.getConnections(token);
        } else if (next === 'pending') {
          response = await authService.getReceivedConnectionRequests(token);
        } else {
          response = await authService.getRejectedConnectionRequests(token);
        }
        const rawData = response?.data;
        const list: ConnectionItem[] = Array.isArray(rawData)
          ? rawData
          : Array.isArray(rawData?.items)
          ? rawData.items
          : [];
        setItemsByTab(prev => ({...prev, [next]: list}));
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : `Could not load ${next} connections.`;
        setErrorByTab(prev => ({...prev, [next]: message}));
        setItemsByTab(prev => ({...prev, [next]: []}));
      } finally {
        setLoadingByTab(prev => ({...prev, [next]: false}));
      }
    },
    [token],
  );

  useEffect(() => {
    loadTab(tab);
  }, [tab, loadTab]);

  const currentItems = itemsByTab[tab];
  const currentLoading = loadingByTab[tab];
  const currentError = errorByTab[tab];

  const visibleItems = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return currentItems;
    return currentItems.filter(item => {
      const haystack = [
        item.companyName,
        item.otherUser?.name,
        item.user?.name,
        item.otherUserAccountType,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [currentItems, searchText]);

  const countLabel = (() => {
    const n = currentItems.length;
    if (tab === 'active') {
      return `You have ${n} active connection${n === 1 ? '' : 's'}`;
    }
    if (tab === 'pending') {
      return `You have ${n} pending request${n === 1 ? '' : 's'}`;
    }
    return `You have ${n} rejected request${n === 1 ? '' : 's'}`;
  })();

  if (selectedStartupUuid) {
    return (
      <StartupDetailScreen
        token={token}
        uuid={selectedStartupUuid}
        primaryColor={primaryColor}
        logoBaseUrl={logoBaseUrl}
        onBack={() => setSelectedStartupUuid(null)}
      />
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.toolbar}>
        <View style={styles.toolbarHeader}>
          {onBack ? (
            <Pressable
              onPress={onBack}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Back">
              <Icon name="chevron-left" size={24} color="#0f172a" />
            </Pressable>
          ) : null}
          <Text style={styles.toolbarTitle}>Connections</Text>
        </View>

        <View style={styles.tabRow}>
          {TABS.map(t => {
            const active = t.key === tab;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={[
                  styles.tabButton,
                  active && {borderBottomColor: primaryColor},
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${t.label} tab`}>
                <Text
                  style={[
                    styles.tabLabel,
                    active && {color: primaryColor, fontWeight: '800'},
                  ]}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.countText}>{countLabel}</Text>

        <View style={styles.searchWrap}>
          <Icon name="magnify" size={18} color="#64748b" />
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search a connection"
            placeholderTextColor="#94a3b8"
            style={styles.searchInput}
          />
          {searchText ? (
            <Pressable onPress={() => setSearchText('')}>
              <Icon name="close" size={18} color="#64748b" />
            </Pressable>
          ) : null}
        </View>

        {currentLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={primaryColor} />
            <Text style={styles.loadingText}>Loading…</Text>
          </View>
        ) : currentError ? (
          <View style={styles.errorCard}>
            <Icon name="alert-circle-outline" size={36} color="#dc2626" />
            <Text style={styles.errorTitle}>Could not load</Text>
            <Text style={styles.errorBody}>{currentError}</Text>
            <Pressable
              style={[styles.retryButton, {backgroundColor: primaryColor}]}
              onPress={() => loadTab(tab)}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : visibleItems.length === 0 ? (
          <View style={styles.emptyCard}>
            <Icon name="account-multiple-outline" size={42} color="#94a3b8" />
            <Text style={styles.emptyText}>
              {searchText
                ? 'No matches found.'
                : tab === 'active'
                ? 'No active connections yet.'
                : tab === 'pending'
                ? 'No pending requests.'
                : 'No rejected requests.'}
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {visibleItems.map((item, index) => (
              <ConnectionCard
                key={
                  item.uuid ||
                  item.connectionUUID ||
                  `${tab}-${item.id || index}`
                }
                item={item}
                tab={tab}
                primaryColor={primaryColor}
                logoBaseUrl={logoBaseUrl}
                onChat={() =>
                  Alert.alert('Chat', 'Messaging flow coming soon.')
                }
                onSchedule={() =>
                  Alert.alert('Schedule call', 'Scheduling flow coming soon.')
                }
                onOpen={() => {
                  if (item.companyUUID) {
                    setSelectedStartupUuid(item.companyUUID);
                  }
                }}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function ConnectionCard({
  item,
  tab,
  primaryColor,
  logoBaseUrl,
  onChat,
  onSchedule,
  onOpen,
}: {
  item: ConnectionItem;
  tab: ConnectionsTab;
  primaryColor: string;
  logoBaseUrl?: string | null;
  onChat: () => void;
  onSchedule: () => void;
  onOpen: () => void;
}) {
  const title = getCompanyTitle(item);
  const subtitle = getSubtitle(item);
  const accountType = getAccountTypeLabel(item);
  const avatarPath = item.otherUser?.avatar || item.user?.avatar || null;
  const avatarUri = resolveAssetUri(avatarPath, logoBaseUrl);
  const isStartup =
    (item.otherUserAccountType || item.otherUser?.accountType || '')
      .toString()
      .toLowerCase() === 'startup';

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.cardTop}
        onPress={onOpen}
        disabled={!item.companyUUID || !isStartup}
        accessibilityRole={isStartup ? 'button' : 'none'}
        accessibilityLabel={`Open ${title}`}>
        {accountType ? (
          <View style={styles.typePill}>
            <Text style={styles.typePillText}>{accountType}</Text>
          </View>
        ) : null}
        {avatarUri ? (
          <Image source={{uri: avatarUri}} style={styles.avatar} />
        ) : (
          <View
            style={[
              styles.avatarFallback,
              {backgroundColor: `${primaryColor}1A`},
            ]}>
            <Text style={[styles.avatarInitials, {color: primaryColor}]}>
              {getInitials(title)}
            </Text>
          </View>
        )}
        <Text style={styles.cardTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.cardSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </Pressable>

      {tab === 'active' ? (
        <View style={styles.cardActions}>
          <Pressable
            style={styles.cardAction}
            onPress={onChat}
            accessibilityRole="button"
            accessibilityLabel={`Chat with ${title}`}>
            <Icon name="message-text-outline" size={16} color="#0f172a" />
            <Text style={styles.cardActionText}>Chat</Text>
          </Pressable>
          <View style={styles.cardActionDivider} />
          <Pressable
            style={styles.cardAction}
            onPress={onSchedule}
            accessibilityRole="button"
            accessibilityLabel={`Schedule call with ${title}`}>
            <Icon name="calendar-outline" size={16} color="#0f172a" />
            <Text style={styles.cardActionText}>Schedule call</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#eef3ff',
  },
  toolbar: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  toolbarHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  backButton: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    marginLeft: -8,
    width: 36,
  },
  toolbarTitle: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '800',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  tabButton: {
    borderBottomColor: 'transparent',
    borderBottomWidth: 3,
    paddingBottom: 10,
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  tabLabel: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingBottom: 32,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  countText: {
    color: '#475569',
    fontSize: 14,
    marginBottom: 10,
  },
  searchWrap: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#dbe2ea',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  searchInput: {
    color: '#0f172a',
    flex: 1,
    fontSize: 14,
    paddingVertical: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    width: '100%',
  },
  cardTop: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 16,
  },
  typePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#f1f5f9',
    borderRadius: 999,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  typePillText: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  avatar: {
    borderRadius: 999,
    height: 76,
    marginBottom: 10,
    width: 76,
  },
  avatarFallback: {
    alignItems: 'center',
    borderRadius: 999,
    height: 76,
    justifyContent: 'center',
    marginBottom: 10,
    width: 76,
  },
  avatarInitials: {
    fontSize: 28,
    fontWeight: '800',
  },
  cardTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  cardSubtitle: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  cardActions: {
    alignItems: 'center',
    borderTopColor: '#e2e8f0',
    borderTopWidth: 1,
    flexDirection: 'row',
  },
  cardAction: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  cardActionDivider: {
    backgroundColor: '#e2e8f0',
    height: '60%',
    width: 1,
  },
  cardActionText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
  },
  centered: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  loadingText: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 10,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 36,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
  },
  errorCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#fecaca',
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  errorTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 10,
  },
  errorBody: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    textAlign: 'center',
  },
  retryButton: {
    borderRadius: 10,
    marginTop: 14,
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  retryText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
});
