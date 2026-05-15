import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {authService} from '../../auth/services/auth.service';
import {Icon} from '../../shared/components/Icon';

type ProfileScreenProps = {
  token: string;
  primaryColor: string;
  logoBaseUrl?: string | null;
  onBack: () => void;
  onEditProfile?: () => void;
};

type NamedRecord = {id?: number | string; name?: string | null};

type Founder = {
  uuid?: string;
  name?: string | null;
  linkedinUrl?: string | null;
  role?: string | null;
};

type AdvisoryBoardMember = {
  uuid?: string;
  name?: string | null;
  linkedinUrl?: string | null;
};

type StartupInfo = {
  uuid?: string;
  companyName?: string;
  yearOfIncorporation?: string | null;
  displayWebsite?: string | null;
  website?: string | null;
  companyLogo?: string | null;
  linkedinUrl?: string | null;
  twitterUrl?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  youtubeUrl?: string | null;
  registeredCountryR?: NamedRecord | null;
  registeredStateR?: NamedRecord | null;
  registeredCityR?: NamedRecord | null;
  startupIndustries?: NamedRecord[];
  startupOtherIndustries?: NamedRecord[];
  startupTechnologies?: NamedRecord[];
  startupOtherTechnologies?: NamedRecord[];
  startupBusinessModels?: NamedRecord[];
  mentorshipAreas?: NamedRecord[];
  productInformation?: {
    description?: string | null;
    productStage?: {name?: string | null} | null;
  } | null;
  financials?: {
    targetFundraise?: string | null;
    tentativeValuation?: string | null;
    fundingStage?: {name?: string | null} | null;
    revenueStage?: string | null;
    pastFunding?: string | null;
    totalFundRaised?: string | null;
    timeToCommercialize?: string | null;
  } | null;
  pitchDeck?: {
    elevatorPitch?: string | null;
    pitchDocument?: string | null;
    powerPitchUrl?: string | null;
    embedUrl?: string | null;
    fileName?: string | null;
  } | null;
  founders?: Founder[];
  advisoryBoards?: AdvisoryBoardMember[];
  modifiedAt?: string;
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

const getInitials = (value?: string | null) => {
  if (!value) {
    return '';
  }
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || '')
    .join('');
};

const formatCurrencyINR = (raw?: string | null) => {
  if (!raw) {
    return null;
  }
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) {
    return raw;
  }
  return `INR ${numeric.toLocaleString('en-IN')}`;
};

const humanizeSnake = (value?: string | null) => {
  if (!value) {
    return null;
  }
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, ch => ch.toUpperCase());
};

const formatLocation = (info: StartupInfo) => {
  const parts = [
    info.registeredCityR?.name,
    info.registeredStateR?.name,
    info.registeredCountryR?.name,
  ].filter(Boolean);
  return parts.join(', ');
};

const openLink = (url?: string | null) => {
  if (!url) {
    return;
  }
  Linking.openURL(url).catch(() => undefined);
};

export function ProfileScreen({
  token,
  primaryColor,
  logoBaseUrl,
  onBack,
  onEditProfile,
}: ProfileScreenProps) {
  const [info, setInfo] = useState<StartupInfo | null>(null);
  const [userBasic, setUserBasic] = useState<{
    name?: string;
    email?: string;
    accountType?: string;
    avatar?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadProfile = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setErrorMessage(null);
      try {
        const userResponse = await authService.getProfile(token);
        const userData: any = (userResponse as any)?.data || {};
        const accountType = String(userData?.accountType || '').toLowerCase();
        setUserBasic({
          name: userData?.name,
          email: userData?.email,
          accountType,
          avatar: userData?.avatar,
        });

        const findUuid = (segment: string) => {
          const pattern = new RegExp(
            `${segment}\\/([0-9a-fA-F-]{36})`,
            'i',
          );
          const scan = (value: any): string | null => {
            if (!value) {
              return null;
            }
            if (typeof value === 'string') {
              const match = value.match(pattern);
              return match?.[1] || null;
            }
            if (Array.isArray(value)) {
              for (const item of value) {
                const found = scan(item);
                if (found) {
                  return found;
                }
              }
              return null;
            }
            if (typeof value === 'object') {
              for (const key of Object.keys(value)) {
                const found = scan(value[key]);
                if (found) {
                  return found;
                }
              }
            }
            return null;
          };
          return scan(userData);
        };

        let response: any = null;
        const wrapEndpointError = (label: string, error: unknown) => {
          const baseMessage =
            error instanceof Error ? error.message : String(error);
          return new Error(`${label} → ${baseMessage}`);
        };

        if (accountType === 'corporate') {
          const uuid = findUuid('corporates');
          if (!uuid) {
            throw new Error(
              'Corporate profile UUID not found in the user profile response. Please upload a company logo or contact support.',
            );
          }
          try {
            response = await authService.getCorporateProfileData(token, uuid);
          } catch (error) {
            throw wrapEndpointError(
              `Corporate endpoint (uuid ${uuid})`,
              error,
            );
          }
        } else if (accountType === 'investor') {
          const uuid = findUuid('investors');
          if (!uuid) {
            throw new Error(
              'Investor profile UUID not found in the user profile response. Please upload an avatar or contact support.',
            );
          }
          try {
            response = await authService.getInvestorProfileData(token, uuid);
          } catch (error) {
            throw wrapEndpointError(`Investor endpoint (uuid ${uuid})`, error);
          }
        } else if (accountType === 'startup') {
          try {
            response = await authService.getStartupInformation(
              token,
              accountType,
            );
          } catch (error) {
            throw wrapEndpointError('Startup endpoint', error);
          }
          const startupUuid =
            response?.data?.uuid || findUuid('startups') || null;
          if (startupUuid) {
            try {
              const publicResponse =
                await authService.getStartupPublicInformation(
                  token,
                  startupUuid,
                );
              if (publicResponse?.data) {
                response = publicResponse;
              }
            } catch (publicError) {
              console.warn(
                '[ProfileScreen] startup public endpoint failed, using private:',
                publicError,
              );
            }
          }
        } else if (!accountType) {
          throw new Error(
            'Account type missing in user profile response. Please log out and log in again.',
          );
        } else {
          throw new Error(
            `Profile view is not available for account type "${accountType}" yet.`,
          );
        }

        const data: any = response?.data || null;
        if (!data) {
          throw new Error('Profile API returned an empty response.');
        }
        setInfo(data);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'We could not load your profile right now.';
        console.warn('[ProfileScreen] loadProfile failed:', error);
        setErrorMessage(message);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token],
  );

  useEffect(() => {
    void loadProfile('initial');
  }, [loadProfile]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={primaryColor} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  const logoUri = resolveAssetUri(
    info?.companyLogo || userBasic?.avatar,
    logoBaseUrl,
  );
  const heroTitle =
    info?.companyName ||
    userBasic?.name ||
    (userBasic?.accountType
      ? `${userBasic.accountType.charAt(0).toUpperCase()}${userBasic.accountType.slice(1)} profile`
      : 'My Profile');
  const location = info ? formatLocation(info) : '';
  const targetFundraise = formatCurrencyINR(info?.financials?.targetFundraise);
  const valuation = formatCurrencyINR(info?.financials?.tentativeValuation);
  const totalFundRaised = formatCurrencyINR(info?.financials?.totalFundRaised);
  const elevatorPitch = info?.pitchDeck?.elevatorPitch || '';

  const socialLinks: Array<{
    key: string;
    url: string;
    icon: string;
    label: string;
  }> = [];

  if (info?.twitterUrl) {
    socialLinks.push({
      key: 'twitter',
      url: info.twitterUrl,
      icon: 'twitter',
      label: 'Twitter',
    });
  }
  if (info?.linkedinUrl) {
    socialLinks.push({
      key: 'linkedin',
      url: info.linkedinUrl,
      icon: 'linkedin',
      label: 'LinkedIn',
    });
  }
  if (info?.facebookUrl) {
    socialLinks.push({
      key: 'facebook',
      url: info.facebookUrl,
      icon: 'facebook',
      label: 'Facebook',
    });
  }
  if (info?.instagramUrl) {
    socialLinks.push({
      key: 'instagram',
      url: info.instagramUrl,
      icon: 'instagram',
      label: 'Instagram',
    });
  }
  if (info?.youtubeUrl) {
    socialLinks.push({
      key: 'youtube',
      url: info.youtubeUrl,
      icon: 'youtube',
      label: 'YouTube',
    });
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => void loadProfile('refresh')}
          tintColor={primaryColor}
        />
      }>
      <View style={styles.toolbar}>
        <Pressable
          onPress={onBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back">
          <Icon name="arrow-left" size={20} color="#0f172a" />
        </Pressable>
        <Text style={styles.toolbarTitle}>My Profile</Text>
        {onEditProfile ? (
          <Pressable
            onPress={onEditProfile}
            style={[styles.editButton, {backgroundColor: primaryColor}]}
            accessibilityRole="button"
            accessibilityLabel="Edit profile">
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </Pressable>
        ) : (
          <View style={styles.toolbarSpacer} />
        )}
      </View>

      {errorMessage ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>We could not load your profile</Text>
          <Text style={styles.errorBody}>{errorMessage}</Text>
          <Pressable
            onPress={() => void loadProfile('initial')}
            style={[styles.retryButton, {backgroundColor: primaryColor}]}>
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          {logoUri ? (
            <Image source={{uri: logoUri}} style={styles.logoImage} />
          ) : (
            <View style={[styles.logoFallback, {backgroundColor: primaryColor}]}>
              <Text style={styles.logoFallbackText}>
                {getInitials(info?.companyName || userBasic?.name)}
              </Text>
            </View>
          )}
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>{heroTitle}</Text>
            <View style={styles.heroMetaRow}>
              {location ? (
                <View style={styles.metaChip}>
                  <Icon name="map-marker" size={14} color="#475569" />
                  <Text style={styles.metaChipText}>{location}</Text>
                </View>
              ) : null}
              {info?.yearOfIncorporation ? (
                <View style={styles.metaChip}>
                  <Icon name="calendar" size={14} color="#475569" />
                  <Text style={styles.metaChipText}>
                    Estd. {info.yearOfIncorporation}
                  </Text>
                </View>
              ) : null}
            </View>
            {info?.displayWebsite ? (
              <Pressable onPress={() => openLink(info.displayWebsite)}>
                <Text style={[styles.heroLink, {color: primaryColor}]}>
                  Visit website
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {elevatorPitch ? (
          <Text style={styles.elevatorPitch}>“{elevatorPitch}”</Text>
        ) : null}
      </View>

      {targetFundraise || valuation || info?.financials?.fundingStage?.name ? (
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
          <View style={styles.fundingMetaRow}>
            {info?.financials?.fundingStage?.name ? (
              <View style={styles.fundingMetaCol}>
                <Text style={styles.miniLabel}>Funding Stage</Text>
                <Text style={styles.miniValue}>
                  {info.financials.fundingStage.name}
                </Text>
              </View>
            ) : null}
            {info?.financials?.revenueStage ? (
              <View style={styles.fundingMetaCol}>
                <Text style={styles.miniLabel}>Revenue Stage</Text>
                <Text style={styles.miniValue}>
                  {humanizeSnake(info.financials.revenueStage)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {info?.financials?.timeToCommercialize ? (
        <SectionBlock title="Revenues" primaryColor={primaryColor}>
          <LabelRow
            label="Time to commercialise?"
            value={info.financials.timeToCommercialize}
          />
        </SectionBlock>
      ) : null}

      {info?.financials?.totalFundRaised || info?.financials?.pastFunding ? (
        <SectionBlock title="Funding Details" primaryColor={primaryColor}>
          {totalFundRaised ? (
            <LabelRow
              label="Total funding raised in previous round ?"
              value={totalFundRaised}
            />
          ) : null}
          {info?.financials?.pastFunding ? (
            <LabelRow
              label="Previous Investors"
              value={info.financials.pastFunding}
            />
          ) : null}
        </SectionBlock>
      ) : null}

      {info?.startupBusinessModels?.length ||
      info?.startupIndustries?.length ||
      info?.startupTechnologies?.length ? (
        <SectionBlock title="Business Details" primaryColor={primaryColor}>
          {info?.startupBusinessModels?.length ? (
            <ChipGroup
              label="Business Models"
              items={info.startupBusinessModels.map(item => item.name || '')}
            />
          ) : null}
          {info?.startupIndustries?.length ? (
            <ChipGroup
              label="Industry Domain"
              items={info.startupIndustries.map(item => item.name || '')}
            />
          ) : null}
          {info?.startupTechnologies?.length ? (
            <ChipGroup
              label="Technology Domain"
              items={info.startupTechnologies.map(item => item.name || '')}
            />
          ) : null}
        </SectionBlock>
      ) : null}

      {socialLinks.length ? (
        <SectionBlock title="Social Links" primaryColor={primaryColor}>
          <View style={styles.socialRow}>
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
        </SectionBlock>
      ) : null}

      {info?.founders?.length ? (
        <SectionBlock title="Team" primaryColor={primaryColor}>
          <View style={styles.peopleGrid}>
            {info.founders.map(person => (
              <PersonChip
                key={person.uuid || person.name || Math.random().toString()}
                name={person.name || 'Team member'}
                linkedinUrl={person.linkedinUrl}
                primaryColor={primaryColor}
              />
            ))}
          </View>
        </SectionBlock>
      ) : null}

      {info?.advisoryBoards?.length ? (
        <SectionBlock title="Advisory board" primaryColor={primaryColor}>
          <View style={styles.peopleGrid}>
            {info.advisoryBoards.map(person => (
              <PersonChip
                key={person.uuid || person.name || Math.random().toString()}
                name={person.name || 'Advisor'}
                linkedinUrl={person.linkedinUrl}
                primaryColor={primaryColor}
              />
            ))}
          </View>
        </SectionBlock>
      ) : null}

      {info?.productInformation?.productStage?.name ||
      info?.productInformation?.description ? (
        <SectionBlock title="Product Information" primaryColor={primaryColor}>
          {info?.productInformation?.productStage?.name ? (
            <LabelRow
              label="Product Stage"
              value={info.productInformation.productStage.name}
            />
          ) : null}
          {info?.productInformation?.description ? (
            <LabelRow
              label="Company Brief"
              value={info.productInformation.description}
            />
          ) : null}
        </SectionBlock>
      ) : null}

      {info?.pitchDeck?.pitchDocument ? (
        <SectionBlock title="Pitch Deck" primaryColor={primaryColor}>
          <Pressable
            onPress={() => openLink(info.pitchDeck?.pitchDocument)}
            style={[styles.linkButton, {borderColor: primaryColor}]}>
            <Icon name="file-document-outline" size={18} color={primaryColor} />
            <Text style={[styles.linkButtonText, {color: primaryColor}]}>
              {info.pitchDeck.fileName || 'Open pitch deck'}
            </Text>
          </Pressable>
        </SectionBlock>
      ) : null}

      {info?.pitchDeck?.powerPitchUrl || info?.pitchDeck?.embedUrl ? (
        <SectionBlock title="Video Pitch" primaryColor={primaryColor}>
          <Pressable
            onPress={() =>
              openLink(info.pitchDeck?.powerPitchUrl || info.pitchDeck?.embedUrl)
            }
            style={[styles.linkButton, {borderColor: primaryColor}]}>
            <Icon name="play-circle-outline" size={18} color={primaryColor} />
            <Text style={[styles.linkButtonText, {color: primaryColor}]}>
              Watch video pitch
            </Text>
          </Pressable>
        </SectionBlock>
      ) : null}

      {info?.modifiedAt ? (
        <Text style={styles.lastUpdated}>
          Last updated: {new Date(info.modifiedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </Text>
      ) : null}
    </ScrollView>
  );
}

function SectionBlock({
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
      <View style={styles.sectionHeading}>
        <View style={[styles.sectionDot, {backgroundColor: primaryColor}]} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function LabelRow({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.labelRow}>
      <Text style={styles.labelText}>{label}</Text>
      <Text style={styles.valueText}>{value}</Text>
    </View>
  );
}

function ChipGroup({label, items}: {label: string; items: string[]}) {
  const filtered = items.filter(Boolean);
  if (!filtered.length) {
    return null;
  }
  return (
    <View style={styles.chipGroup}>
      <Text style={styles.labelText}>{label}</Text>
      <View style={styles.chipsRow}>
        {filtered.map(item => (
          <View key={item} style={styles.chip}>
            <Text style={styles.chipText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function PersonChip({
  name,
  linkedinUrl,
  primaryColor,
}: {
  name: string;
  linkedinUrl?: string | null;
  primaryColor: string;
}) {
  return (
    <View style={styles.personCard}>
      <View style={[styles.personAvatar, {backgroundColor: `${primaryColor}1A`}]}>
        <Text style={[styles.personInitials, {color: primaryColor}]}>
          {getInitials(name)}
        </Text>
      </View>
      <View style={styles.personCopy}>
        <Text style={styles.personName}>{name}</Text>
        {linkedinUrl ? (
          <Pressable onPress={() => openLink(linkedinUrl)}>
            <Text style={[styles.personLink, {color: primaryColor}]}>
              LinkedIn
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
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
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  toolbarTitle: {
    color: '#0f172a',
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
  },
  toolbarSpacer: {
    width: 36,
  },
  editButton: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  errorCard: {
    backgroundColor: '#ffffff',
    borderColor: '#fecaca',
    borderRadius: 16,
    borderWidth: 1,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
  },
  errorTitle: {
    color: '#b91c1c',
    fontSize: 15,
    fontWeight: '800',
  },
  errorBody: {
    color: '#475569',
    fontSize: 13,
    marginTop: 6,
  },
  retryButton: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  heroCard: {
    backgroundColor: '#e0e7ff',
    borderRadius: 18,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
  },
  heroHeader: {
    flexDirection: 'row',
    gap: 14,
  },
  logoImage: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    height: 64,
    width: 64,
  },
  logoFallback: {
    alignItems: 'center',
    borderRadius: 12,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  logoFallbackText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
  },
  heroCopy: {
    flex: 1,
  },
  heroTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  metaChip: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  metaChipText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  heroLink: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6,
    textDecorationLine: 'underline',
  },
  elevatorPitch: {
    color: '#334155',
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 20,
    marginTop: 14,
    textAlign: 'center',
  },
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
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 12,
  },
  sectionDot: {
    borderRadius: 999,
    height: 16,
    marginRight: 10,
    width: 4,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
  sectionBody: {
    gap: 12,
  },
  labelRow: {
    gap: 4,
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
  chipGroup: {
    gap: 8,
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
  socialRow: {
    flexDirection: 'row',
    gap: 12,
  },
  socialChip: {
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    borderRadius: 999,
    height: 40,
    justifyContent: 'center',
    width: 40,
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
  personCopy: {
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
  lastUpdated: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 18,
    paddingHorizontal: 20,
  },
});
