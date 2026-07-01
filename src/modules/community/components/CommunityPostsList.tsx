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
  // Auth token — forwarded to each card so users can post comments.
  token: string;
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
  // Whether the signed-in user is approved to comment / react / share.
  // Forwarded to each card; defaults to true.
  canInteract?: boolean;
  // Called after a reaction is toggled on any card, so the parent can refresh
  // wall stats.
  onReacted?: () => void;
  // Logged-in user's uuid — forwarded to each card so authors get the
  // Edit / Delete menu on their own posts.
  currentUserUuid?: string;
  // Called after a post is deleted, so the parent can refresh wall stats.
  onPostDeleted?: () => void;
  // Called when a user's name/avatar is tapped, to show their posts.
  onUserPress?: (userUuid: string, userName: string) => void;
};

// Paginated, pull-to-refresh, infinite-scroll list of community posts. The
// data source is injected via `fetchPage`, so the same list renders the main
// feed and every filtered ("My Posts", "My Polls", …) view.
export function CommunityPostsList({
  token,
  primaryColor,
  logoBaseUrl,
  fetchPage,
  reloadKey = 0,
  ListHeaderComponent,
  emptyIcon = 'account-group-outline',
  emptyTitle = 'No posts yet',
  emptySubtitle = 'Community posts will appear here.',
  canInteract = true,
  onReacted,
  currentUserUuid,
  onPostDeleted,
  onUserPress,
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
        setPosts(prev => {
          if (mode !== 'more') return items;
          // Dedupe by uuid: as new posts arrive the feed shifts, so a later
          // page can re-return a post already on screen. Appending it blindly
          // produces duplicate React keys.
          const seen = new Set(prev.map(p => p.uuid));
          return [...prev, ...items.filter(p => !seen.has(p.uuid))];
        });
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

  // Drop a deleted post from the list immediately and let the parent refresh
  // wall stats (the "My Posts" / "My Polls" tallies).
  const handleDeleted = useCallback(
    (uuid: string) => {
      setPosts(prev => prev.filter(p => p.uuid !== uuid));
      onPostDeleted?.();
    },
    [onPostDeleted],
  );

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
        <CommunityPostCard
          post={item}
          token={token}
          logoBaseUrl={logoBaseUrl}
          canInteract={canInteract}
          onReacted={onReacted}
          currentUserUuid={currentUserUuid}
          onDeleted={handleDeleted}
          onUserPress={onUserPress}
        />
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
