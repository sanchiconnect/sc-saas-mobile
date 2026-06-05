import React, {useRef, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {radii, spacing, typography} from '../theme/colors';

type Props = {
  // Text shown inside the tooltip bubble.
  message: string;
  // The (usually disabled-looking) content the tooltip is attached to.
  children: React.ReactNode;
  // Where the bubble appears relative to the children. Defaults to 'top'.
  placement?: 'top' | 'bottom';
  // Accessibility label for the tappable wrapper.
  accessibilityLabel?: string;
};

// Lightweight tap-to-reveal tooltip. Mobile has no hover, so the bubble is
// toggled by tapping the wrapped element and auto-hides after a short delay.
// Used to explain why an action is disabled (e.g. pending admin approval)
// without blocking the surrounding layout.
export function Tooltip({
  message,
  children,
  placement = 'top',
  accessibilityLabel,
}: Props) {
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    setVisible(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(false), 2600);
  };

  return (
    <View style={styles.wrap}>
      {visible ? (
        <View
          style={[
            styles.bubble,
            placement === 'top' ? styles.bubbleTop : styles.bubbleBottom,
          ]}
          pointerEvents="none">
          <Text style={styles.bubbleText}>{message}</Text>
        </View>
      ) : null}
      <Pressable
        onPress={show}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={message}>
        {children}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  bubble: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: '#0f172a',
    borderRadius: radii.md,
    maxWidth: 240,
    minWidth: 160,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    zIndex: 20,
    elevation: 6,
  },
  bubbleTop: {
    bottom: '100%',
    marginBottom: spacing.xs,
  },
  bubbleBottom: {
    top: '100%',
    marginTop: spacing.xs,
  },
  bubbleText: {
    color: '#ffffff',
    fontSize: typography.small,
    lineHeight: 16,
    textAlign: 'center',
  },
});
