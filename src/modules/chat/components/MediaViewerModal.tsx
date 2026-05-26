import React from 'react';
import {
  Dimensions,
  Image,
  Linking,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Video from 'react-native-video';

import {Icon} from '../../../core/components/Icon';
import type {AttachmentInfo} from '../utils';

type Props = {
  attachment: AttachmentInfo | null;
  onClose: () => void;
};

// Full-screen lightbox for chat image / video attachments — mirrors the
// lightgallery experience on web. Tap the bubble preview to open here at
// full size, with a download action that hands the URL to the OS browser
// (which on Android/iOS surfaces the system "Save image" / "Download"
// option once the asset is on screen). The modal renders nothing when
// `attachment` is null so the parent can simply mount it once and toggle
// state to show/hide.
export function MediaViewerModal({attachment, onClose}: Props) {
  const insets = useSafeAreaInsets();
  const {width: screenWidth, height: screenHeight} = Dimensions.get('window');

  if (!attachment) return null;

  const isImage = attachment.kind === 'image';
  const isVideo = attachment.kind === 'video';

  const handleDownload = () => {
    Linking.openURL(attachment.url).catch(() => {});
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      // Cover the status bar on Android so the dark backdrop reads as a
      // true full-screen viewer rather than a card pushed below the bar.
      statusBarTranslucent
      onRequestClose={onClose}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="rgba(0,0,0,0.95)"
        translucent
      />
      <View style={styles.overlay}>
        <View
          style={[
            styles.topBar,
            {paddingTop: insets.top + 8},
          ]}>
          <Text style={styles.fileName} numberOfLines={1}>
            {attachment.fileName}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Close">
            <Icon name="close" size={24} color="#ffffff" />
          </Pressable>
        </View>

        <View style={styles.contentWrap}>
          {isImage ? (
            <Image
              source={{uri: attachment.url}}
              style={{
                height: screenHeight * 0.7,
                width: screenWidth,
              }}
              resizeMode="contain"
            />
          ) : isVideo ? (
            <Video
              source={{uri: attachment.url}}
              style={{
                height: screenHeight * 0.6,
                width: screenWidth,
              }}
              controls
              resizeMode="contain"
            />
          ) : null}
        </View>

        <View
          style={[
            styles.bottomBar,
            {paddingBottom: insets.bottom + 16},
          ]}>
          <Pressable
            onPress={handleDownload}
            style={styles.downloadBtn}
            accessibilityRole="button"
            accessibilityLabel="Download">
            <Icon name="download" size={18} color="#ffffff" />
            <Text style={styles.downloadText}>Download</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.95)',
    flex: 1,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  fileName: {
    color: '#ffffff',
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  iconBtn: {
    padding: 4,
  },
  contentWrap: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  bottomBar: {
    alignItems: 'center',
    paddingTop: 12,
  },
  downloadBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 24,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  downloadText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
