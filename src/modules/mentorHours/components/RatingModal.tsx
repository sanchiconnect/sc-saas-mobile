import React, {useContext, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {Icon} from '../../../core/components/Icon';
import {TenantContext} from '../../../core/tenant/TenantProvider';
import {colors} from '../../../core/theme/colors';
import {useToast} from '../../../core/toast/ToastProvider';
import {mentorHoursService} from '../services/mentorHours.service';

type Props = {
  visible: boolean;
  token: string;
  entryUuid: string | undefined;
  onClose: () => void;
  onRated: () => void;
};

export function RatingModal({visible, token, entryUuid, onClose, onRated}: Props) {
  const {theme} = useContext(TenantContext);
  const primaryColor = theme?.primary || colors.primary;
  const toast = useToast();

  const [rating, setRating] = useState(0);
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setRating(0);
    setComments('');
  }, [visible]);

  const handleSubmit = async () => {
    if (!entryUuid) return;
    if (!rating) return toast.error('Please pick a star rating.');

    setSubmitting(true);
    try {
      await mentorHoursService.rate(token, entryUuid, rating, comments);
      toast.success('Rating submitted.');
      onRated();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || 'Could not submit rating.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Rate</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              onPress={onClose}
              style={[styles.closeButton, {borderColor: primaryColor}]}>
              <Icon name="close" size={18} color="#0f172a" />
            </Pressable>
          </View>

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map(i => (
              <Pressable key={i} onPress={() => setRating(i)} hitSlop={6}>
                <Icon
                  name={i <= rating ? 'star' : 'star-outline'}
                  size={32}
                  color="#f59e0b"
                />
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Comments</Text>
          <TextInput
            style={styles.commentInput}
            placeholder="Add a comment (optional)"
            placeholderTextColor="#94a3b8"
            value={comments}
            onChangeText={setComments}
            multiline
          />

          <View style={styles.footer}>
            <Pressable style={styles.cancelBtn} onPress={onClose} disabled={submitting}>
              <Text style={styles.cancelBtnText}>CANCEL</Text>
            </Pressable>
            <Pressable
              style={[styles.submitBtn, {backgroundColor: primaryColor}, submitting && {opacity: 0.7}]}
              onPress={handleSubmit}
              disabled={submitting}>
              {submitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.submitBtnText}>SUBMIT</Text>
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
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  backdrop: {...StyleSheet.absoluteFill},
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitle: {color: '#0f172a', fontSize: 20, fontWeight: '800'},
  closeButton: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 20,
  },
  fieldLabel: {color: '#0f172a', fontSize: 14, fontWeight: '700', marginBottom: 8},
  commentInput: {
    borderColor: '#e2e8f0',
    borderRadius: 12,
    borderWidth: 1,
    color: '#0f172a',
    fontSize: 14,
    minHeight: 80,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: 'top',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  cancelBtn: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  cancelBtnText: {color: '#334155', fontSize: 13, fontWeight: '800', letterSpacing: 0.4},
  submitBtn: {
    alignItems: 'center',
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  submitBtnText: {color: '#ffffff', fontSize: 13, fontWeight: '800', letterSpacing: 0.4},
});
