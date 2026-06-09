import React, {useContext, useEffect, useState} from 'react';
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

import {Icon} from '../../../core/components/Icon';
import {colors, withAlpha} from '../../../core/theme/colors';
import {TenantContext} from '../../../core/tenant/TenantProvider';
import {useToast} from '../../../core/toast/ToastProvider';
import {stripHtml} from '../../chat/utils';
import {
  PdfPagesCarousel,
  getPitchImages,
} from '../../profile/components/PdfPagesCarousel';
import {connectService} from '../services/connect.service';
import {
  initials,
  resolveAccountType,
  resolveCity,
  resolveCountry,
  resolveLogo,
  resolveName,
} from '../utils';
import type {ConnectionState, ConnectRoleKey, DirectoryUser} from '../types';

type Props = {
  token: string;
  role: ConnectRoleKey;
  user: DirectoryUser;
  primaryColor: string;
  logoBaseUrl?: string;
  onBack: () => void;
  isApproved?: boolean;
};

const DEFAULT_CONNECT_MESSAGE = "Hi, I'd love to connect.";

// ─── small helpers ────────────────────────────────────────────────────────────

const toNamedList = (value: unknown): string[] => {
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

const humanizeSnake = (value?: string | null): string => {
  if (!value) return '';
  return value.replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
};

const formatCurrencyINR = (raw?: string | null): string | null => {
  if (!raw) return null;
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return raw;
  return `INR ${numeric.toLocaleString('en-IN')}`;
};

const openLink = (url?: string | null) => {
  if (!url) return;
  Linking.openURL(url).catch(() => undefined);
};

const isDirectVideoUrl = (url?: string | null): boolean => {
  if (!url) return false;
  return /\.(mp4|m4v|mov|webm|mkv)(\?|#|$)/i.test(url);
};

// ─── sub-components ───────────────────────────────────────────────────────────

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
    <View style={sectionStyles.card}>
      <View style={sectionStyles.heading}>
        <View
          style={[sectionStyles.dot, {backgroundColor: primaryColor}]}
        />
        <Text style={sectionStyles.title}>{title}</Text>
      </View>
      <View style={sectionStyles.body}>{children}</View>
    </View>
  );
}

function ChipList({items}: {items: string[]}) {
  const filtered = items.filter(Boolean);
  if (!filtered.length) return <Text style={sectionStyles.empty}>-</Text>;
  return (
    <View style={sectionStyles.chipsRow}>
      {filtered.map(item => (
        <View key={item} style={sectionStyles.chip}>
          <Text style={sectionStyles.chipText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function LabelRow({label, value}: {label: string; value: string}) {
  return (
    <View style={sectionStyles.labelRow}>
      <Text style={sectionStyles.labelText}>{label}</Text>
      <Text style={sectionStyles.valueText}>{value || '-'}</Text>
    </View>
  );
}

function PersonCard({
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
    <View style={sectionStyles.personCard}>
      <View
        style={[
          sectionStyles.personAvatar,
          {backgroundColor: withAlpha(primaryColor, 0.12)},
        ]}>
        <Text style={[sectionStyles.personInitials, {color: primaryColor}]}>
          {abbr}
        </Text>
      </View>
      <View style={sectionStyles.personInfo}>
        <Text style={sectionStyles.personName}>
          {name}
          {sub ? ` (${sub})` : ''}
        </Text>
        {linkedinUrl ? (
          <Pressable onPress={() => openLink(linkedinUrl)}>
            <Text style={[sectionStyles.personLink, {color: primaryColor}]}>
              LinkedIn
            </Text>
          </Pressable>
        ) : null}
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
        style={[sectionStyles.videoFallback, {borderColor: primaryColor}]}>
        <Icon name="alert-circle-outline" size={28} color={primaryColor} />
        <Text style={[sectionStyles.videoFallbackText, {color: primaryColor}]}>
          Tap to open the video externally
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={sectionStyles.videoWrap}>
      <Video
        source={{uri: url}}
        style={sectionStyles.video}
        controls
        resizeMode="contain"
        paused
        onError={() => setHasError(true)}
      />
    </View>
  );
}

// ─── main screen ─────────────────────────────────────────────────────────────

export function ConnectProfileScreen({
  token,
  role,
  user,
  primaryColor,
  logoBaseUrl,
  onBack,
  isApproved,
}: Props) {
  const toast = useToast();
  const {baseUrl: tenantBaseUrl, globalSetting} = useContext(TenantContext);

  const [profile, setProfile] = useState<Record<string, any>>(user.raw);
  const [isLoading, setIsLoading] = useState(true);
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectMessage, setConnectMessage] = useState(DEFAULT_CONNECT_MESSAGE);
  const [isSending, setIsSending] = useState(false);
  const [connState, setConnState] = useState<ConnectionState>('none');
  // Best-known user UUID for connection APIs — refined after full profile loads
  // because search results sometimes only carry the profile/account UUID in
  // `uuid`, while the actual user UUID lives in `profile.user[0].uuid`.
  const [resolvedUuid, setResolvedUuid] = useState(user.uuid);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      let uuid = user.uuid;
      try {
        const full = await connectService.getPublicProfile(
          token,
          role,
          user.profileUuid,
        );
        if (cancelled) return;
        if (full && typeof full === 'object') {
          setProfile(prev => ({...prev, ...full}));
          const fromProfile =
            full?.user?.[0]?.uuid ||
            full?.user?.[0]?.userUUID ||
            full?.userUUID ||
            full?.userUuid;
          if (fromProfile) {
            uuid = fromProfile;
            setResolvedUuid(fromProfile);
          }
        }
      } catch {
        // non-fatal — screen still renders from search row data
      } finally {
        if (!cancelled) setIsLoading(false);
      }

      connectService.incrementViews(token, role, user.profileUuid);

      if (uuid) {
        connectService
          .checkConnectionState(token, uuid)
          .then(state => {
            if (!cancelled) setConnState(state);
          })
          .catch(() => {});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, role, user.profileUuid, user.uuid]);

  // ── derived display values ─────────────────────────────────────────────────

  const name = resolveName(profile);
  const accountType = (
    resolveAccountType(profile) || resolveAccountType(user.raw)
  ).toLowerCase();
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

  const about = stripHtml(
    profile?.longDescription ||
      profile?.briefDescription ||
      profile?.aboutUs ||
      profile?.shortDescription ||
      profile?.description ||
      '',
  );

  const isPersonProfile =
    accountType === 'mentor' ||
    accountType === 'individual' ||
    accountType === 'service_provider';
  const isStartup = accountType === 'startup';
  const isInvestor = accountType === 'investor';
  const isCorporate = accountType === 'corporate';
  const isPartner = accountType === 'partner';

  const heroTagline = isPartner
    ? profile?.tagline || profile?.shortDescription || ''
    : profile?.pitchDeck?.elevatorPitch || profile?.elevatorPitch || '';

  const socialLinks: Array<{key: string; url: string; icon: string; label: string}> =
    [];
  if (profile?.twitterUrl)
    socialLinks.push({key: 'twitter', url: profile.twitterUrl, icon: 'twitter', label: 'Twitter'});
  if (profile?.linkedinUrl)
    socialLinks.push({key: 'linkedin', url: profile.linkedinUrl, icon: 'linkedin', label: 'LinkedIn'});
  if (profile?.facebookUrl)
    socialLinks.push({key: 'facebook', url: profile.facebookUrl, icon: 'facebook', label: 'Facebook'});
  if (profile?.instagramUrl)
    socialLinks.push({key: 'instagram', url: profile.instagramUrl, icon: 'instagram', label: 'Instagram'});
  if (profile?.youtubeUrl)
    socialLinks.push({key: 'youtube', url: profile.youtubeUrl, icon: 'youtube', label: 'YouTube'});

  const cdnBases = [
    globalSetting?.imgKitUrl,
    globalSetting?.assetsImgKitUrl,
    globalSetting?.s3Url,
    tenantBaseUrl,
  ];
  const pitchImages = getPitchImages(profile?.pitchDeck, cdnBases);

  const videoUrl =
    profile?.pitchDeck?.uploadPitchUrl ||
    profile?.pitchDeck?.powerPitchUrl ||
    profile?.pitchDeck?.embedUrl ||
    '';

  const founders: any[] = Array.isArray(profile?.founders) ? profile.founders : [];
  const advisoryBoards: any[] = Array.isArray(profile?.advisoryBoards)
    ? profile.advisoryBoards
    : [];

  const startupBusinessModels = toNamedList(profile?.startupBusinessModels);
  const startupIndustries = [
    ...toNamedList(profile?.startupIndustries),
    ...toNamedList(profile?.startupOtherIndustries),
  ];
  const startupTechnologies = [
    ...toNamedList(profile?.startupTechnologies),
    ...toNamedList(profile?.startupOtherTechnologies),
  ];
  const mentorshipAreas = toNamedList(profile?.mentorshipAreas);

  const expertiseItems = isCorporate
    ? toNamedList(profile?.connectionRequirements)
    : toNamedList(profile?.domainAreas);
  const industryItems = [
    ...toNamedList(profile?.sectoralInterestSubCategoryIds),
    ...toNamedList(profile?.sectoralInterestIds),
    ...toNamedList(profile?.sectoralInterestOthers),
  ];

  const targetFundraise = formatCurrencyINR(profile?.financials?.targetFundraise);
  const valuation = formatCurrencyINR(profile?.financials?.tentativeValuation);
  const totalFundRaised = formatCurrencyINR(profile?.financials?.totalFundRaised);

  // ── investor-specific fields ───────────────────────────────────────────────
  const investmentDetails: Record<string, any> = profile?.investmentDetails ?? {};
  const investmentMechanisms = toNamedList(
    investmentDetails.investmentMechanismIds ??
    profile?.investmentMechanisms ??
    profile?.investmentMechanismIds,
  );
  const investmentStageItems = toNamedList(
    investmentDetails.investmentStageIds ??
    profile?.investmentStages ??
    profile?.investmentStageIds,
  );
  const investmentInstruments = toNamedList(
    profile?.investmentInstruments ??
    investmentDetails.investmentInstruments,
  );
  const investAbilityMetrics = toNamedList(
    investmentDetails.investAbilityMetricsIds ??
    profile?.investAbilityMetrics ??
    profile?.investAbilityMetricsIds,
  );
  const investorBusinessModels = toNamedList(
    investmentDetails.businessModelIds ??
    profile?.businessModels ??
    profile?.businessModel,
  );
  const portfolioSize: number | null =
    profile?.portfolioSize != null ? Number(profile.portfolioSize) : null;
  const ticketSizeMin = investmentDetails.ticketSizeMin ?? profile?.ticketSizeMin;
  const ticketSizeMax = investmentDetails.ticketSizeMax ?? profile?.ticketSizeMax;
  const tat = investmentDetails.turnAroundTime ?? profile?.turnAroundTime;
  const keyInvestments: string = stripHtml(profile?.keyInvestments || '');

  // ── connect action ────────────────────────────────────────────────────────

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
      toast.error(
        err instanceof Error ? err.message : 'Could not send request.',
      );
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

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.page}>
      {/* Top bar */}
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
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>

        {/* ── Hero card ─────────────────────────────────────────────── */}
        <View style={styles.heroCard}>
          <View style={styles.heroRow}>
            {logo ? (
              <Image source={{uri: logo}} style={styles.heroLogo} />
            ) : (
              <View
                style={[
                  styles.heroLogoFallback,
                  {backgroundColor: withAlpha(primaryColor, 0.15)},
                ]}>
                <Text
                  style={[styles.heroLogoInitials, {color: primaryColor}]}>
                  {initials(name) || '?'}
                </Text>
              </View>
            )}
            <View style={styles.heroCopy}>
              <Text style={styles.heroName}>{name}</Text>
              {location ? (
                <View style={styles.heroLocation}>
                  <Icon
                    name="map-marker-outline"
                    size={13}
                    color="#475569"
                  />
                  <Text style={styles.heroLocationText}>{location}</Text>
                </View>
              ) : null}
              {profile?.yearOfIncorporation || profile?.establishmentYear ? (
                <View style={styles.heroLocation}>
                  <Icon name="calendar" size={13} color="#475569" />
                  <Text style={styles.heroLocationText}>
                    Estd.{' '}
                    {profile.yearOfIncorporation || profile.establishmentYear}
                  </Text>
                </View>
              ) : null}
              {profile?.displayWebsite ? (
                <Pressable
                  onPress={() => openLink(profile.displayWebsite)}
                  style={styles.heroLocation}>
                  <Icon name="link-variant" size={13} color={primaryColor} />
                  <Text
                    style={[styles.heroWebsiteText, {color: primaryColor}]}
                    numberOfLines={1}>
                    Visit website
                  </Text>
                </Pressable>
              ) : null}
              {isInvestor && tat ? (
                <View style={styles.heroLocation}>
                  <Icon name="clock-outline" size={13} color="#475569" />
                  <Text style={styles.heroLocationText}>
                    TAT: {tat} days
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {heroTagline ? (
            <Text style={styles.heroTagline}>
              {isPartner ? heroTagline : `"${heroTagline}"`}
            </Text>
          ) : null}
        </View>

        {/* ── Investor: Portfolio / Ticket Size overview ─────────────── */}
        {isInvestor && (portfolioSize != null || ticketSizeMin || ticketSizeMax) ? (
          <View style={styles.fundingCard}>
            <View style={styles.fundingMetaRow}>
              {portfolioSize != null ? (
                <View style={styles.fundingMetaCol}>
                  <Text style={styles.miniLabel}>Portfolio Size</Text>
                  <Text style={styles.miniValue}>{portfolioSize}</Text>
                </View>
              ) : null}
              {(ticketSizeMin || ticketSizeMax) ? (
                <View style={styles.fundingMetaCol}>
                  <Text style={styles.miniLabel}>Investment Ticket Size</Text>
                  <Text style={styles.miniValue}>
                    {[
                      ticketSizeMin ? formatCurrencyINR(String(ticketSizeMin)) : null,
                      ticketSizeMax ? formatCurrencyINR(String(ticketSizeMax)) : null,
                    ]
                      .filter(Boolean)
                      .join(' – ')}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {isLoading ? (
          <ActivityIndicator
            color={primaryColor}
            style={styles.loadingSpinner}
          />
        ) : null}

        {/* ── About ─────────────────────────────────────────────────── */}
        {about ? (
          <SectionCard title="About" primaryColor={primaryColor}>
            <Text style={sectionStyles.valueText}>{about}</Text>
          </SectionCard>
        ) : null}

        {/* ── Startup: Business Details ──────────────────────────────── */}
        {isStartup &&
        (startupBusinessModels.length ||
          mentorshipAreas.length ||
          startupIndustries.length ||
          startupTechnologies.length) ? (
          <SectionCard title="Business Details" primaryColor={primaryColor}>
            {startupBusinessModels.length ? (
              <View style={sectionStyles.labelRow}>
                <Text style={sectionStyles.labelText}>Business Models</Text>
                <ChipList items={startupBusinessModels} />
              </View>
            ) : null}
            {mentorshipAreas.length ? (
              <View style={sectionStyles.labelRow}>
                <Text style={sectionStyles.labelText}>
                  Looking mentorship for?
                </Text>
                <ChipList items={mentorshipAreas} />
              </View>
            ) : null}
            {startupIndustries.length ? (
              <View style={sectionStyles.labelRow}>
                <Text style={sectionStyles.labelText}>Industry Domain</Text>
                <ChipList items={startupIndustries} />
              </View>
            ) : null}
            {startupTechnologies.length ? (
              <View style={sectionStyles.labelRow}>
                <Text style={sectionStyles.labelText}>Technology Domain</Text>
                <ChipList items={startupTechnologies} />
              </View>
            ) : null}
          </SectionCard>
        ) : null}

        {/* ── Mentor / Individual / ServiceProvider: Expertise ────────── */}
        {isPersonProfile && (expertiseItems.length || industryItems.length) ? (
          <SectionCard title="Details" primaryColor={primaryColor}>
            {expertiseItems.length ? (
              <View style={sectionStyles.labelRow}>
                <Text style={sectionStyles.labelText}>Areas of expertise</Text>
                <ChipList items={expertiseItems} />
              </View>
            ) : null}
            {industryItems.length ? (
              <View style={sectionStyles.labelRow}>
                <Text style={sectionStyles.labelText}>
                  Industries of interest
                </Text>
                <ChipList items={industryItems} />
              </View>
            ) : null}
          </SectionCard>
        ) : null}

        {/* ── Investor: Investment Details ───────────────────────────── */}
        {isInvestor && (
          investmentMechanisms.length ||
          investorBusinessModels.length ||
          industryItems.length ||
          expertiseItems.length ||
          investmentInstruments.length ||
          investmentStageItems.length ||
          investAbilityMetrics.length
        ) ? (
          <SectionCard title="Investment Details" primaryColor={primaryColor}>
            {investmentMechanisms.length ? (
              <View style={sectionStyles.labelRow}>
                <Text style={sectionStyles.labelText}>Investment Methodology</Text>
                <ChipList items={investmentMechanisms} />
              </View>
            ) : null}
            {investorBusinessModels.length ? (
              <>
                {investmentMechanisms.length ? <View style={sectionStyles.divider} /> : null}
                <View style={sectionStyles.labelRow}>
                  <Text style={sectionStyles.labelText}>Business Models</Text>
                  <ChipList items={investorBusinessModels} />
                </View>
              </>
            ) : null}
            {industryItems.length ? (
              <>
                {(investmentMechanisms.length || investorBusinessModels.length) ? <View style={sectionStyles.divider} /> : null}
                <View style={sectionStyles.labelRow}>
                  <Text style={sectionStyles.labelText}>Industries</Text>
                  <ChipList items={industryItems} />
                </View>
              </>
            ) : null}
            {expertiseItems.length ? (
              <>
                {(investmentMechanisms.length || investorBusinessModels.length || industryItems.length) ? <View style={sectionStyles.divider} /> : null}
                <View style={sectionStyles.labelRow}>
                  <Text style={sectionStyles.labelText}>Investment Focus</Text>
                  <ChipList items={expertiseItems} />
                </View>
              </>
            ) : null}
            {investmentInstruments.length ? (
              <>
                {(investmentMechanisms.length || investorBusinessModels.length || industryItems.length || expertiseItems.length) ? <View style={sectionStyles.divider} /> : null}
                <View style={sectionStyles.labelRow}>
                  <Text style={sectionStyles.labelText}>Investment Instrument</Text>
                  <ChipList items={investmentInstruments} />
                </View>
              </>
            ) : null}
            {investmentStageItems.length ? (
              <>
                {(investmentMechanisms.length || investorBusinessModels.length || industryItems.length || expertiseItems.length || investmentInstruments.length) ? <View style={sectionStyles.divider} /> : null}
                <View style={sectionStyles.labelRow}>
                  <Text style={sectionStyles.labelText}>Investment Stages</Text>
                  <ChipList items={investmentStageItems} />
                </View>
              </>
            ) : null}
            {investAbilityMetrics.length ? (
              <>
                {(investmentMechanisms.length || investorBusinessModels.length || industryItems.length || expertiseItems.length || investmentInstruments.length || investmentStageItems.length) ? <View style={sectionStyles.divider} /> : null}
                <View style={sectionStyles.labelRow}>
                  <Text style={sectionStyles.labelText}>Investability Metrics</Text>
                  <ChipList items={investAbilityMetrics} />
                </View>
              </>
            ) : null}
          </SectionCard>
        ) : null}

        {/* ── Investor: Key Investments ──────────────────────────────── */}
        {isInvestor && keyInvestments ? (
          <SectionCard title="Key Investments" primaryColor={primaryColor}>
            <Text style={sectionStyles.valueText}>{keyInvestments}</Text>
          </SectionCard>
        ) : null}

        {/* ── Corporate: Details ────────────────────────────────────── */}
        {isCorporate ? (
          <SectionCard title="Details" primaryColor={primaryColor}>
            <LabelRow
              label="Company Size"
              value={profile?.size || '-'}
            />
            <View style={sectionStyles.divider} />
            <LabelRow
              label="Name of Program"
              value={profile?.programName || '-'}
            />
            <View style={sectionStyles.divider} />
            <LabelRow
              label="Total startups supported"
              value={
                profile?.totalSupported != null
                  ? String(profile.totalSupported)
                  : '-'
              }
            />
            {industryItems.length ? (
              <>
                <View style={sectionStyles.divider} />
                <View style={sectionStyles.labelRow}>
                  <Text style={sectionStyles.labelText}>Industry Domain</Text>
                  <ChipList items={industryItems} />
                </View>
              </>
            ) : null}
            {expertiseItems.length ? (
              <>
                <View style={sectionStyles.divider} />
                <View style={sectionStyles.labelRow}>
                  <Text style={sectionStyles.labelText}>
                    Reason to connect with startups
                  </Text>
                  <ChipList items={expertiseItems} />
                </View>
              </>
            ) : null}
          </SectionCard>
        ) : null}

        {/* ── Partner: Details ──────────────────────────────────────── */}
        {isPartner ? (
          <SectionCard title="Details" primaryColor={primaryColor}>
            <LabelRow
              label="Partner Type"
              value={humanizeSnake(profile?.partnerType) || '-'}
            />
            <View style={sectionStyles.divider} />
            <LabelRow label="Location" value={location || '-'} />
            {(() => {
              const tagItems = [
                ...toNamedList(profile?.tags),
                ...toNamedList(profile?.partnerIndustries),
                ...toNamedList(profile?.partnerOtherIndustries),
                ...toNamedList(profile?.partnerTechnologies),
                ...toNamedList(profile?.partnerOtherTechnologies),
              ];
              if (!tagItems.length) return null;
              return (
                <>
                  <View style={sectionStyles.divider} />
                  <View style={sectionStyles.labelRow}>
                    <Text style={sectionStyles.labelText}>Tags</Text>
                    <ChipList items={tagItems} />
                  </View>
                </>
              );
            })()}
          </SectionCard>
        ) : null}

        {/* ── Funding card (startup / investor) ─────────────────────── */}
        {(targetFundraise ||
          valuation ||
          profile?.financials?.fundingStage?.name) ? (
          <View style={styles.fundingCard}>
            {targetFundraise ? (
              <View>
                <Text style={styles.fundingLabel}>Raising</Text>
                <Text style={styles.fundingAmount}>{targetFundraise}</Text>
                {valuation ? (
                  <Text style={styles.fundingMeta}>at {valuation} valuation</Text>
                ) : null}
              </View>
            ) : null}
            {profile?.financials?.fundingStage?.name ||
            profile?.financials?.revenueStage ? (
              <View style={styles.fundingMetaRow}>
                {profile?.financials?.fundingStage?.name ? (
                  <View style={styles.fundingMetaCol}>
                    <Text style={styles.miniLabel}>Funding Stage</Text>
                    <Text style={styles.miniValue}>
                      {profile.financials.fundingStage.name}
                    </Text>
                  </View>
                ) : null}
                {profile?.financials?.revenueStage ? (
                  <View style={styles.fundingMetaCol}>
                    <Text style={styles.miniLabel}>Revenue Stage</Text>
                    <Text style={styles.miniValue}>
                      {humanizeSnake(profile.financials.revenueStage)}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ── Social Links ──────────────────────────────────────────── */}
        {socialLinks.length ? (
          <SectionCard title="Social Links" primaryColor={primaryColor}>
            <View style={sectionStyles.socialRow}>
              {socialLinks.map(item => (
                <Pressable
                  key={item.key}
                  onPress={() => openLink(item.url)}
                  style={styles.socialChip}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}>
                  <Icon name={item.icon} size={22} color={primaryColor} />
                </Pressable>
              ))}
            </View>
          </SectionCard>
        ) : null}

        {/* ── Programs ──────────────────────────────────────────────── */}
        {(() => {
          const programs: any[] = Array.isArray(profile?.programs)
            ? profile.programs
            : [];
          const titles = programs
            .map(
              (p: any) =>
                p?.programTitle ||
                p?.name ||
                (typeof p === 'string' ? p : ''),
            )
            .filter(Boolean);
          if (!titles.length) return null;
          return (
            <SectionCard title="Programs" primaryColor={primaryColor}>
              <ChipList items={titles} />
            </SectionCard>
          );
        })()}

        {/* ── Pitch Deck ────────────────────────────────────────────── */}
        {(profile?.pitchDeck?.pitchDocument || pitchImages.length > 0) ? (
          <SectionCard title="Pitch Deck" primaryColor={primaryColor}>
            {connState === 'connected' ? (
              <>
                {profile?.pitchDeck?.pitchDocument ? (
                  <View style={styles.pitchActionRow}>
                    <Pressable
                      onPress={() =>
                        openLink(profile.pitchDeck?.pitchDocument)
                      }
                      style={[
                        styles.fullScreenPill,
                        {borderColor: primaryColor},
                      ]}>
                      <Icon name="fullscreen" size={14} color={primaryColor} />
                      <Text
                        style={[
                          styles.fullScreenPillText,
                          {color: primaryColor},
                        ]}>
                        Full Screen
                      </Text>
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
                    onPress={() =>
                      openLink(profile.pitchDeck?.pitchDocument)
                    }
                    style={[styles.linkButton, {borderColor: primaryColor}]}>
                    <Icon
                      name="file-document-outline"
                      size={18}
                      color={primaryColor}
                    />
                    <Text
                      style={[styles.linkButtonText, {color: primaryColor}]}>
                      {profile.pitchDeck?.fileName || 'Open pitch deck'}
                    </Text>
                  </Pressable>
                ) : null}
              </>
            ) : (
              <View style={styles.lockedCard}>
                <Icon name="lock-outline" size={32} color="#94a3b8" />
                <Text style={styles.lockedTitle}>
                  Accessible only to connections
                </Text>
              </View>
            )}
          </SectionCard>
        ) : null}

        {/* ── Video Pitch ───────────────────────────────────────────── */}
        {videoUrl ? (
          <SectionCard title="Video Pitch" primaryColor={primaryColor}>
            {isDirectVideoUrl(videoUrl) ? (
              <InlineVideoPlayer url={videoUrl} primaryColor={primaryColor} />
            ) : (
              <Pressable
                onPress={() => openLink(videoUrl)}
                style={[styles.videoPressable, {borderColor: primaryColor}]}>
                <Icon name="play-circle" size={48} color={primaryColor} />
                <Text style={[styles.videoPressableText, {color: primaryColor}]}>
                  Tap to play video pitch
                </Text>
              </Pressable>
            )}
          </SectionCard>
        ) : null}

        {/* ── Team ──────────────────────────────────────────────────── */}
        {founders.length > 0 ? (
          <SectionCard title="Team" primaryColor={primaryColor}>
            <View style={sectionStyles.peopleGrid}>
              {founders.map((p: any) => (
                <PersonCard
                  key={p.uuid || p.name}
                  name={p.name || 'Team member'}
                  sub={p.role}
                  linkedinUrl={p.linkedinUrl}
                  primaryColor={primaryColor}
                />
              ))}
            </View>
          </SectionCard>
        ) : null}

        {/* ── Advisory Board ────────────────────────────────────────── */}
        {advisoryBoards.length > 0 ? (
          <SectionCard title="Advisory Board" primaryColor={primaryColor}>
            <View style={sectionStyles.peopleGrid}>
              {advisoryBoards.map((p: any) => (
                <PersonCard
                  key={p.uuid || p.name}
                  name={p.name || 'Advisor'}
                  linkedinUrl={p.linkedinUrl}
                  primaryColor={primaryColor}
                />
              ))}
            </View>
          </SectionCard>
        ) : null}

        {/* ── Product Information ───────────────────────────────────── */}
        {(profile?.productInformation?.productStage?.name ||
          profile?.productInformation?.description) ? (
          <SectionCard title="Product Information" primaryColor={primaryColor}>
            {profile.productInformation?.productStage?.name ? (
              <LabelRow
                label="Product Stage"
                value={profile.productInformation.productStage.name}
              />
            ) : null}
            {profile.productInformation?.description ? (
              <>
                <View style={sectionStyles.divider} />
                <LabelRow
                  label="Company Brief"
                  value={profile.productInformation.description}
                />
              </>
            ) : null}
          </SectionCard>
        ) : null}

        {/* ── Funding Details ───────────────────────────────────────── */}
        {(totalFundRaised || profile?.financials?.pastFunding) ? (
          <SectionCard title="Funding Details" primaryColor={primaryColor}>
            {totalFundRaised ? (
              <LabelRow
                label="Total funding raised in previous round"
                value={totalFundRaised}
              />
            ) : null}
            {profile?.financials?.pastFunding ? (
              <>
                <View style={sectionStyles.divider} />
                <LabelRow
                  label="Previous Investors"
                  value={profile.financials.pastFunding}
                />
              </>
            ) : null}
          </SectionCard>
        ) : null}

        {profile?.modifiedAt ? (
          <Text style={styles.lastUpdated}>
            Last updated:{' '}
            {new Date(profile.modifiedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
        ) : null}

        <View style={styles.scrollPad} />
      </ScrollView>

      {/* Footer: approval gate, connected badge, or connect button */}
      <View style={styles.footer}>
        {isApproved === false ? (
          <View style={styles.approvalNotice}>
            <Text style={styles.approvalNoticeText}>
              Prior to initiating connections, your profile must be approved by
              the admin.
            </Text>
          </View>
        ) : connState === 'connected' ? (
          <View
            style={[
              styles.connectedBadge,
              {backgroundColor: withAlpha(primaryColor, 0.12)},
            ]}>
            <Icon name="account-check" size={18} color={primaryColor} />
            <Text style={[styles.connectedBadgeText, {color: primaryColor}]}>
              Connected
            </Text>
          </View>
        ) : (
          <Pressable
            disabled={connectDisabled}
            onPress={() => {
              setConnectMessage(DEFAULT_CONNECT_MESSAGE);
              setConnectOpen(true);
            }}
            style={[
              styles.connectBtn,
              {
                backgroundColor: connectDisabled
                  ? colors.borderStrong
                  : primaryColor,
              },
            ]}>
            <Icon name={connectIcon} size={18} color="#ffffff" />
            <Text style={styles.connectBtnText}>{connectLabel}</Text>
          </Pressable>
        )}
      </View>

      {/* Connect-request modal */}
      <Modal
        transparent
        visible={connectOpen}
        animationType="fade"
        onRequestClose={() => (isSending ? undefined : setConnectOpen(false))}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── section sub-styles (used inside sub-components) ─────────────────────────

const sectionStyles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  heading: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 12,
  },
  dot: {
    borderRadius: 999,
    height: 16,
    marginRight: 10,
    width: 4,
  },
  title: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
  body: {
    gap: 10,
  },
  labelRow: {
    gap: 6,
  },
  labelText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  valueText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  empty: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#eff6ff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    color: '#1e3a8a',
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    borderTopColor: '#e2e8f0',
    borderTopWidth: 1,
    borderStyle: 'dashed',
    marginVertical: 4,
  },
  socialRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  peopleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  personCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minWidth: '46%',
    flex: 1,
  },
  personAvatar: {
    alignItems: 'center',
    borderRadius: 999,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  personInitials: {
    fontSize: 13,
    fontWeight: '800',
  },
  personInfo: {
    flex: 1,
  },
  personName: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
  },
  personLink: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  videoWrap: {
    aspectRatio: 16 / 9,
    backgroundColor: '#000000',
    borderRadius: 10,
    overflow: 'hidden',
    width: '100%',
  },
  video: {
    height: '100%',
    width: '100%',
  },
  videoFallback: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 24,
    width: '100%',
  },
  videoFallbackText: {
    fontSize: 13,
    fontWeight: '700',
  },
});

// ─── page-level styles ────────────────────────────────────────────────────────

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
    paddingVertical: 10,
    gap: 8,
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
  },
  scroll: {
    paddingBottom: 16,
  },
  scrollPad: {
    height: 8,
  },
  loadingSpinner: {
    marginTop: 20,
  },

  // Hero card
  heroCard: {
    backgroundColor: '#e0e7ff',
    borderRadius: 18,
    margin: 16,
    marginBottom: 0,
    padding: 16,
  },
  heroRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  heroLogo: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  heroLogoFallback: {
    width: 64,
    height: 64,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLogoInitials: {
    fontSize: 22,
    fontWeight: '800',
  },
  heroCopy: {
    flex: 1,
  },
  heroName: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
  },
  heroLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  heroLocationText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  heroWebsiteText: {
    fontSize: 12,
    fontWeight: '600',
  },
  heroTagline: {
    color: '#334155',
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 20,
    marginTop: 14,
    textAlign: 'center',
  },

  // Funding card
  fundingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    gap: 16,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
  },
  fundingLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  fundingAmount: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  fundingMeta: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 4,
  },
  fundingMetaRow: {
    borderTopColor: '#e2e8f0',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 24,
    paddingTop: 14,
  },
  fundingMetaCol: {
    flex: 1,
  },
  miniLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  miniValue: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
  },

  // Social chip
  socialChip: {
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    borderRadius: 999,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },

  // Pitch deck: locked card
  lockedCard: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    gap: 12,
    paddingVertical: 32,
  },
  lockedTitle: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
  },
  lockedConnectBtn: {
    borderRadius: 10,
    paddingHorizontal: 28,
    paddingVertical: 12,
    marginTop: 4,
  },
  lockedConnectBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Pitch deck: full-screen pill
  pitchActionRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  fullScreenPill: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  fullScreenPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  linkButton: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  linkButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Video pitch: non-direct URL tap button
  videoPressable: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 32,
    width: '100%',
  },
  videoPressableText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Last updated
  lastUpdated: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 18,
    paddingHorizontal: 20,
  },

  // Footer
  footer: {
    padding: 14,
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  approvalNotice: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  approvalNoticeText: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
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
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 15,
  },
  connectedBadgeText: {
    fontSize: 16,
    fontWeight: '800',
  },

  // Connect modal
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
