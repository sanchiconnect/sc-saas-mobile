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
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Video from 'react-native-video';

import {Icon} from '../../../core/components/Icon';
import {colors} from '../../../core/theme/colors';
import {TenantContext} from '../../../core/tenant/TenantProvider';
import {launchImageLibrary} from 'react-native-image-picker';
import {pick, types as DocumentPickerTypes} from '@react-native-documents/picker';
import EmojiPicker from 'rn-emoji-keyboard';

import {ConfirmModal} from '../../../core/components/ConfirmModal';
import {MediaViewerModal} from '../components/MediaViewerModal';
import {ReplyThreadSheet} from '../components/ReplyThreadSheet';
import {chatService} from '../services/chat.service';
import {chatSocket} from '../services/chat.socket';
import type {Conversation, ConversationParticipant, Message} from '../types';
import {getAttachmentInfo, isMessageDeleted, stripHtml} from '../utils';
import type {AttachmentInfo} from '../utils';

// Render the media payload for an attachment message. Images and videos
// tap-open a full-screen lightbox via `onOpen`; files hand the URL to the
// OS browser so the user can read/download in whatever app they prefer.
// `onLongPress` is forwarded onto the inner Pressable so the action sheet
// (Delete etc.) reveals on long-press even on media bubbles — without this
// the child Pressable would swallow the long-press and the parent bubble's
// onLongPress would never fire.
const renderAttachment = (
  attachment: AttachmentInfo,
  own: boolean,
  primaryColor: string,
  onOpen: (info: AttachmentInfo) => void,
  onLongPress?: () => void,
) => {
  if (attachment.kind === 'image') {
    return (
      <Pressable
        onPress={() => onOpen(attachment)}
        onLongPress={onLongPress}
        delayLongPress={350}
        style={attachmentStyles.imageWrap}>
        <Image
          source={{uri: attachment.url}}
          style={attachmentStyles.image}
          resizeMode="cover"
        />
      </Pressable>
    );
  }
  if (attachment.kind === 'video') {
    return (
      <Pressable
        onPress={() => onOpen(attachment)}
        onLongPress={onLongPress}
        delayLongPress={350}
        style={attachmentStyles.videoWrap}>
        <Video
          source={{uri: attachment.url}}
          style={attachmentStyles.video}
          controls={false}
          paused
          resizeMode="cover"
        />
        <View style={attachmentStyles.videoPlayOverlay} pointerEvents="none">
          <Icon name="play-circle" size={48} color="#ffffff" />
        </View>
      </Pressable>
    );
  }
  // File chip — colors flip so the chip stays legible inside both bubble
  // variants (own = dark on light surface, other = primary on light).
  const fg = own ? '#0f172a' : primaryColor;
  return (
    <Pressable
      onPress={() => Linking.openURL(attachment.url).catch(() => {})}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={[
        attachmentStyles.fileChip,
        {backgroundColor: own ? '#ffffff' : '#f8fafc'},
      ]}>
      <Icon name="file-document-outline" size={20} color={fg} />
      <Text
        style={[attachmentStyles.fileChipText, {color: fg}]}
        numberOfLines={1}>
        {attachment.fileName}
      </Text>
      <Icon name="open-in-new" size={16} color={fg} />
    </Pressable>
  );
};

const attachmentStyles = StyleSheet.create({
  imageWrap: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  image: {
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    height: 200,
    width: 220,
  },
  videoWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  video: {
    backgroundColor: '#000000',
    borderRadius: 12,
    height: 200,
    width: 220,
  },
  // Center the play glyph over the paused video poster so users see at a
  // glance that the bubble is a tappable video preview, not an image.
  videoPlayOverlay: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  fileChip: {
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 8,
    maxWidth: 240,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  fileChipText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '600',
  },
});

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

// Match the web's getConversationTitle(): for 1:1 chats prefer the *other*
// member's name (so users see their counterparty, not a slash-concatenated
// conversation name); for group chats fall back to conversation.name.
const findOtherMember = (
  conversation: Conversation,
  currentUserUuid?: string,
): ConversationParticipant | undefined => {
  if (conversation.otherUser) return conversation.otherUser;
  const pool =
    conversation.members && conversation.members.length > 0
      ? conversation.members
      : conversation.participants;
  return pool?.find(p => p.uuid !== currentUserUuid);
};

const isDirectChat = (conversation: Conversation): boolean => {
  if (conversation.conversationType === 'user') return true;
  if (conversation.chatType === 'private') return true;
  const pool =
    conversation.members && conversation.members.length > 0
      ? conversation.members
      : conversation.participants;
  if (pool && pool.length === 2) return true;
  return false;
};

const resolveHeaderName = (
  conversation: Conversation,
  currentUserUuid?: string,
): string => {
  if (isDirectChat(conversation)) {
    const other = findOtherMember(conversation, currentUserUuid);
    if (other?.name) return other.name;
  }
  return conversation.name || 'Conversation';
};

const resolveHeaderAvatar = (
  conversation: Conversation,
  currentUserUuid?: string,
): string | null => {
  if (isDirectChat(conversation)) {
    const other = findOtherMember(conversation, currentUserUuid);
    if (other?.avatar) return other.avatar;
  }
  return conversation.logo || conversation.avatar || null;
};

// Decide if a message was sent by the current user. The web compares against
// `message.user.uuid` — match that primarily and keep `sender` / `senderUUID`
// as fallbacks for sockets / older payloads.
const isOwnMessage = (m: Message, currentUserUuid?: string): boolean => {
  if (!currentUserUuid) return false;
  return (
    m.user?.uuid === currentUserUuid ||
    m.senderUUID === currentUserUuid ||
    m.sender?.uuid === currentUserUuid
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track messages we just sent locally so the socket echo doesn't dupe them.
  const sentMessageIdsRef = useRef<Set<string>>(new Set());

  // Refs for auto-scrolling to the latest message. `flatListRef` is the
  // list handle; `initialScrolledRef` flips after the first scroll so the
  // very first jump is instant (we open at the bottom) but every later
  // append animates smoothly. `skipNextAutoScrollRef` is flipped right
  // before a "Load older messages" prepend — without it the content-size
  // change would yank the view back to the bottom and undo the older-load.
  const flatListRef = useRef<FlatList<Message>>(null);
  const initialScrolledRef = useRef(false);
  const skipNextAutoScrollRef = useRef(false);

  // Active reply target — when set, the ReplyThreadSheet renders for this
  // parent message. Null = no thread open.
  const [replyParent, setReplyParent] = useState<Message | null>(null);
  // Long-press → action sheet → ConfirmModal flow for deleting your own
  // messages. `actionSheetMessage` mirrors the web's hover-reveal: a small
  // menu appears with the Delete option once the user "hovers" (long-presses)
  // a bubble. `pendingDeleteMessage` then triggers the confirm step.
  const [actionSheetMessage, setActionSheetMessage] = useState<Message | null>(
    null,
  );
  const [pendingDeleteMessage, setPendingDeleteMessage] =
    useState<Message | null>(null);
  const [isDeletingMessage, setIsDeletingMessage] = useState(false);

  // Attachment + emoji UI state. `attachmentUploading` blocks send and shows
  // a spinner on the active attachment icon. `emojiPickerOpen` toggles the
  // rn-emoji-keyboard sheet.
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  // Lightbox state — tapping an image/video bubble opens the full-screen
  // viewer with a download action.
  const [mediaViewer, setMediaViewer] = useState<AttachmentInfo | null>(null);

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

  // Switching conversations resets the auto-scroll state so the next
  // thread also opens at its latest message (instant, no animation).
  useEffect(() => {
    initialScrolledRef.current = false;
    skipNextAutoScrollRef.current = false;
  }, [conversation.uuid]);

  // Auto-scroll to the latest message whenever the count grows OR when
  // the list flips out of its initial loading state. The `isLoading` dep
  // matters specifically for the *first* conversation opened: the FlatList
  // is conditionally rendered, so its ref is null while the spinner is up.
  // If we only watched `messages.length` the effect could fire before the
  // ref attached, leaving scrollToEnd as a no-op. Re-running when isLoading
  // flips to false guarantees the ref is live before we scroll. A short
  // setTimeout lets the layout pass finalize before scrollToEnd computes
  // its target offset. `skipNextAutoScrollRef` is honored so a "Load older"
  // prepend doesn't yank the user back to the bottom.
  useEffect(() => {
    if (isLoading) return;
    if (messages.length === 0) return;
    if (skipNextAutoScrollRef.current) {
      skipNextAutoScrollRef.current = false;
      return;
    }
    const handle = setTimeout(() => {
      flatListRef.current?.scrollToEnd({
        animated: initialScrolledRef.current,
      });
      initialScrolledRef.current = true;
    }, 120);
    return () => clearTimeout(handle);
  }, [messages.length, isLoading]);

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
    // Tell the auto-scroll watcher to ignore the upcoming content-size
    // growth — those new rows land at the *top* of the list and we want
    // the user to stay where they were reading.
    skipNextAutoScrollRef.current = true;
    setIsLoadingMore(true);
    await fetchPage(currentPage + 1, 'prepend');
    setIsLoadingMore(false);
  };

  // Delete (soft) the user's own message. Mirrors the web's handleDelete:
  // hit the API, then mark the local copy as deleted so the "tombstone"
  // bubble renders without removing the row.
  const handleConfirmDelete = async () => {
    const target = pendingDeleteMessage;
    if (!target?.uuid) return;
    setIsDeletingMessage(true);
    try {
      await chatService.deleteMessage(token, conversation.uuid, target.uuid);
      setMessages(prev =>
        prev.map(m =>
          m.uuid === target.uuid
            ? {...m, isDeleted: true, message: 'Deleted'}
            : m,
        ),
      );
      setPendingDeleteMessage(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not delete the message.',
      );
    } finally {
      setIsDeletingMessage(false);
    }
  };

  // Pull-to-refresh: re-fetch the first page and replace the visible list.
  // Skipped while a paginated load-older is already in flight to avoid
  // racing two writes against the same messages state.
  const handleRefresh = async () => {
    if (isRefreshing || isLoadingMore) return;
    setIsRefreshing(true);
    try {
      await fetchPage(1, 'replace');
      setCurrentPage(1);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Build an optimistic message that renders the picked file's local URI
  // as its preview — we set `fileUrl` to the device URI so the helper's
  // local-scheme branch kicks in and the bubble shows the actual image /
  // video / file chip the moment the user picks, well before the upload
  // finishes. `refreshAfterUpload` then replaces this row with the
  // server's canonical message (which carries the presigned URL).
  const buildOptimisticAttachment = (
    uri: string,
    name: string,
    mimeType: string,
  ): {temp: Message; tempUuid: string} => {
    const tempUuid = `temp_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const messageType: Message['messageType'] = mimeType.startsWith('image/')
      ? 'image'
      : mimeType.startsWith('video/')
        ? 'video'
        : 'file';
    return {
      tempUuid,
      temp: {
        uuid: tempUuid,
        message: name,
        messageType,
        fileUrl: uri,
        senderUUID: currentUserUuid,
        user: currentUserUuid
          ? {uuid: currentUserUuid, name: currentUserName}
          : undefined,
        createdAt: new Date().toISOString(),
      },
    };
  };

  // Pull page 1 fresh after a successful upload so the canonical message
  // (with its presigned asset URL) replaces the optimistic local-URI row.
  // Without this the temp would linger and the bubble would keep pointing
  // at the device URI instead of the server's copy.
  const refreshAfterUpload = async () => {
    await fetchPage(1, 'replace');
    setCurrentPage(1);
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
      const name = asset.fileName || `photo-${Date.now()}.jpg`;
      const type = asset.type || 'image/jpeg';
      const {temp, tempUuid} = buildOptimisticAttachment(asset.uri, name, type);
      setMessages(prev => [...prev, temp]);
      setAttachmentUploading(true);
      try {
        await chatService.uploadAttachment(token, conversation.uuid, {
          uri: asset.uri,
          name,
          type,
        });
        await refreshAfterUpload();
      } catch (err) {
        // Roll back the optimistic row on failure so the user can retry.
        setMessages(prev => prev.filter(m => m.uuid !== tempUuid));
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
      const name = picked.name || `file-${Date.now()}`;
      const type = picked.type || 'application/octet-stream';
      const {temp, tempUuid} = buildOptimisticAttachment(picked.uri, name, type);
      setMessages(prev => [...prev, temp]);
      setAttachmentUploading(true);
      try {
        await chatService.uploadAttachment(token, conversation.uuid, {
          uri: picked.uri,
          name,
          type,
        });
        await refreshAfterUpload();
      } catch (err) {
        setMessages(prev => prev.filter(m => m.uuid !== tempUuid));
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

  const renderMessage = ({item, index}: {item: Message; index: number}) => {
    const own = isOwnMessage(item, currentUserUuid);
    const time = formatTime(item.createdAt);
    // Soft-delete flag may arrive under different field names depending on
    // the code path (local optimistic vs REST refetch) — normalize first.
    const deleted = isMessageDeleted(item);
    // Uploaded attachments come back either inlined in `message` (refetch
    // path) or split between `fileUrl` and `message` (upload-response). Pass
    // both so freshly-uploaded files render as previews immediately rather
    // than waiting for a refresh.
    const attachment = deleted
      ? null
      : getAttachmentInfo(item.message, item.messageType, item.fileUrl);
    const body = deleted
      ? 'Message deleted'
      : attachment
        ? ''
        : stripHtml(item.message);
    const replyCount = item.replyCount || 0;
    const canReply =
      !deleted && item.uuid && !item.uuid.startsWith('temp_');

    // Tighter spacing between consecutive messages from the same sender —
    // the avatar + name strip still renders on every message (matches the
    // web's layout) but a run reads as a single utterance.
    const prev = index > 0 ? messages[index - 1] : null;
    const prevSenderUuid =
      prev?.user?.uuid || prev?.sender?.uuid || prev?.senderUUID || null;
    const thisSenderUuid =
      item.user?.uuid || item.sender?.uuid || item.senderUUID || null;
    const sameSenderAsPrev =
      prev != null && prevSenderUuid != null && prevSenderUuid === thisSenderUuid;

    const messageSender = item.user || item.sender;
    const senderName = own
      ? currentUserName || messageSender?.name || 'You'
      : messageSender?.name || headerName;
    const senderInitials = (senderName || 'U')
      .split(' ')
      .map(n => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
    const senderRawAvatar = own
      ? messageSender?.avatar || null
      : messageSender?.avatar || headerAvatar;
    const senderAvatar = senderRawAvatar
      ? senderRawAvatar.startsWith('http')
        ? senderRawAvatar
        : `${logoBaseUrl}${senderRawAvatar}`
      : null;

    const avatarNode = (
      <View style={styles.bubbleAvatarWrap}>
        <View
          style={[
            styles.bubbleAvatarFallback,
            {backgroundColor: `${primaryColor}1f`},
          ]}>
          <Text style={[styles.bubbleAvatarInitials, {color: primaryColor}]}>
            {senderInitials || '?'}
          </Text>
        </View>
        {senderAvatar ? (
          <Image
            source={{uri: senderAvatar}}
            style={[styles.bubbleAvatar, styles.bubbleAvatarOverlay]}
          />
        ) : null}
      </View>
    );

    return (
      <View
        style={[
          styles.bubbleRow,
          own ? styles.bubbleRowOwn : styles.bubbleRowOther,
          sameSenderAsPrev ? styles.bubbleRowTight : null,
        ]}>
        {!own ? avatarNode : null}
        <View
          style={[
            styles.bubbleColumn,
            own ? styles.bubbleColumnOwn : styles.bubbleColumnOther,
          ]}>
          <Text
            style={[
              styles.senderName,
              own ? styles.senderNameOwn : null,
              {color: own ? '#475569' : primaryColor},
            ]}
            numberOfLines={1}>
            {senderName}
          </Text>

          {deleted ? (
            // Muted "deleted" bubble — matches the web layout: warning icon
            // + italic "This message is deleted" text on a neutral surface,
            // no timestamp inside the bubble.
            <View style={styles.bubbleDeleted}>
              <Icon
                name="alert-outline"
                size={14}
                color="#94a3b8"
              />
              <Text style={styles.bubbleDeletedText}>
                This message is deleted
              </Text>
            </View>
          ) : (
            <Pressable
              // Long-press own messages to reveal the action menu (Delete).
              // Mirrors the web's hover-to-reveal pattern, adapted to touch.
              // Skipped for received messages and optimistic temp rows.
              onLongPress={
                own && item.uuid && !item.uuid.startsWith('temp_')
                  ? () => setActionSheetMessage(item)
                  : undefined
              }
              delayLongPress={350}
              style={[
                styles.bubble,
                own
                  ? [styles.bubbleOwn, {backgroundColor: primaryColor}]
                  : styles.bubbleOther,
                attachment ? styles.bubbleMedia : null,
              ]}>
              {attachment ? (
                renderAttachment(
                  attachment,
                  own,
                  primaryColor,
                  setMediaViewer,
                  own && item.uuid && !item.uuid.startsWith('temp_')
                    ? () => setActionSheetMessage(item)
                    : undefined,
                )
              ) : (
                <Text
                  style={[
                    styles.bubbleText,
                    own ? styles.bubbleTextOwn : styles.bubbleTextOther,
                  ]}>
                  {body}
                </Text>
              )}
              <Text
                style={[
                  styles.bubbleTime,
                  own ? styles.bubbleTimeOwn : styles.bubbleTimeOther,
                  attachment ? styles.bubbleTimeMedia : null,
                ]}>
                {time}
              </Text>
            </Pressable>
          )}
          {canReply ? (
            <Pressable
              style={[
                styles.replyAction,
                own ? styles.replyActionOwn : styles.replyActionOther,
              ]}
              onPress={() => setReplyParent(item)}
              hitSlop={6}>
              <Icon name="reply-outline" size={13} color="#94a3b8" />
              <Text style={styles.replyActionText}>
                {replyCount > 0 ? `Reply (${replyCount})` : 'Reply'}
              </Text>
            </Pressable>
          ) : null}
        </View>
        {own ? avatarNode : null}
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
          {/* Initials fallback always renders behind the Image so a broken
              avatar URL still surfaces something visible instead of an empty
              circle. */}
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
          {resolvedHeaderAvatar ? (
            <Image
              source={{uri: resolvedHeaderAvatar}}
              style={[styles.headerAvatar, styles.headerAvatarOverlay]}
            />
          ) : null}
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
          ref={flatListRef}
          data={messages}
          // Fall back to index when a message arrives without a uuid (rare,
          // but observed on some legacy events) — otherwise multiple rows
          // collide on the undefined key and React warns.
          keyExtractor={(m, index) => m.uuid || `idx-${index}`}
          renderItem={({item, index}) => renderMessage({item, index})}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
          onEndReachedThreshold={0.2}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={primaryColor}
              colors={[primaryColor]}
            />
          }
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

      <ConfirmModal
        visible={pendingDeleteMessage !== null}
        title="Delete this message?"
        message="The message will be marked as deleted for everyone in this conversation. This can't be undone."
        confirmLabel="Delete"
        cancelLabel="Keep"
        variant="destructive"
        loading={isDeletingMessage}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDeleteMessage(null)}
      />

      <MediaViewerModal
        attachment={mediaViewer}
        onClose={() => setMediaViewer(null)}
      />

      <Modal
        transparent
        visible={actionSheetMessage !== null}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setActionSheetMessage(null)}>
        <Pressable
          style={styles.actionSheetBackdrop}
          onPress={() => setActionSheetMessage(null)}>
          <Pressable style={styles.actionSheet} onPress={() => {}}>
            <View style={styles.actionSheetHandle} />
            <Text style={styles.actionSheetTitle}>Message options</Text>
            <Pressable
              style={styles.actionSheetItem}
              onPress={() => {
                const target = actionSheetMessage;
                setActionSheetMessage(null);
                if (target) setPendingDeleteMessage(target);
              }}>
              <Icon name="trash-can-outline" size={20} color="#dc2626" />
              <Text style={styles.actionSheetItemTextDestructive}>Delete</Text>
            </Pressable>
            <Pressable
              style={styles.actionSheetCancel}
              onPress={() => setActionSheetMessage(null)}>
              <Text style={styles.actionSheetCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

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
  headerAvatarOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
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
    // Messages start at the top of the list and fill downward. The previous
    // bottom-anchor (flexGrow:1 + justifyContent:'flex-end') created a large
    // blank area above sparse threads.
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
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  // Tighter spacing for consecutive messages from the same sender (chat-app
  // convention — runs read as a single utterance).
  bubbleRowTight: {
    marginBottom: 2,
  },
  bubbleAvatarWrap: {
    height: 32,
    width: 32,
  },
  bubbleAvatar: {
    borderRadius: 16,
    height: 32,
    width: 32,
  },
  bubbleAvatarOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  bubbleAvatarFallback: {
    alignItems: 'center',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  bubbleAvatarInitials: {
    fontSize: 11,
    fontWeight: '800',
  },
  bubbleColumn: {
    // Tighter cap so the bubble + avatar combo fits comfortably side by side
    // without spilling against the screen edge.
    flexShrink: 1,
    maxWidth: '72%',
  },
  bubbleColumnOwn: {
    alignItems: 'flex-end',
  },
  bubbleColumnOther: {
    alignItems: 'flex-start',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
    marginLeft: 4,
  },
  senderNameOwn: {
    marginLeft: 0,
    marginRight: 4,
  },
  replyAction: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginTop: 2,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  replyActionOwn: {
    alignSelf: 'flex-end',
  },
  replyActionOther: {
    alignSelf: 'flex-start',
  },
  replyActionText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  bubbleRowOwn: {
    justifyContent: 'flex-end',
  },
  bubbleRowOther: {
    justifyContent: 'flex-start',
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    // Subtle shadow so bubbles read clearly against the chat surface.
    elevation: 1,
    shadowColor: '#0f172a',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  bubbleOwn: {
    // Tail on the right — looks like the message points toward your avatar.
    borderTopRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#ffffff',
    // Tail on the left — points toward the counterparty's avatar.
    borderTopLeftRadius: 4,
  },
  // Media bubbles get tighter padding so the image/video sits flush inside
  // the rounded surface — text bubbles keep the usual breathing room.
  bubbleMedia: {
    paddingBottom: 4,
    paddingHorizontal: 4,
    paddingTop: 4,
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
  bubbleDeleted: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleDeletedText: {
    color: '#94a3b8',
    fontSize: 13,
    fontStyle: 'italic',
    fontWeight: '500',
  },
  bubbleTime: {
    fontSize: 10,
    marginTop: 2,
    textAlign: 'right',
  },
  bubbleTimeOwn: {
    color: '#e0e7ff',
  },
  bubbleTimeOther: {
    color: '#94a3b8',
  },
  // Time row sits below the image/video preview — give it a small inset so
  // it doesn't crowd against the rounded media corners.
  bubbleTimeMedia: {
    marginTop: 4,
    paddingRight: 4,
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
  // Long-press action sheet — bottom-anchored card with the Delete option.
  // Backdrop tap and Cancel both dismiss; tap on Delete forwards to the
  // existing ConfirmModal so the destructive step still requires explicit
  // confirmation.
  actionSheetBackdrop: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 24,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  actionSheetHandle: {
    alignSelf: 'center',
    backgroundColor: '#cbd5e1',
    borderRadius: 2,
    height: 4,
    marginBottom: 12,
    width: 44,
  },
  actionSheetTitle: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  actionSheetItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 4,
    paddingVertical: 14,
  },
  actionSheetItemTextDestructive: {
    color: '#dc2626',
    fontSize: 15,
    fontWeight: '600',
  },
  actionSheetCancel: {
    alignItems: 'center',
    borderTopColor: '#e2e8f0',
    borderTopWidth: 1,
    marginTop: 4,
    paddingVertical: 14,
  },
  actionSheetCancelText: {
    color: '#475569',
    fontSize: 15,
    fontWeight: '600',
  },
});
