import React, {useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {RichEditor, actions} from 'react-native-pell-rich-editor';

import {Icon} from '../../../core/components/Icon';
import {radii, spacing, typography} from '../../../core/theme/colors';
import {communityService} from '../services/community.service';

type Props = {
  visible: boolean;
  token: string;
  primaryColor: string;
  // The post being edited. Only its text is editable here; the existing
  // images are preserved and any poll is left untouched.
  postUuid: string;
  initialHtml: string;
  images?: string[];
  onClose: () => void;
  // Called with the saved HTML after a successful update so the card can
  // reflect the new text without a full feed reload.
  onSaved: (html: string) => void;
};

// Bold / italic / underline only — editing is text-only (no link / image /
// poll), matching the web wall's inline edit.
const FORMAT_TOOLS: {action: string; icon: string; label: string}[] = [
  {action: actions.setBold, icon: 'format-bold', label: 'Bold'},
  {action: actions.setItalic, icon: 'format-italic', label: 'Italic'},
  {action: actions.setUnderline, icon: 'format-underline', label: 'Underline'},
];

// The editor emits empty content as '', '<br>' or '<div><br></div>'. Strip
// tags to decide whether there's anything left to save.
const hasText = (html: string): boolean =>
  html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim().length > 0;

export function EditPostModal({
  visible,
  token,
  primaryColor,
  postUuid,
  initialHtml,
  images = [],
  onClose,
  onSaved,
}: Props) {
  const richText = useRef<RichEditor>(null);
  const [html, setHtml] = useState(initialHtml);
  const [active, setActive] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed the editor whenever a (different) post is opened for editing.
  useEffect(() => {
    if (visible) {
      setHtml(initialHtml);
      setError(null);
      richText.current?.setContentHTML(initialHtml);
    }
  }, [visible, initialHtml]);

  const canSave = hasText(html) && !isSaving;

  const handleClose = () => {
    if (isSaving) return;
    onClose();
  };

  const handleToolPress = (action: string) => {
    richText.current?.sendAction(action, 'result');
  };

  const handleSave = async () => {
    if (!canSave) return;
    setIsSaving(true);
    setError(null);
    try {
      await communityService.updatePost(token, postUuid, html, images);
      onSaved(html);
    } catch (e: any) {
      setError(e?.message || 'Unable to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const isActive = (action: string) => active.includes(action);

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} />

        <View style={styles.card}>
          {/* Toolbar + close */}
          <View style={styles.toolbarRow}>
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
            <Pressable
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}>
              <Icon name="close" size={22} color="#475569" />
            </Pressable>
          </View>

          <View style={styles.divider} />

          <ScrollView
            style={styles.editorScroll}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled>
            <RichEditor
              ref={richText}
              initialContentHTML={initialHtml}
              placeholder="What’s in your mind today?"
              initialHeight={180}
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
              disabled={isSaving}
            />
          </ScrollView>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.footer}>
            <Pressable
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={isSaving}
              accessibilityRole="button"
              accessibilityLabel="Cancel">
              <Text style={styles.cancelButtonText}>CANCEL</Text>
            </Pressable>
            <Pressable
              style={[
                styles.saveButton,
                {backgroundColor: canSave ? primaryColor : '#e2e8f0'},
              ]}
              onPress={handleSave}
              disabled={!canSave}
              accessibilityRole="button"
              accessibilityLabel="Save">
              {isSaving ? (
                <ActivityIndicator size="small" color="#94a3b8" />
              ) : (
                <Text
                  style={[
                    styles.saveButtonText,
                    {color: canSave ? '#ffffff' : '#94a3b8'},
                  ]}>
                  SAVE
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    maxHeight: '80%',
    maxWidth: 560,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    width: '100%',
    zIndex: 2,
  },
  toolbarRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  toolbar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  toolButton: {
    borderRadius: radii.sm,
    padding: spacing.xs,
  },
  toolButtonActive: {
    backgroundColor: '#e2e8f0',
  },
  divider: {
    backgroundColor: '#e2e8f0',
    height: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  editorScroll: {
    maxHeight: 320,
    minHeight: 180,
  },
  error: {
    color: '#dc2626',
    fontSize: typography.body,
    marginTop: spacing.sm,
  },
  footer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'flex-end',
    marginTop: spacing.md,
  },
  cancelButton: {
    alignItems: 'center',
    borderRadius: radii.md,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  cancelButtonText: {
    color: '#475569',
    fontSize: typography.body,
    fontWeight: '800',
    letterSpacing: 1,
  },
  saveButton: {
    alignItems: 'center',
    borderRadius: radii.md,
    justifyContent: 'center',
    minWidth: 96,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  saveButtonText: {
    fontSize: typography.body,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
