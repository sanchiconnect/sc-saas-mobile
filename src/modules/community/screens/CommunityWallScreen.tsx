import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {Icon} from '../../../core/components/Icon';
import {spacing, typography} from '../../../core/theme/colors';
import {CommunityPostsList} from '../components/CommunityPostsList';
import {WallStatsCard, type WallStatType} from '../components/WallStatsCard';
import {communityService} from '../services/community.service';
import type {CommunityPostsResponse, WallStats} from '../types';

type Props = {
  token: string;
  primaryColor: string;
  // Logged-in user's uuid — used to fetch their own posts ("My Posts").
  userUuid: string;
  // Tenant imgKit base, used to resolve relative avatar / image paths.
  logoBaseUrl?: string;
  // Bumped by the parent after a new post is created to force a reload.
  refreshKey?: number;
};

// Title + empty-state copy for each filtered stat list.
const FILTER_META: Record<
  WallStatType,
  {title: string; emptyIcon: string; emptyTitle: string; emptySubtitle: string}
> = {
  posts: {
    title: 'My Posts',
    emptyIcon: 'square-edit-outline',
    emptyTitle: 'No posts yet',
    emptySubtitle: 'Posts you create appear here.',
  },
  comments: {
    title: 'My Commented Posts',
    emptyIcon: 'comment-outline',
    emptyTitle: 'No commented posts',
    emptySubtitle: 'Posts you comment on appear here.',
  },
  polls: {
    title: 'My Polls',
    emptyIcon: 'poll',
    emptyTitle: 'No polls yet',
    emptySubtitle: 'Posts with your polls appear here.',
  },
  reactions: {
    title: 'My Reacted Posts',
    emptyIcon: 'thumb-up-outline',
    emptyTitle: 'No reacted posts',
    emptySubtitle: 'Posts you react to appear here.',
  },
};

export function CommunityWallScreen({
  token,
  primaryColor,
  userUuid,
  logoBaseUrl,
  refreshKey = 0,
}: Props) {
  const [stats, setStats] = useState<WallStats | null>(null);
  const [activeFilter, setActiveFilter] = useState<WallStatType | null>(null);

  // Stats reflect the whole wall, not a page — load on mount and after a new
  // post. A failed stats fetch shouldn't break the feed.
  useEffect(() => {
    let cancelled = false;
    communityService
      .getMyStats(token)
      .then(res => {
        if (!cancelled) setStats(res?.data ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token, refreshKey]);

  // Stable fetcher for the main feed (reloads only when token/refreshKey move).
  const fetchFeed = useCallback(
    (page: number): Promise<CommunityPostsResponse> =>
      communityService.listPosts(token, {page}),
    [token],
  );

  // Stable fetcher for the active filtered list.
  const fetchFiltered = useCallback(
    (page: number): Promise<CommunityPostsResponse> => {
      switch (activeFilter) {
        case 'posts':
          return communityService.listUserPosts(token, userUuid, {page});
        case 'comments':
          return communityService.listMyComments(token, {page});
        case 'polls':
          return communityService.listMyPolls(token, {page});
        case 'reactions':
          return communityService.listMyReactions(token, {page});
        default:
          return communityService.listPosts(token, {page});
      }
    },
    [activeFilter, token, userUuid],
  );

  const statsHeader = useMemo(
    () =>
      stats ? (
        <WallStatsCard stats={stats} onSelectStat={setActiveFilter} />
      ) : null,
    [stats],
  );

  if (activeFilter) {
    const meta = FILTER_META[activeFilter];
    return (
      <View style={styles.flex}>
        <View style={styles.filterHeader}>
          <Pressable
            style={({pressed}) => [pressed && styles.backPressed]}
            hitSlop={10}
            onPress={() => setActiveFilter(null)}
            accessibilityRole="button"
            accessibilityLabel="Back to community wall">
            <Icon name="arrow-left" size={22} color="#475569" />
          </Pressable>
          <Text style={styles.filterTitle}>{meta.title}</Text>
        </View>
        <CommunityPostsList
          key={activeFilter}
          token={token}
          primaryColor={primaryColor}
          logoBaseUrl={logoBaseUrl}
          fetchPage={fetchFiltered}
          emptyIcon={meta.emptyIcon}
          emptyTitle={meta.emptyTitle}
          emptySubtitle={meta.emptySubtitle}
        />
      </View>
    );
  }

  return (
    <CommunityPostsList
      key="feed"
      token={token}
      primaryColor={primaryColor}
      logoBaseUrl={logoBaseUrl}
      fetchPage={fetchFeed}
      reloadKey={refreshKey}
      ListHeaderComponent={statsHeader}
    />
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  filterHeader: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backPressed: {
    opacity: 0.5,
  },
  filterTitle: {
    color: '#0f172a',
    fontSize: typography.title,
    fontWeight: '700',
  },
});
