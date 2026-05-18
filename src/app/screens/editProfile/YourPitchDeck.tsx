import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';

import {authService} from '../../../auth/services/auth.service';
import {Icon} from '../../../shared/components/Icon';
import {colors} from '../../../shared/theme/colors';

type PitchDeck = {
  elevatorPitch?: string | null;
  pitchDocument?: string | null;
  fileName?: string | null;
  powerPitchUrl?: string | null;
  embedUrl?: string | null;
};

type DocumentType = {
  id?: string | number;
  name?: string;
  isActive?: boolean;
};

type Props = {
  primaryColor: string;
  pitchDeck?: PitchDeck | null;
  token: string;
  onUploaded?: () => void;
};

type UploadKind = 'deck' | 'videoUpload' | 'videoRecord';

const MAX_FILE_SIZE_MB = 50;

const openLink = (url?: string | null) => {
  if (!url) {
    return;
  }
  Linking.openURL(url).catch(() => undefined);
};

const findTypeId = (
  types: DocumentType[],
  keywords: string[],
): string | number | null => {
  const match = types.find(type => {
    const name = String(type?.name || '').toLowerCase();
    return keywords.some(keyword => name.includes(keyword));
  });
  return match?.id ?? null;
};

export function YourPitchDeck({
  primaryColor,
  pitchDeck,
  token,
  onUploaded,
}: Props) {
  const elevatorPitch = pitchDeck?.elevatorPitch || '';
  const pitchDocument = pitchDeck?.pitchDocument || '';
  const fileName = pitchDeck?.fileName || '';
  const videoUrl = pitchDeck?.powerPitchUrl || pitchDeck?.embedUrl || '';

  const hasContent = Boolean(elevatorPitch || pitchDocument || videoUrl);

  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [busyKind, setBusyKind] = useState<UploadKind | null>(null);
  const [message, setMessage] = useState<{
    text: string;
    tone: 'success' | 'error';
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    authService
      .getDocumentTypes()
      .then(response => {
        if (cancelled) return;
        const list = Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response)
            ? response
            : [];
        setDocumentTypes(list.filter((type: DocumentType) => type?.isActive !== false));
      })
      .catch(() => {
        if (!cancelled) {
          setDocumentTypes([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleUpload = async (kind: UploadKind) => {
    const isDeck = kind === 'deck';
    const typeId = isDeck
      ? findTypeId(documentTypes, ['pitch deck', 'pitchdeck', 'pitch'])
      : findTypeId(documentTypes, ['video pitch', 'video', 'power pitch']);

    if (!typeId) {
      const fallback = isDeck ? 'Pitch Deck' : 'Video Pitch';
      setMessage({
        text: `${fallback} document type is not configured for your account.`,
        tone: 'error',
      });
      return;
    }

    setMessage(null);
    setBusyKind(kind);

    try {
      const pickerResult =
        kind === 'videoRecord'
          ? await launchCamera({
              mediaType: 'video',
              videoQuality: 'high',
              durationLimit: 120,
              saveToPhotos: true,
            })
          : await launchImageLibrary({
              mediaType: isDeck ? 'photo' : 'video',
              selectionLimit: 1,
              includeBase64: false,
            });

      if (pickerResult?.didCancel) {
        return;
      }

      if (pickerResult?.errorCode) {
        throw new Error(
          pickerResult?.errorMessage || 'Picker could not be opened.',
        );
      }

      const asset = pickerResult?.assets?.[0];
      if (!asset?.uri) {
        throw new Error('No file was selected.');
      }

      const sizeInMB = (asset.fileSize || 0) / (1024 * 1024);
      if (sizeInMB > MAX_FILE_SIZE_MB) {
        throw new Error(`File size should be less than ${MAX_FILE_SIZE_MB} MB`);
      }

      const filePayload = {
        uri: asset.uri,
        name:
          asset.fileName ||
          (isDeck ? 'pitch-deck' : 'video-pitch') +
            (asset.type?.includes('/')
              ? `.${asset.type.split('/')[1]}`
              : ''),
        type: asset.type || (isDeck ? 'image/jpeg' : 'video/mp4'),
      };

      await authService.saveStartupDocument(token, typeId, filePayload);
      setMessage({
        text: isDeck ? 'Pitch deck uploaded.' : 'Video pitch uploaded.',
        tone: 'success',
      });
      onUploaded?.();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Upload failed.';
      if (
        errorMessage.includes('launchCamera') ||
        errorMessage.includes('launchImageLibrary') ||
        errorMessage.includes('null')
      ) {
        Alert.alert(
          'Picker unavailable',
          'The native picker needs an app rebuild. Please restart the app and try again.',
        );
      } else {
        setMessage({text: errorMessage, tone: 'error'});
      }
    } finally {
      setBusyKind(null);
    }
  };

  const renderAction = (
    kind: UploadKind,
    label: string,
    iconName: string,
    variant: 'primary' | 'secondary',
  ) => {
    const isBusy = busyKind === kind;
    const isDisabled = busyKind !== null && !isBusy;
    const isPrimary = variant === 'primary';
    return (
      <Pressable
        key={kind}
        onPress={() => handleUpload(kind)}
        disabled={isDisabled || isBusy}
        style={({pressed}) => [
          styles.actionButton,
          isPrimary
            ? {backgroundColor: primaryColor}
            : {
                backgroundColor: '#ffffff',
                borderColor: primaryColor,
                borderWidth: 1,
              },
          pressed && styles.pressed,
          (isDisabled || isBusy) && styles.disabled,
        ]}>
        {isBusy ? (
          <ActivityIndicator
            color={isPrimary ? '#ffffff' : primaryColor}
            size="small"
          />
        ) : (
          <Icon
            name={iconName}
            size={16}
            color={isPrimary ? '#ffffff' : primaryColor}
          />
        )}
        <Text
          style={[
            styles.actionLabel,
            {color: isPrimary ? '#ffffff' : primaryColor},
          ]}>
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={[styles.iconBadge, {backgroundColor: `${primaryColor}1a`}]}>
          <Icon name="presentation" size={20} color={primaryColor} />
        </View>
        <Text style={styles.title}>Your pitch deck</Text>
      </View>

      {elevatorPitch ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Elevator pitch</Text>
          <Text style={styles.pitchText}>“{elevatorPitch}”</Text>
        </View>
      ) : null}

      {!hasContent ? (
        <View style={styles.emptyState}>
          <Icon name="file-upload-outline" size={28} color="#94a3b8" />
          <Text style={styles.emptyTitle}>Nothing uploaded yet</Text>
          <Text style={styles.emptyBody}>
            Upload your pitch deck file and add a video pitch below.
          </Text>
        </View>
      ) : null}

      <View style={styles.subSection}>
        <View style={styles.subSectionHeader}>
          <View
            style={[styles.subIconBadge, {backgroundColor: `${primaryColor}1a`}]}>
            <Icon
              name="file-document-outline"
              size={18}
              color={primaryColor}
            />
          </View>
          <View style={styles.subTitleWrap}>
            <Text style={styles.subTitle}>Pitch deck</Text>
            <Text style={styles.subSubtitle}>
              {pitchDocument ? 'File uploaded' : 'No file uploaded yet'}
            </Text>
          </View>
        </View>

        {pitchDocument ? (
          <Pressable
            onPress={() => openLink(pitchDocument)}
            style={[styles.linkRow, {borderColor: primaryColor}]}>
            <Icon
              name="file-document-outline"
              size={18}
              color={primaryColor}
            />
            <Text
              style={[styles.linkText, {color: primaryColor}]}
              numberOfLines={1}>
              {fileName || 'Open pitch deck'}
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.actionRow}>
          {renderAction(
            'deck',
            pitchDocument ? 'Replace pitch deck' : 'Upload pitch deck',
            'cloud-upload-outline',
            'primary',
          )}
        </View>
      </View>

      <View style={styles.subSection}>
        <View style={styles.subSectionHeader}>
          <View
            style={[styles.subIconBadge, {backgroundColor: `${primaryColor}1a`}]}>
            <Icon name="video-outline" size={18} color={primaryColor} />
          </View>
          <View style={styles.subTitleWrap}>
            <Text style={styles.subTitle}>Video pitch</Text>
            <Text style={styles.subSubtitle}>
              {videoUrl ? 'Video added' : 'No video added yet'}
            </Text>
          </View>
        </View>

        {videoUrl ? (
          <Pressable
            onPress={() => openLink(videoUrl)}
            style={[styles.linkRow, {borderColor: primaryColor}]}>
            <Icon name="play-circle-outline" size={18} color={primaryColor} />
            <Text
              style={[styles.linkText, {color: primaryColor}]}
              numberOfLines={1}>
              Watch video pitch
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.actionRow}>
          {renderAction(
            'videoUpload',
            videoUrl ? 'Replace video' : 'Upload video',
            'cloud-upload-outline',
            'primary',
          )}
          {renderAction(
            'videoRecord',
            'Record video',
            'video-plus-outline',
            'secondary',
          )}
        </View>
      </View>

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
    marginBottom: 12,
    padding: 16,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  iconBadge: {
    alignItems: 'center',
    borderRadius: 10,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  title: {
    color: '#10213a',
    fontSize: 18,
    fontWeight: '800',
  },
  section: {
    marginTop: 16,
  },
  sectionLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  pitchText: {
    color: '#0f172a',
    fontSize: 15,
    fontStyle: 'italic',
    lineHeight: 22,
    marginTop: 6,
  },
  linkRow: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  linkText: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 22,
  },
  emptyTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
  },
  emptyBody: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  subSection: {
    borderTopColor: '#e2e8f0',
    borderTopWidth: 1,
    marginTop: 18,
    paddingTop: 16,
  },
  subSectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  subIconBadge: {
    alignItems: 'center',
    borderRadius: 8,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  subTitleWrap: {
    flex: 1,
  },
  subTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
  },
  subSubtitle: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  actionButton: {
    alignItems: 'center',
    borderRadius: 10,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.55,
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
