import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  pick,
  types,
  isErrorWithCode,
  errorCodes,
} from '@react-native-documents/picker';

import {authService} from '../../../auth/services/auth.service';
import {Icon} from '../../../shared/components/Icon';
import {colors} from '../../../shared/theme/colors';

type DocumentType = {
  id?: string | number;
  name?: string;
  isActive?: boolean;
  isMandatory?: boolean;
  sampleDocument?: string;
  sampleDocumentText?: string;
};

type SupportingDocument = {
  uuid?: string;
  name?: string | null;
  documentType?: string;
  extension?: string | null;
  url?: {objectUrl?: string | null} | null;
  requestedByAdmin?: boolean;
  isMandatory?: boolean;
};

type Props = {
  token: string;
  primaryColor: string;
  onUploaded?: (response: any) => void;
};

const MAX_FILE_SIZE_MB = 25;

const readDocumentTypesFromResponse = (payload: any): DocumentType[] => {
  const root = payload?.data || payload || [];
  return Array.isArray(root) ? root : [];
};

const readSupportingDocumentsFromResponse = (
  payload: any,
): SupportingDocument[] => {
  const root = payload?.data || payload || [];
  return Array.isArray(root) ? root : [];
};

const getFileExtension = (value?: string | null) => {
  if (!value) {
    return 'any';
  }

  const cleanValue = value.split('?')[0];
  const match = cleanValue.match(/\.([a-z0-9]+)$/i);
  return (match?.[1] || value || 'any').replace('.', '').toLowerCase();
};

const mergeSupportingDocuments = (
  types: DocumentType[],
  documents: SupportingDocument[],
) => {
  const activeTypes = types.filter(type => type?.isActive !== false && type?.name);
  const nonRequestedByType: Record<string, boolean> = {};

  documents.forEach(document => {
    if (!document?.requestedByAdmin && document?.documentType) {
      nonRequestedByType[document.documentType] = true;
    }
  });

  const deduped = documents
    .filter(document => {
      if (!document?.requestedByAdmin) {
        return true;
      }

      return !nonRequestedByType[document.documentType || ''];
    })
    .map(document => {
      const typeInfo = activeTypes.find(type => type.name === document.documentType);
      return {
        ...document,
        isMandatory: typeInfo?.isMandatory ?? document?.isMandatory ?? false,
      };
    });

  const merged = activeTypes.map(type => {
    const existing = deduped.find(document => document.documentType === type.name);
    return (
      existing || {
        documentType: type.name,
        requestedByAdmin: false,
        isMandatory: type.isMandatory ?? false,
        uuid: '',
        url: null,
        name: null,
        extension: null,
      }
    );
  });

  const remaining = deduped.filter(
    document =>
      document?.documentType &&
      !activeTypes.some(type => type.name === document.documentType),
  );

  return [...merged, ...remaining];
};

export function Documents({token, primaryColor, onUploaded}: Props) {
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [documents, setDocuments] = useState<SupportingDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [deletingUuid, setDeletingUuid] = useState<string | null>(null);

  const rowKey = (item: SupportingDocument) =>
    item.uuid || `type:${item.documentType || ''}`;
  const [message, setMessage] = useState<{
    text: string;
    tone: 'success' | 'error';
  } | null>(null);

  const documentTypeMap = useMemo(() => {
    const nextMap = new Map<string, DocumentType>();
    documentTypes.forEach(type => {
      if (type?.name) {
        nextMap.set(type.name, type);
      }
    });
    return nextMap;
  }, [documentTypes]);

  const loadDocuments = async (typesOverride?: DocumentType[]) => {
    const effectiveTypes = typesOverride || documentTypes;
    const response = await authService.getStartupDocuments(token);
    const nextDocuments = readSupportingDocumentsFromResponse(response);
    setDocuments(mergeSupportingDocuments(effectiveTypes, nextDocuments));
  };

  const loadAll = async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      const nextBaseUrl = await authService.getApiBaseUrl();
      const typesResponse = await authService.getDocumentTypes();
      const nextTypes = readDocumentTypesFromResponse(typesResponse);
      setApiBaseUrl(nextBaseUrl);
      setDocumentTypes(nextTypes);
      await loadDocuments(nextTypes);
    } catch (error) {
      setMessage({
        text:
          error instanceof Error
            ? error.message
            : 'Could not load documents.',
        tone: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAll().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const openLink = (url?: string | null, fallback?: string) => {
    if (!url) {
      return;
    }

    Linking.openURL(url).catch(() =>
      Alert.alert('Cannot open', fallback || 'Could not open the file.'),
    );
  };

  const resolveDocumentUrl = (url?: string | null) => {
    if (!url) {
      return '';
    }

    if (/^https?:\/\//i.test(url)) {
      return url;
    }

    if (!apiBaseUrl) {
      return url;
    }

    return `${apiBaseUrl.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
  };

  const pickFileForDocument = async (item: SupportingDocument) => {
    const typeInfo = item.documentType
      ? documentTypeMap.get(item.documentType)
      : undefined;
    const documentTypeId = String(typeInfo?.id || '');

    if (!documentTypeId) {
      setMessage({
        text: 'Document type is missing for this item.',
        tone: 'error',
      });
      return;
    }

    setMessage(null);

    let picked:
      | {uri: string; name?: string | null; type?: string | null; size?: number | null}
      | null = null;
    try {
      const results = await pick({
        type: [types.allFiles],
        allowMultiSelection: false,
      });
      picked = results?.[0] || null;
    } catch (error) {
      if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) {
        return;
      }
      setMessage({
        text:
          error instanceof Error
            ? error.message
            : 'Could not open the file picker.',
        tone: 'error',
      });
      return;
    }

    if (!picked?.uri) {
      setMessage({
        text: 'No file was selected.',
        tone: 'error',
      });
      return;
    }

    const sizeInMB = (picked.size || 0) / (1024 * 1024);
    if (sizeInMB > MAX_FILE_SIZE_MB) {
      setMessage({
        text: `File size should be less than ${MAX_FILE_SIZE_MB} MB`,
        tone: 'error',
      });
      return;
    }

    setUploadingKey(rowKey(item));
    try {
      const filePayload = {
        uri: picked.uri,
        name: picked.name || 'document',
        type: picked.type || 'application/octet-stream',
      };

      const response = item.uuid
        ? await authService.editStartupDocument(
            token,
            item.uuid,
            filePayload,
          )
        : await authService.saveStartupDocument(
            token,
            documentTypeId,
            filePayload,
          );

      try {
        await authService.updatePitchType(token, 'upload_pitch');
      } catch {
        // pitch-type is a non-blocking follow-up; ignore failure.
      }

      await loadDocuments();
      setMessage({
        text:
          response?.message ||
          (item.uuid ? 'Document updated.' : 'Document saved.'),
        tone: 'success',
      });
      onUploaded?.(response);
    } catch (error) {
      setMessage({
        text:
          error instanceof Error
            ? error.message
            : 'Could not save the document.',
        tone: 'error',
      });
    } finally {
      setUploadingKey(null);
    }
  };

  const removeDocument = (item: SupportingDocument) => {
    if (!item?.uuid) {
      return;
    }

    Alert.alert(
      'Delete document',
      'Are you sure you want to remove this document?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingUuid(item.uuid || '');
            setMessage(null);
            try {
              const response = await authService.deleteStartupDocument(
                token,
                item.uuid || '',
              );
              await loadDocuments();
              setMessage({
                text: response?.message || 'Document deleted.',
                tone: 'success',
              });
              onUploaded?.(response);
            } catch (error) {
              setMessage({
                text:
                  error instanceof Error
                    ? error.message
                    : 'Could not delete the document.',
                tone: 'error',
              });
            } finally {
              setDeletingUuid(null);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>All Documents</Text>

      {isLoading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator color={primaryColor} />
          <Text style={styles.emptyText}>Loading documents...</Text>
        </View>
      ) : documents.length ? (
        <View style={styles.list}>
          {documents.map(item => {
            const typeInfo = item.documentType
              ? documentTypeMap.get(item.documentType)
              : undefined;
            const fileUrl = resolveDocumentUrl(item.url?.objectUrl || '');
            const hasFile = Boolean(fileUrl);
            const canDelete = Boolean(item.uuid);
            const extension = (
              item.extension ||
              getFileExtension(item.name || fileUrl || item.documentType)
            )
              .replace('.', '')
              .toLowerCase();
            const isDeleting = deletingUuid === item.uuid;
            const itemKey = rowKey(item);
            const isRowUploading = uploadingKey === itemKey;
            const isAnyUploading = uploadingKey !== null;
            const isRowBusy = isRowUploading || isDeleting;
            const isRowDisabled = (isAnyUploading && !isRowUploading) || isDeleting;

            return (
              <View
                key={`${item.documentType || 'document'}-${item.uuid || 'new'}`}>
                <Pressable
                  style={styles.row}
                  disabled={!hasFile || isRowBusy}
                  onPress={() =>
                    openLink(fileUrl, 'Could not open the uploaded file.')
                  }>
                  <View style={styles.left}>
                    <View style={styles.fileWrap}>
                      {hasFile && !isRowUploading ? (
                        <View style={styles.statusBadge}>
                          <Icon name="check" size={12} color="#ffffff" />
                        </View>
                      ) : null}
                      <View style={styles.fileIcon}>
                        <Icon
                          name="file-document-outline"
                          size={24}
                          color="#1877f2"
                        />
                        <Text style={styles.fileTypeText}>
                          {hasFile ? extension || 'any' : 'any'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.meta}>
                      <Text style={styles.name}>
                        {item.documentType || 'Document'}
                        {item.isMandatory ? (
                          <Text style={styles.required}> *</Text>
                        ) : null}
                      </Text>

                      {typeInfo?.sampleDocument ? (
                        <Pressable
                          onPress={() =>
                            openLink(
                              resolveDocumentUrl(typeInfo.sampleDocument),
                              'Could not open the sample document.',
                            )
                          }>
                          <Text style={[styles.sampleLink, {color: primaryColor}]}>
                            Download Sample
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.actions}>
                    <Pressable
                      style={({pressed}) => [
                        styles.action,
                        hasFile ? styles.primaryAction : styles.uploadOnlyAction,
                        pressed && styles.pressed,
                        isRowDisabled && styles.disabled,
                        isRowUploading && styles.disabled,
                      ]}
                      onPress={() => pickFileForDocument(item)}
                      disabled={isRowUploading || isRowDisabled}>
                      {isRowUploading ? (
                        <ActivityIndicator
                          color={hasFile ? '#ffffff' : '#475569'}
                          size="small"
                        />
                      ) : (
                        <Icon
                          name={hasFile ? 'pencil-outline' : 'upload'}
                          size={16}
                          color={hasFile ? '#ffffff' : '#475569'}
                        />
                      )}
                    </Pressable>

                    {hasFile ? (
                      <Pressable
                        style={({pressed}) => [
                          styles.action,
                          styles.secondaryAction,
                          pressed && styles.pressed,
                          isRowDisabled && styles.disabled,
                        ]}
                        disabled={isRowDisabled}
                        onPress={() =>
                          openLink(fileUrl, 'Could not open the uploaded file.')
                        }>
                        <Icon name="download" size={16} color="#475569" />
                      </Pressable>
                    ) : null}

                    {hasFile ? (
                      <Pressable
                        style={({pressed}) => [
                          styles.action,
                          styles.deleteAction,
                          pressed && styles.pressed,
                          (!canDelete || isDeleting || isRowDisabled) &&
                            styles.disabled,
                        ]}
                        onPress={() => removeDocument(item)}
                        disabled={!canDelete || isDeleting || isRowDisabled}>
                        {isDeleting ? (
                          <ActivityIndicator color="#ffffff" size="small" />
                        ) : (
                          <Icon name="trash-can-outline" size={16} color="#ffffff" />
                        )}
                      </Pressable>
                    ) : null}
                  </View>
                </Pressable>
                <View style={styles.divider} />
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No documents uploaded</Text>
        </View>
      )}

      {message ? (
        <Text
          style={[
            styles.message,
            message.tone === 'success'
              ? styles.messageSuccess
              : styles.messageError,
          ]}>
          {message.text}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
  },
  title: {
    color: '#10213a',
    fontSize: 18,
    fontWeight: '800',
  },
  list: {
    marginTop: 10,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  left: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    paddingRight: 12,
  },
  fileWrap: {
    height: 54,
    marginRight: 12,
    position: 'relative',
    width: 50,
  },
  statusBadge: {
    alignItems: 'center',
    backgroundColor: '#52c97d',
    borderColor: '#ffffff',
    borderRadius: 999,
    borderWidth: 2,
    height: 20,
    justifyContent: 'center',
    left: -2,
    position: 'absolute',
    top: -2,
    width: 20,
    zIndex: 1,
  },
  fileIcon: {
    alignItems: 'center',
    backgroundColor: '#e8f1ff',
    borderRadius: 0,
    height: 54,
    justifyContent: 'center',
    width: 50,
  },
  fileTypeText: {
    color: '#1877f2',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
    textTransform: 'lowercase',
  },
  meta: {
    flex: 1,
  },
  name: {
    color: '#10213a',
    fontSize: 17,
    fontWeight: '700',
  },
  required: {
    color: '#ef4444',
  },
  sampleLink: {
    fontSize: 13,
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  action: {
    alignItems: 'center',
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  primaryAction: {
    backgroundColor: '#1f2744',
  },
  uploadOnlyAction: {
    backgroundColor: '#e8ecf8',
  },
  secondaryAction: {
    backgroundColor: '#e8ecf8',
  },
  deleteAction: {
    backgroundColor: '#ef2f2f',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.6,
  },
  divider: {
    backgroundColor: '#e9edf4',
    height: 1,
  },
  emptyState: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 22,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
  },
  message: {
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
  },
  messageSuccess: {
    color: colors.success,
  },
  messageError: {
    color: colors.danger,
  },
});
