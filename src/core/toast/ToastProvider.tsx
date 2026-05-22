import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {TenantContext} from '../tenant/TenantProvider';
import {colors, radii, shadows, spacing, typography} from '../theme/colors';
import {Icon} from '../components/Icon';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

type ToastSpec = {
  id: number;
  tone: ToastTone;
  message: string;
  // ms; 0 = sticky until dismissed by user.
  duration: number;
};

type ToastContextValue = {
  show: (message: string, options?: {tone?: ToastTone; duration?: number}) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
};

const noop = () => {};

// Default no-op context so importers don't have to null-check. Real
// implementation lives in ToastProvider below.
const ToastContext = createContext<ToastContextValue>({
  show: noop,
  success: noop,
  error: noop,
  info: noop,
  warning: noop,
});

let nextId = 1;

export function ToastProvider({children}: {children: ReactNode}) {
  const [toast, setToast] = useState<ToastSpec | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    setToast(null);
  }, []);

  const show = useCallback(
    (
      message: string,
      options?: {tone?: ToastTone; duration?: number},
    ) => {
      const id = nextId++;
      const tone = options?.tone || 'info';
      const duration = options?.duration ?? defaultDurationFor(tone);
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
      setToast({id, tone, message, duration});
      if (duration > 0) {
        dismissTimerRef.current = setTimeout(dismiss, duration);
      }
    },
    [dismiss],
  );

  const value: ToastContextValue = {
    show,
    success: (m, d) => show(m, {tone: 'success', duration: d}),
    error: (m, d) => show(m, {tone: 'error', duration: d}),
    info: (m, d) => show(m, {tone: 'info', duration: d}),
    warning: (m, d) => show(m, {tone: 'warning', duration: d}),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastHost toast={toast} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

const defaultDurationFor = (tone: ToastTone): number => {
  if (tone === 'error') return 5000;
  if (tone === 'warning') return 4500;
  return 3500;
};

// The single floating toast banner. Rendered at app root so it always sits
// above whatever the user is on.
function ToastHost({
  toast,
  onDismiss,
}: {
  toast: ToastSpec | null;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;
  const {theme} = useContext(TenantContext);

  useEffect(() => {
    if (toast) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 80,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [toast, opacity, translateY]);

  if (!toast) return null;

  const palette = paletteFor(toast.tone, theme);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, {paddingTop: insets.top + spacing.sm}]}>
      <Animated.View
        style={[
          styles.toast,
          {
            backgroundColor: palette.bg,
            borderColor: palette.border,
            opacity,
            transform: [{translateY}],
          },
        ]}>
        <Icon name={palette.icon} size={20} color={palette.fg} />
        <Text
          style={[styles.message, {color: palette.fg}]}
          numberOfLines={1}
          ellipsizeMode="tail">
          {toast.message}
        </Text>
        <Pressable
          onPress={onDismiss}
          hitSlop={10}
          accessibilityLabel="Dismiss notification">
          <Icon name="close" size={18} color={palette.fg} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

type Theme = {
  primary?: string;
  secondary?: string;
  danger?: string;
  success?: string;
} | null;

function paletteFor(
  tone: ToastTone,
  theme: Theme,
): {bg: string; border: string; fg: string; icon: string} {
  if (tone === 'success') {
    return {
      bg: colors.successSoft,
      border: colors.successSoftBorder,
      fg: theme?.success || colors.success,
      icon: 'check-circle-outline',
    };
  }
  if (tone === 'error') {
    return {
      bg: colors.dangerSoft,
      border: colors.dangerSoftBorder,
      fg: theme?.danger || colors.danger,
      icon: 'alert-circle-outline',
    };
  }
  if (tone === 'warning') {
    return {
      bg: colors.warningSoft,
      border: colors.warningSoftBorder,
      fg: colors.warning,
      icon: 'alert-outline',
    };
  }
  return {
    bg: colors.infoSoft,
    border: colors.infoSoftBorder,
    fg: theme?.primary || colors.info,
    icon: 'information-outline',
  };
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    // alignItems removed — the toast now stretches to use the host's full
    // width (constrained by its own marginHorizontal) so longer messages
    // like "Personal information saved." aren't truncated by an overly
    // narrow minimum width.
    zIndex: 1000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.lg,
    borderWidth: 1,
    borderRadius: radii.lg,
    ...shadows.md,
  },
  message: {
    flex: 1,
    fontSize: typography.body,
    fontWeight: '500',
    lineHeight: 18,
  },
});
