import React from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';

import {Icon} from '../../../core/components/Icon';
import {radii, spacing, typography} from '../../../core/theme/colors';
import type {CommunityPost} from '../types';

type Props = {
  post: CommunityPost;
  // Tenant imgKit base for resolving relative avatar / image paths.
  logoBaseUrl?: string;
};

// Resolve a relative S3 path (`users/abc/x.png`) into an absolute URL using
// the tenant's imgKit base. Absolute URLs are returned untouched.
const resolveUrl = (raw?: string | null, baseUrl?: string): string | null => {
  if (!raw) return null;
  if (/^https?:\/\//.test(raw)) return raw;
  if (!baseUrl) return null;
  return `${baseUrl.replace(/\/$/, '')}/${raw.replace(/^\//, '')}`;
};

// The feed shows a plain-text preview. Strip HTML tags and decode the few
// entities that show up most often in the editor output.
const stripHtml = (html?: string): string => {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

// Short "x ago" relative time. Falls back to the raw value if unparseable.
const timeAgo = (iso: string): string => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return `${secs} second${secs === 1 ? '' : 's'} ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
};

// Map the poll's `timeLine` enum to a duration (ms), then describe how much
// time is left relative to when the poll was created.
const POLL_DURATION_MS: Record<string, number> = {
  one_day: 24 * 60 * 60 * 1000,
  one_week: 7 * 24 * 60 * 60 * 1000,
  one_month: 30 * 24 * 60 * 60 * 1000,
};

const pollTimeLeft = (timeLine: string, createdAt: string): string => {
  const duration = POLL_DURATION_MS[timeLine];
  const start = new Date(createdAt).getTime();
  if (!duration || Number.isNaN(start)) return '';
  const remaining = start + duration - Date.now();
  if (remaining <= 0) return 'Poll ended';
  const day = 24 * 60 * 60 * 1000;
  if (remaining < day) return 'Less than a day left';
  const days = Math.floor(remaining / day);
  return `${days} day${days === 1 ? '' : 's'} left`;
};

export function CommunityPostCard({post, logoBaseUrl}: Props) {
  const avatarUri = resolveUrl(
    post.user.avatar || post.user.organizationLogo,
    logoBaseUrl,
  );
  const orgName = post.user.organizationName;
  const text = stripHtml(post.text);
  // Prefer the `images` array; fall back to the legacy single `image` field.
  const imagePaths = post.images?.length
    ? post.images
    : post.image
      ? [post.image]
      : [];
  const imageUris = imagePaths
    .map(p => resolveUrl(p, logoBaseUrl))
    .filter((u): u is string => Boolean(u));

  return (
    <View style={styles.card}>
      {/* Header — avatar, name (org), relative time, overflow menu */}
      <View style={styles.header}>
        <View style={styles.avatarWrap}>
          {avatarUri ? (
            <Image
              source={{uri: avatarUri}}
              style={styles.avatarImage}
              resizeMode="cover"
            />
          ) : (
            <Text style={styles.avatarText}>
              {post.user.name.slice(0, 2).toUpperCase()}
            </Text>
          )}
          <View style={styles.onlineDot} />
        </View>

        <View style={styles.headerCopy}>
          <Text style={styles.authorName} numberOfLines={1}>
            {post.user.name}
            {orgName ? (
              <Text style={styles.authorOrg}>{`  (${orgName})`}</Text>
            ) : null}
          </Text>
          <Text style={styles.timeText}>{timeAgo(post.createdAt)}</Text>
        </View>

        <Icon name="dots-horizontal" size={22} color="#94a3b8" />
      </View>

      {/* Body text */}
      {text ? <Text style={styles.bodyText}>{text}</Text> : null}

      {/* Attached image(s) */}
      {imageUris.map(uri => (
        <View key={uri} style={styles.imageCard}>
          <Image
            source={{uri}}
            style={styles.postImage}
            resizeMode="contain"
          />
        </View>
      ))}

      {/* Poll */}
      {post.poll ? (
        <View style={styles.pollCard}>
          <Text style={styles.pollQuestion}>{post.poll.question}</Text>
          {post.poll.options.map(option => (
            <View key={option.id} style={styles.pollOption}>
              <Text style={styles.pollOptionText} numberOfLines={2}>
                {option.optionText}
              </Text>
              {option.voteCount > 0 ? (
                <Text style={styles.pollOptionCount}>{option.voteCount}</Text>
              ) : null}
            </View>
          ))}
          <Text style={styles.pollMeta}>
            {post.poll.totalVotes} vote{post.poll.totalVotes === 1 ? '' : 's'}
            {' • '}
            {pollTimeLeft(post.poll.timeLine, post.poll.pollCreatedAt)}
          </Text>
        </View>
      ) : null}

      {/* Footer — comment / reaction counts + share */}
      <View style={styles.footer}>
        <View style={styles.footerItem}>
          <Icon name="comment-outline" size={18} color="#64748b" />
          <Text style={styles.footerText}>
            {post.stats.totalComments} comment
            {post.stats.totalComments === 1 ? '' : 's'}
          </Text>
        </View>
        <View style={styles.footerItem}>
          <Icon name="thumb-up-outline" size={18} color="#64748b" />
          <Text style={styles.footerText}>
            {post.stats.totalReactions} reaction
            {post.stats.totalReactions === 1 ? '' : 's'}
          </Text>
        </View>
        <View style={styles.footerItem}>
          <Icon name="share-variant-outline" size={18} color="#64748b" />
          <Text style={styles.footerText}>Share</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: radii.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.lg,
    shadowColor: '#0f172a',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  avatarWrap: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
    borderRadius: radii.md,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    position: 'relative',
    width: 52,
  },
  avatarImage: {
    borderRadius: radii.md,
    height: '100%',
    width: '100%',
  },
  avatarText: {
    color: '#475569',
    fontSize: typography.subhead,
    fontWeight: '800',
  },
  onlineDot: {
    backgroundColor: '#16a34a',
    borderColor: '#ffffff',
    borderRadius: 999,
    borderWidth: 2,
    height: 12,
    position: 'absolute',
    right: -3,
    top: -3,
    width: 12,
  },
  headerCopy: {
    flex: 1,
  },
  authorName: {
    color: '#0f172a',
    fontSize: typography.subhead,
    fontWeight: '800',
  },
  authorOrg: {
    color: '#64748b',
    fontSize: typography.body,
    fontWeight: '600',
  },
  timeText: {
    color: '#94a3b8',
    fontSize: typography.small,
    marginTop: 2,
  },
  bodyText: {
    color: '#0f172a',
    fontSize: typography.bodyLg,
    lineHeight: 22,
    marginTop: spacing.md,
  },
  imageCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.md,
    overflow: 'hidden',
    padding: spacing.sm,
  },
  postImage: {
    aspectRatio: 1,
    borderRadius: radii.md,
    width: '100%',
  },
  pollCard: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.lg,
  },
  pollQuestion: {
    color: '#0f172a',
    fontSize: typography.subhead,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  pollOption: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
  },
  pollOptionText: {
    color: '#0f172a',
    flex: 1,
    fontSize: typography.bodyLg,
  },
  pollOptionCount: {
    color: '#64748b',
    fontSize: typography.body,
    fontWeight: '700',
    marginLeft: spacing.md,
  },
  pollMeta: {
    color: '#64748b',
    fontSize: typography.small,
    marginTop: spacing.xs,
  },
  footer: {
    borderTopColor: '#e2e8f0',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
  },
  footerItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  footerText: {
    color: '#64748b',
    fontSize: typography.body,
    fontWeight: '600',
  },
});
