import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {Icon} from '../../../core/components/Icon';
import {colors, withAlpha} from '../../../core/theme/colors';
import {useToast} from '../../../core/toast/ToastProvider';
import {connectService} from '../services/connect.service';
import {DirectoryCard} from '../components/DirectoryCard';
import {ConnectFilterSheet} from '../components/ConnectFilterSheet';
import {ConnectProfileScreen} from './ConnectProfileScreen';
import type {
  ConnectRoleKey,
  DirectorySort,
  DirectoryUser,
  FilterGroup,
  FilterSelection,
  InvestorType,
} from '../types';

type RoleTab = {key: ConnectRoleKey; label: string};

type Props = {
  token: string;
  roles: RoleTab[];
  initialRoleKey?: ConnectRoleKey;
  primaryColor: string;
  logoBaseUrl?: string;
  onActiveProfileChange?: (active: boolean) => void;
  isApproved?: boolean;
  currentUserId?: string;
};

const SORTS: DirectorySort[] = [
  {key: 'trending', label: 'Trending', sortBy: 'priority', orderBy: 'ASC'},
  {key: 'newest', label: 'Newest', sortBy: 'createdAt', orderBy: 'DESC'},
  {key: 'name', label: 'Name (A–Z)', sortBy: 'name', orderBy: 'ASC'},
];

const SEARCH_DEBOUNCE_MS = 400;

const countFilters = (sel: FilterSelection): number =>
  Object.values(sel).reduce((sum, vals) => sum + (vals?.length || 0), 0);

// The Connect directory: role tabs across the top, then a search + filter +
// sort toolbar, then a two-column card grid backed by the public-search
// endpoint. A "Saved" toggle swaps the grid for the user's wishlist.
export function ConnectDirectoryScreen({
  token,
  roles,
  initialRoleKey,
  primaryColor,
  logoBaseUrl,
  onActiveProfileChange,
  isApproved,
  currentUserId,
}: Props) {
  useToast(); // keep provider happy; no wishlist toasts needed currently

  const [roleKey, setRoleKey] = useState<ConnectRoleKey>(
    initialRoleKey && roles.some(r => r.key === initialRoleKey)
      ? initialRoleKey
      : roles[0]?.key,
  );
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<DirectorySort>(SORTS[0]);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [investorType, setInvestorType] =
    useState<InvestorType>('organization');
  const [filters, setFilters] = useState<FilterSelection>({});

  const [items, setItems] = useState<DirectoryUser[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter sheet + its option groups (loaded once, lazily).
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterGroups, setFilterGroups] = useState<FilterGroup[]>([]);
  const [filterGroupsLoaded, setFilterGroupsLoaded] = useState(false);
  const [filterGroupsLoading, setFilterGroupsLoading] = useState(false);

  // The profile-detail overlay; non-null replaces the list with the detail view.
  const [activeProfile, setActiveProfile] = useState<DirectoryUser | null>(null);

  const filterCount = countFilters(filters);

  // Debounce the search box into the committed `search` value.
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    if (initialRoleKey && roles.some(r => r.key === initialRoleKey)) {
      setRoleKey(initialRoleKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRoleKey]);

  const openProfile = useCallback(
    (item: DirectoryUser) => {
      setActiveProfile(item);
      onActiveProfileChange?.(true);
    },
    [onActiveProfileChange],
  );

  const closeProfile = useCallback(() => {
    setActiveProfile(null);
    onActiveProfileChange?.(false);
  }, [onActiveProfileChange]);

  useEffect(() => {
    const onBack = () => {
      if (activeProfile) {
        closeProfile();
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [activeProfile, closeProfile]);

  const fetchPage = useCallback(
    async (targetPage: number, mode: 'replace' | 'append') => {
      try {
        const res = await connectService.searchUsers(token, roleKey, {
          page: targetPage,
          searchName: search,
          sortBy: sort.sortBy,
          orderBy: sort.orderBy,
          investorType: roleKey === 'investors' ? investorType : undefined,
          filters,
        });
        setItems(prev => {
          if (mode === 'replace') return res.items;
          const seen = new Set(prev.map(i => i.uuid));
          return [...prev, ...res.items.filter(i => !seen.has(i.uuid))];
        });
        setPage(res.meta.currentPage);
        setTotalPages(res.meta.totalPages);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Could not load this list.',
        );
      }
    },
    [token, roleKey, search, sort, investorType, filters],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setItems([]);
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
    if (isLoadingMore || page >= totalPages) return;
    setIsLoadingMore(true);
    await fetchPage(page + 1, 'append');
    setIsLoadingMore(false);
  };

  const openFilters = async () => {
    setFilterOpen(true);
    if (filterGroupsLoaded || filterGroupsLoading) return;
    setFilterGroupsLoading(true);
    try {
      const groups = await connectService.getFilterGroups(token);
      setFilterGroups(groups);
      setFilterGroupsLoaded(true);
    } catch {
      setFilterGroups([]);
    } finally {
      setFilterGroupsLoading(false);
    }
  };

  const investorToggle = roleKey === 'investors';

  const renderCard = useCallback(
    ({item}: {item: DirectoryUser}) => (
      <DirectoryCard
        user={item}
        primaryColor={primaryColor}
        logoBaseUrl={logoBaseUrl}
        onPress={() => openProfile(item)}
      />
    ),
    [primaryColor, logoBaseUrl, openProfile],
  );

  // Detail overlay takes over the whole section when a card is tapped.
  if (activeProfile) {
    return (
      <ConnectProfileScreen
        token={token}
        role={roleKey}
        user={activeProfile}
        primaryColor={primaryColor}
        logoBaseUrl={logoBaseUrl}
        onBack={closeProfile}
        isApproved={isApproved}
        currentUserId={currentUserId}
      />
    );
  }

  return (
    <View style={styles.page}>
      {/* Role tabs. */}
      <View style={styles.tabsSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}>
          {roles.map(tab => {
            const isActive = tab.key === roleKey;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setRoleKey(tab.key)}
                style={[
                  styles.tab,
                  isActive && {backgroundColor: primaryColor},
                ]}>
                <Text
                  style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Search row. */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Icon name="magnify" size={18} color={colors.textSubtle} />
          <TextInput
            style={styles.searchInput}
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="Search by name"
            placeholderTextColor={colors.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchInput ? (
            <Pressable onPress={() => setSearchInput('')} hitSlop={8}>
              <Icon name="close-circle" size={16} color={colors.textSubtle} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Toolbar: filter + sort. */}
      <View style={styles.toolbar}>
          <Pressable
            onPress={openFilters}
            style={[
              styles.toolbarBtn,
              filterCount > 0 && {
                backgroundColor: withAlpha(primaryColor, 0.1),
                borderColor: primaryColor,
              },
            ]}>
            <Icon
              name="filter-variant"
              size={16}
              color={filterCount > 0 ? primaryColor : colors.textMuted}
            />
            <Text
              style={[
                styles.toolbarBtnText,
                filterCount > 0 && {color: primaryColor},
              ]}>
              Filter{filterCount > 0 ? ` (${filterCount})` : ''}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setSortMenuOpen(true)}
            style={styles.toolbarBtn}>
            <Icon name="sort" size={16} color={colors.textMuted} />
            <Text style={styles.toolbarBtnText}>{sort.label}</Text>
            <Icon name="chevron-down" size={16} color={colors.textMuted} />
          </Pressable>
      </View>

      {/* Investor org/individual segmented toggle. */}
      {investorToggle ? (
        <View style={styles.segmentRow}>
          {(['organization', 'individual'] as InvestorType[]).map(t => {
            const isActive = investorType === t;
            return (
              <Pressable
                key={t}
                onPress={() => setInvestorType(t)}
                style={[
                  styles.segment,
                  isActive && {backgroundColor: primaryColor},
                ]}>
                <Text
                  style={[
                    styles.segmentText,
                    isActive && styles.segmentTextActive,
                  ]}>
                  {t === 'organization' ? 'Organizations' : 'Individuals'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBanner}>
          <Icon name="alert-circle-outline" size={16} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item, index) => item.uuid || String(index)}
          renderItem={renderCard}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={[
            styles.listContent,
            items.length === 0 && styles.emptyContent,
          ]}
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
                name="account-search-outline"
                size={42}
                color={colors.borderStrong}
              />
              <Text style={styles.emptyTitle}>No results</Text>
              <Text style={styles.emptyBody}>
                Try adjusting your search or filters.
              </Text>
            </View>
          }
        />
      )}

      {/* Sort menu. */}
      <Modal
        transparent
        visible={sortMenuOpen}
        animationType="fade"
        onRequestClose={() => setSortMenuOpen(false)}>
        <Pressable
          style={styles.sortBackdrop}
          onPress={() => setSortMenuOpen(false)}>
          <Pressable style={styles.sortSheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sortTitle}>Sort by</Text>
            {SORTS.map(opt => {
              const isActive = opt.key === sort.key;
              return (
                <Pressable
                  key={opt.key}
                  style={styles.sortItem}
                  onPress={() => {
                    setSort(opt);
                    setSortMenuOpen(false);
                  }}>
                  <Text
                    style={[
                      styles.sortItemText,
                      isActive && {color: primaryColor, fontWeight: '800'},
                    ]}>
                    {opt.label}
                  </Text>
                  {isActive ? (
                    <Icon name="check" size={18} color={primaryColor} />
                  ) : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      <ConnectFilterSheet
        visible={filterOpen}
        primaryColor={primaryColor}
        groups={filterGroups}
        isLoading={filterGroupsLoading}
        selection={filters}
        onClose={() => setFilterOpen(false)}
        onApply={next => {
          setFilters(next);
          setFilterOpen(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#eef3ff',
  },
  tabsSection: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  tabsRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: '#ffffff',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    padding: 0,
  },
  savedBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  toolbarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  toolbarBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  segmentTextActive: {
    color: '#ffffff',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.dangerSoftBorder,
  },
  errorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 13,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 12,
    gap: 12,
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  columnWrapper: {
    gap: 12,
  },
  footerLoading: {
    paddingVertical: 18,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    marginTop: 6,
  },
  emptyBody: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  sortBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.scrim,
  },
  sortSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 28,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: 12,
  },
  sortTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 6,
  },
  sortItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sortItemText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
  },
});
