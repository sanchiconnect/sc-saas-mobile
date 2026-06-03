import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {Icon} from '../../../core/components/Icon';
import {CreatePostModal} from '../../community/components/CreatePostModal';
import {radii, spacing, typography} from '../../../core/theme/colors';

// Dashboard post composer. Mirrors the web "What's in your mind today?" card,
// and tapping anywhere on it opens the full community-wall composer modal
// (rich text + image upload) to publish a real post.
const FORMAT_TOOLS: {key: string; icon: string; label: string}[] = [
  {key: 'bold', icon: 'format-bold', label: 'Bold'},
  {key: 'italic', icon: 'format-italic', label: 'Italic'},
  {key: 'underline', icon: 'format-underline', label: 'Underline'},
  {key: 'link', icon: 'link-variant', label: 'Link'},
];

type PostComposerProps = {
  primaryColor: string;
  token: string;
  // Called after a post is published (e.g. to refresh a feed). Optional —
  // the dashboard doesn't render the wall, so it can be omitted.
  onPosted?: () => void;
};

export function PostComposer({primaryColor, token, onPosted}: PostComposerProps) {
  const [isComposerOpen, setIsComposerOpen] = useState(false);

  return (
    <>
      <Pressable
        style={styles.card}
        onPress={() => setIsComposerOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Create a post">
        {/* Visual-only chrome; the whole card opens the editor on press. */}
        <View style={styles.toolbar} pointerEvents="none">
          {FORMAT_TOOLS.map(tool => (
            <View key={tool.key} style={styles.toolButton}>
              <Icon name={tool.icon} size={22} color="#475569" />
            </View>
          ))}
        </View>

        <View style={styles.divider} />

        <View style={styles.inputArea} pointerEvents="none">
          <Text style={styles.placeholder}>What’s in your mind today?</Text>
        </View>

        <View style={styles.footer} pointerEvents="none">
          <View style={[styles.postButton, styles.postButtonIdle]}>
            <Text style={styles.postButtonText}>POST</Text>
          </View>

          <View style={styles.mediaActions}>
            <View style={styles.mediaButton}>
              <Icon name="image-outline" size={24} color="#475569" />
            </View>
            <View style={styles.mediaButton}>
              <Icon name="poll" size={24} color="#475569" />
            </View>
          </View>
        </View>
      </Pressable>

      <CreatePostModal
        visible={isComposerOpen}
        token={token}
        primaryColor={primaryColor}
        onClose={() => setIsComposerOpen(false)}
        onPosted={() => {
          setIsComposerOpen(false);
          onPosted?.();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: radii.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    shadowColor: '#0f172a',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.xs,
  },
  toolButton: {
    paddingVertical: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  inputArea: {
    justifyContent: 'flex-start',
    minHeight: 96,
    paddingTop: spacing.xs,
  },
  placeholder: {
    color: '#94a3b8',
    fontSize: typography.bodyLg,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  postButton: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  postButtonIdle: {
    backgroundColor: '#e2e8f0',
  },
  postButtonText: {
    color: '#94a3b8',
    fontSize: typography.body,
    fontWeight: '800',
    letterSpacing: 1,
  },
  mediaActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  mediaButton: {
    padding: spacing.xs,
  },
});
