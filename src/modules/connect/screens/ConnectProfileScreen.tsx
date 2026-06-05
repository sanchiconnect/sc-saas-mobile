import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {Icon} from '../../../core/components/Icon';
import {colors, withAlpha} from '../../../core/theme/colors';
import {useToast} from '../../../core/toast/ToastProvider';
import {stripHtml} from '../../chat/utils';
import {connectService} from '../services/connect.service';
import {
  formatNumber,
  initials,
  joinList,
  resolveAccountType,
  resolveCity,
  resolveCountry,
  resolveHeadline,
  resolveLogo,
  resolveName,
} from '../utils';
import type {ConnectRoleKey, DirectoryUser} from '../types';

type Props = {
  token: string;
  role: ConnectRoleKey;
  user: DirectoryUser;
  primaryColor: string;
  logoBaseUrl?: string;
  isSaved: boolean;
  onToggleSave: () => void;
  onBack: () => void;
};

const DEFAULT_CONNECT_MESSAGE = "Hi, I'd love to connect.";

// Role-keyed detail field sets — same shape the connections detail sheet uses,
// reading from the (merged) profile payload.
const fieldsFor = (
  accountType: string,
  d: Record<string, any>,
): Array<{label: string; value: string}> => {
  const t = accountType.toLowerCase();
  if (t === 'startup') {
    return [
      {label: 'Funding Type', value: d.fundingType || 'N/A'},
      {label: 'Business Model', value: joinList(d.businessModel)},
      {label: 'Target fundraise (INR)', value: formatNumber(d.targetFundRaise)},
      {
        label: 'Tentative valuation (INR)',
        value: formatNumber(d.tentativeValuation),
      },
      {label: 'Revenue (INR)', value: formatNumber(d.revenue)},
      {label: 'Industries', value: joinList(d.startupIndustries || d.industries)},
    ];
  }
  if (t === 'investor') {
    return [
      {label: 'Organization Type', value: d.organizationType || 'N/A'},
      {label: 'Portfolio Size', value: formatNumber(d.portfolioSize)},
      {label: 'Min Ticket (INR)', value: formatNumber(d.ticketSizeMin)},
      {label: 'Max Ticket (INR)', value: formatNumber(d.ticketSizeMax)},
      {label: 'Investment Stages', value: joinList(d.investmentStages)},
      {label: 'Industries', value: joinList(d.sectoralInterests || d.industries)},
    ];
  }
  if (t === 'corporate') {
    return [
      {label: 'Company Size', value: d.companySize || 'N/A'},
      {label: 'Program Name', value: d.programName || 'N/A'},
      {label: 'Industries', value: joinList(d.industries)},
      {
        label: 'Startups Supported',
        value: formatNumber(d.totalStartupSupported),
      },
    ];
  }
  if (t === 'mentor') {
    return [
      {label: 'Designation', value: d.designation || 'N/A'},
      {label: 'Experience (yrs)', value: formatNumber(d.experience)},
      {label: 'Expertise', value: joinList(d.expertise || d.domains)},
      {label: 'Industries', value: joinList(d.industries)},
    ];
  }
  return [];
};

// Read-only public profile for a directory member, with Save + Connect actions.
export function ConnectProfileScreen({
  token,
  role,
  user,
  primaryColor,
  logoBaseUrl,
  isSaved,
  onToggleSave,
  onBack,
}: Props) {
  const toast = useToast();
  // Start from the search row so the header paints immediately, then merge the
  // fuller profile payload once it loads.
  const [profile, setProfile] = useState<Record<string, any>>(user.raw);
  const [isLoading, setIsLoading] = useState(true);
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectMessage, setConnectMessage] = useState(DEFAULT_CONNECT_MESSAGE);
  const [isSending, setIsSending] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    connectService
      .getPublicProfile(token, role, user.uuid)
      .then(full => {
        if (cancelled) return;
        // Merge: keep the search-row fields, layer the fuller profile on top.
        if (full && typeof full === 'object') {
          setProfile(prev => ({...prev, ...full}));
        }
      })
      .catch(() => {
        // Non-fatal — we already have the search row to render from.
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, role, user.uuid]);

  const name = resolveName(profile);
  const accountType = resolveAccountType(profile) || resolveAccountType(user.raw);
  const logo = resolveLogo(profile, logoBaseUrl);
  const headline = resolveHeadline(profile);
  const city = resolveCity(profile);
  const country = resolveCountry(profile);
  const location = [city, country].filter(Boolean).join(', ');
  const fields = useMemo(
    () => fieldsFor(accountType || '', profile),
    [accountType, profile],
  );
  const about = stripHtml(
    profile?.description || profile?.aboutUs || profile?.bio || '',
  );

  const handleSend = async () => {
    setIsSending(true);
    try {
      await connectService.sendConnectRequest(token, user, connectMessage);
      setRequestSent(true);
      setConnectOpen(false);
      toast.success(`Connection request sent to ${name}.`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not send request.',
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <View style={styles.page}>
      <View style={styles.topBar}>
        <Pressable
          style={({pressed}) => [
            styles.iconBtn,
            pressed && {opacity: 0.5, backgroundColor: colors.border},
          ]}
          hitSlop={10}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back">
          <Icon name="arrow-left" size={24} color="#475569" />
        </Pressable>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {name}
        </Text>
        <Pressable
          style={({pressed}) => [
            styles.iconBtn,
            pressed && {opacity: 0.5, backgroundColor: colors.border},
          ]}
          hitSlop={10}
          onPress={onToggleSave}
          accessibilityRole="button"
          accessibilityLabel={isSaved ? 'Unsave profile' : 'Save profile'}>
          <Icon
            name={isSaved ? 'bookmark' : 'bookmark-outline'}
            size={22}
            color={isSaved ? primaryColor : '#475569'}
          />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.avatarWrap}>
            {logo ? (
              <Image source={{uri: logo}} style={styles.avatar} />
            ) : (
              <View
                style={[
                  styles.avatarFallback,
                  {backgroundColor: withAlpha(primaryColor, 0.12)},
                ]}>
                <Text style={[styles.avatarInitials, {color: primaryColor}]}>
                  {initials(name) || '?'}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.name}>{name}</Text>
          {accountType ? (
            <View
              style={[
                styles.typeChip,
                {
                  backgroundColor: withAlpha(primaryColor, 0.1),
                  borderColor: withAlpha(primaryColor, 0.25),
                },
              ]}>
              <Text style={[styles.typeChipText, {color: primaryColor}]}>
                {accountType.replace(/_/g, ' ').toUpperCase()}
              </Text>
            </View>
          ) : null}
          {location ? (
            <View style={styles.locationRow}>
              <Icon name="map-marker-outline" size={14} color={colors.textMuted} />
              <Text style={styles.locationText}>{location}</Text>
            </View>
          ) : null}
          {headline ? <Text style={styles.headline}>{headline}</Text> : null}
        </View>

        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={primaryColor} />
          </View>
        ) : null}

        {about ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>About</Text>
            <View style={styles.aboutBox}>
              <Text style={styles.aboutText}>{about}</Text>
            </View>
          </View>
        ) : null}

        {fields.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Details</Text>
            <View style={styles.grid}>
              {fields.map(f => (
                <View key={f.label} style={styles.gridItem}>
                  <Text style={styles.fieldLabel}>{f.label}</Text>
                  <Text style={styles.fieldValue} numberOfLines={3}>
                    {f.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          disabled={requestSent}
          onPress={() => {
            setConnectMessage(DEFAULT_CONNECT_MESSAGE);
            setConnectOpen(true);
          }}
          style={[
            styles.connectBtn,
            {backgroundColor: requestSent ? colors.borderStrong : primaryColor},
          ]}>
          <Icon
            name={requestSent ? 'check' : 'account-plus-outline'}
            size={18}
            color="#ffffff"
          />
          <Text style={styles.connectBtnText}>
            {requestSent ? 'Request Sent' : 'Connect'}
          </Text>
        </Pressable>
      </View>

      {/* Connect-request modal — intro message + send. */}
      <Modal
        transparent
        visible={connectOpen}
        animationType="fade"
        onRequestClose={() => (isSending ? undefined : setConnectOpen(false))}>
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => (isSending ? undefined : setConnectOpen(false))}
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Connect with {name}</Text>
            <Text style={styles.modalSubtitle}>
              Add a short note to introduce yourself.
            </Text>
            <TextInput
              style={styles.modalInput}
              value={connectMessage}
              onChangeText={setConnectMessage}
              placeholder="Write a message…"
              placeholderTextColor={colors.placeholder}
              multiline
              maxLength={500}
              editable={!isSending}
            />
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                disabled={isSending}
                onPress={() => setConnectOpen(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalSendBtn,
                  {backgroundColor: primaryColor},
                  isSending && {opacity: 0.7},
                ]}
                disabled={isSending}
                onPress={handleSend}>
                {isSending ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.modalSendText}>Send Request</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#eef3ff',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginHorizontal: 4,
  },
  content: {
    paddingBottom: 30,
  },
  hero: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  avatarWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: 'hidden',
    marginBottom: 12,
  },
  avatar: {
    width: 96,
    height: 96,
    resizeMode: 'cover',
  },
  avatarFallback: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 36,
    fontWeight: '800',
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  typeChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
  },
  typeChipText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  locationText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  headline: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 10,
  },
  loadingRow: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  section: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  aboutBox: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
  },
  aboutText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 21,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridItem: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
  },
  fieldLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  fieldValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  footer: {
    padding: 14,
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 15,
  },
  connectBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.scrim,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 6,
    marginBottom: 14,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: colors.text,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  modalCancelBtn: {
    paddingVertical: 13,
    paddingHorizontal: 18,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textMuted,
  },
  modalSendBtn: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 13,
  },
  modalSendText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
