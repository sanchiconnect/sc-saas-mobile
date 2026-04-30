import React, {PropsWithChildren} from 'react';
import {StyleProp, StyleSheet, View, ViewStyle} from 'react-native';

import {colors} from '../theme/colors';

type AppCardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  elevated?: boolean;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}>;

export function AppCard({
  children,
  style,
  padded = true,
  elevated = true,
  header,
  footer,
}: AppCardProps) {
  return (
    <View
      style={[
        styles.card,
        padded && styles.padded,
        elevated && styles.elevated,
        style,
      ]}>
      {header ? <View style={styles.header}>{header}</View> : null}
      {children}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    width: '100%',
  },
  padded: {
    padding: 20,
  },
  elevated: {
    elevation: 2,
    shadowColor: '#0f172a',
    shadowOffset: {height: 2, width: 0},
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  header: {
    marginBottom: 12,
  },
  footer: {
    marginTop: 12,
  },
});
