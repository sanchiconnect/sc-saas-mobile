import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
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

type StartupItem = {
  uuid: string;
  companyName: string;
  companyLogo: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  isLiveDeal?: boolean;
  user?: {
    name?: string;
    avatar?: string | null;
  } | null;
  startupIndustries?: string[];
  startupTechnologies?: string[];
  startupIndustryPrimary?: {name?: string} | null;
  productInformation?: {productStage?: {name?: string} | null} | null;
  financials?: {fundingStage?: {name?: string} | null} | null;
};

type StartupsScreenProps = {
  token: string;
  userId?: string | number | null;
  primaryColor: string;
  logoBaseUrl?: string | null;
  onBack?: () => void;
};

type SavedProfileItem = {
  uuid: string;
  companyName: string;
  companyUUID: string;
  avatar?: string | null;
  otherUserAccountType?: string | null;
  otherUser?: {
    name?: string;
    avatar?: string | null;
    accountType?: string | null;
  } | null;
};

type SortOption = {
  key: string;
  label: string;
  sortBy: string;
  orderBy: 'ASC' | 'DESC';
};

const SORT_OPTIONS: SortOption[] = [
  {key: 'trending', label: 'Trending', sortBy: 'priority', orderBy: 'ASC'},
  {
    key: 'newly-added',
    label: 'Newly Added',
    sortBy: 'recently-added',
    orderBy: 'DESC',
  },
  {
    key: 'most-viewed',
    label: 'Most Viewed',
    sortBy: 'most-viewed',
    orderBy: 'DESC',
  },
];

const PAGE_SIZE_HINT = 8;

const resolveAssetUri = (
  assetPath: string | null | undefined,
  logoBaseUrl?: string | null,
) => {
  if (!assetPath) {
    return null;
  }
  if (/^https?:\/\//i.test(assetPath)) {
    return assetPath;
  }
  if (!logoBaseUrl) {
    return null;
  }
  return `${logoBaseUrl.replace(/\/$/, '')}/${assetPath.replace(/^\//, '')}`;
};

const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0]?.toUpperCase() || '')
    .join('') || 'S';

const formatLocation = (item: StartupItem) => {
  const parts = [item.city, item.state, item.country].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
};

export function StartupsScreen({
  token,
  userId,
  primaryColor,
  logoBaseUrl,
  onBack,
}: StartupsScreenProps) {
  const [items, setItems] = useState<StartupItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [sortKey, setSortKey] = useState<string>(SORT_OPTIONS[0].key);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);
  const [savedModalOpen, setSavedModalOpen] = useState(false);
  const [savedItems, setSavedItems] = useState<SavedProfileItem[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedError, setSavedError] = useState<string | null>(null);

  const openSavedProfiles = async () => {
    setSavedModalOpen(true);
    if (!userId) {
      setSavedError('Cannot load saved profiles — no user id.');
      return;
    }
    setSavedLoading(true);
    setSavedError(null);
    try {
      const response = await authService.getWishlist(token, userId);
      const list: SavedProfileItem[] = Array.isArray(response?.data)
        ? response.data
        : [];
      const seen = new Set<string>();
      const deduped: SavedProfileItem[] = [];
      for (const entry of list) {
        const key = entry.companyUUID || entry.uuid;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        deduped.push(entry);
      }
      setSavedItems(deduped);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not load saved profiles.';
      setSavedError(message);
      setSavedItems([]);
    } finally {
      setSavedLoading(false);
    }
  };

  const loadPage = useCallback(
    async (
      pageNumber: number,
      keyword: string,
      sortKeyToUse: string,
      append: boolean,
    ) => {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
        setErrorMessage(null);
      }
      const sortOption =
        SORT_OPTIONS.find(option => option.key === sortKeyToUse) ||
        SORT_OPTIONS[0];
      try {
        const response = await authService.searchStartups(token, {
          pageNumber,
          sortBy: sortOption.sortBy,
          orderBy: sortOption.orderBy,
          partnerId: null,
          keyword,
        });
        console.log(
          '[Startups] response keys:',
          response ? Object.keys(response) : null,
          'items count:',
          Array.isArray(response?.data?.items)
            ? response.data.items.length
            : 'not an array',
        );
        const list: StartupItem[] = Array.isArray(response?.data?.items)
          ? response.data.items
          : [];
        const meta = response?.data?.meta || {};
        setItems(prev => (append ? [...prev, ...list] : list));
        setPage(Number(meta.currentPage) || pageNumber);
        setTotalPages(Number(meta.totalPages) || 1);
        setTotalItems(Number(meta.totalItems) || list.length);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Could not load startups right now.';
        console.warn('[Startups] load failed:', message);
        if (!append) {
          setErrorMessage(message);
          setItems([]);
          setTotalPages(1);
          setTotalItems(0);
        } else {
          Alert.alert('Could not load more', message);
        }
      } finally {
        if (append) {
          setIsLoadingMore(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    [token],
  );

  useEffect(() => {
    loadPage(1, '', SORT_OPTIONS[0].key, false);
  }, [loadPage]);

  const handleSubmitSearch = () => {
    setAppliedSearch(searchText);
    loadPage(1, searchText, sortKey, false);
  };

  const handleClearSearch = () => {
    setSearchText('');
    if (appliedSearch) {
      setAppliedSearch('');
      loadPage(1, '', sortKey, false);
    }
  };

  const handleSelectSort = (nextKey: string) => {
    if (nextKey === sortKey) {
      return;
    }
    setSortKey(nextKey);
    loadPage(1, appliedSearch, nextKey, false);
  };

  const handleLoadMore = () => {
    if (isLoadingMore || page >= totalPages) {
      return;
    }
    loadPage(page + 1, appliedSearch, sortKey, true);
  };

  const hasMore = page < totalPages;

  const headerMeta = useMemo(() => {
    if (!totalItems) {
      return 'No startups found';
    }
    return `Showing ${items.length} of ${totalItems}`;
  }, [items.length, totalItems]);

  if (selectedUuid) {
    return (
      <StartupDetailScreen
        token={token}
        uuid={selectedUuid}
        primaryColor={primaryColor}
        logoBaseUrl={logoBaseUrl}
        onBack={() => setSelectedUuid(null)}
      />
    );
  }

  if (isLoading && items.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={primaryColor} />
        <Text style={styles.loadingText}>Loading startups...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
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
          <Text style={styles.toolbarTitle}>Startups</Text>
        </View>

        <View style={styles.searchWrap}>
          <Icon name="magnify" size={18} color="#64748b" />
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={handleSubmitSearch}
            placeholder="Search for startups"
            placeholderTextColor="#94a3b8"
            returnKeyType="search"
            style={styles.searchInput}
          />
          {searchText ? (
            <Pressable onPress={handleClearSearch}>
              <Icon name="close" size={18} color="#64748b" />
            </Pressable>
          ) : null}
        </View>

        <Pressable
          style={[styles.savedProfilesButton, {borderColor: primaryColor}]}
          onPress={openSavedProfiles}
          accessibilityRole="button"
          accessibilityLabel="View saved profiles">
          <Icon name="bookmark" size={16} color={primaryColor} />
          <Text style={[styles.savedProfilesText, {color: primaryColor}]}>
            SAVED PROFILES
          </Text>
        </Pressable>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sortRow}>
          {SORT_OPTIONS.map(option => {
            const isActive = option.key === sortKey;
            return (
              <Pressable
                key={option.key}
                onPress={() => handleSelectSort(option.key)}
                style={[
                  styles.sortPill,
                  isActive && {
                    backgroundColor: primaryColor,
                    borderColor: primaryColor,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Sort by ${option.label}`}>
                <Text
                  style={[
                    styles.sortPillText,
                    isActive && styles.sortPillTextActive,
                  ]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.metaText}>{headerMeta}</Text>
      </View>

      <View style={styles.gridList}>
        {items.map(item => (
          <StartupCard
            key={item.uuid}
            item={item}
            logoBaseUrl={logoBaseUrl}
            primaryColor={primaryColor}
            onPress={() => setSelectedUuid(item.uuid)}
          />
        ))}
      </View>

      {errorMessage ? (
        <View style={styles.errorCard}>
          <Icon name="alert-circle-outline" size={42} color="#dc2626" />
          <Text style={styles.errorTitle}>Could not load startups</Text>
          <Text style={styles.errorBody}>{errorMessage}</Text>
          <Pressable
            style={[styles.retryButton, {backgroundColor: primaryColor}]}
            onPress={() => loadPage(1, appliedSearch, sortKey, false)}
            accessibilityRole="button"
            accessibilityLabel="Retry">
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {!errorMessage && items.length === 0 && !isLoading ? (
        <View style={styles.emptyCard}>
          <Icon name="alert-circle-outline" size={42} color="#94a3b8" />
          <Text style={styles.emptyText}>No startups found</Text>
        </View>
      ) : null}

      {hasMore ? (
        <Pressable
          style={[styles.loadMoreButton, {borderColor: primaryColor}]}
          onPress={handleLoadMore}
          disabled={isLoadingMore}
          accessibilityRole="button"
          accessibilityLabel="Load more startups">
          {isLoadingMore ? (
            <ActivityIndicator size="small" color={primaryColor} />
          ) : (
            <Text style={[styles.loadMoreText, {color: primaryColor}]}>
              Load more
            </Text>
          )}
        </Pressable>
      ) : items.length > PAGE_SIZE_HINT ? (
        <Text style={styles.endText}>You've reached the end</Text>
      ) : null}

      <Modal
        visible={savedModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setSavedModalOpen(false)}>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSavedModalOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Saved Profiles</Text>
              <Pressable
                style={styles.modalCloseButton}
                onPress={() => setSavedModalOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Close saved profiles">
                <Icon name="close" size={22} color="#0f172a" />
              </Pressable>
            </View>

            {savedLoading ? (
              <View style={styles.savedEmpty}>
                <ActivityIndicator size="large" color={primaryColor} />
                <Text style={styles.savedEmptyText}>Loading saved profiles…</Text>
              </View>
            ) : savedError ? (
              <Text style={styles.savedError}>{savedError}</Text>
            ) : savedItems.length === 0 ? (
              <View style={styles.savedEmpty}>
                <Icon name="bookmark-outline" size={36} color="#94a3b8" />
                <Text style={styles.savedEmptyText}>No saved profiles yet.</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.savedGrid}>
                  {savedItems.map(item => (
                    <SavedProfileCard
                      key={item.uuid}
                      item={item}
                      primaryColor={primaryColor}
                      logoBaseUrl={logoBaseUrl}
                      onPress={() => {
                        setSavedModalOpen(false);
                        setSelectedUuid(item.companyUUID);
                      }}
                    />
                  ))}
                </View>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

function SavedProfileCard({
  item,
  primaryColor,
  logoBaseUrl,
  onPress,
}: {
  item: SavedProfileItem;
  primaryColor: string;
  logoBaseUrl?: string | null;
  onPress: () => void;
}) {
  const avatarPath = item.otherUser?.avatar || item.avatar || null;
  const avatarUri = resolveAssetUri(avatarPath, logoBaseUrl);
  const initials = getInitials(item.companyName || item.otherUser?.name || 'S');
  const accountType = (
    item.otherUserAccountType ||
    item.otherUser?.accountType ||
    ''
  )
    .toString()
    .toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      style={styles.savedCard}
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.companyName}`}>
      {accountType ? (
        <View style={styles.savedTypePill}>
          <Text style={styles.savedTypePillText}>{accountType}</Text>
        </View>
      ) : null}
      {avatarUri ? (
        <Image source={{uri: avatarUri}} style={styles.savedAvatar} />
      ) : (
        <View
          style={[
            styles.savedAvatarFallback,
            {backgroundColor: `${primaryColor}1A`},
          ]}>
          <Text style={[styles.savedAvatarInitials, {color: primaryColor}]}>
            {initials}
          </Text>
        </View>
      )}
      <Text style={styles.savedCompanyName} numberOfLines={1}>
        {item.companyName}
      </Text>
      {item.otherUser?.name ? (
        <Text style={styles.savedUserName} numberOfLines={1}>
          {item.otherUser.name}
        </Text>
      ) : null}
    </Pressable>
  );
}

function StartupCard({
  item,
  logoBaseUrl,
  primaryColor,
  onPress,
}: {
  item: StartupItem;
  logoBaseUrl?: string | null;
  primaryColor: string;
  onPress?: () => void;
}) {
  const logoUri = resolveAssetUri(item.companyLogo, logoBaseUrl);
  const location = formatLocation(item);
  const primaryIndustry =
    item.startupIndustryPrimary?.name ||
    item.startupIndustries?.[0] ||
    null;
  const technologies = item.startupTechnologies || [];
  const remainingTech = technologies.length > 1 ? technologies.length - 1 : 0;
  const productStage = item.productInformation?.productStage?.name;
  const fundingStage = item.financials?.fundingStage?.name;

  return (
    <Pressable
      onPress={onPress}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`View ${item.companyName}`}>
      <View style={styles.cardMedia}>
        {logoUri ? (
          <Image source={{uri: logoUri}} style={styles.cardLogo} />
        ) : (
          <View style={[styles.cardLogoFallback, {backgroundColor: primaryColor}]}>
            <Text style={styles.cardLogoInitials}>
              {getInitials(item.companyName)}
            </Text>
          </View>
        )}
        <View style={styles.cardNameOverlay}>
          <Text style={styles.cardName} numberOfLines={1}>
            {item.companyName}
          </Text>
          {location ? (
            <Text style={styles.cardLocation} numberOfLines={1}>
              {location}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.tagRow}>
          {productStage ? (
            <View style={styles.tag}>
              <Text style={styles.tagText} numberOfLines={1}>
                {productStage}
              </Text>
            </View>
          ) : null}
          {primaryIndustry ? (
            <View style={styles.tag}>
              <Text style={styles.tagText} numberOfLines={1}>
                {primaryIndustry}
              </Text>
            </View>
          ) : null}
          {!productStage && !primaryIndustry ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>N/A</Text>
            </View>
          ) : null}
        </View>

        {technologies.length ? (
          <View style={styles.tagRow}>
            <View style={styles.tag}>
              <Text style={styles.tagText} numberOfLines={1}>
                {technologies[0]}
              </Text>
            </View>
            {remainingTech > 0 ? (
              <View style={styles.tag}>
                <Text style={styles.tagText}>+{remainingTech}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {fundingStage ? (
          <Text style={styles.fundingText} numberOfLines={1}>
            {fundingStage}
          </Text>
        ) : null}

        {item.isLiveDeal ? (
          <View style={[styles.liveDealBadge, {backgroundColor: primaryColor}]}>
            <Icon name="check-decagram" size={12} color="#ffffff" />
            <Text style={styles.liveDealText}>Live Deal</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#eef3ff',
  },
  content: {
    paddingBottom: 32,
  },
  centered: {
    alignItems: 'center',
    backgroundColor: '#eef3ff',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#64748b',
    fontSize: 15,
    marginTop: 12,
  },
  toolbar: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  toolbarHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginBottom: 12,
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
    fontSize: 24,
    fontWeight: '800',
  },
  searchWrap: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: '#dbe2ea',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
  },
  searchInput: {
    color: '#0f172a',
    flex: 1,
    fontSize: 14,
    paddingVertical: 12,
  },
  savedProfilesButton: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 999,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  savedProfilesText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  modalOverlay: {
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    flex: 1,
    justifyContent: 'flex-start',
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  modalHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '800',
  },
  modalCloseButton: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  savedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'flex-start',
  },
  savedCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 16,
    width: '47.5%',
  },
  savedTypePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#f1f5f9',
    borderRadius: 999,
    marginBottom: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  savedTypePillText: {
    color: '#475569',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  savedAvatar: {
    borderRadius: 999,
    height: 72,
    marginBottom: 10,
    width: 72,
  },
  savedAvatarFallback: {
    alignItems: 'center',
    borderRadius: 999,
    height: 72,
    justifyContent: 'center',
    marginBottom: 10,
    width: 72,
  },
  savedAvatarInitials: {
    fontSize: 26,
    fontWeight: '800',
  },
  savedCompanyName: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  savedUserName: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  savedEmpty: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  savedEmptyText: {
    color: '#64748b',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  savedError: {
    color: '#b91c1c',
    fontSize: 13,
    paddingVertical: 16,
    textAlign: 'center',
  },
  sortRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingRight: 8,
  },
  sortPill: {
    backgroundColor: '#ffffff',
    borderColor: '#dbe2ea',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sortPillText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
  },
  sortPillTextActive: {
    color: '#ffffff',
  },
  metaText: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 10,
  },
  gridList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    rowGap: 14,
  },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    width: '48.5%',
  },
  cardMedia: {
    backgroundColor: '#f1f5f9',
    height: 130,
    justifyContent: 'flex-end',
    position: 'relative',
  },
  cardLogo: {
    height: '100%',
    resizeMode: 'cover',
    width: '100%',
  },
  cardLogoFallback: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
  cardLogoInitials: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
  },
  cardNameOverlay: {
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  cardName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  cardLocation: {
    color: '#cbd5e1',
    fontSize: 11,
    marginTop: 2,
  },
  cardBody: {
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: '100%',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '600',
  },
  fundingText: {
    color: '#64748b',
    fontSize: 11,
    fontStyle: 'italic',
  },
  liveDealBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  liveDealText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  errorCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#fecaca',
    borderRadius: 18,
    borderWidth: 1,
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  errorTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 12,
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
  emptyText: {
    color: '#64748b',
    fontSize: 15,
    marginTop: 12,
    textAlign: 'center',
  },
  loadMoreButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    marginTop: 18,
    paddingVertical: 14,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '800',
  },
  endText: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 18,
    textAlign: 'center',
  },
});
