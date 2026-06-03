import React from 'react';
import {Alert, Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import {launchImageLibrary} from 'react-native-image-picker';

import {Icon} from '../../../core/components/Icon';
import {radii, spacing, typography} from '../../../core/theme/colors';

export type PickedImage = {
  uri: string;
  name: string;
  type: string;
};

type Props = {
  visible: boolean;
  primaryColor: string;
  onClose: () => void;
  // Returns the picked image(s) to the composer (local URIs — preview only).
  onPicked: (images: PickedImage[]) => void;
};

// "Upload an image" picker modal. Mirrors the web drop-box, but on mobile the
// box / Upload button open the device gallery (png/jpg/jpeg only).
export function ImageUploadModal({
  visible,
  primaryColor,
  onClose,
  onPicked,
}: Props) {
  const handleUpload = async () => {
    if (typeof launchImageLibrary !== 'function') {
      Alert.alert(
        'Image picker unavailable',
        'Please rebuild the app and try again.',
      );
      return;
    }
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 0,
      includeBase64: false,
    });
    if (result.didCancel) return;
    if (result.errorCode) {
      Alert.alert(
        'Upload failed',
        result.errorMessage || 'Could not open the gallery.',
      );
      return;
    }
    const images = (result.assets || [])
      .filter(asset => asset.uri)
      .map((asset, i) => ({
        uri: asset.uri as string,
        name: asset.fileName || `image_${i}.jpg`,
        type: asset.type || 'image/jpeg',
      }));
    if (images.length === 0) return;
    onPicked(images);
    onClose();
  };

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Upload an image</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}>
              <Icon name="close" size={24} color="#0f172a" />
            </Pressable>
          </View>

          <View style={styles.divider} />

          <Pressable
            style={[styles.dropBox, {borderColor: primaryColor}]}
            onPress={handleUpload}
            accessibilityRole="button"
            accessibilityLabel="Choose an image to upload">
            <Text style={styles.dropTitle}>
              Click or Drop file in this box to upload.
            </Text>
            <Text style={styles.dropFormats}>Accepted formats: png, jpg, jpeg</Text>
            <View style={styles.uploadButton}>
              <Icon name="cloud-upload-outline" size={22} color="#475569" />
              <Text style={styles.uploadButtonText}>Upload</Text>
            </View>
          </Pressable>

          <View style={styles.footer}>
            <Pressable
              style={styles.cancelButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cancel">
              <Text style={styles.cancelText}>CANCEL</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.56)',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: radii.xl,
    maxWidth: 560,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    width: '100%',
    zIndex: 2,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    color: '#0f172a',
    fontSize: typography.title,
    fontWeight: '800',
  },
  divider: {
    backgroundColor: '#e2e8f0',
    height: 1,
    marginTop: spacing.md,
  },
  dropBox: {
    alignItems: 'center',
    borderRadius: radii.lg,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxxl,
  },
  dropTitle: {
    color: '#0f172a',
    fontSize: typography.subhead,
    fontWeight: '700',
    textAlign: 'center',
  },
  dropFormats: {
    color: '#0f172a',
    fontSize: typography.subhead,
    fontWeight: '700',
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  uploadButton: {
    alignItems: 'center',
    backgroundColor: '#eef2f7',
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  uploadButtonText: {
    color: '#0f172a',
    fontSize: typography.title,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'flex-end',
    marginTop: spacing.xl,
  },
  cancelButton: {
    backgroundColor: '#eef2f7',
    borderRadius: radii.md,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
  },
  cancelText: {
    color: '#475569',
    fontSize: typography.subhead,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
