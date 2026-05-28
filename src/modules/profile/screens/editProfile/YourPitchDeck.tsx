import React, {useContext, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {launchImageLibrary} from 'react-native-image-picker';
import Video from 'react-native-video';
import {
  pick,
  types,
  isErrorWithCode,
  errorCodes,
} from '@react-native-documents/picker';

import {authService} from '../../../auth/services/auth.service';
import {Icon} from '../../../../core/components/Icon';
import {colors} from '../../../../core/theme/colors';
import {TenantContext} from '../../../../core/tenant/TenantProvider';

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
  // The backend pre-converts the uploaded PDF to JPGs (one per page) on
  // ingestion. The mobile carousel reads whichever of these arrays the
  // server returns; the web component does the same. Fields are typed
  // loosely because the API may ship plain string URLs or wrapped objects.
  pitchDocumentImages?: unknown;
  pitchImages?: unknown;
  documentImages?: unknown;
  images?: unknown;
  pdfImages?: unknown;
  pages?: unknown;
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

const extOf = (path: string): string => {
  const match = /\.([a-z0-9]+)(?:\?|#|$)/i.exec(path);
  return match ? match[1].toLowerCase() : '';
};

const iconForExt = (ext: string): string => {
  if (ext === 'pdf') return 'file-pdf-box';
  if (ext === 'ppt' || ext === 'pptx') return 'file-powerpoint-box';
  if (ext === 'doc' || ext === 'docx') return 'file-word-box';
  return 'file-document-outline';
};

// Resolve a (possibly relative) server path against the tenant's CDN / API
// origin so external openers (browser, download) always receive an absolute
// URL. Falls back through the most-specific origin first (imgKit → s3 →
// baseUrl) so production paths land on the CDN they were uploaded to.
const resolveUrl = (
  path: string,
  bases: Array<string | null | undefined>,
): string => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const base = bases.find(b => typeof b === 'string' && b.length > 0);
  if (!base) return path;
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
};

// Pulls an image URL string out of whatever shape the backend ships — some
// endpoints return plain strings, others wrap each page as
// `{url}` / `{path}` / `{src}` / `{image}`. Unrecognized entries are
// dropped.
const imageUrlFromEntry = (entry: unknown): string => {
  if (!entry) return '';
  if (typeof entry === 'string') return entry;
  if (typeof entry === 'object') {
    const obj = entry as Record<string, unknown>;
    const candidate =
      obj.url || obj.path || obj.image || obj.src || obj.filePath || obj.fileName;
    return typeof candidate === 'string' ? candidate : '';
  }
  return '';
};

// Flexible reader for the pre-converted page-image array on `pitchDeck`.
// The exact field name varies between deployments, so we walk a list of
// known candidates and return the first non-empty one. Matches the web
// `app-pitch-document-carousel`'s behavior of consuming the pitchDeck
// object as-is.
const getPitchImages = (
  pitchDeck: PitchDeck | null | undefined,
  bases: Array<string | null | undefined>,
): string[] => {
  if (!pitchDeck) return [];
  const candidates: unknown[] = [
    pitchDeck.pitchDocumentImages,
    pitchDeck.pitchImages,
    pitchDeck.documentImages,
    pitchDeck.images,
    pitchDeck.pdfImages,
    pitchDeck.pages,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      const urls = candidate
        .map(imageUrlFromEntry)
        .filter(Boolean)
        .map(u => resolveUrl(u, bases));
      if (urls.length > 0) return urls;
    }
  }
  return [];
};

// Image-based pitch-deck carousel that mirrors the web `<ngb-carousel>` —
// the backend pre-renders each PDF page to a JPG on upload, so we just
// flip through those images instead of rasterizing the PDF on-device.
// Avoids the CORS / WebView problems the PDF.js approach hit.
function PdfPagesCarousel({
  images,
  primaryColor,
}: {
  images: string[];
  primaryColor: string;
}) {
  const [page, setPage] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  const total = images.length;
  const safePage = Math.min(Math.max(1, page), Math.max(1, total));
  const currentUrl = images[safePage - 1];

  // Reset per-image load state whenever the user flips pages so the
  // spinner appears while the new image is fetching, and `errored`
  // doesn't leak from a previous page.
  const goTo = (next: number) => {
    if (next < 1 || next > total) return;
    setLoaded(false);
    setErrored(false);
    setPage(next);
  };

  if (total === 0) return null;

  const canPrev = safePage > 1;
  const canNext = safePage < total;

  return (
    <View style={styles.previewFrame}>
      <Image
        source={{uri: currentUrl}}
        style={styles.previewImage}
        resizeMode="contain"
        onLoadEnd={() => setLoaded(true)}
        onError={() => {
          setLoaded(true);
          setErrored(true);
        }}
      />

      {!loaded ? (
        <View style={styles.previewStatusOverlay} pointerEvents="none">
          <ActivityIndicator color={primaryColor} />
          <Text style={styles.previewStatusText}>Loading page {safePage}…</Text>
        </View>
      ) : null}

      {errored ? (
        <View style={styles.previewStatusOverlay} pointerEvents="none">
          <Icon name="image-broken-variant" size={36} color={primaryColor} />
          <Text style={styles.previewStatusText}>Couldn't load this page.</Text>
        </View>
      ) : null}

      {/* Floating Prev / Next chevrons, same pattern as the web carousel. */}
      <Pressable
        onPress={() => goTo(safePage - 1)}
        disabled={!canPrev}
        hitSlop={8}
        style={({pressed}) => [
          styles.pagerBtn,
          styles.pagerBtnLeft,
          !canPrev && styles.pagerBtnDisabled,
          pressed && canPrev && styles.pressed,
        ]}>
        <Icon
          name="chevron-left"
          size={24}
          color={canPrev ? '#0f172a' : '#cbd5e1'}
        />
      </Pressable>
      <Pressable
        onPress={() => goTo(safePage + 1)}
        disabled={!canNext}
        hitSlop={8}
        style={({pressed}) => [
          styles.pagerBtn,
          styles.pagerBtnRight,
          !canNext && styles.pagerBtnDisabled,
          pressed && canNext && styles.pressed,
        ]}>
        <Icon
          name="chevron-right"
          size={24}
          color={canNext ? '#0f172a' : '#cbd5e1'}
        />
      </Pressable>

      <View style={styles.pagerBadge}>
        <Text style={styles.pagerBadgeText}>
          {safePage} / {total}
        </Text>
      </View>
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
  const {baseUrl, globalSetting} = useContext(TenantContext);
  const rawPitchDocument = pitchDeck?.pitchDocument || '';
  // Resolve to an absolute URL so OS-level openers (browser, download)
  // always receive a fetchable address — server may return a relative path.
  const pitchDocument = resolveUrl(rawPitchDocument, [
    globalSetting?.imgKitUrl,
    globalSetting?.assetsImgKitUrl,
    globalSetting?.s3Url,
    baseUrl,
  ]);
  const fileName =
    pitchDeck?.fileName || (rawPitchDocument.split('/').pop() ?? '');
  const fileExt = extOf(fileName || rawPitchDocument);
  // Resolve the array of pre-converted page-images from whichever field
  // the backend ships, against the same CDN bases used for pitchDocument.
  const pitchImages = getPitchImages(pitchDeck, [
    globalSetting?.imgKitUrl,
    globalSetting?.assetsImgKitUrl,
    globalSetting?.s3Url,
    baseUrl,
  ]);
  const uploadVideoUrl = pitchDeck?.uploadPitchUrl || '';
  const powerVideoUrl =
    pitchDeck?.powerPitchUrl || pitchDeck?.embedUrl || '';

  const hasContent = Boolean(
    pitchDocument || uploadVideoUrl || powerVideoUrl,
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

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={[styles.iconBadge, {backgroundColor: `${primaryColor}1a`}]}>
          <Icon name="presentation" size={20} color={primaryColor} />
        </View>
        <Text style={styles.title}>Your pitch deck</Text>
      </View>

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
          // Uploaded: one consolidated card — PDF page preview (with Prev /
          // Next pager) for .pdf, a large icon for other formats; filename
          // below; and the three actions (View, Download, Replace) on a
          // single row.
          <View
            style={[
              styles.deckCard,
              {borderColor: primaryColor},
            ]}>
            {pitchImages.length > 0 ? (
              <PdfPagesCarousel
                images={pitchImages}
                primaryColor={primaryColor}
              />
            ) : (
              <View
                style={[
                  styles.deckThumb,
                  {backgroundColor: `${primaryColor}10`},
                ]}>
                <Icon
                  name={iconForExt(fileExt)}
                  size={72}
                  color={primaryColor}
                />
                {fileExt ? (
                  <Text style={[styles.deckThumbBadge, {color: primaryColor}]}>
                    {fileExt.toUpperCase()}
                  </Text>
                ) : null}
              </View>
            )}

            <Text style={[styles.deckFileName, {marginTop: 12}]} numberOfLines={2}>
              {fileName || 'pitch-deck'}
            </Text>
            <Text style={styles.deckFileMeta}>
              {pitchImages.length > 1
                ? 'Use the arrows above to flip through pages.'
                : pitchImages.length === 1
                  ? 'Single-page preview above.'
                  : "Tap View to open this file in your device's viewer."}
            </Text>

            <View style={styles.deckActions}>
              <Pressable
                onPress={() => openLink(pitchDocument)}
                style={({pressed}) => [
                  styles.deckActionBtn,
                  styles.deckActionOutline,
                  {borderColor: primaryColor},
                  pressed && styles.pressed,
                ]}>
                <Icon name="open-in-new" size={16} color={primaryColor} />
                <Text style={[styles.deckActionText, {color: primaryColor}]}>
                  View
                </Text>
              </Pressable>
              <Pressable
                onPress={() => openLink(pitchDocument)}
                style={({pressed}) => [
                  styles.deckActionBtn,
                  {backgroundColor: primaryColor},
                  pressed && styles.pressed,
                ]}>
                <Icon name="download" size={16} color="#ffffff" />
                <Text style={[styles.deckActionText, {color: '#ffffff'}]}>
                  Download
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleUpload('deck')}
                disabled={busyKind !== null}
                style={({pressed}) => [
                  styles.deckActionBtn,
                  styles.deckActionGhost,
                  pressed && styles.pressed,
                  busyKind !== null && styles.disabled,
                ]}>
                {busyKind === 'deck' ? (
                  <ActivityIndicator color="#475569" size="small" />
                ) : (
                  <>
                    <Icon name="pencil-outline" size={16} color="#475569" />
                    <Text
                      style={[styles.deckActionText, {color: '#475569'}]}>
                      Replace
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          // Empty state: single tappable upload zone (no duplicate Edit
          // button beside it). Tap anywhere on this card to open the picker.
          <Pressable
            onPress={() => handleUpload('deck')}
            disabled={busyKind !== null}
            style={({pressed}) => [
              styles.uploadZone,
              {borderColor: primaryColor},
              pressed && styles.pressed,
              busyKind === 'deck' && styles.disabled,
            ]}>
            {busyKind === 'deck' ? (
              <ActivityIndicator color={primaryColor} size="large" />
            ) : (
              <>
                <Icon
                  name="cloud-upload-outline"
                  size={42}
                  color={primaryColor}
                />
                <Text style={styles.uploadZoneTitle}>
                  Tap to upload your pitch deck
                </Text>
                <Text style={styles.uploadZoneHint}>
                  Accepted formats: ppt, pptx, pdf · Max 50 MB
                </Text>
              </>
            )}
          </Pressable>
        )}
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
  fileCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 14,
    marginTop: 12,
    padding: 14,
  },
  fileIconWrap: {
    alignItems: 'center',
    borderRadius: 12,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  fileMeta: {
    flex: 1,
    gap: 4,
  },
  fileCardName: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
  },
  fileCardExt: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  fileCardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  fileCardViewBtn: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  fileCardViewText: {
    fontSize: 12,
    fontWeight: '700',
  },
  fileCardDownloadBtn: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  fileCardDownloadText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  // Consolidated pitch-deck card: large thumbnail + filename + 3 actions.
  // Replaces the previous file-card + drop-zone + file-row stack.
  deckCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1.5,
    marginTop: 12,
    padding: 18,
  },
  deckThumb: {
    alignItems: 'center',
    borderRadius: 14,
    height: 160,
    justifyContent: 'center',
    marginBottom: 14,
    width: '100%',
  },
  deckThumbBadge: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 6,
  },
  deckFileName: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  deckFileMeta: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  deckActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    width: '100%',
  },
  deckActionBtn: {
    alignItems: 'center',
    borderRadius: 10,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  deckActionOutline: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
  },
  deckActionGhost: {
    backgroundColor: '#f1f5f9',
  },
  deckActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  // Single-tap upload zone shown when no file exists.
  uploadZone: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 32,
  },
  uploadZoneTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
  },
  uploadZoneHint: {
    color: '#64748b',
    fontSize: 12,
  },
  // PdfPreview chrome — the WebView container plus the floating pager
  // buttons and page indicator that overlay it. alignSelf:'stretch' is
  // essential: the parent deckCard sets alignItems:'center', which would
  // otherwise collapse this frame to its content's natural width.
  previewFrame: {
    alignSelf: 'stretch',
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 12,
    borderWidth: 1,
    height: 360,
    marginTop: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  previewWeb: {
    backgroundColor: '#f8fafc',
    flex: 1,
  },
  // Each carousel slide is a single Image filling the preview frame; the
  // image itself contains the rendered page so we let it letterbox via
  // resizeMode="contain" rather than cropping with cover.
  previewImage: {
    backgroundColor: '#f8fafc',
    height: '100%',
    width: '100%',
  },
  // Absolute overlay so the loading spinner / error message sits on top of
  // the Image rather than getting laid out below it (and clipped by
  // overflow:hidden on the frame).
  previewStatusOverlay: {
    alignItems: 'center',
    bottom: 0,
    gap: 10,
    justifyContent: 'center',
    left: 0,
    paddingHorizontal: 24,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  previewStatusText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  pagerBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 999,
    elevation: 3,
    height: 40,
    justifyContent: 'center',
    position: 'absolute',
    shadowColor: '#0f172a',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.18,
    shadowRadius: 6,
    top: '50%',
    transform: [{translateY: -20}],
    width: 40,
  },
  pagerBtnLeft: {
    left: 8,
  },
  pagerBtnRight: {
    right: 8,
  },
  pagerBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    elevation: 0,
    shadowOpacity: 0,
  },
  pagerBadge: {
    backgroundColor: 'rgba(15,23,42,0.78)',
    borderRadius: 999,
    bottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    position: 'absolute',
    right: 10,
  },
  pagerBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
});
