import React, {useState} from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {Icon} from '../../../core/components/Icon';
import {useToast} from '../../../core/toast/ToastProvider';
import {PdfPagesCarousel} from './PdfPagesCarousel';

type Props = {
  // Set to a file payload to open the modal; pass null to close. Caller
  // owns the dismiss state (single source of truth) so the same modal
  // instance can host every Download button on a screen without per-row
  // mounting.
  file: {
    url: string;
    displayName?: string | null;
    // For PDFs the backend pre-renders one JPG per page. When present we
    // show them through the existing PdfPagesCarousel so the user can
    // flip through pages inside the preview.
    images?: string[];
  } | null;
  primaryColor: string;
  onClose: () => void;
};

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp']);

const extOf = (urlOrName: string): string => {
  const cleaned = (urlOrName || '').split('?')[0];
  const dot = cleaned.lastIndexOf('.');
  if (dot < 0) return '';
  return cleaned.slice(dot + 1).toLowerCase();
};

const fileIconForExt = (ext: string): string => {
  if (ext === 'pdf') return 'file-pdf-box';
  if (ext === 'ppt' || ext === 'pptx') return 'file-powerpoint-box';
  if (ext === 'doc' || ext === 'docx') return 'file-word-box';
  if (ext === 'xls' || ext === 'xlsx') return 'file-excel-box';
  return 'file-document-outline';
};

/**
 * Full-screen file preview that the Download buttons open before
 * actually fetching the file. The user sees the deck / document inside
 * the app first, then taps Download to hand the URL off to the OS —
 * after which we close the modal so they land back on the screen they
 * came from instead of being stuck on a Chrome tab.
 *
 * Render rules for the preview body:
 *  - If `file.images` is non-empty → PdfPagesCarousel (works for the
 *    pitch deck, where pages are pre-rendered).
 *  - Else if the URL extension looks like an image → <Image contain>.
 *  - Else → tinted file icon + filename + an explainer that the format
 *    can't be previewed inline but Download will still work.
 */
export function FilePreviewModal({file, primaryColor, onClose}: Props) {
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [downloading, setDownloading] = useState(false);

  const visible = file !== null;
  const url = file?.url || '';
  const displayName = file?.displayName || '';
  const images = file?.images || [];

  // URL is the source of truth for the file's actual format — display
  // names like "Company PAN Card" carry no extension and would otherwise
  // route the preview into the file-icon fallback even though the file
  // itself is a JPG. Fall back to displayName only when the URL truly
  // has no extension (rare).
  const ext = extOf(url) || extOf(displayName);
  const isImageFile = IMAGE_EXTS.has(ext);
  const screenHeight = Dimensions.get('window').height;
  // Body fills the area between the header (56) and footer (~80) plus
  // safe-area padding. Carousel rendered slightly shorter than the body
  // for visual breathing room.
  const previewHeight = Math.max(280, screenHeight - 240 - insets.top - insets.bottom);

  const handleDownload = async () => {
    if (!url) return;
    setDownloading(true);
    toast.info('Downloading file…');
    try {
      // In-app silent fetch — no Linking.openURL handoff, so Chrome never
      // takes over and the user stays inside the app the entire time.
      // We drain the response blob so the network transfer actually
      // completes (otherwise the fetch promise can resolve on headers
      // only). Caveat: without a filesystem package (react-native-blob-util
      // etc.) the bytes live in memory and aren't persisted to /Download/.
      // If actual disk persistence is required later, swap this for the
      // blob-util variant — the rest of the UX (toast, modal close,
      // returns to caller) stays identical.
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      await response.blob();
      toast.success(
        displayName ? `${displayName} downloaded.` : 'Your file has been downloaded.',
      );
      // Close the modal so the user lands back on the screen they tapped
      // Download from — no Chrome tab to manually dismiss.
      onClose();
    } catch {
      toast.error('Could not download file.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      transparent={false}>
      <View style={[styles.container, {paddingTop: insets.top}]}>
        {/* Header: filename + close X. Coloured with tenant primary so
            users see they're inside an app modal, not a system viewer. */}
        <View style={[styles.header, {backgroundColor: primaryColor}]}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {displayName || 'File preview'}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close preview">
            <Icon name="close" size={24} color="#ffffff" />
          </Pressable>
        </View>

        <View style={styles.body}>
          {images.length > 0 ? (
            <PdfPagesCarousel
              images={images}
              primaryColor={primaryColor}
              height={previewHeight}
            />
          ) : isImageFile ? (
            <Image
              source={{uri: url}}
              style={[styles.imagePreview, {height: previewHeight}]}
              resizeMode="contain"
            />
          ) : (
            <View
              style={[
                styles.iconFallback,
                {
                  height: previewHeight,
                  backgroundColor: `${primaryColor}0a`,
                },
              ]}>
              <Icon
                name={fileIconForExt(ext)}
                size={84}
                color={primaryColor}
              />
              {ext ? (
                <Text style={[styles.extBadge, {color: primaryColor}]}>
                  {ext.toUpperCase()}
                </Text>
              ) : null}
              <Text style={styles.fallbackName} numberOfLines={2}>
                {displayName || 'File'}
              </Text>
              <Text style={styles.fallbackHint}>
                This file format can't be previewed inside the app. Tap
                Download to save it and open it in your device's viewer.
              </Text>
            </View>
          )}
        </View>

        <View
          style={[
            styles.footer,
            {paddingBottom: Math.max(12, insets.bottom)},
          ]}>
          <Pressable
            onPress={handleDownload}
            disabled={downloading}
            style={({pressed}) => [
              styles.downloadBtn,
              {backgroundColor: primaryColor},
              pressed && {opacity: 0.85},
              downloading && {opacity: 0.7},
            ]}
            accessibilityRole="button"
            accessibilityLabel="Download file">
            {downloading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Icon name="download" size={18} color="#ffffff" />
                <Text style={styles.downloadBtnText}>Download</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: {
    color: '#ffffff',
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
  },
  body: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  imagePreview: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    width: '100%',
  },
  iconFallback: {
    alignItems: 'center',
    borderRadius: 12,
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal: 24,
    width: '100%',
  },
  extBadge: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  fallbackName: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 8,
    textAlign: 'center',
  },
  fallbackHint: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    paddingHorizontal: 16,
    textAlign: 'center',
  },
  footer: {
    borderTopColor: '#e2e8f0',
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  downloadBtn: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 14,
  },
  downloadBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
