import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {Icon} from '../../../core/components/Icon';
import {colors} from '../../../core/theme/colors';
import {useToast} from '../../../core/toast/ToastProvider';
import {
  StartupKitServiceDetail,
  startupKitService,
} from '../services/startupKit.service';

type Props = {
  uuid: string;
  token: string;
  imgKitUrl?: string;
  primaryColor: string;
  onBack: () => void;
};

const stripHtml = (html?: string): string => {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const formatCredit = (detail: StartupKitServiceDetail): string | null => {
  if (detail.creditType === 'credits' && detail.totalCreditsAmount) {
    return `$${detail.totalCreditsAmount.toLocaleString()} Credits`;
  }
  if (detail.creditType === 'discount') {
    if (detail.discountType === 'percentage' && detail.totalDiscountPercentage) {
      return `${detail.totalDiscountPercentage}% Off`;
    }
    if (detail.totalDiscountAmount) {
      return `$${detail.totalDiscountAmount.toLocaleString()} Off`;
    }
  }
  return null;
};

export function StartupKitDetailScreen({
  uuid,
  token,
  imgKitUrl,
  primaryColor,
  onBack,
}: Props) {
  const toast = useToast();
  const [detail, setDetail] = useState<StartupKitServiceDetail | null>(null);
  const [isApplied, setIsApplied] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [loadingCheck, setLoadingCheck] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadingDetail(true);
      setError(null);
      try {
        const d = await startupKitService.getDetail(uuid, imgKitUrl);
        if (!cancelled) setDetail(d);
      } catch {
        if (!cancelled) setError('Failed to load service details.');
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    };

    const check = async () => {
      setLoadingCheck(true);
      try {
        const applied = await startupKitService.checkApplied(token, uuid);
        if (!cancelled) setIsApplied(applied);
      } catch {
        // non-fatal — default to not applied
      } finally {
        if (!cancelled) setLoadingCheck(false);
      }
    };

    load();
    check();
    return () => { cancelled = true; };
  }, [uuid, token, imgKitUrl]);

  const refreshAppliedStatus = async () => {
    try {
      const applied = await startupKitService.checkApplied(token, uuid);
      setIsApplied(applied);
    } catch {
      // non-fatal
    }
  };

  const handleApply = () => setConfirmVisible(true);

  const confirmApply = async () => {
    setConfirmVisible(false);
    setApplying(true);
    try {
      const message = await startupKitService.apply(token, uuid);
      toast.success(message);
      await refreshAppliedStatus();
    } catch (e: any) {
      toast.error(e?.message || 'Something went wrong. Please try again.');
    } finally {
      setApplying(false);
    }
  };

  const creditLabel = detail ? formatCredit(detail) : null;

  return (
    <View style={styles.page}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable
          onPress={onBack}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({pressed}) => [
            styles.iconBtn,
            pressed && {opacity: 0.5, backgroundColor: colors.border},
          ]}>
          <Icon name="arrow-left" size={24} color="#475569" />
        </Pressable>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          Startup Booster Kit
        </Text>
      </View>

      {loadingDetail ? (
        <View style={styles.centered}>
          <ActivityIndicator color={primaryColor} size="large" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Icon name="alert-circle-outline" size={40} color="#f87171" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            onPress={() => {
              setLoadingDetail(true);
              startupKitService
                .getDetail(uuid, imgKitUrl)
                .then(setDetail)
                .catch(() => setError('Failed to load service details.'))
                .finally(() => setLoadingDetail(false));
            }}
            style={[styles.retryBtn, {borderColor: primaryColor}]}>
            <Text style={[styles.retryBtnText, {color: primaryColor}]}>
              Retry
            </Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}>
          {/* Service header */}
          <View style={styles.header}>
            {/* Logo + Info side by side */}
            <View style={styles.headerRow}>
              <View style={styles.logoWrap}>
                {detail?.logo ? (
                  <Image
                    source={{uri: detail.logo}}
                    style={styles.logo}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.logoPlaceholder}>
                    <Icon name="image-outline" size={28} color="#cbd5e1" />
                  </View>
                )}
              </View>

              <View style={styles.infoBlock}>
                <Text style={styles.serviceName} numberOfLines={2}>
                  {detail?.name}
                </Text>
                {detail?.shortDescription ? (
                  <Text style={styles.serviceShort} numberOfLines={2}>
                    {detail.shortDescription}
                  </Text>
                ) : null}
                {detail?.category?.name ? (
                  <View style={[styles.categoryBadge, {backgroundColor: `${primaryColor}18`}]}>
                    <Text style={[styles.categoryBadgeText, {color: primaryColor}]}>
                      {detail.category.name}
                    </Text>
                  </View>
                ) : null}
                {creditLabel ? (
                  <View style={styles.creditRow}>
                    <Icon name="tag-outline" size={13} color="#16a34a" />
                    <Text style={styles.creditLabel}>{creditLabel}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Apply button — full width below */}
            <View style={styles.applyWrap}>
              {loadingCheck || applying ? (
                <ActivityIndicator color={primaryColor} />
              ) : isApplied ? (
                <View style={styles.appliedBadge}>
                  <Icon name="check-circle" size={16} color="#16a34a" />
                  <Text style={styles.appliedText}>Applied</Text>
                </View>
              ) : (
                <Pressable
                  onPress={handleApply}
                  style={({pressed}) => [
                    styles.applyBtn,
                    {backgroundColor: primaryColor},
                    pressed && {opacity: 0.85},
                  ]}
                  accessibilityRole="button">
                  <Text style={styles.applyBtnText}>Apply Now</Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Long description */}
          {detail?.longDescription ? (
            <View style={styles.descSection}>
              <Text style={styles.descTitle}>About this service</Text>
              <Text style={styles.descBody}>
                {stripHtml(detail.longDescription)}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      )}

      {/* Apply confirmation modal */}
      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            {/* Orange exclamation circle */}
            <View style={[styles.alertCircle, {borderColor: primaryColor}]}>
              <Text style={[styles.alertMark, {color: primaryColor}]}>!</Text>
            </View>

            <Text style={styles.dialogTitle}>Apply for Credits</Text>
            <Text style={styles.dialogBody}>
              Please confirm if you wish to proceed with the application for
              this program. By doing so, the details of your startup will be
              forwarded to the program organizer for subsequent steps.
            </Text>

            <View style={styles.dialogBtns}>
              <Pressable
                onPress={() => setConfirmVisible(false)}
                style={({pressed}) => [
                  styles.dialogBtn,
                  styles.cancelBtn,
                  pressed && {opacity: 0.75},
                ]}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={confirmApply}
                style={({pressed}) => [
                  styles.dialogBtn,
                  {backgroundColor: primaryColor},
                  pressed && {opacity: 0.85},
                ]}>
                <Text style={styles.okBtnText}>OK</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {flex: 1, backgroundColor: '#f1f5f9'},

  topBar: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  iconBtn: {
    alignItems: 'center',
    borderRadius: 10,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  topBarTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
  },

  centered: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {color: '#ef4444', fontSize: 14, textAlign: 'center'},
  retryBtn: {
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  retryBtnText: {fontSize: 14, fontWeight: '600'},

  content: {padding: 16, gap: 16},

  header: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    elevation: 2,
    gap: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  logoWrap: {
    borderColor: '#e2e8f0',
    borderRadius: 10,
    borderWidth: 1,
    height: 80,
    overflow: 'hidden',
    width: 80,
    flexShrink: 0,
  },
  logo: {height: '100%', width: '100%'},
  logoPlaceholder: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    flex: 1,
    justifyContent: 'center',
  },

  infoBlock: {flex: 1, gap: 5},
  serviceName: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },
  serviceShort: {color: '#64748b', fontSize: 12, lineHeight: 17},
  categoryBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  categoryBadgeText: {fontSize: 11, fontWeight: '700'},
  creditRow: {alignItems: 'center', flexDirection: 'row', gap: 4},
  creditLabel: {color: '#16a34a', fontSize: 12, fontWeight: '700'},

  applyWrap: {marginTop: 0},
  applyBtn: {
    alignItems: 'center',
    borderRadius: 10,
    paddingVertical: 13,
  },
  applyBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  appliedBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  appliedText: {color: '#16a34a', fontSize: 14, fontWeight: '700'},

  descSection: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    elevation: 2,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  descTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  descBody: {color: '#475569', fontSize: 14, lineHeight: 22},

  // Confirmation modal
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  dialog: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    gap: 12,
    paddingBottom: 24,
    paddingHorizontal: 24,
    paddingTop: 32,
    width: '100%',
  },
  alertCircle: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 2.5,
    height: 64,
    justifyContent: 'center',
    marginBottom: 4,
    width: 64,
  },
  alertMark: {fontSize: 34, fontWeight: '700', lineHeight: 40},
  dialogTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  dialogBody: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  dialogBtns: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    width: '100%',
  },
  dialogBtn: {
    alignItems: 'center',
    borderRadius: 10,
    flex: 1,
    paddingVertical: 13,
  },
  cancelBtn: {backgroundColor: '#94a3b8'},
  cancelBtnText: {color: '#ffffff', fontSize: 15, fontWeight: '700'},
  okBtnText: {color: '#ffffff', fontSize: 15, fontWeight: '700'},
});
