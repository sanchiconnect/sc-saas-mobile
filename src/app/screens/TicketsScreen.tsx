import React, {useContext, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {launchImageLibrary} from 'react-native-image-picker';

import {authService} from '../../auth/services/auth.service';
import {TenantContext} from '../../context/TenantProvider';
import {AppButton} from '../../shared/components/AppButton';
import {AppTextField} from '../../shared/components/AppTextField';
import {Icon} from '../../shared/components/Icon';
import {colors} from '../../shared/theme/colors';

type TicketsScreenProps = {
  token: string;
  onBack: () => void;
  primaryColor: string;
};

type IssueTypeOption = {
  id: number;
  name: string;
};

type LocalAttachment = {
  id: string;
  uri: string;
  name: string;
  size: string;
  type: string;
  uploadedPath?: string;
  uploading?: boolean;
  error?: string;
};

type RemoteTicket = {
  id: number;
  uuid: string;
  ticketNumber: number;
  title: string;
  ticketStatus: string;
  severity: string;
  createdAt: string;
  modifiedAt: string;
  issueType?: {name?: string};
  lastUpdate?: string;
  isSupportReplied?: boolean;
};

type TicketConversation = {
  uuid: string;
  createdAt: string;
  text: string;
  attachments?: string[];
  user?: {uuid?: string; name?: string} | null;
  admin?: {uuid?: string; name?: string} | null;
};

type TicketDetail = {
  uuid: string;
  ticketNumber: number;
  title: string;
  ticketStatus: string;
  createdAt: string;
  modifiedAt: string;
  issueType?: {name?: string};
  assignedToIds?: Array<{name?: string; role?: number}>;
  user?: {uuid?: string; name?: string} | null;
  conversations?: TicketConversation[];
};

type FormState = {
  issueTypeId: number | null;
  title: string;
  description: string;
  attachmentsEnabled: boolean;
  attachments: LocalAttachment[];
};

const INITIAL_FORM: FormState = {
  issueTypeId: null,
  title: '',
  description: '',
  attachmentsEnabled: true,
  attachments: [],
};

const formatBytes = (size?: number) => {
  if (!size || size <= 0) {
    return '';
  }
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(0)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const formatTicketDate = (raw: string) => {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatRelativeTime = (raw: string) => {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) {
    return 'just now';
  }
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }
  return formatTicketDate(raw);
};

const resolveAttachmentUri = (
  path: string,
  baseUrl?: string | null,
) => {
  if (!path) {
    return null;
  }
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  if (!baseUrl) {
    return null;
  }
  return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
};

const isImageAttachment = (path: string) =>
  /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(path);

export function TicketsScreen({
  token,
  onBack,
  primaryColor,
}: TicketsScreenProps) {
  const {theme, globalSetting} = useContext(TenantContext);
  const secondaryColor = theme?.secondary || '#1e1f3a';
  const dangerColor = theme?.danger || '#dc2626';
  const attachmentBaseUrl =
    (globalSetting as any)?.s3Url ||
    (globalSetting as any)?.imgKitUrl ||
    (globalSetting as any)?.assetsImgKitUrl ||
    null;

  const [issueTypes, setIssueTypes] = useState<IssueTypeOption[]>([]);
  const [tickets, setTickets] = useState<RemoteTicket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isIssuePickerOpen, setIsIssuePickerOpen] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<{
    issueType?: string;
    title?: string;
    description?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedTicketUuid, setSelectedTicketUuid] = useState<string | null>(
    null,
  );
  const [detailData, setDetailData] = useState<TicketDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyAttachments, setReplyAttachments] = useState<LocalAttachment[]>(
    [],
  );
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  const selectedIssueType = useMemo(
    () => issueTypes.find(item => item.id === form.issueTypeId) || null,
    [issueTypes, form.issueTypeId],
  );

  const isValid = useMemo(
    () =>
      Boolean(
        form.issueTypeId && form.title.trim() && form.description.trim(),
      ),
    [form.issueTypeId, form.title, form.description],
  );

  const loadTickets = async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') {
      setIsLoadingTickets(true);
    } else {
      setIsRefreshing(true);
    }
    setLoadError(null);
    try {
      const response = await authService.getTickets(token);
      const items: RemoteTicket[] = response?.data?.items || [];
      setTickets(items);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : 'Could not load tickets.',
      );
    } finally {
      setIsLoadingTickets(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    authService
      .getTicketIssueTypes()
      .then(response => {
        if (cancelled) return;
        const items: IssueTypeOption[] = (response?.data || []).map(
          (item: any) => ({id: Number(item?.id), name: String(item?.name)}),
        );
        setIssueTypes(items.filter(item => Number.isFinite(item.id)));
      })
      .catch(() => {
        if (!cancelled) {
          setIssueTypes([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void loadTickets('initial');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadDetail = async (uuid: string) => {
    setIsLoadingDetail(true);
    setDetailError(null);
    try {
      const response = await authService.getTicketDetail(token, uuid);
      setDetailData((response?.data as TicketDetail) || null);
    } catch (error) {
      setDetailError(
        error instanceof Error ? error.message : 'Could not load ticket detail.',
      );
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleOpenDetail = (uuid: string) => {
    setSelectedTicketUuid(uuid);
    setDetailData(null);
    setReplyText('');
    setReplyAttachments([]);
    void loadDetail(uuid);
  };

  const handleCloseDetail = () => {
    setSelectedTicketUuid(null);
    setDetailData(null);
    setDetailError(null);
    setReplyText('');
    setReplyAttachments([]);
  };

  const handleAddReplyAttachment = async () => {
    try {
      if (typeof launchImageLibrary !== 'function') {
        Alert.alert(
          'Attachment upload unavailable',
          'Image picker is not ready yet. Please rebuild the app and try again.',
        );
        return;
      }

      const result = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
        includeBase64: false,
      });
      if (result.didCancel || result.errorCode) {
        return;
      }
      const asset = result.assets?.[0];
      if (!asset?.uri) {
        return;
      }

      const attachment: LocalAttachment = {
        id: `${Date.now()}_${replyAttachments.length}`,
        uri: asset.uri,
        name: asset.fileName || `attachment_${Date.now()}.jpg`,
        size: formatBytes(asset.fileSize),
        type: asset.type || 'image/jpeg',
        uploading: true,
      };
      setReplyAttachments(prev => [...prev, attachment]);

      try {
        const uploadResponse = await authService.uploadTicketAttachments(
          token,
          [
            {
              uri: attachment.uri,
              name: attachment.name,
              type: attachment.type,
            },
          ],
        );
        const paths: string[] = uploadResponse?.data || [];
        setReplyAttachments(prev =>
          prev.map(item =>
            item.id === attachment.id
              ? {...item, uploadedPath: paths[0], uploading: false}
              : item,
          ),
        );
      } catch (uploadError) {
        const message =
          uploadError instanceof Error
            ? uploadError.message
            : 'Upload failed.';
        setReplyAttachments(prev =>
          prev.map(item =>
            item.id === attachment.id
              ? {...item, uploading: false, error: message}
              : item,
          ),
        );
      }
    } catch (error) {
      Alert.alert(
        'Attachment failed',
        error instanceof Error ? error.message : 'Could not pick the file.',
      );
    }
  };

  const handleRemoveReplyAttachment = (id: string) => {
    setReplyAttachments(prev => prev.filter(item => item.id !== id));
  };

  const handleSubmitReply = async () => {
    if (!selectedTicketUuid) {
      return;
    }
    if (!replyText.trim()) {
      Alert.alert('Reply required', 'Please write a reply before submitting.');
      return;
    }
    if (replyAttachments.some(item => item.uploading)) {
      Alert.alert('Please wait', 'Attachments are still uploading.');
      return;
    }

    const attachmentPaths = replyAttachments
      .map(item => item.uploadedPath)
      .filter((path): path is string => Boolean(path));

    setIsSubmittingReply(true);
    try {
      await authService.addTicketConversation(token, selectedTicketUuid, {
        description: replyText.trim(),
        attachments: attachmentPaths,
      });
      setReplyText('');
      setReplyAttachments([]);
      await loadDetail(selectedTicketUuid);
    } catch (error) {
      Alert.alert(
        'Could not send reply',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const openCreateModal = () => {
    setForm(INITIAL_FORM);
    setErrors({});
    setIsModalVisible(true);
  };

  const closeCreateModal = () => {
    setIsModalVisible(false);
    setIsIssuePickerOpen(false);
  };

  const updateForm = <K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) => {
    setForm(current => ({...current, [key]: value}));
  };

  const handleSelectIssueType = (option: IssueTypeOption) => {
    updateForm('issueTypeId', option.id);
    setErrors(current => ({...current, issueType: undefined}));
    setIsIssuePickerOpen(false);
  };

  const handleAddAttachment = async () => {
    try {
      if (typeof launchImageLibrary !== 'function') {
        Alert.alert(
          'Attachment upload unavailable',
          'Image picker is not ready yet. Please rebuild the app and try again.',
        );
        return;
      }

      const result = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
        includeBase64: false,
      });

      if (result.didCancel) {
        return;
      }
      if (result.errorCode) {
        Alert.alert(
          'Attachment failed',
          result.errorMessage || 'Could not open the image picker.',
        );
        return;
      }

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        return;
      }

      const attachment: LocalAttachment = {
        id: `${Date.now()}_${form.attachments.length}`,
        uri: asset.uri,
        name: asset.fileName || `attachment_${Date.now()}.jpg`,
        size: formatBytes(asset.fileSize),
        type: asset.type || 'image/jpeg',
        uploading: true,
      };

      setForm(current => ({
        ...current,
        attachments: [...current.attachments, attachment],
      }));

      try {
        const uploadResponse = await authService.uploadTicketAttachments(
          token,
          [
            {
              uri: attachment.uri,
              name: attachment.name,
              type: attachment.type,
            },
          ],
        );
        const paths: string[] = uploadResponse?.data || [];
        setForm(current => ({
          ...current,
          attachments: current.attachments.map(item =>
            item.id === attachment.id
              ? {...item, uploadedPath: paths[0], uploading: false}
              : item,
          ),
        }));
      } catch (uploadError) {
        const message =
          uploadError instanceof Error
            ? uploadError.message
            : 'Upload failed.';
        setForm(current => ({
          ...current,
          attachments: current.attachments.map(item =>
            item.id === attachment.id
              ? {...item, uploading: false, error: message}
              : item,
          ),
        }));
      }
    } catch (error) {
      Alert.alert(
        'Attachment failed',
        error instanceof Error ? error.message : 'Could not pick the file.',
      );
    }
  };

  const handleRemoveAttachment = (id: string) => {
    updateForm(
      'attachments',
      form.attachments.filter(item => item.id !== id),
    );
  };

  const handleToggleAttachments = (value: boolean) => {
    setForm(current => ({
      ...current,
      attachmentsEnabled: value,
      attachments: value ? current.attachments : [],
    }));
  };

  const handleSubmit = async () => {
    const nextErrors: typeof errors = {};
    if (!form.issueTypeId) {
      nextErrors.issueType = 'Please choose an issue type.';
    }
    if (!form.title.trim()) {
      nextErrors.title = 'Please enter a title.';
    }
    if (!form.description.trim()) {
      nextErrors.description = 'Please describe the issue.';
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const stillUploading = form.attachments.some(item => item.uploading);
    if (stillUploading) {
      Alert.alert('Please wait', 'Attachments are still uploading.');
      return;
    }

    const attachmentPaths = form.attachmentsEnabled
      ? form.attachments
          .map(item => item.uploadedPath)
          .filter((path): path is string => Boolean(path))
      : [];

    setIsSubmitting(true);
    try {
      await authService.createTicket(token, {
        title: form.title.trim(),
        description: form.description.trim(),
        issueTypeId: form.issueTypeId as number,
        attachments: attachmentPaths,
      });
      closeCreateModal();
      await loadTickets('refresh');
    } catch (error) {
      Alert.alert(
        'Could not create ticket',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderTicketCard = (ticket: RemoteTicket) => (
    <View key={ticket.uuid || ticket.id} style={styles.ticketCard}>
      <View style={styles.ticketHeader}>
        <View
          style={[styles.ticketBadge, {backgroundColor: `${primaryColor}1a`}]}>
          <Text style={[styles.ticketBadgeText, {color: primaryColor}]}>
            {ticket.issueType?.name || 'Issue'}
          </Text>
        </View>
        <Text style={styles.ticketDate}>
          {ticket.lastUpdate || formatTicketDate(ticket.createdAt)}
        </Text>
      </View>

      <Text style={styles.ticketTitle}>{ticket.title}</Text>
      <View style={styles.ticketMetaRow}>
        <Text style={styles.ticketMeta}>#{ticket.ticketNumber}</Text>
        <View
          style={[
            styles.ticketStatusBadge,
            ticket.ticketStatus === 'closed'
              ? styles.ticketStatusClosed
              : styles.ticketStatusOpen,
          ]}>
          <Text style={styles.ticketStatusText}>
            {ticket.ticketStatus?.toUpperCase() || 'OPEN'}
          </Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open details for ticket ${ticket.ticketNumber}`}
        onPress={() => handleOpenDetail(ticket.uuid)}
        style={[styles.detailsButton, {backgroundColor: primaryColor}]}>
        <Text style={styles.detailsButtonText}>DETAILS</Text>
      </Pressable>
    </View>
  );

  const renderConversation = (conversation: TicketConversation) => {
    const authorName =
      conversation.admin?.name || conversation.user?.name || 'User';
    return (
      <View key={conversation.uuid} style={styles.conversationCard}>
        <View style={styles.conversationHeader}>
          <Text style={styles.conversationAuthor}>{authorName}</Text>
          <Text style={styles.conversationTime}>
            {formatRelativeTime(conversation.createdAt)}
          </Text>
        </View>
        <View style={styles.conversationDivider} />
        {conversation.text ? (
          <Text style={styles.conversationText}>{conversation.text}</Text>
        ) : null}
        {Array.isArray(conversation.attachments) &&
        conversation.attachments.length > 0 ? (
          <View style={styles.conversationAttachments}>
            {conversation.attachments.map(path => {
              const uri = resolveAttachmentUri(path, attachmentBaseUrl);
              const isImage = isImageAttachment(path);
              if (uri && isImage) {
                return (
                  <Pressable
                    key={path}
                    onPress={() => Linking.openURL(uri).catch(() => undefined)}
                    style={styles.attachmentThumbWrap}>
                    <Image source={{uri}} style={styles.attachmentThumb} />
                  </Pressable>
                );
              }
              return (
                <Pressable
                  key={path}
                  onPress={() =>
                    uri && Linking.openURL(uri).catch(() => undefined)
                  }
                  style={styles.attachmentLinkRow}>
                  <Icon name="paperclip" size={16} color={primaryColor} />
                  <Text
                    style={[styles.attachmentLinkText, {color: primaryColor}]}
                    numberOfLines={1}>
                    {path.split('/').pop()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
    );
  };

  if (selectedTicketUuid) {
    return (
      <View style={styles.page}>
        <View style={styles.detailHeader}>
          <Pressable
            onPress={handleCloseDetail}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Back to tickets">
            <Icon name="chevron-left" size={22} color="#0f172a" />
          </Pressable>
          <View style={styles.detailHeaderCopy}>
            <Text style={styles.detailTitle}>
              {detailData?.title || '...'}{' '}
              <Text style={[styles.detailTicketNumber, {color: primaryColor}]}>
                (#{detailData?.ticketNumber || ''})
              </Text>
            </Text>
            <Text style={styles.detailIssueType}>
              {detailData?.issueType?.name || ''}
            </Text>
          </View>
        </View>

        {isLoadingDetail && !detailData ? (
          <View style={styles.emptyWrap}>
            <ActivityIndicator size="large" color={primaryColor} />
            <Text style={styles.loadingText}>Loading ticket...</Text>
          </View>
        ) : detailError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Couldn't load ticket</Text>
            <Text style={styles.errorBody}>{detailError}</Text>
            <AppButton
              fullWidth={false}
              label="Retry"
              onPress={() => void loadDetail(selectedTicketUuid)}
              style={styles.retryButton}
            />
          </View>
        ) : (
          <ScrollView
            style={styles.listWrap}
            contentContainerStyle={styles.detailContent}
            keyboardShouldPersistTaps="handled">
            <View style={styles.detailMetaCard}>
              <View style={styles.detailMetaCol}>
                <Text style={styles.detailMetaLabel}>Create Date</Text>
                <Text style={styles.detailMetaValue}>
                  {detailData?.createdAt
                    ? formatTicketDate(detailData.createdAt)
                    : '-'}
                </Text>
              </View>
              <View style={styles.detailMetaCol}>
                <Text style={styles.detailMetaLabel}>Status</Text>
                <View
                  style={[
                    styles.ticketStatusBadge,
                    detailData?.ticketStatus === 'closed'
                      ? styles.ticketStatusClosed
                      : styles.ticketStatusOpen,
                    {alignSelf: 'flex-start'},
                  ]}>
                  <Text style={styles.ticketStatusText}>
                    {(detailData?.ticketStatus || 'open').toUpperCase()}
                  </Text>
                </View>
              </View>
              <View style={styles.detailMetaCol}>
                <Text style={styles.detailMetaLabel}>Assigned to</Text>
                <Text style={styles.detailMetaValue}>
                  {detailData?.assignedToIds?.[0]?.name || 'Unassigned'}
                </Text>
              </View>
              <View style={styles.detailMetaCol}>
                <Text style={styles.detailMetaLabel}>Last activity</Text>
                <Text style={styles.detailMetaValue}>
                  {detailData?.modifiedAt
                    ? formatRelativeTime(detailData.modifiedAt)
                    : '-'}
                </Text>
              </View>
            </View>

            {(detailData?.conversations || []).map(renderConversation)}

            <View style={styles.replyCard}>
              <Text style={styles.replyHeading}>Submit your reply</Text>
              <View style={styles.replyDivider} />
              <View style={styles.textAreaWrap}>
                <TextInput
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  value={replyText}
                  onChangeText={setReplyText}
                  placeholder="Write your reply"
                  placeholderTextColor="#94a3b8"
                  style={styles.textArea}
                />
              </View>

              {replyAttachments.length > 0 ? (
                <View style={styles.attachmentList}>
                  {replyAttachments.map(attachment => (
                    <View key={attachment.id} style={styles.attachmentItem}>
                      <Icon
                        name="file-document-outline"
                        size={18}
                        color="#475569"
                      />
                      <View style={styles.attachmentInfo}>
                        <Text
                          style={styles.attachmentName}
                          numberOfLines={1}>
                          {attachment.name}
                        </Text>
                        <Text style={styles.attachmentSize}>
                          {attachment.uploading
                            ? 'Uploading...'
                            : attachment.error
                            ? attachment.error
                            : attachment.size}
                        </Text>
                      </View>
                      {attachment.uploading ? (
                        <ActivityIndicator
                          size="small"
                          color={primaryColor}
                        />
                      ) : (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${attachment.name}`}
                          onPress={() =>
                            handleRemoveReplyAttachment(attachment.id)
                          }
                          hitSlop={8}>
                          <Icon name="close" size={18} color="#94a3b8" />
                        </Pressable>
                      )}
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={styles.replyActions}>
                <Pressable
                  onPress={handleAddReplyAttachment}
                  style={styles.addAttachmentButton}
                  accessibilityRole="button"
                  accessibilityLabel="Add attachments">
                  <Text style={styles.addAttachmentText}>+ Add attachments</Text>
                </Pressable>
                <AppButton
                  fullWidth={false}
                  label={isSubmittingReply ? 'SUBMITTING...' : 'SUBMIT'}
                  onPress={() => void handleSubmitReply()}
                  disabled={isSubmittingReply || !replyText.trim()}
                  style={styles.submitButton}
                  labelStyle={styles.submitButtonLabel}
                />
              </View>
            </View>
          </ScrollView>
        )}
      </View>
    );
  }

  return (
    <>
      <View style={styles.page}>
        <View style={styles.headerCard}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to dashboard"
            onPress={onBack}
            style={styles.backButton}>
            <Icon name="arrow-left" size={20} color="#0f172a" />
          </Pressable>

          <Text style={styles.headerTitle}>Tickets</Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Raise a ticket"
            onPress={openCreateModal}
            style={[styles.raiseButton, {backgroundColor: secondaryColor}]}>
            <Text style={styles.raiseButtonText}>+ RAISE A TICKET</Text>
          </Pressable>
        </View>

        {isLoadingTickets ? (
          <View style={styles.emptyWrap}>
            <ActivityIndicator size="large" color={primaryColor} />
            <Text style={styles.loadingText}>Loading tickets...</Text>
          </View>
        ) : loadError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Couldn't load tickets</Text>
            <Text style={styles.errorBody}>{loadError}</Text>
            <AppButton
              fullWidth={false}
              label="Retry"
              onPress={() => void loadTickets('initial')}
              style={styles.retryButton}
            />
          </View>
        ) : tickets.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <Icon name="alert-circle-outline" size={120} color="#cbd5e1" />
            </View>
            <Text style={styles.emptyText}>No tickets found</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.listWrap}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={() => void loadTickets('refresh')}
                tintColor={primaryColor}
              />
            }
            showsVerticalScrollIndicator={false}>
            {tickets.map(renderTicketCard)}
          </ScrollView>
        )}
      </View>

      <Modal
        animationType="fade"
        transparent
        visible={isModalVisible}
        onRequestClose={closeCreateModal}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={closeCreateModal} />

          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Ticket</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close create ticket dialog"
                onPress={closeCreateModal}
                style={styles.modalCloseButton}>
                <Icon name="close" size={22} color="#0f172a" />
              </Pressable>
            </View>

            <View style={styles.modalDivider} />

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>
                Type of issue?
                <Text style={{color: dangerColor}}> *</Text>
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose an issue type"
                onPress={() => setIsIssuePickerOpen(true)}
                style={[
                  styles.dropdown,
                  errors.issueType && {borderColor: dangerColor},
                ]}>
                <Text
                  style={[
                    styles.dropdownText,
                    !selectedIssueType && styles.dropdownPlaceholder,
                  ]}>
                  {selectedIssueType?.name || 'Choose an issue type'}
                </Text>
                <Icon name="chevron-down" size={20} color="#94a3b8" />
              </Pressable>
              {errors.issueType ? (
                <Text style={[styles.errorText, {color: dangerColor}]}>
                  {errors.issueType}
                </Text>
              ) : null}

              <AppTextField
                label="Title"
                required
                value={form.title}
                onChangeText={text => {
                  updateForm('title', text);
                  if (text.trim()) {
                    setErrors(current => ({...current, title: undefined}));
                  }
                }}
                placeholder="Enter a nice title for your issue"
                error={errors.title}
                containerStyle={styles.fieldWrap}
              />

              <Text style={styles.fieldLabel}>
                Description
                <Text style={{color: dangerColor}}> *</Text>
              </Text>
              <View
                style={[
                  styles.textAreaWrap,
                  errors.description && {borderColor: dangerColor},
                ]}>
                <TextInput
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                  value={form.description}
                  onChangeText={text => {
                    updateForm('description', text);
                    if (text.trim()) {
                      setErrors(current => ({
                        ...current,
                        description: undefined,
                      }));
                    }
                  }}
                  placeholder="Explain your issue in detail here..."
                  placeholderTextColor="#94a3b8"
                  style={styles.textArea}
                />
              </View>
              {errors.description ? (
                <Text style={[styles.errorText, {color: dangerColor}]}>
                  {errors.description}
                </Text>
              ) : null}

              <View style={styles.attachmentsHeader}>
                <Text style={styles.attachmentsLabel}>Add Attachments</Text>
                <Switch
                  value={form.attachmentsEnabled}
                  onValueChange={handleToggleAttachments}
                  trackColor={{false: '#cbd5e1', true: primaryColor}}
                  thumbColor="#ffffff"
                />
              </View>

              {form.attachmentsEnabled ? (
                <>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Upload an attachment"
                    onPress={handleAddAttachment}
                    style={styles.uploadBox}>
                    <Text style={styles.uploadBoxTitle}>
                      Click or Drop file in this box to upload.
                    </Text>
                    <Text style={styles.uploadBoxFormats}>
                      Accepted formats: png, jpg, jpeg, ppt, pptx, doc, docx,
                      pdf, xls, xlsx
                    </Text>
                    <View style={styles.uploadButton}>
                      <Icon
                        name="cloud-upload-outline"
                        size={18}
                        color="#475569"
                      />
                      <Text style={styles.uploadButtonText}>Upload</Text>
                    </View>
                  </Pressable>

                  {form.attachments.length > 0 ? (
                    <View style={styles.attachmentList}>
                      {form.attachments.map(attachment => (
                        <View
                          key={attachment.id}
                          style={styles.attachmentItem}>
                          <Icon
                            name="file-document-outline"
                            size={18}
                            color="#475569"
                          />
                          <View style={styles.attachmentInfo}>
                            <Text style={styles.attachmentName} numberOfLines={1}>
                              {attachment.name}
                            </Text>
                            <Text style={styles.attachmentSize}>
                              {attachment.uploading
                                ? 'Uploading...'
                                : attachment.error
                                ? attachment.error
                                : attachment.size}
                            </Text>
                          </View>
                          {attachment.uploading ? (
                            <ActivityIndicator size="small" color={primaryColor} />
                          ) : (
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Remove ${attachment.name}`}
                              onPress={() => handleRemoveAttachment(attachment.id)}
                              hitSlop={8}>
                              <Icon name="close" size={18} color="#94a3b8" />
                            </Pressable>
                          )}
                        </View>
                      ))}
                    </View>
                  ) : null}
                </>
              ) : null}
            </ScrollView>

            <View style={styles.modalDivider} />

            <View style={styles.modalActions}>
              <AppButton
                fullWidth={false}
                label="CANCEL"
                onPress={closeCreateModal}
                variant="secondary"
                style={styles.cancelButton}
                labelStyle={styles.cancelButtonLabel}
                disabled={isSubmitting}
              />
              <AppButton
                fullWidth={false}
                label={isSubmitting ? 'SUBMITTING...' : 'SUBMIT'}
                onPress={() => void handleSubmit()}
                disabled={!isValid || isSubmitting}
                style={styles.submitButton}
                labelStyle={styles.submitButtonLabel}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={isIssuePickerOpen}
        onRequestClose={() => setIsIssuePickerOpen(false)}>
        <Pressable
          style={styles.pickerOverlay}
          onPress={() => setIsIssuePickerOpen(false)}>
          <Pressable style={styles.pickerSheet} onPress={() => {}}>
            <Text style={styles.pickerTitle}>Choose an issue type</Text>
            <ScrollView style={styles.pickerList}>
              {issueTypes.length === 0 ? (
                <Text style={styles.pickerEmpty}>
                  No issue types available right now.
                </Text>
              ) : (
                issueTypes.map(option => {
                  const isActive = option.id === form.issueTypeId;
                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => handleSelectIssueType(option)}
                      style={[
                        styles.pickerOption,
                        isActive && {backgroundColor: `${primaryColor}14`},
                      ]}>
                      <Text
                        style={[
                          styles.pickerOptionText,
                          isActive && {color: primaryColor, fontWeight: '700'},
                        ]}>
                        {option.name}
                      </Text>
                      {isActive ? (
                        <Icon name="check" size={20} color={primaryColor} />
                      ) : null}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#eef2f7',
    flex: 1,
  },
  headerCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  headerTitle: {
    color: '#0f172a',
    flex: 1,
    fontSize: 24,
    fontWeight: '800',
  },
  raiseButton: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  raiseButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  emptyWrap: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 60,
    paddingHorizontal: 20,
  },
  emptyIconWrap: {
    marginBottom: 18,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 17,
    fontWeight: '600',
  },
  loadingText: {
    color: '#64748b',
    fontSize: 14,
    marginTop: 12,
  },
  errorCard: {
    backgroundColor: '#ffffff',
    borderColor: '#fecaca',
    borderRadius: 16,
    borderWidth: 1,
    margin: 16,
    padding: 16,
  },
  errorTitle: {
    color: '#b91c1c',
    fontSize: 15,
    fontWeight: '800',
  },
  errorBody: {
    color: '#475569',
    fontSize: 13,
    marginTop: 6,
  },
  retryButton: {
    marginTop: 12,
  },
  listWrap: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  ticketCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  ticketHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  ticketBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  ticketBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  ticketDate: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  ticketTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  ticketMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  ticketMeta: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  ticketStatusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  ticketStatusOpen: {
    backgroundColor: '#dcfce7',
  },
  ticketStatusClosed: {
    backgroundColor: '#fee2e2',
  },
  ticketStatusText: {
    color: '#0f172a',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.56)',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    maxHeight: '90%',
    maxWidth: 560,
    paddingBottom: 0,
    paddingTop: 20,
    width: '100%',
    zIndex: 2,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  modalTitle: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '800',
  },
  modalCloseButton: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  modalDivider: {
    backgroundColor: '#e2e8f0',
    height: 1,
    marginTop: 16,
  },
  modalScroll: {
    maxHeight: 520,
  },
  modalScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
  },
  fieldLabel: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  fieldWrap: {
    marginTop: 14,
  },
  dropdown: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  dropdownText: {
    color: '#0f172a',
    fontSize: 15,
  },
  dropdownPlaceholder: {
    color: colors.placeholder,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
  textAreaWrap: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  textArea: {
    color: colors.text,
    fontSize: 15,
    minHeight: 110,
  },
  attachmentsHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  attachmentsLabel: {
    color: '#334155',
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  uploadBox: {
    alignItems: 'center',
    borderColor: '#cbd5e1',
    borderRadius: 14,
    borderStyle: 'dashed',
    borderWidth: 1,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 22,
  },
  uploadBoxTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  uploadBoxFormats: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
    textAlign: 'center',
  },
  uploadButton: {
    alignItems: 'center',
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  uploadButtonText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
  },
  attachmentList: {
    gap: 8,
    marginTop: 12,
  },
  attachmentItem: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  attachmentInfo: {
    flex: 1,
  },
  attachmentName: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
  },
  attachmentSize: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  cancelButton: {
    backgroundColor: '#f1f5f9',
    borderColor: '#f1f5f9',
    minWidth: 110,
  },
  cancelButtonLabel: {
    color: '#475569',
    letterSpacing: 0.6,
  },
  submitButton: {
    minWidth: 110,
  },
  submitButtonLabel: {
    letterSpacing: 0.6,
  },
  pickerOverlay: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 24,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  pickerTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  pickerList: {
    maxHeight: '90%',
  },
  pickerEmpty: {
    color: '#94a3b8',
    fontSize: 14,
    padding: 16,
    textAlign: 'center',
  },
  pickerOption: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  pickerOptionText: {
    color: '#0f172a',
    fontSize: 15,
  },
  detailsButton: {
    alignSelf: 'flex-end',
    borderRadius: 8,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  detailsButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  detailHeader: {
    alignItems: 'flex-start',
    backgroundColor: '#ffffff',
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  detailHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  detailTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
  },
  detailTicketNumber: {
    fontSize: 15,
    fontWeight: '700',
  },
  detailIssueType: {
    color: '#64748b',
    fontSize: 13,
  },
  detailContent: {
    padding: 16,
    paddingBottom: 60,
  },
  detailMetaCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 16,
    padding: 16,
  },
  detailMetaCol: {
    flexBasis: '45%',
    flexGrow: 1,
    gap: 4,
  },
  detailMetaLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  detailMetaValue: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
  conversationCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  conversationHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  conversationAuthor: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
  },
  conversationTime: {
    color: '#94a3b8',
    fontSize: 12,
  },
  conversationDivider: {
    backgroundColor: '#e2e8f0',
    height: 1,
    marginVertical: 10,
  },
  conversationText: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 20,
  },
  conversationAttachments: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  attachmentThumbWrap: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  attachmentThumb: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    height: 120,
    width: 120,
  },
  attachmentLinkRow: {
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 6,
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  attachmentLinkText: {
    fontSize: 13,
    fontWeight: '700',
  },
  replyCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 4,
    padding: 16,
  },
  replyHeading: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
  },
  replyDivider: {
    backgroundColor: '#e2e8f0',
    height: 1,
    marginVertical: 12,
  },
  replyActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginTop: 14,
  },
  addAttachmentButton: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addAttachmentText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
});
