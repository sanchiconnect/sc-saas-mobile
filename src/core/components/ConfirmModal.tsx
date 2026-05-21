import React, {useContext} from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {TenantContext} from '../tenant/TenantProvider';
import {colors} from '../theme/colors';
import {Icon} from './Icon';

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // 'destructive' renders the confirm button in red; 'default' uses the
  // tenant primary.
  variant?: 'default' | 'destructive';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

// Drop-in replacement for Alert.alert("Title", "Body", [Cancel, Confirm]).
// Styled to match the FeedbackModal card so destructive flows feel native
// to the app rather than relying on the OS dialog.
export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  const {theme} = useContext(TenantContext);
  const primaryColor = theme?.primary || colors.primary;
  const dangerColor = theme?.danger || '#dc2626';
  const confirmColor = variant === 'destructive' ? dangerColor : primaryColor;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      // Android back button still cancels; backdrop taps are absorbed by a
      // no-op Pressable below so users have to explicitly tap Cancel /
      // Confirm — avoids accidental dismissals on destructive flows.
      onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={() => {}} />
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{title}</Text>
              {message ? <Text style={styles.message}>{message}</Text> : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onCancel}
              hitSlop={8}
              style={styles.closeButton}>
              <Icon name="close" size={20} color="#475569" />
            </Pressable>
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              disabled={loading}
              style={[styles.actionButton, styles.cancelButton]}>
              <Text style={styles.cancelLabel}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={loading}
              style={[
                styles.actionButton,
                {backgroundColor: confirmColor},
                loading && styles.actionButtonLoading,
              ]}>
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.confirmLabel}>{confirmLabel}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    elevation: 6,
    padding: 22,
    shadowColor: '#0f172a',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.18,
    shadowRadius: 18,
  },
  header: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  headerCopy: {
    flex: 1,
    gap: 6,
  },
  title: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
  },
  message: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
  },
  closeButton: {
    height: 28,
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    alignItems: 'center',
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  actionButtonLoading: {
    opacity: 0.7,
  },
  cancelButton: {
    backgroundColor: '#f1f5f9',
  },
  cancelLabel: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  confirmLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
