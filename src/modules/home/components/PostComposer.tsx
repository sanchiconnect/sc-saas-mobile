import React, {useRef, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {RichEditor, actions} from 'react-native-pell-rich-editor';

import {Icon} from '../../../core/components/Icon';
import {
  CreatePollModal,
  type PollDraft,
} from '../../community/components/CreatePollModal';
import {
  ImageUploadModal,
  type PickedImage,
} from '../../community/components/ImageUploadModal';
import {communityService} from '../../community/services/community.service';
import {radii, spacing, typography} from '../../../core/theme/colors';

// Dashboard post composer. Mirrors the web "What's in your mind today?" card —
// now fully editable inline (rich text + image + poll) so the user can publish
// a post straight from the dashboard without opening a separate modal.
const FORMAT_TOOLS: {action: string; icon: string; label: string}[] = [
  {action: actions.setBold, icon: 'format-bold', label: 'Bold'},
  {action: actions.setItalic, icon: 'format-italic', label: 'Italic'},
  {action: actions.setUnderline, icon: 'format-underline', label: 'Underline'},
  {action: actions.insertLink, icon: 'link-variant', label: 'Link'},
];

// The editor emits empty content as '', '<br>' or '<div><br></div>'. Strip
// tags to decide whether there's anything to post.
const hasText = (html: string): boolean =>
  html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim().length > 0;

type PostComposerProps = {
  primaryColor: string;
  token: string;
  // Called after a post is published (e.g. to refresh a feed). Optional —
  // the dashboard doesn't render the wall, so it can be omitted.
  onPosted?: () => void;
};

export function PostComposer({primaryColor, token, onPosted}: PostComposerProps) {
  const richText = useRef<RichEditor>(null);
  const [html, setHtml] = useState('');
  const [active, setActive] = useState<string[]>([]);
  const [images, setImages] = useState<PickedImage[]>([]);
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [poll, setPoll] = useState<PollDraft | null>(null);
  const [isPollOpen, setIsPollOpen] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Poll is view-only for now (not persisted), so it doesn't gate posting.
  const canPost = (hasText(html) || images.length > 0) && !isPosting;

  const reset = () => {
    richText.current?.setContentHTML('');
    setHtml('');
    setImages([]);
    setPoll(null);
    setError(null);
    setLinkUrl('');
    setIsLinkOpen(false);
  };

  const handleToolPress = (action: string) => {
    if (action === actions.insertLink) {
      setLinkUrl('');
      setIsLinkOpen(true);
      return;
    }
    richText.current?.sendAction(action, 'result');
  };

  const handleInsertLink = () => {
    const url = linkUrl.trim();
    if (url) {
      richText.current?.insertLink(url, url);
    }
    setIsLinkOpen(false);
    setLinkUrl('');
  };

  const handleRemoveImage = (uri: string) => {
    setImages(prev => prev.filter(img => img.uri !== uri));
  };

  const handlePost = async () => {
    if (!canPost) return;
    setIsPosting(true);
    setError(null);
    try {
      // Upload each picked image first, then attach the returned paths to the
      // post. Uploads run in parallel; a single failure aborts the post.
      const paths = await Promise.all(
        images.map(img => communityService.uploadFile(token, img)),
      );
      // Poll is view-only for now — built and previewed, but not yet sent to
      // the backend. Pass `poll` here once the create-poll contract is wired.
      await communityService.createPost(token, html, paths);
      reset();
      onPosted?.();
    } catch (e: any) {
      setError(e?.message || 'Unable to create post. Please try again.');
    } finally {
      setIsPosting(false);
    }
  };

  const isActive = (action: string) => active.includes(action);

  return (
    <>
      <View style={styles.card}>
        {/* Toolbar */}
        <View style={styles.toolbar}>
          {FORMAT_TOOLS.map(tool => (
            <Pressable
              key={tool.action}
              style={[
                styles.toolButton,
                isActive(tool.action) && styles.toolButtonActive,
              ]}
              onPress={() => handleToolPress(tool.action)}
              accessibilityRole="button"
              accessibilityLabel={tool.label}
              hitSlop={6}>
              <Icon
                name={tool.icon}
                size={22}
                color={isActive(tool.action) ? primaryColor : '#475569'}
              />
            </Pressable>
          ))}
        </View>

        <View style={styles.divider} />

        <View style={styles.inputArea}>
          <RichEditor
            ref={richText}
            placeholder="What’s in your mind today?"
            initialHeight={96}
            onChange={setHtml}
            editorInitializedCallback={() =>
              richText.current?.registerToolbar(items =>
                setActive(items.map(i => (typeof i === 'string' ? i : i.type))),
              )
            }
            editorStyle={{
              color: '#0f172a',
              placeholderColor: '#94a3b8',
              contentCSSText: 'font-size: 15px; line-height: 22px;',
            }}
            disabled={isPosting}
          />

          {/* Picked-image previews — uploaded on post */}
          {images.length > 0 ? (
            <View style={styles.previewRow}>
              {images.map(img => (
                <View key={img.uri} style={styles.previewItem}>
                  <Image source={{uri: img.uri}} style={styles.previewImage} />
                  <Pressable
                    style={styles.previewRemove}
                    onPress={() => handleRemoveImage(img.uri)}
                    accessibilityRole="button"
                    accessibilityLabel="Remove image"
                    hitSlop={6}>
                    <Icon name="close" size={14} color="#ffffff" />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          {/* Poll preview */}
          {poll ? (
            <View style={styles.pollPreview}>
              <View style={styles.pollPreviewHeader}>
                <Text style={styles.pollPreviewQuestion} numberOfLines={2}>
                  {poll.question}
                </Text>
                <View style={styles.pollPreviewActions}>
                  <Pressable
                    onPress={() => setIsPollOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Edit poll"
                    hitSlop={6}>
                    <Icon name="pencil-outline" size={18} color="#475569" />
                  </Pressable>
                  <Pressable
                    onPress={() => setPoll(null)}
                    accessibilityRole="button"
                    accessibilityLabel="Remove poll"
                    hitSlop={6}>
                    <Icon name="close" size={18} color="#94a3b8" />
                  </Pressable>
                </View>
              </View>
              {poll.options.map((option, i) => (
                <View key={i} style={styles.pollPreviewOption}>
                  <Text style={styles.pollPreviewOptionText} numberOfLines={1}>
                    {option}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.footer}>
          <Pressable
            style={[
              styles.postButton,
              {backgroundColor: canPost ? primaryColor : '#e2e8f0'},
            ]}
            onPress={handlePost}
            disabled={!canPost}
            accessibilityRole="button"
            accessibilityLabel="Post">
            {isPosting ? (
              <ActivityIndicator size="small" color="#94a3b8" />
            ) : (
              <Text
                style={[
                  styles.postButtonText,
                  {color: canPost ? '#ffffff' : '#94a3b8'},
                ]}>
                POST
              </Text>
            )}
          </Pressable>

          <View style={styles.mediaActions}>
            <Pressable
              style={styles.mediaButton}
              onPress={() => setIsImagePickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Add image"
              hitSlop={6}>
              <Icon name="image-outline" size={24} color="#475569" />
            </Pressable>
            <Pressable
              style={styles.mediaButton}
              onPress={() => setIsPollOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Add poll"
              hitSlop={6}>
              <Icon
                name="poll"
                size={24}
                color={poll ? primaryColor : '#475569'}
              />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Image picker sub-modal */}
      <ImageUploadModal
        visible={isImagePickerOpen}
        primaryColor={primaryColor}
        onClose={() => setIsImagePickerOpen(false)}
        onPicked={picked => setImages(prev => [...prev, ...picked])}
      />

      {/* Poll builder sub-modal */}
      <CreatePollModal
        visible={isPollOpen}
        primaryColor={primaryColor}
        initial={poll}
        onClose={() => setIsPollOpen(false)}
        onSave={setPoll}
      />

      {/* Link URL prompt */}
      <Modal
        animationType="fade"
        transparent
        visible={isLinkOpen}
        onRequestClose={() => setIsLinkOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.linkOverlay}>
          <Pressable
            style={styles.linkBackdrop}
            onPress={() => setIsLinkOpen(false)}
          />
          <View style={styles.linkCard}>
            <Text style={styles.linkTitle}>Add link</Text>
            <TextInput
              style={styles.linkInput}
              placeholder="https://example.com"
              placeholderTextColor="#94a3b8"
              value={linkUrl}
              onChangeText={setLinkUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              autoFocus
            />
            <View style={styles.linkActions}>
              <Pressable
                style={styles.linkCancel}
                onPress={() => setIsLinkOpen(false)}>
                <Text style={styles.linkCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.linkInsert, {backgroundColor: primaryColor}]}
                onPress={handleInsertLink}>
                <Text style={styles.linkInsertText}>Insert</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    borderRadius: radii.sm,
    paddingVertical: spacing.xs,
  },
  toolButtonActive: {
    backgroundColor: '#e2e8f0',
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
  previewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  previewItem: {
    height: 84,
    position: 'relative',
    width: 84,
  },
  previewImage: {
    borderRadius: radii.md,
    height: '100%',
    width: '100%',
  },
  previewRemove: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: radii.pill,
    height: 22,
    justifyContent: 'center',
    position: 'absolute',
    right: -6,
    top: -6,
    width: 22,
  },
  pollPreview: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  pollPreviewHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  pollPreviewQuestion: {
    color: '#0f172a',
    flex: 1,
    fontSize: typography.subhead,
    fontWeight: '700',
  },
  pollPreviewActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  pollPreviewOption: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  pollPreviewOptionText: {
    color: '#0f172a',
    fontSize: typography.body,
  },
  error: {
    color: '#dc2626',
    fontSize: typography.body,
    marginTop: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  postButton: {
    alignItems: 'center',
    borderRadius: radii.md,
    justifyContent: 'center',
    minWidth: 96,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  postButtonText: {
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
  linkOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  linkBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.56)',
  },
  linkCard: {
    backgroundColor: '#ffffff',
    borderRadius: radii.xl,
    maxWidth: 480,
    padding: spacing.xl,
    width: '100%',
    zIndex: 2,
  },
  linkTitle: {
    color: '#0f172a',
    fontSize: typography.title,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  linkInput: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: radii.md,
    borderWidth: 1,
    color: '#0f172a',
    fontSize: typography.bodyLg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  linkActions: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'flex-end',
    marginTop: spacing.lg,
  },
  linkCancel: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  linkCancelText: {
    color: '#475569',
    fontSize: typography.body,
    fontWeight: '700',
  },
  linkInsert: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  linkInsertText: {
    color: '#ffffff',
    fontSize: typography.body,
    fontWeight: '800',
  },
});
