import React, {useContext} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';

import {Icon} from '../../../../core/components/Icon';
import {TenantContext} from '../../../../core/tenant/TenantProvider';
import {stripHtml} from '../../../chat/utils';
import {
  ChipList,
  DetailScreenProps,
  PersonCard,
  PitchSection,
  ProfileHero,
  ProfileShell,
  SectionCard,
  formatCurrencyINR,
  openLink,
  resolveSocialLinks,
  sStyles,
  toNamedList,
} from '../../components/profile/SharedProfileUI';
import {useProfileDetail} from '../../hooks/useProfileDetail';
import {resolveName} from '../../utils';

// Response keys specific to the investor profile endpoint:
//   GET /api/v1/investors/public/profile/{uuid}
//   GET /api/v1/forms-management/profile/data/investor/{uuid}

type Props = DetailScreenProps;

export function InvestorProfileScreen({
  token,
  user,
  primaryColor,
  logoBaseUrl,
  onBack,
  isApproved,
  currentUserId,
  currentUserNumericId,
  currentUserAccountType,
  onEditProfile,
  onOpenChat,
}: Props) {
  const {globalSetting, baseUrl: tenantBaseUrl} = useContext(TenantContext);
  const {profile, isLoading, connDetail, setConnDetail, resolvedUuid} =
    useProfileDetail(token, 'investors', user, currentUserNumericId);
  const connState = connDetail?.state ?? 'none';

  const name = resolveName(profile);

  // ── investor-specific field mapping ──────────────────────────────────────
  const investmentDetails: Record<string, any> = profile?.investmentDetails ?? {};

  const portfolioSize: number | null =
    profile?.portfolioSize != null ? Number(profile.portfolioSize) : null;

  const ticketSizeMin = investmentDetails.ticketSizeMin ?? profile?.ticketSizeMin;
  const ticketSizeMax = investmentDetails.ticketSizeMax ?? profile?.ticketSizeMax;
  const ticketRange = [
    ticketSizeMin ? formatCurrencyINR(String(ticketSizeMin)) : null,
    ticketSizeMax ? formatCurrencyINR(String(ticketSizeMax)) : null,
  ]
    .filter(Boolean)
    .join(' – ');

  const tat = investmentDetails.turnAroundTime ?? profile?.turnAroundTime;

  // Organization type (shown for non-individual investors)
  const organizationType: string =
    profile?.organizationType?.name || profile?.organizationType || '';
  const isIndividualInvestor =
    (profile?.investorType || '').toLowerCase() === 'individual';

  // Investment Methodology ← investmentPreferenceIds (web-verified field name)
  const mechanisms = toNamedList(
    investmentDetails.investmentPreferenceIds ??
      investmentDetails.investmentMechanismIds ??
      profile?.investmentMechanisms,
  );
  const businessModels = toNamedList(
    investmentDetails.businessModelIds ??
      profile?.businessModels ??
      profile?.businessModel,
  );
  // Industries: web reads from investmentDetails first, then top-level
  const industries = [
    ...toNamedList(investmentDetails.sectoralInterestIds),
    ...toNamedList(investmentDetails.sectoralInterestOthers),
    ...toNamedList(profile?.sectoralInterestSubCategoryIds),
    ...toNamedList(profile?.sectoralInterestIds),
    ...toNamedList(profile?.sectoralInterestOthers),
  ].filter((v, i, arr) => arr.indexOf(v) === i); // deduplicate
  const investmentFocus = toNamedList(profile?.domainAreas);
  // Investment Instrument ← investmentMechanismIds (web-verified field name)
  const instruments = toNamedList(
    investmentDetails.investmentMechanismIds ??
      profile?.investmentInstruments ??
      investmentDetails.investmentInstruments,
  );
  const stages = toNamedList(
    investmentDetails.investmentStageIds ??
      profile?.investmentStages ??
      profile?.investmentStageIds,
  );
  const metrics = toNamedList(
    investmentDetails.investAbilityMetricsIds ??
      profile?.investAbilityMetrics ??
      profile?.investAbilityMetricsIds,
  );

  // Key investments: web only shows this for individual investor type
  const keyInvestments = isIndividualInvestor
    ? stripHtml(profile?.keyInvestments || '')
    : '';
  const about = stripHtml(
    profile?.longDescription ||
      profile?.briefDescription ||
      profile?.aboutUs ||
      profile?.shortDescription ||
      profile?.description ||
      '',
  );

  const socialLinks = resolveSocialLinks(profile);

  const cdnBases = [
    globalSetting?.imgKitUrl,
    globalSetting?.assetsImgKitUrl,
    globalSetting?.s3Url,
    tenantBaseUrl,
  ];

  const founders: any[] = Array.isArray(profile?.founders) ? profile.founders : [];
  const advisoryBoards: any[] = Array.isArray(profile?.advisoryBoards)
    ? profile.advisoryBoards
    : [];

  const hasMetricsCard =
    Boolean(organizationType && !isIndividualInvestor) ||
    portfolioSize != null ||
    Boolean(ticketRange) ||
    mechanisms.length > 0 ||
    businessModels.length > 0 ||
    socialLinks.length > 0 ||
    industries.length > 0 ||
    investmentFocus.length > 0 ||
    instruments.length > 0 ||
    stages.length > 0 ||
    metrics.length > 0;

  return (
    <ProfileShell
      name={name}
      token={token}
      role="investors"
      user={user}
      resolvedUuid={resolvedUuid}
      connDetail={connDetail}
      setConnDetail={setConnDetail}
      primaryColor={primaryColor}
      isApproved={isApproved}
      isLoading={isLoading}
      onBack={onBack}
      currentUserId={currentUserId}
      currentUserNumericId={currentUserNumericId}
      currentUserAccountType={currentUserAccountType}
      onEditProfile={onEditProfile}
      onOpenChat={onOpenChat}>

      {/* Hero */}
      <ProfileHero profile={profile} primaryColor={primaryColor} logoBaseUrl={logoBaseUrl}>
        {tat ? (
          <View style={styles.metaRow}>
            <Icon name="clock-outline" size={13} color="#475569" />
            <Text style={styles.metaText}>TAT: {tat} days</Text>
          </View>
        ) : null}
      </ProfileHero>

      {isLoading ? (
        <ActivityIndicator color={primaryColor} style={styles.spinner} />
      ) : null}

      {/* Combined investor metrics card */}
      {hasMetricsCard ? (
        <View style={styles.metricsCard}>
          {/* Organization type + Portfolio size + Ticket size */}
          {((!isIndividualInvestor && Boolean(organizationType)) || portfolioSize != null || Boolean(ticketRange)) ? (
            <View style={styles.topRow}>
              {!isIndividualInvestor && organizationType ? (
                <View style={styles.topCell}>
                  <Text style={styles.cellLabel}>Organization type</Text>
                  <Text style={[styles.cellValue, styles.cellValueUppercase]}>{organizationType}</Text>
                </View>
              ) : null}
              {portfolioSize != null ? (
                <View style={[styles.topCell, (!isIndividualInvestor && organizationType) ? styles.vDiv : null]}>
                  <Text style={styles.cellLabel}>Portfolio size</Text>
                  <Text style={styles.cellValue}>{portfolioSize}</Text>
                </View>
              ) : null}
              {ticketRange ? (
                <View
                  style={[styles.topCell, ((!isIndividualInvestor && organizationType) || portfolioSize != null) ? styles.vDiv : null]}>
                  <Text style={styles.cellLabel}>Investment Ticket Size</Text>
                  <Text style={styles.cellValue}>{ticketRange}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Investment Methodology */}
          {mechanisms.length > 0 ? (
            <>
              <View style={styles.hDiv} />
              <View style={styles.fullRow}>
                <Text style={styles.cellLabel}>Investment Methodology</Text>
                <ChipList items={mechanisms} />
              </View>
            </>
          ) : null}

          {/* Business Models | Social Links */}
          {(businessModels.length > 0 || socialLinks.length > 0) ? (
            <>
              <View style={styles.hDiv} />
              <View style={styles.twoColRow}>
                {businessModels.length > 0 ? (
                  <View style={styles.halfCell}>
                    <Text style={styles.cellLabel}>Business Models</Text>
                    <ChipList items={businessModels} />
                  </View>
                ) : null}
                {socialLinks.length > 0 ? (
                  <View
                    style={[styles.halfCell, businessModels.length > 0 ? styles.vDiv : null]}>
                    <Text style={styles.cellLabel}>Social Links</Text>
                    <View style={styles.socialRow}>
                      {socialLinks.map(link => (
                        <Pressable
                          key={link.key}
                          onPress={() => openLink(link.url)}
                          accessibilityRole="button"
                          accessibilityLabel={link.label}>
                          <Icon name={link.icon} size={24} color={primaryColor} />
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            </>
          ) : null}

          {/* Industries */}
          {industries.length > 0 ? (
            <>
              <View style={styles.hDiv} />
              <View style={styles.fullRow}>
                <Text style={styles.cellLabel}>Industries</Text>
                <ChipList items={industries} />
              </View>
            </>
          ) : null}

          {/* Investment Focus */}
          {investmentFocus.length > 0 ? (
            <>
              <View style={styles.hDiv} />
              <View style={styles.fullRow}>
                <Text style={styles.cellLabel}>Investment Focus</Text>
                <ChipList items={investmentFocus} />
              </View>
            </>
          ) : null}

          {/* Investment Instrument | Investment Stages */}
          {(instruments.length > 0 || stages.length > 0) ? (
            <>
              <View style={styles.hDiv} />
              <View style={styles.twoColRow}>
                {instruments.length > 0 ? (
                  <View style={styles.halfCell}>
                    <Text style={styles.cellLabel}>Investment Instrument</Text>
                    <ChipList items={instruments} />
                  </View>
                ) : null}
                {stages.length > 0 ? (
                  <View
                    style={[styles.halfCell, instruments.length > 0 ? styles.vDiv : null]}>
                    <Text style={styles.cellLabel}>Investment Stages</Text>
                    <ChipList items={stages} />
                  </View>
                ) : null}
              </View>
            </>
          ) : null}

          {/* Investability Metrics */}
          {metrics.length > 0 ? (
            <>
              <View style={styles.hDiv} />
              <View style={styles.fullRow}>
                <Text style={styles.cellLabel}>Investability Metrics</Text>
                <ChipList items={metrics} />
              </View>
            </>
          ) : null}
        </View>
      ) : null}

      {/* Key Investments */}
      {keyInvestments ? (
        <SectionCard title="Key Investments" primaryColor={primaryColor}>
          <Text style={sStyles.valueText}>{keyInvestments}</Text>
        </SectionCard>
      ) : null}

      {/* About */}
      {about ? (
        <SectionCard title="About" primaryColor={primaryColor}>
          <Text style={sStyles.valueText}>{about}</Text>
        </SectionCard>
      ) : null}

      {/* Pitch Deck + Video */}
      <PitchSection
        profile={profile}
        primaryColor={primaryColor}
        connState={connState}
        cdnBases={cdnBases}
      />

      {/* Team */}
      {founders.length > 0 ? (
        <SectionCard title="Team" primaryColor={primaryColor}>
          <View style={sStyles.peopleGrid}>
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

      {/* Advisory Board */}
      {advisoryBoards.length > 0 ? (
        <SectionCard title="Advisory Board" primaryColor={primaryColor}>
          <View style={sStyles.peopleGrid}>
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

      {/* Last updated */}
      {profile?.modifiedAt ? (
        <Text style={sStyles.lastUpdated}>
          Last updated:{' '}
          {new Date(profile.modifiedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </Text>
      ) : null}
    </ProfileShell>
  );
}

const styles = StyleSheet.create({
  metaRow: {flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4},
  metaText: {color: '#475569', fontSize: 12, fontWeight: '600'},
  spinner: {marginTop: 20},
  metricsCard: {backgroundColor: '#ffffff', borderRadius: 18, marginHorizontal: 16, marginTop: 16, overflow: 'hidden'},
  topRow: {flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 16},
  topCell: {flex: 1, gap: 4},
  hDiv: {height: 1, backgroundColor: '#e2e8f0'},
  vDiv: {borderLeftColor: '#e2e8f0', borderLeftWidth: 1, marginLeft: 8, paddingLeft: 14},
  fullRow: {gap: 10, paddingHorizontal: 16, paddingVertical: 14},
  twoColRow: {flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14},
  halfCell: {flex: 1, gap: 8},
  cellLabel: {color: '#64748b', fontSize: 12, fontWeight: '700'},
  cellValue: {color: '#0f172a', fontSize: 15, fontWeight: '800'},
  cellValueUppercase: {textTransform: 'uppercase', fontSize: 13},
  socialRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4},
});
