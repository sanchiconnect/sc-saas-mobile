import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {Icon} from '../../../core/components/Icon';
import {spacing, typography} from '../../../core/theme/colors';
import {CommunityPostCard} from './CommunityPostCard';
import type {CommunityPost, CommunityPostsResponse} from '../types';

type Props = {
  primaryColor: string;
  logoBaseUrl?: string;
  // Fetches one page of posts. Must be stable (memoised) — a new identity
  // triggers a reload from the top.
  fetchPage: (page: number) => Promise<CommunityPostsResponse>;
  // Bump to force a reload from the top (e.g. after creating a post).
  reloadKey?: number;
  ListHeaderComponent?: React.ReactElement | null;
  emptyIcon?: string;
  emptyTitle?: string;
  emptySubtitle?: string;
};

// Paginated, pull-to-refresh, infinite-scroll list of community posts. The
// data source is injected via `fetchPage`, so the same list renders the main
// feed and every filtered ("My Posts", "My Polls", …) view.
export function CommunityPostsList({
  primaryColor,
  logoBaseUrl,
  fetchPage,
  reloadKey = 0,
  ListHeaderComponent,
  emptyIcon = 'account-group-outline',
  emptyTitle = 'No posts yet',
  emptySubtitle = 'Community posts will appear here.',
}: Props) {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(
    async (targetPage: number, mode: 'initial' | 'refresh' | 'more') => {
      if (mode === 'initial') setIsLoading(true);
      if (mode === 'refresh') setIsRefreshing(true);
      if (mode === 'more') setIsLoadingMore(true);
      setError(null);
      try {
        const res = await fetchPage(targetPage);
        const items = res?.data?.items ?? [];
        const meta = res?.data?.meta;
        setTotalPages(meta?.totalPages ?? 1);
        setPage(meta?.currentPage ?? targetPage);
        setPosts(prev => (mode === 'more' ? [...prev, ...items] : items));
      } catch (e: any) {
        setError(e?.message || 'Unable to load community posts.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    [fetchPage],
  );

  // Initial load + reload whenever the data source or reloadKey changes.
  useEffect(() => {
    loadPage(1, 'initial');
  }, [loadPage, reloadKey]);

  const handleRefresh = useCallback(() => {
    loadPage(1, 'refresh');
  }, [loadPage]);

  const handleEndReached = useCallback(() => {
    if (isLoadingMore || isLoading || isRefreshing) return;
    if (page >= totalPages) return;
    loadPage(page + 1, 'more');
  }, [isLoadingMore, isLoading, isRefreshing, page, totalPages, loadPage]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  if (error && posts.length === 0) {
    return (
      <View style={styles.centered}>
        <Icon name="alert-circle-outline" size={40} color="#94a3b8" />
        <Text style={styles.emptyTitle}>Couldn’t load posts</Text>
        <Text style={styles.emptySubtitle}>{error}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={posts}
      keyExtractor={item => item.uuid}
      renderItem={({item}) => (
        <CommunityPostCard post={item} logoBaseUrl={logoBaseUrl} />
      )}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={ListHeaderComponent}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          colors={[primaryColor]}
        />
      }
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.4}
      ListEmptyComponent={
        <View style={styles.centered}>
          <Icon name={emptyIcon} size={40} color="#94a3b8" />
          <Text style={styles.emptyTitle}>{emptyTitle}</Text>
          <Text style={styles.emptySubtitle}>{emptySubtitle}</Text>
        </View>
      }
      ListFooterComponent={
        isLoadingMore ? (
          <View style={styles.footerLoader}>
            <ActivityIndicator color={primaryColor} />
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    flexGrow: 1,
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxxl,
  },
  emptyTitle: {
    color: '#0f172a',
    fontSize: typography.subhead,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  emptySubtitle: {
    color: '#64748b',
    fontSize: typography.body,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  footerLoader: {
    paddingVertical: spacing.lg,
  },
});
