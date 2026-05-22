import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {launchImageLibrary} from 'react-native-image-picker';
import {pick, types as DocumentPickerTypes} from '@react-native-documents/picker';
import EmojiPicker from 'rn-emoji-keyboard';

import {Icon} from '../../../core/components/Icon';
import {chatService} from '../services/chat.service';
import {chatSocket} from '../services/chat.socket';
import type {Message} from '../types';
import {stripHtml} from '../utils';

type Props = {
  visible: boolean;
  token: string;
  conversationId: string;
  parent: Message | null;
  currentUserUuid?: string;
  primaryColor: string;
  onClose: () => void;
  // Called once after a reply has been successfully posted so the parent
  // screen can bump the visible reply count.
  onReplyPosted?: () => void;
};

const formatTime = (raw?: string): string => {
  if (!raw) return '';
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return '';
  return new Date(ms).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const isOwn = (m: Message, currentUserUuid?: string): boolean => {
  if (!currentUserUuid) return false;
  return (
    m.user?.uuid === currentUserUuid ||
    m.senderUUID === currentUserUuid ||
    m.sender?.uuid === currentUserUuid
  );
};

export function ReplyThreadSheet({
  visible,
  token,
  conversationId,
  parent,
  currentUserUuid,
  primaryColor,
  onClose,
  onReplyPosted,
}: Props) {
  const [replies, setReplies] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Mirrors the main composer: spinner on the active attachment icon, and a
  // toggle for the emoji sheet.
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  // Track local optimistic ids so socket echoes don't dupe them.
  const sentReplyIdsRef = useRef<Set<string>>(new Set());

  // Android-only — mirror the main thread's keyboard-lift workaround.
  const [androidKeyboardLift, setAndroidKeyboardLift] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      setAndroidKeyboardLift(8);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setAndroidKeyboardLift(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Fetch the existing replies when the sheet opens for a new parent.
  const fetchReplies = useCallback(async () => {
    if (!parent?.uuid) return;
    setIsLoading(true);
    try {
      const res = await chatService.listReplies(
        token,
        conversationId,
        parent.uuid,
      );
      // Backend returns newest-first like the main thread — reverse so
      // they read top→bottom chronologically.
      const items = (res?.data?.items || []).slice().reverse();
      setReplies(items);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load replies.');
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, parent?.uuid, token]);

  useEffect(() => {
    if (visible && parent?.uuid) {
      fetchReplies();
      setDraft('');
      setError(null);
    } else if (!visible) {
      setReplies([]);
    }
  }, [visible, parent?.uuid, fetchReplies]);

  // Socket: live replies arriving while the sheet is open. We filter by the
  // parent's uuid so replies on OTHER messages don't leak into this thread.
  useEffect(() => {
    if (!visible || !parent?.uuid) return;
    const unsub = chatSocket.onReplyReceived((payload: any) => {
      const newReply: Message | undefined =
        payload?.reply ||
        payload?.message ||
        payload?.data?.message ||
        payload?.data ||
        payload;
      const parentUuid =
        payload?.parentMessageUUID ||
        payload?.parentMessageUuid ||
        payload?.replyTo ||
        payload?.chatMessageId ||
        payload?.message?.chatMessageId;
      if (!newReply?.uuid) return;
      // Match against the active parent; if the backend doesn't include the
      // parent uuid we fall back to always appending (the room scope already
      // narrows things to this conversation).
      if (parentUuid && parentUuid !== parent.uuid) return;
      if (sentReplyIdsRef.current.has(newReply.uuid)) {
        sentReplyIdsRef.current.delete(newReply.uuid);
        return;
      }
      setReplies(prev =>
        prev.some(r => r.uuid === newReply.uuid)
          ? prev
          : [...prev, newReply],
      );
    });
    return unsub;
  }, [visible, parent?.uuid]);

  const handleSend = async () => {
    if (!parent?.uuid) return;
    const trimmed = draft.trim();
    if (!trimmed || isSending) return;

    const tempUuid = `temp_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const tempReply: Message = {
      uuid: tempUuid,
      message: trimmed,
      messageType: 'text',
      senderUUID: currentUserUuid,
      createdAt: new Date().toISOString(),
    };
    setReplies(prev => [...prev, tempReply]);
    setIsSending(true);
    setDraft('');

    try {
      const res = await chatService.sendReply(
        token,
        conversationId,
        parent.uuid,
        trimmed,
      );
      const sent: Message | undefined =
        (res as any)?.data?.message ||
        (res as any)?.data ||
        (res as any)?.message ||
        (res as any);
      if (sent?.uuid) {
        sentReplyIdsRef.current.add(sent.uuid);
        setReplies(prev =>
          prev.map(r => (r.uuid === tempUuid ? sent : r)),
        );
      }
      onReplyPosted?.();
    } catch (err) {
      setReplies(prev => prev.filter(r => r.uuid !== tempUuid));
      setError(err instanceof Error ? err.message : 'Could not send reply.');
      setDraft(trimmed);
    } finally {
      setIsSending(false);
    }
  };

  // Append a freshly-uploaded reply to the visible list. Server returns the
  // saved message under .data or .data.message; same shape as the main
  // attachment flow.
  const appendUploadedReply = (raw: any) => {
    const sent: Message | undefined =
      raw?.data?.message || raw?.data || raw?.message || raw;
    if (sent?.uuid) {
      sentReplyIdsRef.current.add(sent.uuid);
      setReplies(prev =>
        prev.some(r => r.uuid === sent.uuid) ? prev : [...prev, sent],
      );
      onReplyPosted?.();
    }
  };

  const handleAttachImage = async () => {
    if (attachmentUploading || !parent?.uuid) return;
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
        includeBase64: false,
      });
      if (result.didCancel) return;
      if (result.errorCode) {
        setError(result.errorMessage || 'Could not open image picker.');
        return;
      }
      const asset = result.assets?.[0];
      if (!asset?.uri) return;
      if ((asset.fileSize ?? 0) > 10 * 1024 * 1024) {
        setError('Please choose an image smaller than 10MB.');
        return;
      }
      setAttachmentUploading(true);
      try {
        const raw = await chatService.uploadReplyAttachment(
          token,
          conversationId,
          parent.uuid,
          {
            uri: asset.uri,
            name: asset.fileName || `photo-${Date.now()}.jpg`,
            type: asset.type || 'image/jpeg',
          },
        );
        appendUploadedReply(raw);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed.');
      } finally {
        setAttachmentUploading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not pick image.');
    }
  };

  const handleAttachFile = async () => {
    if (attachmentUploading || !parent?.uuid) return;
    try {
      const [picked] = await pick({
        type: [DocumentPickerTypes.allFiles],
      });
      if (!picked?.uri) return;
      setAttachmentUploading(true);
      try {
        const raw = await chatService.uploadReplyAttachment(
          token,
          conversationId,
          parent.uuid,
          {
            uri: picked.uri,
            name: picked.name || `file-${Date.now()}`,
            type: picked.type || 'application/octet-stream',
          },
        );
        appendUploadedReply(raw);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed.');
      } finally {
        setAttachmentUploading(false);
      }
    } catch (err: any) {
      if (err?.code !== 'DOCUMENT_PICKER_CANCELED') {
        setError(err instanceof Error ? err.message : 'Could not pick file.');
      }
    }
  };

  const renderReply = ({item}: {item: Message}) => {
    const own = isOwn(item, currentUserUuid);
    const time = formatTime(item.createdAt);
    const body = item.isDeleted ? 'Message deleted' : stripHtml(item.message);
    return (
      <View
        style={[
          styles.bubbleRow,
          own ? styles.bubbleRowOwn : styles.bubbleRowOther,
        ]}>
        <View
          style={[
            styles.bubble,
            own
              ? [styles.bubbleOwn, {backgroundColor: primaryColor}]
              : styles.bubbleOther,
          ]}>
          <Text
            style={[
              styles.bubbleText,
              own ? styles.bubbleTextOwn : styles.bubbleTextOther,
              item.isDeleted && styles.bubbleTextDeleted,
            ]}>
            {body}
          </Text>
          <Text
            style={[
              styles.bubbleTime,
              own ? styles.bubbleTimeOwn : styles.bubbleTimeOther,
            ]}>
            {time}
          </Text>
        </View>
      </View>
    );
  };

  if (!parent) return null;

  const parentBody = parent.isDeleted
    ? 'Message deleted'
    : stripHtml(parent.message);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={8}>
              <Icon name="close" size={22} color="#0f172a" />
            </Pressable>
            <Text style={styles.headerTitle}>Reply thread</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.parentCard}>
            <Text style={styles.parentLabel}>Replying to</Text>
            <Text style={styles.parentBody} numberOfLines={4}>
              {parentBody}
            </Text>
            <Text style={styles.parentTime}>{formatTime(parent.createdAt)}</Text>
          </View>

          {isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={primaryColor} />
            </View>
          ) : (
            <FlatList
              data={replies}
              keyExtractor={(r, index) => r.uuid || `idx-${index}`}
              renderItem={renderReply}
              style={styles.repliesList}
              contentContainerStyle={styles.repliesContent}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Icon
                    name="message-reply-outline"
                    size={32}
                    color="#cbd5e1"
                  />
                  <Text style={styles.emptyTitle}>No replies yet</Text>
                  <Text style={styles.emptyBody}>
                    Be the first to reply to this message.
                  </Text>
                </View>
              }
            />
          )}

          {error ? (
            <View style={styles.errorBanner}>
              <Icon name="alert-circle-outline" size={16} color="#dc2626" />
              <Text style={styles.errorText}>{error}</Text>
              <Pressable onPress={() => setError(null)} hitSlop={6}>
                <Icon name="close" size={16} color="#991b1b" />
              </Pressable>
            </View>
          ) : null}

          <View
            style={[
              styles.composer,
              {paddingBottom: 10 + androidKeyboardLift},
            ]}>
            <View style={styles.composerActionsRow}>
              <Pressable
                onPress={() => setEmojiPickerOpen(true)}
                disabled={isSending || attachmentUploading}
                hitSlop={6}
                style={styles.composerIcon}>
                <Icon name="emoticon-happy-outline" size={22} color="#64748b" />
              </Pressable>
              <Pressable
                onPress={handleAttachImage}
                disabled={attachmentUploading || isSending}
                hitSlop={6}
                style={styles.composerIcon}>
                {attachmentUploading ? (
                  <ActivityIndicator color="#64748b" size="small" />
                ) : (
                  <Icon name="image-outline" size={22} color="#64748b" />
                )}
              </Pressable>
              <Pressable
                onPress={handleAttachFile}
                disabled={attachmentUploading || isSending}
                hitSlop={6}
                style={styles.composerIcon}>
                <Icon name="paperclip" size={22} color="#64748b" />
              </Pressable>
            </View>
            <TextInput
              style={styles.composerInput}
              value={draft}
              onChangeText={setDraft}
              placeholder="Write a reply"
              placeholderTextColor="#94a3b8"
              multiline
              editable={!isSending}
            />
            <Pressable
              onPress={handleSend}
              disabled={!draft.trim() || isSending}
              style={[
                styles.sendButton,
                {backgroundColor: primaryColor},
                (!draft.trim() || isSending) && styles.sendButtonDisabled,
              ]}>
              {isSending ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Icon name="send" size={18} color="#ffffff" />
              )}
            </Pressable>
          </View>
        </View>
      </View>

      <EmojiPicker
        open={emojiPickerOpen}
        onClose={() => setEmojiPickerOpen(false)}
        onEmojiSelected={emoji => setDraft(prev => prev + emoji.emoji)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#f8fafc',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '85%',
  },
  header: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: {
    color: '#0f172a',
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 22,
  },
  parentCard: {
    backgroundColor: '#eef2ff',
    borderColor: '#c7d2fe',
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    margin: 12,
    padding: 12,
  },
  parentLabel: {
    color: '#3730a3',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  parentBody: {
    color: '#1e1b4b',
    fontSize: 14,
    lineHeight: 19,
  },
  parentTime: {
    color: '#6366f1',
    fontSize: 11,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
  },
  repliesList: {
    flex: 1,
  },
  repliesContent: {
    flexGrow: 1,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  bubbleRowOwn: {
    justifyContent: 'flex-end',
  },
  bubbleRowOther: {
    justifyContent: 'flex-start',
  },
  bubble: {
    borderRadius: 14,
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleOwn: {
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
    borderColor: '#e2e8f0',
    borderWidth: 1,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 19,
  },
  bubbleTextOwn: {
    color: '#ffffff',
  },
  bubbleTextOther: {
    color: '#0f172a',
  },
  bubbleTextDeleted: {
    fontStyle: 'italic',
    opacity: 0.6,
  },
  bubbleTime: {
    fontSize: 10,
    marginTop: 4,
  },
  bubbleTimeOwn: {
    color: '#e0e7ff',
    textAlign: 'right',
  },
  bubbleTimeOther: {
    color: '#94a3b8',
  },
  errorBanner: {
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  errorText: {
    color: '#991b1b',
    flex: 1,
    fontSize: 13,
  },
  composer: {
    alignItems: 'flex-end',
    backgroundColor: '#ffffff',
    borderTopColor: '#e2e8f0',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    padding: 10,
  },
  composerActionsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  composerIcon: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 32,
  },
  composerInput: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 10,
    borderWidth: 1,
    color: '#0f172a',
    flex: 1,
    fontSize: 15,
    maxHeight: 120,
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sendButton: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  empty: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  emptyTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 12,
  },
  emptyBody: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
});
