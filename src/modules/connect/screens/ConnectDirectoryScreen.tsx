import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
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
  // Signed-in user's numeric id — the path param on GET api/v1/wishlist/{id}.
  wishlistOwnerId: string;
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
  wishlistOwnerId,
}: Props) {
  const toast = useToast();

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

  // Wishlist (saved profiles).
  const [savedUuids, setSavedUuids] = useState<Set<string>>(new Set());
  const [savedItems, setSavedItems] = useState<DirectoryUser[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [savingUuid, setSavingUuid] = useState<string | null>(null);

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

  // Reload from page 1 whenever the role, search, sort, investor type or
  // filters change. Skipped while the saved view is showing.
  useEffect(() => {
    if (showSaved) return;
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
  }, [fetchPage, showSaved]);

  // Load the wishlist once on mount so cards can show their saved state, and
  // refresh it whenever the saved view is opened.
  const loadWishlist = useCallback(async () => {
    if (!wishlistOwnerId) return;
    try {
      const {savedUuids: ids, items: saved} = await connectService.getWishlist(
        token,
        wishlistOwnerId,
      );
      setSavedUuids(ids);
      setSavedItems(saved);
    } catch {
      // Non-fatal — directory still works without saved state.
    }
  }, [token, wishlistOwnerId]);

  useEffect(() => {
    loadWishlist();
  }, [loadWishlist]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (showSaved) {
      await loadWishlist();
    } else {
      await Promise.all([fetchPage(1, 'replace'), loadWishlist()]);
    }
    setIsRefreshing(false);
  };

  const handleEndReached = async () => {
    if (showSaved || isLoadingMore || page >= totalPages) return;
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

  // Optimistic save/unsave with rollback on failure.
  const toggleSave = useCallback(
    async (user: DirectoryUser) => {
      if (!user.uuid || savingUuid) return;
      const wasSaved = savedUuids.has(user.uuid);
      setSavingUuid(user.uuid);
      setSavedUuids(prev => {
        const next = new Set(prev);
        if (wasSaved) next.delete(user.uuid);
        else next.add(user.uuid);
        return next;
      });
      try {
        if (wasSaved) {
          await connectService.removeFromWishlist(token, user);
          setSavedItems(prev => prev.filter(i => i.uuid !== user.uuid));
        } else {
          await connectService.addToWishlist(token, user);
          setSavedItems(prev =>
            prev.some(i => i.uuid === user.uuid) ? prev : [user, ...prev],
          );
        }
      } catch (err) {
        // Roll back the optimistic toggle.
        setSavedUuids(prev => {
          const next = new Set(prev);
          if (wasSaved) next.add(user.uuid);
          else next.delete(user.uuid);
          return next;
        });
        toast.error(
          err instanceof Error ? err.message : 'Could not update saved list.',
        );
      } finally {
        setSavingUuid(null);
      }
    },
    [token, savedUuids, savingUuid, toast],
  );

  const data = showSaved ? savedItems : items;
  const investorToggle = roleKey === 'investors';

  const renderCard = useCallback(
    ({item}: {item: DirectoryUser}) => (
      <DirectoryCard
        user={item}
        primaryColor={primaryColor}
        logoBaseUrl={logoBaseUrl}
        isSaved={savedUuids.has(item.uuid)}
        isSaving={savingUuid === item.uuid}
        onPress={() => setActiveProfile(item)}
        onToggleSave={() => toggleSave(item)}
      />
    ),
    [primaryColor, logoBaseUrl, savedUuids, savingUuid, toggleSave],
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
        isSaved={savedUuids.has(activeProfile.uuid)}
        onToggleSave={() => toggleSave(activeProfile)}
        onBack={() => setActiveProfile(null)}
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
            const isActive = tab.key === roleKey && !showSaved;
            return (
              <Pressable
                key={tab.key}
                onPress={() => {
                  setShowSaved(false);
                  setRoleKey(tab.key);
                }}
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

      {/* Search + saved toggle. */}
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
        <Pressable
          onPress={() => setShowSaved(s => !s)}
          style={[
            styles.savedBtn,
            showSaved && {
              backgroundColor: withAlpha(primaryColor, 0.12),
              borderColor: primaryColor,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Saved profiles">
          <Icon
            name={showSaved ? 'bookmark' : 'bookmark-outline'}
            size={20}
            color={showSaved ? primaryColor : colors.textMuted}
          />
        </Pressable>
      </View>

      {/* Toolbar: filter + sort (hidden in saved view). */}
      {!showSaved ? (
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
      ) : null}

      {/* Investor org/individual segmented toggle. */}
      {investorToggle && !showSaved ? (
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

      {error && !showSaved ? (
        <View style={styles.errorBanner}>
          <Icon name="alert-circle-outline" size={16} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {isLoading && !showSaved ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item, index) => item.uuid || String(index)}
          renderItem={renderCard}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={[
            styles.listContent,
            data.length === 0 && styles.emptyContent,
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
                name={showSaved ? 'bookmark-outline' : 'account-search-outline'}
                size={42}
                color={colors.borderStrong}
              />
              <Text style={styles.emptyTitle}>
                {showSaved ? 'No saved profiles yet' : 'No results'}
              </Text>
              <Text style={styles.emptyBody}>
                {showSaved
                  ? 'Tap the bookmark on any profile to save it here.'
                  : 'Try adjusting your search or filters.'}
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
