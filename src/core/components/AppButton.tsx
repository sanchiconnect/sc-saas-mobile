import React, {useContext} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import {TenantContext} from '../tenant/TenantProvider';
import {colors} from '../theme/colors';

type Variant = 'primary' | 'secondary' | 'ghost';

type AppButtonProps = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
};

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  loadingLabel,
  fullWidth = true,
  leftIcon,
  rightIcon,
  style,
  labelStyle,
}: AppButtonProps) {
  const {theme} = useContext(TenantContext);
  const isDisabled = disabled || loading;

  const palette = {
    primary: {
      bg: theme?.primary ?? colors.primary,
      border: 'transparent',
      label: '#ffffff',
    },
    secondary: {
      bg: 'transparent',
      border: theme?.secondary ?? colors.border,
      label: theme?.primary ?? colors.primary,
    },
    ghost: {
      bg: 'transparent',
      border: 'transparent',
      label: theme?.primary ?? colors.primary,
    },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{busy: loading, disabled: isDisabled}}
      disabled={isDisabled}
      onPress={onPress}
      style={({pressed}) => [
        styles.button,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderWidth: variant === 'secondary' ? 1 : 0,
        },
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}>
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={palette.label} size="small" />
        ) : leftIcon ? (
          <View>{leftIcon}</View>
        ) : null}

        <Text
          style={[
            styles.label,
            {color: palette.label},
            labelStyle,
          ]}>
          {loading && loadingLabel ? loadingLabel : label}
        </Text>

        {!loading && rightIcon ? <View>{rightIcon}</View> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 14,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.6,
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
  },
});
