import React, {useState} from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Video from 'react-native-video';

import {Icon} from '../../../../core/components/Icon';
import {colors, withAlpha} from '../../../../core/theme/colors';
import {useToast} from '../../../../core/toast/ToastProvider';
import {PdfPagesCarousel, getPitchImages} from '../../../profile/components/PdfPagesCarousel';
import {connectService} from '../../services/connect.service';
import {initials, resolveLogo, resolveName, resolveCity, resolveCountry} from '../../utils';
import type {ConnectionState, DirectoryUser} from '../../types';

// ─── prop type shared by every role detail screen ─────────────────────────────

export type DetailScreenProps = {
  token: string;
  user: DirectoryUser;
  primaryColor: string;
  logoBaseUrl?: string;
  onBack: () => void;
  isApproved?: boolean;
  currentUserId?: string;
};

// ─── helpers ──────────────────────────────────────────────────────────────────

export const toNamedList = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return (value as any[])
      .map(item => (typeof item === 'string' ? item : item?.name || ''))
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map(p => p.trim())
      .filter(Boolean);
  }
  return [(value as any)?.name || ''].filter(Boolean);
};

export const humanizeSnake = (value?: string | null): string => {
  if (!value) return '';
  return value.replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
};

export const formatCurrencyINR = (raw?: string | null): string | null => {
  if (!raw) return null;
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return raw;
  return `INR ${numeric.toLocaleString('en-IN')}`;
};

export const openLink = (url?: string | null) => {
  if (!url) return;
  Linking.openURL(url).catch(() => undefined);
};

export const isDirectVideoUrl = (url?: string | null): boolean => {
  if (!url) return false;
  return /\.(mp4|m4v|mov|webm|mkv)(\?|#|$)/i.test(url);
};

export const resolveSocialLinks = (
  profile: Record<string, any>,
): Array<{key: string; url: string; icon: string; label: string}> => {
  const out: Array<{key: string; url: string; icon: string; label: string}> = [];
  if (profile?.twitterUrl) out.push({key: 'twitter', url: profile.twitterUrl, icon: 'twitter', label: 'Twitter'});
  if (profile?.linkedinUrl) out.push({key: 'linkedin', url: profile.linkedinUrl, icon: 'linkedin', label: 'LinkedIn'});
  if (profile?.facebookUrl) out.push({key: 'facebook', url: profile.facebookUrl, icon: 'facebook', label: 'Facebook'});
  if (profile?.instagramUrl) out.push({key: 'instagram', url: profile.instagramUrl, icon: 'instagram', label: 'Instagram'});
  if (profile?.youtubeUrl) out.push({key: 'youtube', url: profile.youtubeUrl, icon: 'youtube', label: 'YouTube'});
  return out;
};

// ─── primitive section components ─────────────────────────────────────────────

export function SectionCard({
  title,
  primaryColor,
  children,
}: {
  title: string;
  primaryColor: string;
  children: React.ReactNode;
}) {
  return (
    <View style={sStyles.card}>
      <View style={sStyles.heading}>
        <View style={[sStyles.dot, {backgroundColor: primaryColor}]} />
        <Text style={sStyles.title}>{title}</Text>
      </View>
      <View style={sStyles.body}>{children}</View>
    </View>
  );
}

export function ChipList({items}: {items: string[]}) {
  const filtered = items.filter(Boolean);
  if (!filtered.length) return <Text style={sStyles.empty}>-</Text>;
  return (
    <View style={sStyles.chipsRow}>
      {filtered.map(item => (
        <View key={item} style={sStyles.chip}>
          <Text style={sStyles.chipText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export function LabelRow({label, value}: {label: string; value: string}) {
  return (
    <View style={sStyles.labelRow}>
      <Text style={sStyles.labelText}>{label}</Text>
      <Text style={sStyles.valueText}>{value || '-'}</Text>
    </View>
  );
}

export function Divider() {
  return <View style={sStyles.divider} />;
}

export function PersonCard({
  name,
  sub,
  linkedinUrl,
  primaryColor,
}: {
  name: string;
  sub?: string | null;
  linkedinUrl?: string | null;
  primaryColor: string;
}) {
  const abbr = initials(name) || '?';
  return (
    <View style={sStyles.personCard}>
      <View style={[sStyles.personAvatar, {backgroundColor: withAlpha(primaryColor, 0.12)}]}>
        <Text style={[sStyles.personInitials, {color: primaryColor}]}>{abbr}</Text>
      </View>
      <View style={sStyles.personInfo}>
        <Text style={sStyles.personName}>
          {name}
          {sub ? ` (${sub})` : ''}
        </Text>
        {linkedinUrl ? (
          <Pressable onPress={() => openLink(linkedinUrl)}>
            <Text style={[sStyles.personLink, {color: primaryColor}]}>LinkedIn</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function InlineVideoPlayer({
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
        style={[sStyles.videoFallback, {borderColor: primaryColor}]}>
        <Icon name="alert-circle-outline" size={28} color={primaryColor} />
        <Text style={[sStyles.videoFallbackText, {color: primaryColor}]}>
          Tap to open the video externally
        </Text>
      </Pressable>
    );
  }
  return (
    <View style={sStyles.videoWrap}>
      <Video
        source={{uri: url}}
        style={sStyles.video}
        controls
        resizeMode="contain"
        paused
        onError={() => setHasError(true)}
      />
    </View>
  );
}

// ─── PitchSection (Investor + Startup) ────────────────────────────────────────

export function PitchSection({
  profile,
  primaryColor,
  connState,
  cdnBases,
}: {
  profile: Record<string, any>;
  primaryColor: string;
  connState: ConnectionState;
  cdnBases: (string | undefined | null)[];
}) {
  const pitchImages = getPitchImages(profile?.pitchDeck, cdnBases);
  const videoUrl =
    profile?.pitchDeck?.uploadPitchUrl ||
    profile?.pitchDeck?.powerPitchUrl ||
    profile?.pitchDeck?.embedUrl ||
    '';

  return (
    <>
      {profile?.pitchDeck?.pitchDocument || pitchImages.length > 0 ? (
        <SectionCard title="Pitch Deck" primaryColor={primaryColor}>
          {connState === 'connected' ? (
            <>
              {profile?.pitchDeck?.pitchDocument ? (
                <View style={pStyles.fullScreenRow}>
                  <Pressable
                    onPress={() => openLink(profile.pitchDeck?.pitchDocument)}
                    style={[pStyles.pill, {borderColor: primaryColor}]}>
                    <Icon name="fullscreen" size={14} color={primaryColor} />
                    <Text style={[pStyles.pillText, {color: primaryColor}]}>Full Screen</Text>
                  </Pressable>
                </View>
              ) : null}
              {pitchImages.length > 0 ? (
                <PdfPagesCarousel
                  images={pitchImages}
                  primaryColor={primaryColor}
                  height={480}
                />
              ) : profile?.pitchDeck?.pitchDocument ? (
                <Pressable
                  onPress={() => openLink(profile.pitchDeck?.pitchDocument)}
                  style={[pStyles.linkBtn, {borderColor: primaryColor}]}>
                  <Icon name="file-document-outline" size={18} color={primaryColor} />
                  <Text style={[pStyles.linkBtnText, {color: primaryColor}]}>
                    {profile.pitchDeck?.fileName || 'Open pitch deck'}
                  </Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <View style={pStyles.locked}>
              <Icon name="lock-outline" size={32} color="#94a3b8" />
              <Text style={pStyles.lockedText}>Accessible only to connections</Text>
            </View>
          )}
        </SectionCard>
      ) : null}

      {videoUrl ? (
        <SectionCard title="Video Pitch" primaryColor={primaryColor}>
          {isDirectVideoUrl(videoUrl) ? (
            <InlineVideoPlayer url={videoUrl} primaryColor={primaryColor} />
          ) : (
            <Pressable
              onPress={() => openLink(videoUrl)}
              style={[pStyles.videoBtn, {borderColor: primaryColor}]}>
              <Icon name="play-circle" size={48} color={primaryColor} />
              <Text style={[pStyles.videoBtnText, {color: primaryColor}]}>
                Tap to play video pitch
              </Text>
            </Pressable>
          )}
        </SectionCard>
      ) : null}
    </>
  );
}

// ─── ProfileHero ──────────────────────────────────────────────────────────────

export function ProfileHero({
  profile,
  primaryColor,
  logoBaseUrl,
  children,
}: {
  profile: Record<string, any>;
  primaryColor: string;
  logoBaseUrl?: string;
  children?: React.ReactNode;
}) {
  const name = resolveName(profile);
  const logo = resolveLogo(profile, logoBaseUrl);
  const city = resolveCity(profile);
  const country = resolveCountry(profile);
  const location = [
    profile?.registeredCityR?.name || city,
    profile?.registeredStateR?.name || profile?.registeredState,
    profile?.registeredCountryR?.name || country,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <View style={hStyles.card}>
      <View style={hStyles.row}>
        {logo ? (
          <Image source={{uri: logo}} style={hStyles.logo} />
        ) : (
          <View style={[hStyles.logoFallback, {backgroundColor: withAlpha(primaryColor, 0.15)}]}>
            <Text style={[hStyles.logoInitials, {color: primaryColor}]}>
              {initials(name) || '?'}
            </Text>
          </View>
        )}
        <View style={hStyles.copy}>
          <Text style={hStyles.name}>{name}</Text>
          {location ? (
            <View style={hStyles.metaRow}>
              <Icon name="map-marker-outline" size={13} color="#475569" />
              <Text style={hStyles.metaText}>{location}</Text>
            </View>
          ) : null}
          {profile?.displayWebsite ? (
            <Pressable onPress={() => openLink(profile.displayWebsite)} style={hStyles.metaRow}>
              <Icon name="link-variant" size={13} color={primaryColor} />
              <Text style={[hStyles.websiteText, {color: primaryColor}]} numberOfLines={1}>
                Visit website
              </Text>
            </Pressable>
          ) : null}
          {children}
        </View>
      </View>
    </View>
  );
}

// ─── ProfileShell ─────────────────────────────────────────────────────────────

const DEFAULT_MSG = "Hi, I'd love to connect.";

export function ProfileShell({
  name,
  token,
  user,
  resolvedUuid,
  currentUserId,
  connState,
  setConnState,
  primaryColor,
  isApproved,
  onBack,
  onEditProfile,
  children,
}: {
  name: string;
  token: string;
  user: DirectoryUser;
  resolvedUuid: string;
  currentUserId?: string;
  connState: ConnectionState;
  setConnState: (s: ConnectionState) => void;
  primaryColor: string;
  isApproved?: boolean;
  onBack: () => void;
  onEditProfile?: () => void;
  children: React.ReactNode;
}) {
  const isOwnProfile = !!currentUserId && currentUserId === resolvedUuid;
  const toast = useToast();
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectMessage, setConnectMessage] = useState(DEFAULT_MSG);
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    setIsSending(true);
    try {
      await connectService.sendConnectRequest(
        token,
        {...user, uuid: resolvedUuid},
        connectMessage,
      );
      setConnState('pending');
      setConnectOpen(false);
      toast.success(`Connection request sent to ${name}.`);
      connectService
        .checkConnectionState(token, resolvedUuid)
        .then(setConnState)
        .catch(() => undefined);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send request.');
    } finally {
      setIsSending(false);
    }
  };

  const connectDisabled = connState !== 'none';
  const connectLabel =
    connState === 'connected'
      ? 'Connected'
      : connState === 'pending'
        ? 'Request Sent'
        : 'CONNECT';
  const connectIcon =
    connState === 'connected'
      ? 'account-check'
      : connState === 'pending'
        ? 'check'
        : 'account-plus-outline';

  return (
    <View style={shStyles.page}>
      {/* Top bar */}
      <View style={shStyles.topBar}>
        <Pressable
          style={({pressed}) => [shStyles.iconBtn, pressed && {opacity: 0.5, backgroundColor: colors.border}]}
          hitSlop={10}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back">
          <Icon name="arrow-left" size={24} color="#475569" />
        </Pressable>
        <Text style={shStyles.topBarTitle} numberOfLines={1}>
          {name}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={shStyles.scroll}
        showsVerticalScrollIndicator={false}>
        {children}
        <View style={{height: 8}} />
      </ScrollView>

      {/* Footer: connect button or status */}
      <View style={shStyles.footer}>
        {isApproved === false ? (
          <View style={shStyles.approvalNotice}>
            <Text style={shStyles.approvalNoticeText}>
              Prior to initiating connections, your profile must be approved by the admin.
            </Text>
          </View>
        ) : connState === 'connected' ? (
          <View style={[shStyles.connectedBadge, {backgroundColor: withAlpha(primaryColor, 0.12)}]}>
            <Icon name="account-check" size={18} color={primaryColor} />
            <Text style={[shStyles.connectedBadgeText, {color: primaryColor}]}>Connected</Text>
          </View>
        ) : (
          <Pressable
            disabled={connectDisabled}
            onPress={() => {
              setConnectMessage(DEFAULT_MSG);
              setConnectOpen(true);
            }}
            style={[
              shStyles.connectBtn,
              {backgroundColor: connectDisabled ? colors.borderStrong : primaryColor},
            ]}>
            <Icon name={connectIcon} size={18} color="#ffffff" />
            <Text style={shStyles.connectBtnText}>{connectLabel}</Text>
          </Pressable>
        )}
      </View>

      {/* Connect request modal */}
      <Modal
        transparent
        visible={connectOpen}
        animationType="fade"
        onRequestClose={() => (isSending ? undefined : setConnectOpen(false))}>
        <KeyboardAvoidingView
          style={shStyles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable
            style={shStyles.modalBackdrop}
            onPress={() => (isSending ? undefined : setConnectOpen(false))}
          />
          <View style={shStyles.modalCard}>
            <Text style={shStyles.modalTitle}>Connect with {name}</Text>
            <Text style={shStyles.modalSubtitle}>
              Add a short note to introduce yourself.
            </Text>
            <TextInput
              style={shStyles.modalInput}
              value={connectMessage}
              onChangeText={setConnectMessage}
              placeholder="Write a message…"
              placeholderTextColor={colors.placeholder}
              multiline
              maxLength={500}
              editable={!isSending}
            />
            <View style={shStyles.modalActions}>
              <Pressable
                style={shStyles.modalCancelBtn}
                disabled={isSending}
                onPress={() => setConnectOpen(false)}>
                <Text style={shStyles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  shStyles.modalSendBtn,
                  {backgroundColor: primaryColor},
                  isSending && {opacity: 0.7},
                ]}
                disabled={isSending}
                onPress={handleSend}>
                {isSending ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={shStyles.modalSendText}>Send Request</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

export const sStyles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  heading: {alignItems: 'center', flexDirection: 'row', marginBottom: 12},
  dot: {borderRadius: 999, height: 16, marginRight: 10, width: 4},
  title: {color: '#0f172a', fontSize: 16, fontWeight: '800'},
  body: {gap: 10},
  labelRow: {gap: 6},
  labelText: {color: '#64748b', fontSize: 12, fontWeight: '700'},
  valueText: {color: '#0f172a', fontSize: 14, fontWeight: '600', lineHeight: 20},
  empty: {color: '#94a3b8', fontSize: 14, fontWeight: '700'},
  chipsRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  chip: {backgroundColor: '#eff6ff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6},
  chipText: {color: '#1e3a8a', fontSize: 12, fontWeight: '700'},
  divider: {borderTopColor: '#e2e8f0', borderTopWidth: 1, borderStyle: 'dashed', marginVertical: 4},
  socialRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 12},
  peopleGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 12},
  personCard: {alignItems: 'center', flexDirection: 'row', gap: 10, minWidth: '46%', flex: 1},
  personAvatar: {alignItems: 'center', borderRadius: 999, height: 36, justifyContent: 'center', width: 36},
  personInitials: {fontSize: 13, fontWeight: '800'},
  personInfo: {flex: 1},
  personName: {color: '#0f172a', fontSize: 13, fontWeight: '700'},
  personLink: {fontSize: 12, fontWeight: '700', marginTop: 2},
  videoWrap: {aspectRatio: 16 / 9, backgroundColor: '#000', borderRadius: 10, overflow: 'hidden', width: '100%'},
  video: {height: '100%', width: '100%'},
  videoFallback: {alignItems: 'center', borderRadius: 10, borderWidth: 1, gap: 8, justifyContent: 'center', paddingVertical: 24, width: '100%'},
  videoFallbackText: {fontSize: 13, fontWeight: '700'},
  lastUpdated: {color: '#94a3b8', fontSize: 12, marginHorizontal: 16, marginTop: 16, textAlign: 'center'},
});

const hStyles = StyleSheet.create({
  card: {backgroundColor: '#e0e7ff', borderRadius: 18, margin: 16, marginBottom: 0, padding: 16},
  row: {flexDirection: 'row', gap: 14, alignItems: 'center'},
  logo: {width: 64, height: 64, borderRadius: 12, backgroundColor: '#ffffff'},
  logoFallback: {width: 64, height: 64, borderRadius: 12, alignItems: 'center', justifyContent: 'center'},
  logoInitials: {fontSize: 22, fontWeight: '800'},
  copy: {flex: 1},
  name: {color: '#0f172a', fontSize: 18, fontWeight: '800'},
  metaRow: {flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4},
  metaText: {color: '#475569', fontSize: 12, fontWeight: '600'},
  websiteText: {fontSize: 12, fontWeight: '600'},
});

const shStyles = StyleSheet.create({
  page: {flex: 1, backgroundColor: '#eef3ff'},
  topBar: {
    alignItems: 'center', backgroundColor: colors.surface,
    borderBottomColor: colors.border, borderBottomWidth: 1,
    flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 10,
  },
  iconBtn: {alignItems: 'center', borderRadius: 10, height: 40, justifyContent: 'center', width: 40},
  topBarTitle: {color: colors.text, flex: 1, fontSize: 18, fontWeight: '700'},
  scroll: {paddingBottom: 16},
  footer: {
    backgroundColor: colors.surface, borderTopColor: colors.border,
    borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 12,
  },
  approvalNotice: {backgroundColor: '#fff7ed', borderRadius: 12, padding: 14},
  approvalNoticeText: {color: '#9a3412', fontSize: 13, fontWeight: '600', lineHeight: 18, textAlign: 'center'},
  connectedBadge: {alignItems: 'center', borderRadius: 14, flexDirection: 'row', gap: 8, justifyContent: 'center', paddingVertical: 14},
  connectedBadgeText: {fontSize: 15, fontWeight: '700'},
  connectBtn: {alignItems: 'center', borderRadius: 14, flexDirection: 'row', gap: 8, justifyContent: 'center', paddingVertical: 14},
  connectBtnText: {color: '#ffffff', fontSize: 15, fontWeight: '800', letterSpacing: 0.3},
  modalOverlay: {flex: 1, justifyContent: 'flex-end'},
  modalBackdrop: {...StyleSheet.absoluteFill, backgroundColor: colors.scrim},
  modalCard: {
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    gap: 12, paddingBottom: 32, paddingHorizontal: 24, paddingTop: 20,
  },
  modalTitle: {color: colors.text, fontSize: 18, fontWeight: '800'},
  modalSubtitle: {color: colors.textMuted, fontSize: 14},
  modalInput: {
    backgroundColor: colors.background, borderColor: colors.border, borderRadius: 12,
    borderWidth: 1, color: colors.text, fontSize: 14, minHeight: 96,
    padding: 12, textAlignVertical: 'top',
  },
  modalActions: {flexDirection: 'row', gap: 12, justifyContent: 'flex-end'},
  modalCancelBtn: {borderColor: colors.border, borderRadius: 10, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 10},
  modalCancelText: {color: colors.textMuted, fontSize: 14, fontWeight: '700'},
  modalSendBtn: {borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10},
  modalSendText: {color: '#ffffff', fontSize: 14, fontWeight: '700'},
});

const pStyles = StyleSheet.create({
  fullScreenRow: {flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8},
  pill: {alignItems: 'center', borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingVertical: 6},
  pillText: {fontSize: 13, fontWeight: '700'},
  linkBtn: {alignItems: 'center', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 8, padding: 12},
  linkBtnText: {flex: 1, fontSize: 14, fontWeight: '600'},
  locked: {alignItems: 'center', gap: 8, paddingVertical: 24},
  lockedText: {color: '#94a3b8', fontSize: 14, fontWeight: '600', textAlign: 'center'},
  videoBtn: {alignItems: 'center', borderRadius: 12, borderWidth: 1, gap: 8, paddingVertical: 32},
  videoBtnText: {fontSize: 14, fontWeight: '700'},
});
