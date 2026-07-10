import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {Icon} from '../../../core/components/Icon';

type Props = {
  rating: number;
  size?: number;
};

export function StarRatingDisplay({rating, size = 14}: Props) {
  const rounded = Math.round(rating);
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map(i => (
        <Icon
          key={i}
          name={i <= rounded ? 'star' : 'star-outline'}
          size={size}
          color="#f59e0b"
        />
      ))}
      <Text style={styles.label}>{rating.toFixed(1)}/5.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {alignItems: 'center', flexDirection: 'row', gap: 2},
  label: {color: '#64748b', fontSize: 12, fontWeight: '600', marginLeft: 4},
});
