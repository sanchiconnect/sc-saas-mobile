import React, {useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {launchImageLibrary} from 'react-native-image-picker';
import Video from 'react-native-video';
import {WebView} from 'react-native-webview';
import {
  pick,
  types,
  isErrorWithCode,
  errorCodes,
} from '@react-native-documents/picker';

import {authService} from '../../../auth/services/auth.service';
import {Icon} from '../../../../core/components/Icon';
import {colors} from '../../../../core/theme/colors';

type PitchDeck = {
  elevatorPitch?: string | null;
  pitchDocument?: string | null;
  fileName?: string | null;
  powerPitchUrl?: string | null;
  powerPitchDeckUrl?: string | null;
  uploadPitchUrl?: string | null;
  embedUrl?: string | null;
  pitchType?: string | null;
  sampleDocument?: string | null;
};

const PITCH_TYPE_UPLOAD = 'upload_pitch';
const PITCH_TYPE_POWER = 'power_pitch';

const initialModeFor = (
  pitchType?: string | null,
): 'create' | 'upload' =>
  pitchType === PITCH_TYPE_UPLOAD ? 'upload' : 'create';

const isDirectVideoUrl = (url?: string | null) => {
  if (!url) return false;
  return /\.(mp4|m4v|mov|webm|mkv)(\?|#|$)/i.test(url);
};

function PdfPreview({
  url,
  primaryColor,
}: {
  url: string;
  primaryColor: string;
}) {
  const [hasError, setHasError] = useState(false);
  const viewerUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`;

  if (hasError) {
    return (
      <View style={styles.pdfFallback}>
        <Icon name="file-pdf-box" size={56} color={primaryColor} />
        <Text style={styles.pdfFallbackText}>
          Inline preview unavailable. Tap to open in full screen.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.pdfWrap}>
      <WebView
        source={{uri: viewerUrl}}
        style={styles.pdfWebView}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.pdfLoading}>
            <ActivityIndicator color={primaryColor} />
          </View>
        )}
        onError={() => setHasError(true)}
        onHttpError={() => setHasError(true)}
      />
    </View>
  );
}

function InlineVideoPlayer({
  url,
  primaryColor,
}: {
  url: string;
  primaryColor: string;
}) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <Pressable
        onPress={() => Linking.openURL(url).catch(() => undefined)}
        style={[styles.videoPlayerFallback, {borderColor: primaryColor}]}>
        <Icon name="alert-circle-outline" size={28} color={primaryColor} />
        <Text style={[styles.videoPlayerFallbackText, {color: primaryColor}]}>
          Tap to open the video externally
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.videoPlayerWrap}>
      <Video
        source={{uri: url}}
        style={styles.videoPlayer}
        controls
        resizeMode="contain"
        paused
        onError={() => setHasError(true)}
      />
    </View>
  );
}

type Props = {
  primaryColor: string;
  pitchDeck?: PitchDeck | null;
  token: string;
  onUploaded?: () => void;
};

type UploadKind = 'deck' | 'videoUpload' | 'videoCreate';

const MAX_FILE_SIZE_MB = 50;

const openLink = (url?: string | null) => {
  if (!url) {
    return;
  }
  Linking.openURL(url).catch(() => undefined);
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
  const uploadVideoUrl = pitchDeck?.uploadPitchUrl || '';
  const powerVideoUrl =
    pitchDeck?.powerPitchUrl || pitchDeck?.embedUrl || '';

  const hasContent = Boolean(
    elevatorPitch || pitchDocument || uploadVideoUrl || powerVideoUrl,
  );

  const [busyKind, setBusyKind] = useState<UploadKind | null>(null);
  const [videoMode, setVideoMode] = useState<'create' | 'upload'>(
    initialModeFor(pitchDeck?.pitchType),
  );
  const [defaultPitchType, setDefaultPitchType] = useState<string | null>(
    pitchDeck?.pitchType || null,
  );
  const [message, setMessage] = useState<{
    text: string;
    tone: 'success' | 'error';
  } | null>(null);

  const handleModeSwitch = async (mode: 'create' | 'upload') => {
    if (videoMode === mode || busyKind !== null) {
      setVideoMode(mode);
      return;
    }
    setVideoMode(mode);
    const nextPitchType =
      mode === 'create' ? PITCH_TYPE_POWER : PITCH_TYPE_UPLOAD;
    setDefaultPitchType(nextPitchType);
    try {
      await authService.updatePitchType(token, nextPitchType);
      onUploaded?.();
    } catch {
      // Mode switch PATCH is best-effort; UI already reflects the change.
    }
  };

  const pickDeckFile = async () => {
    try {
      const results = await pick({
        type: [types.allFiles],
        allowMultiSelection: false,
      });
      const picked = results?.[0];
      if (!picked?.uri) {
        throw new Error('No file was selected.');
      }
      const sizeInMB = (picked.size || 0) / (1024 * 1024);
      if (sizeInMB > MAX_FILE_SIZE_MB) {
        throw new Error(`File size should be less than ${MAX_FILE_SIZE_MB} MB`);
      }
      return {
        uri: picked.uri,
        name: picked.name || 'pitch-deck',
        type: picked.type || 'application/octet-stream',
      };
    } catch (pickerError) {
      if (
        isErrorWithCode(pickerError) &&
        pickerError.code === errorCodes.OPERATION_CANCELED
      ) {
        return null;
      }
      throw pickerError;
    }
  };

  const pickVideoFile = async () => {
    const pickerResult = await launchImageLibrary({
      mediaType: 'video',
      selectionLimit: 1,
      includeBase64: false,
    });
    if (pickerResult?.didCancel) {
      return null;
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
    const mimeSuffix =
      asset.type && asset.type.includes('/') ? asset.type.split('/')[1] : '';
    return {
      uri: asset.uri,
      name: asset.fileName || `video-pitch${mimeSuffix ? `.${mimeSuffix}` : ''}`,
      type: asset.type || 'video/mp4',
    };
  };

  const openPowerPitchConnect = async () => {
    const response = await authService.connectPowerPitch(token);
    const redirectUrl =
      response?.data?.url ||
      response?.data?.redirectUrl ||
      response?.url ||
      response?.redirectUrl;
    if (typeof redirectUrl === 'string' && redirectUrl) {
      Linking.openURL(redirectUrl).catch(() => undefined);
    }
    return Boolean(redirectUrl);
  };

  const handleUpload = async (kind: UploadKind) => {
    setMessage(null);
    setBusyKind(kind);

    try {
      if (kind === 'videoCreate') {
        const opened = await openPowerPitchConnect();
        setMessage({
          text: opened
            ? 'Opening PowerPitch.ai to create your video.'
            : 'PowerPitch is set as your video mode.',
          tone: 'success',
        });
        onUploaded?.();
        return;
      }

      const filePayload =
        kind === 'deck' ? await pickDeckFile() : await pickVideoFile();
      if (!filePayload) {
        return;
      }

      if (kind === 'deck') {
        await authService.uploadPitchFile(
          token,
          filePayload,
          'fundraising-pitch',
        );
        try {
          await authService.updatePitchType(token, PITCH_TYPE_UPLOAD);
        } catch {
          // pitch-type is best-effort for deck uploads.
        }
      } else {
        await authService.uploadPitchVideo(
          token,
          filePayload,
          'fundraising-pitch',
        );
      }

      setMessage({
        text: kind === 'deck' ? 'Pitch deck uploaded.' : 'Video pitch uploaded.',
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
        <View style={styles.deckHeaderRow}>
          <Text style={styles.deckTitle}>
            Upload Pitch Deck <Text style={styles.required}>*</Text>
          </Text>
          {pitchDeck?.sampleDocument ? (
            <Pressable
              onPress={() => openLink(pitchDeck.sampleDocument)}
              style={({pressed}) => [
                styles.sampleButton,
                {borderColor: primaryColor},
                pressed && styles.pressed,
              ]}>
              <Icon name="download" size={14} color={primaryColor} />
              <Text style={[styles.sampleText, {color: primaryColor}]}>
                Download Sample
              </Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.deckSubtitle}>
          (Your pitch deck is private and visible only to your connections.)
        </Text>

        {pitchDocument ? (
          <View
            style={[
              styles.previewBox,
              {borderColor: primaryColor, padding: 8},
            ]}>
            <PdfPreview url={pitchDocument} primaryColor={primaryColor} />
            <Pressable
              onPress={() => openLink(pitchDocument)}
              style={styles.previewOpenLink}>
              <Icon name="open-in-new" size={14} color={primaryColor} />
              <Text style={[styles.previewOpenLinkText, {color: primaryColor}]}>
                Open in full screen
              </Text>
            </Pressable>
          </View>
        ) : (
          <View
            style={[
              styles.previewBox,
              styles.previewBoxEmpty,
              {borderColor: primaryColor},
            ]}>
            <View style={styles.previewContent}>
              <Icon name="file-upload-outline" size={48} color="#94a3b8" />
              <Text style={styles.previewEmptyTitle}>
                No pitch deck uploaded yet
              </Text>
              <Text style={styles.previewEmptyHint}>
                Use the upload box below to add one.
              </Text>
            </View>
          </View>
        )}

        <View style={styles.dropZoneRow}>
          <Pressable
            onPress={() => handleUpload('deck')}
            disabled={busyKind !== null}
            style={({pressed}) => [
              styles.dropZone,
              pressed && styles.pressed,
              busyKind === 'deck' && styles.disabled,
            ]}>
            <Text style={styles.dropZoneTitle}>
              Tap to select a file to upload.
            </Text>
            <Text style={styles.dropZoneHint}>
              Accepted formats: ppt, pptx, pdf
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleUpload('deck')}
            disabled={busyKind !== null}
            style={({pressed}) => [
              styles.editButton,
              pressed && styles.pressed,
              busyKind !== null && styles.disabled,
            ]}>
            {busyKind === 'deck' ? (
              <ActivityIndicator color="#475569" size="small" />
            ) : (
              <>
                <Icon
                  name={pitchDocument ? 'pencil-outline' : 'upload'}
                  size={16}
                  color="#475569"
                />
                <Text style={styles.editButtonText}>
                  {pitchDocument ? 'Edit' : 'Upload'}
                </Text>
              </>
            )}
          </Pressable>
        </View>

        {pitchDocument ? (
          <View style={styles.fileRow}>
            <Text style={styles.fileRowName} numberOfLines={1}>
              {fileName || 'pitch-deck.pdf'}
            </Text>
            <Pressable
              onPress={() => openLink(pitchDocument)}
              style={({pressed}) => [
                styles.downloadButton,
                {backgroundColor: primaryColor},
                pressed && styles.pressed,
              ]}>
              <Icon name="download" size={14} color="#ffffff" />
              <Text style={styles.downloadButtonText}>DOWNLOAD</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <View style={styles.subSection}>
        <View style={styles.videoTitleRow}>
          <View
            style={[styles.titleBar, {backgroundColor: primaryColor}]}
          />
          <Text style={styles.videoSectionTitle}>Your pitch video</Text>
        </View>

        <View style={styles.modeCardsRow}>
          <Pressable
            onPress={() => handleModeSwitch('create')}
            style={[
              styles.modeCard,
              videoMode === 'create' && {
                borderColor: primaryColor,
                borderWidth: 2,
              },
            ]}>
            <View style={styles.popularBadge}>
              <Text style={styles.popularBadgeText}>Popular</Text>
            </View>
            <Icon name="camera-outline" size={32} color="#0f172a" />
            <Text style={[styles.modeCardTitle, {color: primaryColor}]}>
              Create Video
            </Text>
            <Text style={styles.modeCardDescription}>
              Using an AI based video pitch platform
            </Text>
            {defaultPitchType === PITCH_TYPE_POWER ? (
              <View
                style={[styles.defaultBadge, {backgroundColor: primaryColor}]}>
                <Text style={styles.defaultBadgeText}>DEFAULT</Text>
              </View>
            ) : null}
          </Pressable>

          <Pressable
            onPress={() => handleModeSwitch('upload')}
            style={[
              styles.modeCard,
              videoMode === 'upload' && {
                borderColor: primaryColor,
                borderWidth: 2,
              },
            ]}>
            <Icon name="cloud-upload-outline" size={32} color="#0f172a" />
            <Text style={[styles.modeCardTitle, {color: primaryColor}]}>
              Upload Video
            </Text>
            <Text style={styles.modeCardDescription}>
              If you have an existing video created
            </Text>
            {defaultPitchType === PITCH_TYPE_UPLOAD ? (
              <View
                style={[styles.defaultBadge, {backgroundColor: primaryColor}]}>
                <Text style={styles.defaultBadgeText}>DEFAULT</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <View style={[styles.videoContent, {borderColor: '#cbd5e1'}]}>
          {videoMode === 'create' ? (
            <View style={styles.videoContentInner}>
              {powerVideoUrl ? (
                isDirectVideoUrl(powerVideoUrl) ? (
                  <InlineVideoPlayer
                    url={powerVideoUrl}
                    primaryColor={primaryColor}
                  />
                ) : (
                  <Pressable
                    onPress={() => openLink(powerVideoUrl)}
                    style={[styles.videoPreviewBox, {borderColor: primaryColor}]}>
                    <Icon name="play-circle" size={48} color={primaryColor} />
                    <Text
                      style={[styles.videoPreviewText, {color: primaryColor}]}>
                      Tap to play your video pitch
                    </Text>
                  </Pressable>
                )
              ) : (
                <Text style={styles.videoEmptyText}>
                  You do not have any video created
                </Text>
              )}
              <Pressable
                onPress={() => handleUpload('videoCreate')}
                disabled={busyKind !== null}
                style={({pressed}) => [
                  styles.solidCta,
                  {backgroundColor: primaryColor},
                  pressed && styles.pressed,
                  busyKind !== null && styles.disabled,
                ]}>
                {busyKind === 'videoCreate' ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.solidCtaText}>
                    {powerVideoUrl ? 'EDIT OR RECREATE' : '+ CREATE VIDEO'}
                  </Text>
                )}
              </Pressable>
            </View>
          ) : (
            <View style={styles.videoContentInner}>
              <Pressable
                onPress={() => handleUpload('videoUpload')}
                disabled={busyKind !== null}
                style={({pressed}) => [
                  styles.solidCta,
                  styles.solidCtaSelfStart,
                  {backgroundColor: primaryColor},
                  pressed && styles.pressed,
                  busyKind !== null && styles.disabled,
                ]}>
                {busyKind === 'videoUpload' ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.solidCtaText}>
                    {uploadVideoUrl ? 'UPLOAD NEW' : 'UPLOAD'}
                  </Text>
                )}
              </Pressable>
              {uploadVideoUrl ? (
                <View style={{marginTop: 12, width: '100%'}}>
                  <InlineVideoPlayer
                    url={uploadVideoUrl}
                    primaryColor={primaryColor}
                  />
                </View>
              ) : (
                <Text style={[styles.videoEmptyText, {marginTop: 16}]}>
                  No video uploaded yet
                </Text>
              )}
            </View>
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
  deckHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  deckTitle: {
    color: '#0f172a',
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  required: {
    color: '#ef4444',
  },
  deckSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 4,
  },
  sampleButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  sampleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  previewBox: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 220,
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  previewBoxEmpty: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
  },
  previewContent: {
    alignItems: 'center',
    gap: 6,
  },
  previewFileName: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'center',
  },
  previewHint: {
    color: '#64748b',
    fontSize: 12,
  },
  previewEmptyTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
  },
  previewEmptyHint: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
  },
  dropZoneRow: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  dropZone: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderRadius: 10,
    borderStyle: 'dashed',
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dropZoneTitle: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '600',
  },
  dropZoneHint: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 4,
  },
  editButton: {
    alignItems: 'center',
    backgroundColor: '#e8ecf8',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minWidth: 80,
    paddingHorizontal: 14,
  },
  editButtonText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  fileRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginTop: 14,
  },
  fileRowName: {
    color: '#0f172a',
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  downloadButton: {
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  downloadButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  videoTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  titleBar: {
    borderRadius: 2,
    height: 18,
    width: 3,
  },
  videoSectionTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
  },
  modeCardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  modeCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 18,
  },
  popularBadge: {
    alignSelf: 'flex-end',
    backgroundColor: '#22c55e',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    position: 'absolute',
    right: 6,
    top: 6,
  },
  popularBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  modeCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 8,
  },
  modeCardDescription: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  defaultBadge: {
    borderRadius: 6,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  defaultBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  videoContent: {
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    marginTop: 14,
    padding: 14,
  },
  videoContentInner: {
    alignItems: 'center',
    gap: 8,
  },
  videoEmptyText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  pdfWrap: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    height: 280,
    overflow: 'hidden',
    width: '100%',
  },
  pdfWebView: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  pdfLoading: {
    alignItems: 'center',
    backgroundColor: '#0f172a55',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  previewOpenLink: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    paddingVertical: 4,
  },
  previewOpenLinkText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pdfFallback: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 32,
    width: '100%',
  },
  pdfFallbackText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  videoPlayerWrap: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    overflow: 'hidden',
    width: '100%',
  },
  videoPlayer: {
    aspectRatio: 16 / 9,
    backgroundColor: '#0f172a',
    width: '100%',
  },
  videoPlayerFallback: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 24,
    width: '100%',
  },
  videoPlayerFallbackText: {
    fontSize: 13,
    fontWeight: '600',
  },
  videoPreviewBox: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 20,
    width: '100%',
  },
  videoPreviewText: {
    fontSize: 13,
    fontWeight: '600',
  },
  solidCta: {
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  solidCtaSelfStart: {
    alignSelf: 'flex-start',
    marginTop: 0,
  },
  solidCtaText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
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
