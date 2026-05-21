import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {Icon} from '../../../core/components/Icon';
import {colors} from '../../../core/theme/colors';
import {TenantContext} from '../../../core/tenant/TenantProvider';
import {launchImageLibrary} from 'react-native-image-picker';
import {pick, types as DocumentPickerTypes} from '@react-native-documents/picker';
import EmojiPicker from 'rn-emoji-keyboard';

import {ReplyThreadSheet} from '../components/ReplyThreadSheet';
import {chatService} from '../services/chat.service';
import {chatSocket} from '../services/chat.socket';
import type {Conversation, Message} from '../types';
import {stripHtml} from '../utils';

type Props = {
  token: string;
  conversation: Conversation;
  currentUserUuid?: string;
  // Used to label the user's own messages (e.g. "Brock Lesnar") so the
  // sender header matches the web design.
  currentUserName?: string;
  onBack: () => void;
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

// Resolve the counterparty's display name for header + initials fallback.
const resolveHeaderName = (
  conversation: Conversation,
  currentUserUuid?: string,
): string => {
  if (conversation.name) return conversation.name;
  const other =
    conversation.otherUser ||
    conversation.participants?.find(p => p.uuid !== currentUserUuid);
  return other?.name || 'Conversation';
};

const resolveHeaderAvatar = (
  conversation: Conversation,
  currentUserUuid?: string,
): string | null => {
  if (conversation.logo) return conversation.logo;
  if (conversation.avatar) return conversation.avatar;
  const other =
    conversation.otherUser ||
    conversation.participants?.find(p => p.uuid !== currentUserUuid);
  return other?.avatar || null;
};

// Decide if a message was sent by the current user. Backend either embeds the
// sender uuid directly on `senderUUID` or in a nested sender object.
const isOwnMessage = (m: Message, currentUserUuid?: string): boolean => {
  if (!currentUserUuid) return false;
  return (
    m.senderUUID === currentUserUuid || m.sender?.uuid === currentUserUuid
  );
};

export function ConversationDetailScreen({
  token,
  conversation,
  currentUserUuid,
  currentUserName,
  onBack,
}: Props) {
  const {theme, globalSetting} = useContext(TenantContext);
  const primaryColor = theme?.primary || colors.primary;
  const logoBaseUrl =
    globalSetting?.imgKitUrl || globalSetting?.assetsImgKitUrl || '';

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track messages we just sent locally so the socket echo doesn't dupe them.
  const sentMessageIdsRef = useRef<Set<string>>(new Set());

  // Active reply target — when set, the ReplyThreadSheet renders for this
  // parent message. Null = no thread open.
  const [replyParent, setReplyParent] = useState<Message | null>(null);

  // Attachment + emoji UI state. `attachmentUploading` blocks send and shows
  // a spinner on the active attachment icon. `emojiPickerOpen` toggles the
  // rn-emoji-keyboard sheet.
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  // Track keyboard visibility to keep the composer flush with the keyboard —
  // adjustResize + flex-end on the FlatList does most of the lift work; we
  // only nudge a tiny 8dp on Android to clear any 1–2dp OEM cropping.
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

  const headerName = resolveHeaderName(conversation, currentUserUuid);
  const headerAvatar = resolveHeaderAvatar(conversation, currentUserUuid);
  const resolvedHeaderAvatar = headerAvatar
    ? headerAvatar.startsWith('http')
      ? headerAvatar
      : `${logoBaseUrl}${headerAvatar}`
    : null;

  const fetchPage = useCallback(
    async (page: number, mode: 'replace' | 'prepend') => {
      try {
        const res = await chatService.listMessages(token, conversation.uuid, {
          page,
        });
        // Backend returns newest-first; UI shows oldest-first top→bottom, so
        // reverse before appending.
        const items = (res?.data?.items || []).slice().reverse();
        const meta = res?.data?.meta || {
          currentPage: 1,
          totalPages: 1,
          itemsPerPage: 20,
        };
        setMessages(prev => {
          if (mode === 'replace') return items;
          // Prepend older messages, dedupe by uuid.
          const seen = new Set(prev.map(m => m.uuid));
          return [...items.filter(m => !seen.has(m.uuid)), ...prev];
        });
        setCurrentPage(meta.currentPage);
        setTotalPages(meta.totalPages);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Could not load messages.',
        );
      }
    },
    [conversation.uuid, token],
  );

  // Initial fetch + room join.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      await fetchPage(1, 'replace');
      if (!cancelled) setIsLoading(false);
    })();
    chatSocket.joinConversation(conversation.uuid).catch(() => {
      // Socket connect failures are silent — the REST messages still load
      // and the user can manually pull-to-refresh to see new content.
    });
    return () => {
      cancelled = true;
      chatSocket.leaveCurrentRoom();
    };
  }, [conversation.uuid, fetchPage]);

  // Live message-received listener. Re-binds whenever the socket reconnects
  // (joinConversation returns the active socket each time).
  useEffect(() => {
    let unsubReceived: (() => void) | undefined;
    let unsubDeleted: (() => void) | undefined;
    let cancelled = false;

    const setup = async () => {
      await chatSocket.joinConversation(conversation.uuid);
      if (cancelled) return;
      unsubReceived = chatSocket.onMessageReceived((payload: any) => {
        // Payload shape mirrors the REST message — extract the new message
        // and append, deduping locally-echoed sends.
        const newMessage: Message | undefined =
          payload?.message || payload?.data?.message || payload;
        if (!newMessage?.uuid) return;
        if (sentMessageIdsRef.current.has(newMessage.uuid)) {
          sentMessageIdsRef.current.delete(newMessage.uuid);
          return;
        }
        setMessages(prev =>
          prev.some(m => m.uuid === newMessage.uuid)
            ? prev
            : [...prev, newMessage],
        );
      });
      unsubDeleted = chatSocket.onMessageDeleted((payload: any) => {
        const deletedId =
          payload?.messageUUID ||
          payload?.message?.uuid ||
          payload?.data?.uuid ||
          payload?.uuid;
        if (!deletedId) return;
        setMessages(prev =>
          prev.map(m =>
            m.uuid === deletedId ? {...m, isDeleted: true} : m,
          ),
        );
      });
    };

    setup();
    return () => {
      cancelled = true;
      unsubReceived?.();
      unsubDeleted?.();
    };
  }, [conversation.uuid]);

  const handleLoadOlder = async () => {
    if (isLoadingMore || currentPage >= totalPages) return;
    setIsLoadingMore(true);
    await fetchPage(currentPage + 1, 'prepend');
    setIsLoadingMore(false);
  };

  // Append an attachment message to the local list after a successful upload.
  // The backend returns the saved Message under `.data` or `.data.message`
  // (or, on some installs, the root). Falls back to a temp row if the shape
  // is unknown so the user still sees their upload reflected immediately.
  const appendUploadedMessage = (raw: any, file: {name: string; type: string}) => {
    const sent: Message | undefined =
      raw?.data?.message || raw?.data || raw?.message || raw;
    if (sent?.uuid) {
      sentMessageIdsRef.current.add(sent.uuid);
      setMessages(prev =>
        prev.some(m => m.uuid === sent.uuid) ? prev : [...prev, sent],
      );
    } else {
      const tempUuid = `temp_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      setMessages(prev => [
        ...prev,
        {
          uuid: tempUuid,
          message: file.name,
          messageType: file.type.startsWith('image/') ? 'image' : 'file',
          senderUUID: currentUserUuid,
          createdAt: new Date().toISOString(),
        },
      ]);
    }
  };

  const handleAttachImage = async () => {
    if (attachmentUploading) return;
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
      // Reasonable cap so we don't time out on slow networks. 10MB matches
      // the avatar / corporate logo cap the rest of the app uses.
      if ((asset.fileSize ?? 0) > 10 * 1024 * 1024) {
        setError('Please choose an image smaller than 10MB.');
        return;
      }
      setAttachmentUploading(true);
      try {
        const raw = await chatService.uploadAttachment(token, conversation.uuid, {
          uri: asset.uri,
          name: asset.fileName || `photo-${Date.now()}.jpg`,
          type: asset.type || 'image/jpeg',
        });
        appendUploadedMessage(raw, {
          name: asset.fileName || 'photo.jpg',
          type: asset.type || 'image/jpeg',
        });
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
    if (attachmentUploading) return;
    try {
      const [picked] = await pick({
        type: [DocumentPickerTypes.allFiles],
      });
      if (!picked?.uri) return;
      setAttachmentUploading(true);
      try {
        const raw = await chatService.uploadAttachment(token, conversation.uuid, {
          uri: picked.uri,
          name: picked.name || `file-${Date.now()}`,
          type: picked.type || 'application/octet-stream',
        });
        appendUploadedMessage(raw, {
          name: picked.name || 'file',
          type: picked.type || 'application/octet-stream',
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed.');
      } finally {
        setAttachmentUploading(false);
      }
    } catch (err: any) {
      // The document picker throws on user-cancel — silently ignore.
      if (err?.code !== 'DOCUMENT_PICKER_CANCELED') {
        setError(err instanceof Error ? err.message : 'Could not pick file.');
      }
    }
  };

  const handleSend = async () => {
    const trimmed = draft.trim();
    if (!trimmed || isSending) return;

    // Optimistic local message — appears instantly so the user doesn't sit
    // staring at an empty input wondering if their tap registered. Replaced
    // with the server's canonical message when the response lands (or by the
    // socket echo, whichever wins).
    const tempUuid = `temp_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const tempMessage: Message = {
      uuid: tempUuid,
      message: trimmed,
      messageType: 'text',
      senderUUID: currentUserUuid,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMessage]);

    setIsSending(true);
    setDraft('');
    try {
      const res = await chatService.sendTextMessage(
        token,
        conversation.uuid,
        trimmed,
      );
      // Backend may return {data: Message}, {data: {message: Message}}, or
      // the message at the root — handle all three so the temp gets replaced
      // by the canonical record.
      const sent: Message | undefined =
        (res as any)?.data?.message ||
        (res as any)?.data ||
        (res as any)?.message ||
        (res as any);
      if (sent?.uuid) {
        sentMessageIdsRef.current.add(sent.uuid);
        setMessages(prev =>
          prev.map(m => (m.uuid === tempUuid ? sent : m)),
        );
      }
      // If the response shape was unexpected, leave the temp in place — the
      // socket echo will arrive shortly with the canonical uuid and dedupe
      // against the temp (or just appear as a second row, which is rare).
    } catch (err) {
      // Roll back: pull the temp row and restore the draft so the user can retry.
      setMessages(prev => prev.filter(m => m.uuid !== tempUuid));
      setError(err instanceof Error ? err.message : 'Could not send message.');
      setDraft(trimmed);
    } finally {
      setIsSending(false);
    }
  };

  const renderMessage = ({item}: {item: Message}) => {
    const own = isOwnMessage(item, currentUserUuid);
    const time = formatTime(item.createdAt);
    const body = item.isDeleted
      ? 'Message deleted'
      : item.messageType === 'image'
        ? `📷 ${stripHtml(item.message) || 'Photo'}`
        : item.messageType && item.messageType !== 'text'
          ? `📎 ${stripHtml(item.message) || 'Attachment'}`
          : stripHtml(item.message);
    const replyCount = item.replyCount || 0;
    const canReply =
      !item.isDeleted && item.uuid && !item.uuid.startsWith('temp_');
    // Sender chip — mirrors the web layout where each message shows the
    // sender's name + a small avatar above the bubble. For own messages we
    // use the session's display name; for received messages we fall back to
    // the conversation header (1:1) when the message itself lacks a sender.
    const senderName = own
      ? currentUserName || 'You'
      : item.sender?.name || headerName;
    const senderInitials = (senderName || 'U')
      .split(' ')
      .map(n => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
    const senderRawAvatar =
      !own && (item.sender?.avatar || headerAvatar) ? item.sender?.avatar || headerAvatar : null;
    const senderAvatar = senderRawAvatar
      ? senderRawAvatar.startsWith('http')
        ? senderRawAvatar
        : `${logoBaseUrl}${senderRawAvatar}`
      : null;
    return (
      <View
        style={[
          styles.bubbleRow,
          own ? styles.bubbleRowOwn : styles.bubbleRowOther,
        ]}>
        <View style={styles.bubbleColumn}>
          <View
            style={[
              styles.senderHeader,
              own ? styles.senderHeaderOwn : styles.senderHeaderOther,
            ]}>
            {!own ? (
              senderAvatar ? (
                <Image source={{uri: senderAvatar}} style={styles.senderAvatar} />
              ) : (
                <View
                  style={[
                    styles.senderAvatarFallback,
                    {backgroundColor: `${primaryColor}1f`},
                  ]}>
                  <Text
                    style={[styles.senderInitials, {color: primaryColor}]}>
                    {senderInitials}
                  </Text>
                </View>
              )
            ) : null}
            <Text style={styles.senderName} numberOfLines={1}>
              {senderName}
            </Text>
            {own ? (
              <View
                style={[
                  styles.senderAvatarFallback,
                  {backgroundColor: `${primaryColor}1f`},
                ]}>
                <Text style={[styles.senderInitials, {color: primaryColor}]}>
                  {senderInitials}
                </Text>
              </View>
            ) : null}
          </View>

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
          {canReply ? (
            <Pressable
              style={[
                styles.replyAction,
                own ? styles.replyActionOwn : styles.replyActionOther,
              ]}
              onPress={() => setReplyParent(item)}
              hitSlop={6}>
              <Icon
                name="reply-outline"
                size={13}
                color={primaryColor}
              />
              <Text style={[styles.replyActionText, {color: primaryColor}]}>
                {replyCount > 0 ? `Reply (${replyCount})` : 'Reply'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  };

  const initials = useMemo(
    () =>
      headerName
        .split(' ')
        .map(n => n[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase(),
    [headerName],
  );

  return (
    <KeyboardAvoidingView
      style={styles.page}
      // iOS needs explicit padding behavior so the content slides up.
      // Android relies on the manifest's `adjustResize` — KAV with any
      // behavior set on Android double-adjusts and hides the input behind
      // the keyboard's autocomplete bar.
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back">
          <Icon name="arrow-left" size={22} color="#0f172a" />
        </Pressable>
        <View style={styles.headerAvatarWrap}>
          {resolvedHeaderAvatar ? (
            <Image
              source={{uri: resolvedHeaderAvatar}}
              style={styles.headerAvatar}
            />
          ) : (
            <View
              style={[
                styles.headerAvatarFallback,
                {backgroundColor: `${primaryColor}1f`},
              ]}>
              <Text
                style={[styles.headerAvatarInitials, {color: primaryColor}]}>
                {initials || '?'}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.headerName} numberOfLines={1}>
          {headerName}
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={m => m.uuid}
          renderItem={renderMessage}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
          onEndReachedThreshold={0.2}
          ListHeaderComponent={
            isLoadingMore ? (
              <View style={styles.headerLoading}>
                <ActivityIndicator color={primaryColor} />
              </View>
            ) : currentPage < totalPages ? (
              <Pressable onPress={handleLoadOlder} style={styles.loadOlderBtn}>
                <Text style={[styles.loadOlderText, {color: primaryColor}]}>
                  Load older messages
                </Text>
              </Pressable>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Icon
                name="message-text-outline"
                size={42}
                color="#cbd5e1"
              />
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptyBody}>Say hi to start the thread.</Text>
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

      <View style={[styles.composer, {paddingBottom: 10 + androidKeyboardLift}]}>
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
          placeholder="Type a message"
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

      <EmojiPicker
        open={emojiPickerOpen}
        onClose={() => setEmojiPickerOpen(false)}
        onEmojiSelected={emoji => setDraft(prev => prev + emoji.emoji)}
      />

      <ReplyThreadSheet
        visible={replyParent !== null}
        token={token}
        conversationId={conversation.uuid}
        parent={replyParent}
        currentUserUuid={currentUserUuid}
        primaryColor={primaryColor}
        onClose={() => setReplyParent(null)}
        onReplyPosted={() => {
          // Optimistically bump the parent's reply count so the badge under
          // the bubble updates immediately. The next refetch will reconcile
          // if the server's count diverges (rare).
          if (!replyParent) return;
          setMessages(prev =>
            prev.map(m =>
              m.uuid === replyParent.uuid
                ? {...m, replyCount: (m.replyCount || 0) + 1}
                : m,
            ),
          );
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#f1f5f9',
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  headerAvatarWrap: {
    height: 36,
    width: 36,
  },
  headerAvatar: {
    borderRadius: 18,
    height: 36,
    width: 36,
  },
  headerAvatarFallback: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  headerAvatarInitials: {
    fontSize: 14,
    fontWeight: '700',
  },
  headerName: {
    color: '#0f172a',
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  messagesList: {
    // flex: 1 lets the FlatList shrink when Android's adjustResize fires —
    // without this it grows to content height and pushes the composer below
    // the keyboard.
    flex: 1,
  },
  messagesContent: {
    // flexGrow: 1 + justifyContent: 'flex-end' pins messages to the bottom
    // (WhatsApp-style) when the thread doesn't yet fill the viewport.
    flexGrow: 1,
    justifyContent: 'flex-end',
    padding: 12,
  },
  headerLoading: {
    paddingVertical: 12,
  },
  loadOlderBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  loadOlderText: {
    fontSize: 13,
    fontWeight: '700',
  },
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  bubbleColumn: {
    flexShrink: 1,
    maxWidth: '85%',
  },
  senderHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  senderHeaderOwn: {
    alignSelf: 'flex-end',
  },
  senderHeaderOther: {
    alignSelf: 'flex-start',
  },
  senderAvatar: {
    borderRadius: 11,
    height: 22,
    width: 22,
  },
  senderAvatarFallback: {
    alignItems: 'center',
    borderRadius: 11,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  senderInitials: {
    fontSize: 10,
    fontWeight: '800',
  },
  senderName: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '700',
  },
  replyAction: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  replyActionOwn: {
    alignSelf: 'flex-end',
  },
  replyActionOther: {
    alignSelf: 'flex-start',
  },
  replyActionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  bubbleRowOwn: {
    justifyContent: 'flex-end',
  },
  bubbleRowOther: {
    justifyContent: 'flex-start',
  },
  bubble: {
    borderRadius: 14,
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
    gap: 4,
  },
  composerIcon: {
    alignItems: 'center',
    height: 36,
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
  emptyState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyTitle: {
    color: '#0f172a',
    fontSize: 16,
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
