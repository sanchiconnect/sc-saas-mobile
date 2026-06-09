import React from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';

import {Icon} from '../../../core/components/Icon';
import {radii, spacing, typography} from '../../../core/theme/colors';

type Props = {
  // Absolute image URL, or null to show the "No Image" placeholder.
  imageUrl?: string | null;
  title: string;
  // Optional muted snippet (article body / report description).
  subtitle?: string;
  // Publisher / attribution (e.g. "The Times of India", "Nasscom").
  source?: string;
  // Pre-formatted date string.
  date?: string;
  // Small pill tags (category / industries).
  tags?: string[];
  // Shown as a play badge over the thumbnail for video cards.
  isVideo?: boolean;
  onPress: () => void;
};

// One Resources list row — thumbnail on the left, text on the right, mirroring
// the web "Latest News" / report cards. Used for news, reports and videos.
export function ResourceCard({
  imageUrl,
  title,
  subtitle,
  source,
  date,
  tags,
  isVideo,
  onPress,
}: Props) {
  return (
    <Pressable
      style={({pressed}) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}>
      <View style={styles.thumbWrap}>
        {imageUrl ? (
          <Image
            source={{uri: imageUrl}}
            style={styles.thumb}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Text style={styles.thumbPlaceholderText}>No Image</Text>
          </View>
        )}
        {isVideo ? (
          <View style={styles.playBadge}>
            <Icon name="play" size={18} color="#ffffff" />
          </View>
        ) : null}
      </View>

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
        {source ? (
          <Text style={styles.source} numberOfLines={1}>
            {source}
          </Text>
        ) : null}
        {date ? (
          <View style={styles.dateRow}>
            <Icon name="calendar-blank-outline" size={13} color="#94a3b8" />
            <Text style={styles.date}>{date}</Text>
          </View>
        ) : null}
        {tags && tags.length ? (
          <View style={styles.tagRow}>
            {tags.slice(0, 3).map(tag => (
              <View key={tag} style={styles.tag}>
                <Icon name="tag-outline" size={11} color="#64748b" />
                <Text style={styles.tagText} numberOfLines={1}>
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  thumbWrap: {
    height: 96,
    width: 96,
  },
  thumb: {
    backgroundColor: '#e2e8f0',
    borderRadius: radii.md,
    height: 96,
    width: 96,
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbPlaceholderText: {
    color: '#94a3b8',
    fontSize: typography.small,
    fontWeight: '600',
  },
  playBadge: {
    // Centered within the 96×96 thumb: (96 − 32) / 2 = 32.
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: radii.pill,
    height: 32,
    justifyContent: 'center',
    left: 32,
    position: 'absolute',
    top: 32,
    width: 32,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    color: '#0f172a',
    fontSize: typography.body,
    fontWeight: '700',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: typography.small,
    lineHeight: 17,
    marginTop: 2,
  },
  source: {
    color: '#0f172a',
    fontSize: typography.small,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  dateRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  date: {
    color: '#94a3b8',
    fontSize: typography.caption,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  tag: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: radii.sm,
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  tagText: {
    color: '#64748b',
    fontSize: typography.caption,
    fontWeight: '600',
    maxWidth: 120,
  },
});
