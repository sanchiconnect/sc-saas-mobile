import React from 'react';
import {FlatList, StyleSheet, Text, View} from 'react-native';

import {RecommendedCard, RecommendedKind} from './RecommendedCard';

type Props = {
  title: string;
  kind: RecommendedKind;
  items: Array<Record<string, any>>;
  logoBaseUrl?: string;
  onItemPress?: (item: Record<string, any>) => void;
};

export function RecommendedSection({
  title,
  kind,
  items,
  logoBaseUrl,
  onItemPress,
}: Props) {
  // Sections collapse entirely when the backend returns nothing — matches the
  // frontend's *ngIf-on-list-length pattern. No empty-state placeholders here.
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <FlatList
        data={items}
        keyExtractor={(item, index) =>
          String(item?.id || item?.uuid || `${kind}-${index}`)
        }
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({item}) => (
          <RecommendedCard
            kind={kind}
            item={item}
            logoBaseUrl={logoBaseUrl}
            onPress={onItemPress ? () => onItemPress(item) : undefined}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 24,
  },
  title: {
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
});
