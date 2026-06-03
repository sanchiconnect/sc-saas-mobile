import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {Icon} from '../../../core/components/Icon';
import {radii, spacing, typography} from '../../../core/theme/colors';
import type {WallStats} from '../types';

// Which filtered list a stat row opens.
export type WallStatType = 'posts' | 'comments' | 'polls' | 'reactions';

type Props = {
  stats: WallStats;
  // Tapping a row opens that user's filtered list of posts.
  onSelectStat: (type: WallStatType) => void;
};

// Each row maps a labelled wall metric to its count + the list it opens.
const ROWS: {
  key: keyof WallStats;
  type: WallStatType;
  label: string;
  icon: string;
}[] = [
  {key: 'totalPost', type: 'posts', label: 'My Posts', icon: 'square-edit-outline'},
  {
    key: 'totalComment',
    type: 'comments',
    label: 'My Commented Posts',
    icon: 'comment-outline',
  },
  {key: 'totalPoll', type: 'polls', label: 'My Polls', icon: 'poll'},
  {
    key: 'totalPostReaction',
    type: 'reactions',
    label: 'My Reacted Posts',
    icon: 'thumb-up-outline',
  },
];

export function WallStatsCard({stats, onSelectStat}: Props) {
  return (
    <View style={styles.card}>
      {ROWS.map((row, index) => (
        <Pressable
          key={row.key}
          style={({pressed}) => [
            styles.row,
            index > 0 && styles.rowDivider,
            pressed && styles.rowPressed,
          ]}
          onPress={() => onSelectStat(row.type)}
          accessibilityRole="button"
          accessibilityLabel={row.label}>
          <Icon name={row.icon} size={22} color="#475569" />
          <Text style={styles.label}>{row.label}</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{stats[row.key] ?? 0}</Text>
          </View>
          <Icon name="chevron-right" size={22} color="#cbd5e1" />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: radii.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    shadowColor: '#0f172a',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  rowDivider: {
    borderTopColor: '#e2e8f0',
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },
  rowPressed: {
    opacity: 0.6,
  },
  label: {
    color: '#0f172a',
    flex: 1,
    fontSize: typography.subhead,
    fontWeight: '700',
  },
  countBadge: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: radii.sm,
    justifyContent: 'center',
    minWidth: 40,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  countText: {
    color: '#0f172a',
    fontSize: typography.subhead,
    fontWeight: '700',
  },
});
