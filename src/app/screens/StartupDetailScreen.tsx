import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {authService} from '../../auth/services/auth.service';
import {Icon} from '../../shared/components/Icon';

type NamedEntity = {id?: number | string; name?: string};

type StartupDetail = {
  uuid: string;
  companyName: string;
  companyLogo: string | null;
  yearOfIncorporation?: string | number | null;
  website?: string | null;
  displayWebsite?: string | null;
  linkedinUrl?: string | null;
  twitterUrl?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  youtubeUrl?: string | null;
  isLiveDeal?: boolean;
  isRaisingFunds?: boolean;
  totalViews?: number;
  modifiedAt?: string | null;
  registeredCountryR?: NamedEntity | null;
  registeredStateR?: NamedEntity | null;
  registeredCityR?: NamedEntity | null;
  registeredCountry?: string | null;
  registeredState?: string | null;
  registeredCity?: string | null;
  startupBusinessModels?: NamedEntity[];
  mentorshipAreas?: NamedEntity[];
  startupIndustries?: NamedEntity[];
  startupTechnologies?: NamedEntity[];
  startupIndustryPrimary?: NamedEntity | null;
  productInformation?: {
    description?: string | null;
    productStage?: NamedEntity | null;
  } | null;
  financials?: {
    fundingStage?: NamedEntity | null;
    targetFundraise?: string | number | null;
    instrumentIds?: NamedEntity[];
  } | null;
  pitchDeck?: {
    elevatorPitch?: string | null;
    pitchDocument?: string | null;
    powerPitchUrl?: string | null;
  } | null;
  founders?: Array<{
    uuid?: string;
    name?: string;
    role?: string | null;
    linkedinUrl?: string | null;
  }>;
  advisoryBoards?: Array<{
    uuid?: string;
    name?: string;
    linkedinUrl?: string | null;
  }>;
  user?: Array<{
    uuid?: string;
    accountRole?: string | null;
    name?: string;
  }>;
};

type ConnectionState = {
  connected: boolean;
  requested?: boolean;
  status?: string | null;
  canConnect?: boolean;
  connectionUUID?: string | null;
  message?: string | null;
};

const extractUserUuids = (data: any): string[] => {
  const rawUser = data?.user;
  const userArray = Array.isArray(rawUser)
    ? rawUser
    : rawUser && typeof rawUser === 'object'
    ? [rawUser]
    : [];
  return userArray
    .map((u: any) => u?.uuid)
    .filter((value: any): value is string => typeof value === 'string' && value.length > 0);
};

type StartupDetailScreenProps = {
  token: string;
  uuid: string;
  primaryColor: string;
  logoBaseUrl?: string | null;
  onBack: () => void;
};

const resolveAssetUri = (
  assetPath: string | null | undefined,
  logoBaseUrl?: string | null,
) => {
  if (!assetPath) {
    return null;
  }
  if (/^https?:\/\//i.test(assetPath)) {
    return assetPath;
  }
  if (!logoBaseUrl) {
    return null;
  }
  return `${logoBaseUrl.replace(/\/$/, '')}/${assetPath.replace(/^\//, '')}`;
};

const getInitials = (name?: string) =>
  (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0]?.toUpperCase() || '')
    .join('') || 'S';

const formatLocation = (item: StartupDetail) => {
  const city =
    item.registeredCityR?.name || item.registeredCity || null;
  const state =
    item.registeredStateR?.name || item.registeredState || null;
  const country =
    item.registeredCountryR?.name || item.registeredCountry || null;
  return [city, state, country].filter(Boolean).join(', ') || null;
};

const formatLastUpdated = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

const openLink = (url?: string | null) => {
  if (!url) return;
  const target = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  Linking.openURL(target).catch(() => {
    Alert.alert('Could not open link', target);
  });
};

const formatRole = (role?: string | null) => {
  if (!role) return null;
  return role
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

export function StartupDetailScreen({
  token,
  uuid,
  primaryColor,
  logoBaseUrl,
  onBack,
}: StartupDetailScreenProps) {
  const [detail, setDetail] = useState<StartupDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [connectionsByUuid, setConnectionsByUuid] = useState<
    Record<string, ConnectionState>
  >({});
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [connectMessage, setConnectMessage] = useState('');
  const [isSendingConnect, setIsSendingConnect] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setErrorMessage(null);
    setConnectionsByUuid({});
    authService
      .getStartupPublicInformation(token, uuid)
      .then(response => {
        if (cancelled) return;
        const data = (response?.data || response) as StartupDetail;
        setDetail(data);

        const userUuids = extractUserUuids(data);
        if (!userUuids.length) return;

        Promise.allSettled(
          userUuids.map(userUuid =>
            authService
              .checkConnectionRequest(token, userUuid)
              .then(result => ({userUuid, result})),
          ),
        ).then(results => {
          if (cancelled) return;
          const next: Record<string, ConnectionState> = {};
          results.forEach((entry, index) => {
            if (entry.status !== 'fulfilled') {
              console.warn(
                '[StartupDetail] check failed for',
                userUuids[index],
                entry.reason instanceof Error
                  ? entry.reason.message
                  : String(entry.reason),
              );
              return;
            }
            const {userUuid, result} = entry.value;
            const payload = result?.data || result;
            if (payload) {
              next[userUuid] = {
                connected: Boolean(payload.connected),
                requested: Boolean(payload.requested),
                status: payload.status || null,
                canConnect: Boolean(payload.canConnect),
                connectionUUID: payload.connectionUUID || uuid || null,
                message:
                  typeof payload.message === 'string' ? payload.message : null,
              };
            }
          });
          setConnectionsByUuid(next);
        });
      })
      .catch(error => {
        if (cancelled) return;
        const message =
          error instanceof Error
            ? error.message
            : 'Could not load startup details.';
        console.warn('[StartupDetail] load failed:', message);
        setErrorMessage(message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, uuid]);

  const isAnyAccepted = Object.values(connectionsByUuid).some(
    c => c.connected,
  );
  const isAnyPending =
    !isAnyAccepted &&
    Object.values(connectionsByUuid).some(
      c =>
        c.requested ||
        (c.status || '').toLowerCase() === 'pending' ||
        (c.status || '').toLowerCase() === 'requested',
    );

  const handleOpenConnect = () => {
    if (!detail) return;
    const userUuids = extractUserUuids(detail);
    if (!userUuids[0]) {
      Alert.alert(
        'Cannot connect',
        'No user identifier found for this startup.',
      );
      return;
    }
    setConnectMessage('');
    setConnectModalOpen(true);
  };

  const handleSendConnect = async () => {
    if (!detail || isSendingConnect) return;
    const trimmed = connectMessage.trim();
    if (!trimmed) {
      Alert.alert('Message required', 'Please enter a message.');
      return;
    }
    const userUuids = extractUserUuids(detail);
    const targetUuid = userUuids[0];
    if (!targetUuid) return;
    setIsSendingConnect(true);
    try {
      const sendResp = await authService.sendConnectionRequest(
        token,
        targetUuid,
        trimmed,
      );
      const sendPayload = sendResp?.data || sendResp;
      const sendConnectionUUID =
        (sendPayload && typeof sendPayload === 'object'
          ? sendPayload.connectionUUID || sendPayload.uuid
          : null) || null;

      setConnectionsByUuid(prev => ({
        ...prev,
        [targetUuid]: {
          connected: false,
          requested: true,
          status: 'pending',
          canConnect: false,
          connectionUUID:
            sendConnectionUUID ||
            prev[targetUuid]?.connectionUUID ||
            uuid ||
            null,
        },
      }));
      setConnectModalOpen(false);
      setConnectMessage('');
      Alert.alert('Connection request sent', 'They will be notified.');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not send connection request.';
      Alert.alert('Request failed', message);
    } finally {
      setIsSendingConnect(false);
    }
  };

  const handleSave = async () => {
    if (isSaving || !detail) return;
    const userUuids = extractUserUuids(detail);
    const targetUuid = userUuids[0];
    if (!targetUuid) {
      Alert.alert('Cannot save', 'No user identifier found for this startup.');
      return;
    }
    setIsSaving(true);
    try {
      if (isSaved) {
        await authService.deleteWishlistEntry(token, targetUuid);
        setIsSaved(false);
      } else {
        await authService.createWishlistEntry(token, targetUuid);
        setIsSaved(true);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : isSaved
          ? 'Could not remove from saved.'
          : 'Could not save right now.';
      Alert.alert(isSaved ? 'Unsave failed' : 'Save failed', message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={primaryColor} />
        <Text style={styles.loadingText}>Loading startup...</Text>
      </View>
    );
  }

  if (errorMessage || !detail) {
    return (
      <View style={styles.page}>
        <View style={styles.toolbar}>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Icon name="chevron-left" size={24} color="#0f172a" />
          </Pressable>
          <Text style={styles.toolbarTitle}>Startup</Text>
        </View>
        <View style={styles.errorCard}>
          <Icon name="alert-circle-outline" size={42} color="#dc2626" />
          <Text style={styles.errorTitle}>Could not load startup</Text>
          <Text style={styles.errorBody}>
            {errorMessage || 'No data returned.'}
          </Text>
        </View>
      </View>
    );
  }

  const logoUri = resolveAssetUri(detail.companyLogo, logoBaseUrl);
  const location = formatLocation(detail);
  const elevatorPitch = detail.pitchDeck?.elevatorPitch?.trim();
  const lastUpdated = formatLastUpdated(detail.modifiedAt);
  const website = detail.displayWebsite || detail.website;
  const socials: Array<{label: string; icon: string; url?: string | null}> = [
    {label: 'LinkedIn', icon: 'linkedin', url: detail.linkedinUrl},
    {label: 'Twitter', icon: 'twitter', url: detail.twitterUrl},
    {label: 'Facebook', icon: 'facebook', url: detail.facebookUrl},
    {label: 'Instagram', icon: 'instagram', url: detail.instagramUrl},
    {label: 'YouTube', icon: 'youtube', url: detail.youtubeUrl},
  ];
  const availableSocials = socials.filter(s => Boolean(s.url));

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <View style={styles.toolbar}>
        <Pressable
          onPress={onBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back to startups">
          <Icon name="chevron-left" size={24} color="#0f172a" />
        </Pressable>
        <Text style={styles.toolbarTitle}>Startup</Text>
      </View>

      <View style={styles.headerCard}>
        <View style={styles.headerTopRow}>
          {logoUri ? (
            <Image source={{uri: logoUri}} style={styles.headerLogo} />
          ) : (
            <View
              style={[styles.headerLogoFallback, {backgroundColor: primaryColor}]}>
              <Text style={styles.headerLogoInitials}>
                {getInitials(detail.companyName)}
              </Text>
            </View>
          )}
          <View style={styles.headerCopy}>
            <Text style={styles.headerName}>{detail.companyName}</Text>
            <View style={styles.headerMetaRow}>
              {location ? (
                <View style={styles.metaPill}>
                  <Icon name="map-marker-outline" size={12} color="#475569" />
                  <Text style={styles.metaText}>{location}</Text>
                </View>
              ) : null}
              {detail.yearOfIncorporation ? (
                <View style={styles.metaPill}>
                  <Icon
                    name="calendar-outline"
                    size={12}
                    color="#475569"
                  />
                  <Text style={styles.metaText}>
                    Estd. {detail.yearOfIncorporation}
                  </Text>
                </View>
              ) : null}
            </View>
            {website ? (
              <Pressable onPress={() => openLink(website)}>
                <Text style={[styles.websiteText, {color: primaryColor}]}>
                  Visit website
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            style={[
              styles.outlineButton,
              {borderColor: primaryColor},
              isSaved && {backgroundColor: `${primaryColor}14`},
            ]}
            onPress={handleSave}
            disabled={isSaving}
            accessibilityRole="button"
            accessibilityLabel={isSaved ? 'Saved, tap to remove' : 'Save'}>
            {isSaving ? (
              <ActivityIndicator size="small" color={primaryColor} />
            ) : (
              <Icon
                name={isSaved ? 'bookmark' : 'bookmark-outline'}
                size={16}
                color={primaryColor}
              />
            )}
            <Text style={[styles.outlineButtonText, {color: primaryColor}]}>
              {isSaved ? 'Saved' : 'Save'}
            </Text>
          </Pressable>
          {isAnyAccepted ? (
            <>
              <Pressable
                style={[styles.primaryButton, {backgroundColor: primaryColor}]}
                onPress={() =>
                  Alert.alert('Message', 'Messaging flow coming soon.')
                }>
                <Text style={styles.primaryButtonText}>Message</Text>
              </Pressable>
              <Pressable
                style={[styles.outlineButton, {borderColor: primaryColor}]}
                onPress={() =>
                  Alert.alert('Schedule Call', 'Scheduling flow coming soon.')
                }>
                <Text style={[styles.outlineButtonText, {color: primaryColor}]}>
                  Schedule Call
                </Text>
                <Icon name="chevron-down" size={14} color={primaryColor} />
              </Pressable>
            </>
          ) : isAnyPending ? (
            <Pressable
              style={[styles.primaryButton, styles.pendingButton]}
              disabled
              accessibilityRole="button"
              accessibilityLabel="Connection request pending">
              <Text style={styles.pendingButtonText}>Pending Request</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.primaryButton, {backgroundColor: primaryColor}]}
              onPress={handleOpenConnect}>
              <Text style={styles.primaryButtonText}>Connect</Text>
            </Pressable>
          )}
        </View>

      </View>

      {elevatorPitch ? (
        <View style={styles.pitchQuoteCard}>
          <Icon name="format-quote-open" size={20} color={primaryColor} />
          <Text style={styles.pitchQuoteText}>{elevatorPitch}</Text>
        </View>
      ) : null}

      <SectionCard title="Business Details" primaryColor={primaryColor}>
        <TagGroup
          label="Business Models"
          values={(detail.startupBusinessModels || []).map(v => v.name || '')}
        />
        <TagGroup
          label="Looking mentorship for"
          values={(detail.mentorshipAreas || []).map(v => v.name || '')}
        />
        <TagGroup
          label="Industry Domain"
          values={(detail.startupIndustries || []).map(v => v.name || '')}
        />
        <TagGroup
          label="Technology Domain"
          values={(detail.startupTechnologies || []).map(v => v.name || '')}
        />
        {detail.startupIndustryPrimary?.name ? (
          <TagGroup
            label="Primary Industry"
            values={[detail.startupIndustryPrimary.name]}
          />
        ) : null}
      </SectionCard>

      {availableSocials.length ? (
        <SectionCard title="Social Links" primaryColor={primaryColor}>
          <View style={styles.socialRow}>
            {availableSocials.map(social => (
              <Pressable
                key={social.label}
                style={styles.socialButton}
                onPress={() => openLink(social.url)}
                accessibilityRole="link"
                accessibilityLabel={social.label}>
                <Icon name={social.icon} size={20} color={primaryColor} />
              </Pressable>
            ))}
          </View>
        </SectionCard>
      ) : null}

      <SectionCard title="Pitch Deck" primaryColor={primaryColor}>
        {isAnyAccepted ? (
          <View style={styles.lockedPitchCard}>
            <Icon name="file-document-outline" size={26} color={primaryColor} />
            <Text style={styles.lockedPitchText}>
              You're connected — pitch deck is available.
            </Text>
            {detail.pitchDeck?.pitchDocument ? (
              <Pressable
                style={[styles.primaryButton, {backgroundColor: primaryColor}]}
                onPress={() => openLink(detail.pitchDeck?.pitchDocument)}>
                <Text style={styles.primaryButtonText}>Open Pitch Deck</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={styles.lockedPitchCard}>
            <Icon name="lock-outline" size={26} color="#64748b" />
            <Text style={styles.lockedPitchText}>
              Accessible only to connections.
            </Text>
            {isAnyPending ? (
              <Pressable
                style={[styles.primaryButton, styles.pendingButton]}
                disabled>
                <Text style={styles.pendingButtonText}>Pending Request</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.primaryButton, {backgroundColor: primaryColor}]}
                onPress={handleOpenConnect}>
                <Text style={styles.primaryButtonText}>Connect</Text>
              </Pressable>
            )}
          </View>
        )}
      </SectionCard>

      {(() => {
        const rawUser: any = (detail as any).user;
        const userArray: Array<any> = Array.isArray(rawUser)
          ? rawUser
          : rawUser && typeof rawUser === 'object'
          ? [rawUser]
          : [];
        const hasTeam = userArray.length || (detail.founders?.length ?? 0);
        if (!hasTeam) return null;
        const members = userArray.length
          ? userArray.map((u, index) => ({
              uuid: u?.uuid,
              name: u?.name || 'Unknown',
              subtitle: formatRole(u?.accountRole),
              linkedinUrl: null as string | null,
              key: u?.uuid || `${u?.name || 'user'}-${index}`,
            }))
          : (detail.founders || []).map((f, index) => ({
              uuid: f.uuid,
              name: f.name || 'Unknown',
              subtitle: formatRole(f.role),
              linkedinUrl: f.linkedinUrl ?? null,
              key: f.uuid || `${f.name || 'founder'}-${index}`,
            }));
        return (
          <SectionCard title="Team" primaryColor={primaryColor}>
            <View style={styles.peopleGrid}>
              {members.map(member => {
                const connection = member.uuid
                  ? connectionsByUuid[member.uuid]
                  : undefined;
                const isAccepted = Boolean(connection?.connected);
                return (
                  <PersonRow
                    key={member.key}
                    name={member.name}
                    subtitle={member.subtitle}
                    primaryColor={primaryColor}
                    linkedinUrl={member.linkedinUrl}
                    isConnected={isAccepted}
                  />
                );
              })}
            </View>
          </SectionCard>
        );
      })()}

      {detail.advisoryBoards?.length ? (
        <SectionCard title="Advisory Board" primaryColor={primaryColor}>
          <View style={styles.peopleGrid}>
            {detail.advisoryBoards.map((member, index) => (
              <PersonRow
                key={member.uuid || `${member.name}-${index}`}
                name={member.name || 'Unknown'}
                subtitle={member.linkedinUrl ? 'LinkedIn' : null}
                primaryColor={primaryColor}
                linkedinUrl={member.linkedinUrl}
              />
            ))}
          </View>
        </SectionCard>
      ) : null}

      {detail.productInformation ? (
        <SectionCard title="Product Information" primaryColor={primaryColor}>
          {detail.productInformation.productStage?.name ? (
            <View style={styles.productRow}>
              <Text style={styles.productLabel}>Product Stage</Text>
              <Text style={styles.productValue}>
                {detail.productInformation.productStage.name}
              </Text>
            </View>
          ) : null}
          {detail.productInformation.description ? (
            <View style={styles.productRow}>
              <Text style={styles.productLabel}>Company Brief</Text>
              <Text style={styles.productBody}>
                {detail.productInformation.description}
              </Text>
            </View>
          ) : null}
          {detail.financials?.fundingStage?.name ? (
            <View style={styles.productRow}>
              <Text style={styles.productLabel}>Funding Stage</Text>
              <Text style={styles.productValue}>
                {detail.financials.fundingStage.name}
              </Text>
            </View>
          ) : null}
        </SectionCard>
      ) : null}


      {lastUpdated ? (
        <Text style={styles.lastUpdatedText}>Last updated: {lastUpdated}</Text>
      ) : null}

      <Modal
        visible={connectModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setConnectModalOpen(false)}>
        <Pressable
          style={styles.connectOverlay}
          onPress={() => setConnectModalOpen(false)}>
          <Pressable style={styles.connectCard} onPress={() => {}}>
            <View style={styles.connectHeaderRow}>
              <Text style={styles.connectTitle} numberOfLines={1}>
                Connect with{' '}
                {(() => {
                  const raw: any = (detail as any)?.user;
                  const first = Array.isArray(raw) ? raw[0] : raw;
                  return (
                    first?.name ||
                    detail?.founders?.[0]?.name ||
                    detail?.companyName ||
                    'this user'
                  );
                })()}
              </Text>
              <Pressable
                onPress={() => setConnectModalOpen(false)}
                style={styles.connectClose}
                accessibilityRole="button"
                accessibilityLabel="Close connect dialog">
                <Icon name="close" size={20} color="#0f172a" />
              </Pressable>
            </View>

            <TextInput
              value={connectMessage}
              onChangeText={text =>
                setConnectMessage(text.slice(0, 300))
              }
              placeholder="Enter message..."
              placeholderTextColor="#94a3b8"
              multiline
              style={styles.connectInput}
              maxLength={300}
            />
            <Text style={styles.connectCounter}>
              {connectMessage.length}/300 characters remaining
            </Text>

            <View style={styles.connectActions}>
              <Pressable
                style={[
                  styles.connectSendButton,
                  {backgroundColor: primaryColor},
                  (!connectMessage.trim() || isSendingConnect) && styles.connectSendDisabled,
                ]}
                onPress={handleSendConnect}
                disabled={!connectMessage.trim() || isSendingConnect}>
                {isSendingConnect ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.connectSendText}>SEND</Text>
                )}
              </Pressable>
              <Pressable
                style={styles.connectCancelButton}
                onPress={() => setConnectModalOpen(false)}
                disabled={isSendingConnect}>
                <Text style={styles.connectCancelText}>CANCEL</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

function SectionCard({
  title,
  primaryColor,
  children,
}: {
  title: string;
  primaryColor: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionDot, {backgroundColor: primaryColor}]} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function TagGroup({label, values}: {label: string; values: string[]}) {
  const cleaned = values.filter(v => v && v.trim());
  if (!cleaned.length) return null;
  return (
    <View style={styles.tagGroup}>
      <Text style={styles.tagGroupLabel}>{label}</Text>
      <View style={styles.tagWrap}>
        {cleaned.map(value => (
          <View key={value} style={styles.tagChip}>
            <Text style={styles.tagChipText}>{value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function PersonRow({
  name,
  subtitle,
  primaryColor,
  linkedinUrl,
  isConnected,
}: {
  name: string;
  subtitle?: string | null;
  primaryColor: string;
  linkedinUrl?: string | null;
  isConnected?: boolean;
}) {
  const initial = name.charAt(0).toUpperCase() || '?';
  return (
    <Pressable
      style={styles.personRow}
      disabled={!linkedinUrl}
      onPress={() => openLink(linkedinUrl)}>
      <View style={[styles.personAvatar, {backgroundColor: `${primaryColor}1A`}]}>
        <Text style={[styles.personInitial, {color: primaryColor}]}>
          {initial}
        </Text>
      </View>
      <View style={styles.personCopy}>
        <Text style={styles.personName} numberOfLines={1}>
          {name}
        </Text>
        {subtitle ? (
          <Text style={styles.personSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {isConnected ? (
        <View
          style={[styles.connectedBadge, {backgroundColor: primaryColor}]}>
          <Icon name="check-decagram" size={12} color="#ffffff" />
          <Text style={styles.connectedBadgeText}>Connected</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#eef3ff',
  },
  content: {
    paddingBottom: 32,
  },
  centered: {
    alignItems: 'center',
    backgroundColor: '#eef3ff',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#64748b',
    fontSize: 15,
    marginTop: 12,
  },
  toolbar: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  backButton: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  toolbarTitle: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '800',
  },
  headerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
  },
  headerTopRow: {
    flexDirection: 'row',
    gap: 14,
  },
  headerLogo: {
    borderRadius: 14,
    height: 64,
    width: 64,
  },
  headerLogoFallback: {
    alignItems: 'center',
    borderRadius: 14,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  headerLogoInitials: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
  },
  headerCopy: {
    flex: 1,
  },
  headerName: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  headerMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  metaPill: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metaText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '600',
  },
  websiteText: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
    textDecorationLine: 'underline',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  outlineButton: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  outlineButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 10,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  pendingButton: {
    backgroundColor: '#e2e8f0',
  },
  pendingButtonText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  cannotConnectText: {
    color: '#b45309',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
  },
  pitchQuoteCard: {
    alignItems: 'flex-start',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
  },
  pitchQuoteText: {
    color: '#334155',
    flex: 1,
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 21,
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 12,
  },
  sectionDot: {
    borderRadius: 999,
    height: 18,
    marginRight: 8,
    width: 3,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
  },
  sectionBody: {
    gap: 14,
  },
  tagGroup: {
    gap: 6,
  },
  tagGroupLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagChip: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagChipText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
  },
  socialRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  socialButton: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  lockedPitchCard: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 22,
  },
  lockedPitchText: {
    color: '#475569',
    fontSize: 13,
    textAlign: 'center',
  },
  peopleGrid: {
    gap: 8,
  },
  personRow: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 12,
    padding: 10,
  },
  personAvatar: {
    alignItems: 'center',
    borderRadius: 999,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  personInitial: {
    fontSize: 14,
    fontWeight: '800',
  },
  personCopy: {
    flex: 1,
  },
  personName: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
  },
  personSubtitle: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  connectedBadge: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  connectedBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  productRow: {
    gap: 4,
  },
  productLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  productValue: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
  productBody: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 20,
  },
  lastUpdatedText: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 18,
    textAlign: 'center',
  },
  connectOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  connectCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    width: '100%',
  },
  connectHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  connectTitle: {
    color: '#0f172a',
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    marginRight: 8,
  },
  connectClose: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  connectInput: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 12,
    borderWidth: 1,
    color: '#0f172a',
    fontSize: 14,
    minHeight: 120,
    padding: 12,
    textAlignVertical: 'top',
  },
  connectCounter: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 6,
    textAlign: 'right',
  },
  connectActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  connectSendButton: {
    alignItems: 'center',
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  connectSendDisabled: {
    opacity: 0.5,
  },
  connectSendText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  connectCancelButton: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  connectCancelText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  errorCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#fecaca',
    borderRadius: 18,
    borderWidth: 1,
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  errorTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 12,
  },
  errorBody: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    textAlign: 'center',
  },
});
