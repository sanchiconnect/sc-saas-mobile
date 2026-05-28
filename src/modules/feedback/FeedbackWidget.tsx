import React, {useContext, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {TenantContext} from '../../core/tenant/TenantProvider';
import {AppButton} from '../../core/components/AppButton';
import {Icon} from '../../core/components/Icon';
import {useToast} from '../../core/toast/ToastProvider';

type FeedbackReaction =
  | 'below_average'
  | 'average'
  | 'good'
  | 'excellent'
  | 'loving_it';

type ReactionOption = {
  value: FeedbackReaction;
  label: string;
  emoji: string;
};

const reactionOptions: ReactionOption[] = [
  {value: 'below_average', label: 'Below Average', emoji: '😕'},
  {value: 'average', label: 'Average', emoji: '🙂'},
  {value: 'good', label: 'Good', emoji: '😊'},
  {value: 'excellent', label: 'Excellent', emoji: '🤩'},
  {value: 'loving_it', label: 'Loving it!', emoji: '😍'},
];

export function FeedbackWidget() {
  const [visible, setVisible] = useState(false);
  const {theme} = useContext(TenantContext);
  const primaryColor = theme?.primary || '#0b0aa3';

  return (
    <>
      <Pressable
        accessibilityLabel="Open feedback"
        accessibilityRole="button"
        onPress={() => setVisible(true)}
        style={[styles.fab, {backgroundColor: primaryColor}]}>
        <View style={styles.fabIconStack}>
          <Icon name="thumb-up" size={26} color="#ffffff" />
          <View style={styles.fabIconBadge}>
            <Icon name="message-star" size={16} color="#ffffff" />
          </View>
        </View>
      </Pressable>

      <FeedbackModal visible={visible} onClose={() => setVisible(false)} />
    </>
  );
}

type FeedbackModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function FeedbackModal({visible, onClose}: FeedbackModalProps) {
  const {theme, globalSetting, baseUrl} = useContext(TenantContext);
  const toast = useToast();
  const [selectedReaction, setSelectedReaction] =
    useState<FeedbackReaction | null>(null);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);

  const primaryColor = theme?.primary || '#0b0aa3';
  const needsComment = useMemo(
    () =>
      selectedReaction === 'below_average' ||
      selectedReaction === 'average' ||
      selectedReaction === 'good',
    [selectedReaction],
  );

  const resetAndClose = () => {
    setSelectedReaction(null);
    setFeedback('');
    setLoading(false);
    onClose();
  };

  const handleSubmit = async (reaction?: FeedbackReaction) => {
    const nextReaction = reaction || selectedReaction;

    if (!nextReaction || !baseUrl) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${baseUrl}api/v1/public/global/platform-feedback`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            ratings: nextReaction,
            comments: feedback,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      resetAndClose();
    } catch (error) {
      setLoading(false);
      toast.error(
        error instanceof Error
          ? error.message
          : 'We could not submit your feedback. Please try again.',
      );
    }
  };

  const handleSelectReaction = (reaction: FeedbackReaction) => {
    setSelectedReaction(reaction);

    if (reaction === 'excellent' || reaction === 'loving_it') {
      void handleSubmit(reaction);
    }
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={resetAndClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={resetAndClose} />

        <View style={styles.modalCard}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Rate your overall experience</Text>
              <Text style={styles.subtitle}>
                Share feedback for {globalSetting?.brandName || 'this app'}.
              </Text>
            </View>

            <Pressable
              accessibilityLabel="Close feedback"
              accessibilityRole="button"
              onPress={resetAndClose}
              style={styles.closeButton}>
              <Icon name="close" size={20} color="#475569" />
            </Pressable>
          </View>

          <View style={styles.reactionRow}>
            {reactionOptions.map(option => {
              const isSelected = option.value === selectedReaction;

              return (
                <Pressable
                  key={option.value}
                  onPress={() => handleSelectReaction(option.value)}
                  style={styles.reactionWrap}>
                  <View
                    style={[
                      styles.reactionBubble,
                      isSelected
                        ? {borderColor: primaryColor, backgroundColor: '#eef2ff'}
                        : null,
                    ]}>
                    <Text style={styles.reactionEmoji}>{option.emoji}</Text>
                  </View>
                  <Text
                    style={[
                      styles.reactionLabel,
                      isSelected ? {color: primaryColor, fontWeight: '700'} : null,
                    ]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {needsComment ? (
            <View style={styles.body}>
              <Text style={styles.bodyLabel}>
                Kindly provide feedback for our continual improvement efforts.
              </Text>
              <TextInput
                multiline
                numberOfLines={4}
                placeholder="Enter your feedback/comments."
                placeholderTextColor="#94a3b8"
                style={styles.textarea}
                textAlignVertical="top"
                value={feedback}
                onChangeText={setFeedback}
              />
            </View>
          ) : null}

          {needsComment ? (
            <View style={styles.footer}>
              <AppButton
                label="Cancel"
                onPress={resetAndClose}
                variant="secondary"
                disabled={loading}
                style={styles.footerButton}
              />
              <AppButton
                label="Submit"
                onPress={() => void handleSubmit()}
                disabled={!selectedReaction || loading}
                style={styles.footerButton}
                rightIcon={
                  loading ? <ActivityIndicator color="#ffffff" size="small" /> : null
                }
              />
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fabIconStack: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    position: 'relative',
    width: 32,
  },
  fabIconBadge: {
    position: 'absolute',
    right: -8,
    top: -6,
  },
  fab: {
    alignItems: 'center',
    borderRadius: 28,
    bottom: 96,
    elevation: 8,
    height: 56,
    justifyContent: 'center',
    position: 'absolute',
    right: 24,
    shadowColor: '#0f172a',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.18,
    shadowRadius: 16,
    width: 56,
    zIndex: 100,
  },
  overlay: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingBottom: 18,
    paddingTop: 18,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerCopy: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    color: '#64748b',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  closeButton: {
    alignItems: 'center',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  reactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  reactionWrap: {
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  reactionBubble: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 24,
    borderWidth: 2,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  reactionEmoji: {
    fontSize: 24,
  },
  reactionLabel: {
    color: '#334155',
    fontSize: 11,
    textAlign: 'center',
  },
  body: {
    marginTop: 22,
  },
  bodyLabel: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  textarea: {
    borderColor: '#cbd5e1',
    borderRadius: 16,
    borderWidth: 1,
    color: '#0f172a',
    fontSize: 15,
    minHeight: 110,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  footerButton: {
    flex: 1,
  },
});
