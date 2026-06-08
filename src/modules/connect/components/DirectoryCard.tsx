import React from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';

import {Icon} from '../../../core/components/Icon';
import {colors} from '../../../core/theme/colors';
import {
  initials,
  resolveCity,
  resolveLogo,
  resolveName,
  resolveTags,
} from '../utils';
import type {DirectoryUser} from '../types';

type Props = {
  user: DirectoryUser;
  primaryColor: string;
  logoBaseUrl?: string;
  isSaved: boolean;
  isSaving: boolean;
  onPress: () => void;
  onToggleSave: () => void;
};

// A directory card mirroring the web "Startups/Investors/…" grid tile: a logo
// header with the member name overlaid on a dark scrim, a bookmark toggle, and
// a row of industry/stage chips beneath.
function DirectoryCardBase({
  user,
  primaryColor,
  logoBaseUrl,
  isSaved,
  isSaving,
  onPress,
  onToggleSave,
}: Props) {
  const name = resolveName(user.raw);
  const logo = resolveLogo(user.raw, logoBaseUrl);
  const city = resolveCity(user.raw);
  const tags = resolveTags(user.raw, 2);

  return (
    <Pressable
      style={({pressed}) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${name}`}>
      <View style={styles.header}>
        {logo ? (
          <Image source={{uri: logo}} style={styles.logo} />
        ) : (
          <View
            style={[styles.logoFallback, {backgroundColor: `${primaryColor}1f`}]}>
            <Text style={[styles.logoInitials, {color: primaryColor}]}>
              {initials(name) || '?'}
            </Text>
          </View>
        )}
        {/* Bottom scrim so the white name stays legible over any logo. */}
        <View style={styles.scrim} />
        <Text style={styles.name} numberOfLines={2}>
          {name}
        </Text>

        <Pressable
          onPress={onToggleSave}
          disabled={isSaving}
          hitSlop={8}
          style={styles.saveBtn}
          accessibilityRole="button"
          accessibilityLabel={isSaved ? `Unsave ${name}` : `Save ${name}`}>
          <Icon
            name={isSaved ? 'bookmark' : 'bookmark-outline'}
            size={18}
            color={isSaved ? primaryColor : '#ffffff'}
          />
        </Pressable>
      </View>

      <View style={styles.body}>
        {city ? (
          <View style={styles.metaRow}>
            <Icon name="map-marker-outline" size={12} color={colors.textMuted} />
            <Text style={styles.metaText} numberOfLines={1}>
              {city}
            </Text>
          </View>
        ) : null}

        <View style={styles.tagRow}>
          {tags.length > 0 ? (
            tags.map(tag => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText} numberOfLines={1}>
                  {tag}
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.tag}>
              <Text style={styles.tagText}>N/A</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export const DirectoryCard = React.memo(DirectoryCardBase);

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 3},
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.92,
  },
  header: {
    height: 130,
    backgroundColor: colors.surfaceMuted,
    justifyContent: 'flex-end',
  },
  logo: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  logoFallback: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInitials: {
    fontSize: 36,
    fontWeight: '800',
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    top: '45%',
    // Solid dark wash on the lower portion so the white name stays legible;
    // RN core has no gradient and a dep isn't worth it for one card.
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  name: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  saveBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: 12,
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: colors.textMuted,
    flex: 1,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
  },
  tagText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
});
