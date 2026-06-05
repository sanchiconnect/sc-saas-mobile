import React from 'react';
import {
  Clipboard,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {Icon} from '../../../core/components/Icon';
import {useToast} from '../../../core/toast/ToastProvider';
import {radii, spacing, typography} from '../../../core/theme/colors';
import {CommunityPostCard} from './CommunityPostCard';
import type {CommunityPost} from '../types';

type Props = {
  visible: boolean;
  post: CommunityPost;
  // Absolute web URL to the shared post. When absent (tenant domain unknown)
  // the network share buttons are disabled and only the preview is shown.
  shareUrl?: string;
  logoBaseUrl?: string;
  onClose: () => void;
};

// Plain-text snippet of the post body, used as the share caption.
const plainText = (html?: string): string =>
  (html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);

// Each network's web-intent / app-scheme share URL, built from the post link.
const SHARE_TARGETS: {
  key: string;
  label: string;
  icon: string;
  color: string;
  build: (url: string, text: string) => string;
}[] = [
  {
    key: 'facebook',
    label: 'Facebook',
    icon: 'facebook',
    color: '#1877F2',
    build: url => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    icon: 'whatsapp',
    color: '#25D366',
    build: (url, text) =>
      `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`.trim())}`,
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    icon: 'linkedin',
    color: '#0A66C2',
    build: url =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    key: 'x',
    label: 'X',
    icon: 'twitter',
    color: '#0f172a',
    build: (url, text) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  },
];

export function SharePostModal({
  visible,
  post,
  shareUrl,
  logoBaseUrl,
  onClose,
}: Props) {
  const toast = useToast();
  const caption = plainText(post.text);

  const openTarget = (intentUrl: string) => {
    Linking.openURL(intentUrl).catch(() => {
      toast.error('Couldn’t open the share app.');
    });
  };

  const copyLink = () => {
    if (!shareUrl) return;
    Clipboard.setString(shareUrl);
    toast.success('Link copied');
  };

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.card}>
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={styles.title}>Share post</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}>
              <Icon name="close" size={22} color="#475569" />
            </Pressable>
          </View>

          {/* Network share buttons */}
          <View style={styles.networks}>
            {SHARE_TARGETS.map(target => (
              <Pressable
                key={target.key}
                style={({pressed}) => [
                  styles.networkButton,
                  {backgroundColor: shareUrl ? target.color : '#cbd5e1'},
                  pressed && styles.pressed,
                ]}
                disabled={!shareUrl}
                onPress={() => openTarget(target.build(shareUrl!, caption))}
                accessibilityRole="button"
                accessibilityLabel={`Share on ${target.label}`}>
                <Icon name={target.icon} size={24} color="#ffffff" />
              </Pressable>
            ))}
            <Pressable
              style={({pressed}) => [
                styles.networkButton,
                {backgroundColor: shareUrl ? '#ea7a34' : '#cbd5e1'},
                pressed && styles.pressed,
              ]}
              disabled={!shareUrl}
              onPress={copyLink}
              accessibilityRole="button"
              accessibilityLabel="Copy link">
              <Icon name="content-copy" size={22} color="#ffffff" />
            </Pressable>
          </View>

          {/* Guest-view note */}
          <Text style={styles.note}>
            Anyone with this link can view the post. They’ll need to sign in to
            comment, react, or share.
          </Text>

          <View style={styles.divider} />

          {/* Read-only preview — exactly what a signed-out viewer sees */}
          <ScrollView
            style={styles.previewScroll}
            showsVerticalScrollIndicator={false}>
            <CommunityPostCard
              post={post}
              token=""
              logoBaseUrl={logoBaseUrl}
              readOnly
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.56)',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: radii.xl,
    maxHeight: '82%',
    maxWidth: 560,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    width: '100%',
    zIndex: 2,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    color: '#0f172a',
    fontSize: typography.title,
    fontWeight: '800',
  },
  networks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  networkButton: {
    alignItems: 'center',
    borderRadius: radii.md,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  pressed: {
    opacity: 0.7,
  },
  note: {
    color: '#64748b',
    fontSize: typography.small,
    lineHeight: 18,
    marginTop: spacing.lg,
  },
  divider: {
    backgroundColor: '#e2e8f0',
    height: 1,
    marginTop: spacing.lg,
  },
  previewScroll: {
    marginHorizontal: -spacing.lg,
    marginTop: spacing.md,
  },
});
