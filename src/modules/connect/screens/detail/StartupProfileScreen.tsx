import React, {useContext} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';

import {Icon} from '../../../../core/components/Icon';
import {TenantContext} from '../../../../core/tenant/TenantProvider';
import {stripHtml} from '../../../chat/utils';
import {
  ChipList,
  DetailScreenProps,
  Divider,
  LabelRow,
  PersonCard,
  PitchSection,
  ProfileHero,
  ProfileShell,
  SectionCard,
  formatCurrencyINR,
  humanizeSnake,
  openLink,
  resolveSocialLinks,
  sStyles,
  toNamedList,
} from '../../components/profile/SharedProfileUI';
import {useProfileDetail} from '../../hooks/useProfileDetail';
import {resolveName} from '../../utils';

// Response keys specific to the startup profile endpoint:
//   GET /api/v1/startups/public/startup-information/{uuid}
//   GET /api/v1/forms-management/profile/data/startup/{uuid}

type Props = DetailScreenProps;

export function StartupProfileScreen({
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
    useProfileDetail(token, 'startups', user, currentUserNumericId);
  const connState = connDetail?.state ?? 'none';

  const name = resolveName(profile);

  // ── startup-specific field mapping ───────────────────────────────────────
  const businessModels = toNamedList(profile?.startupBusinessModels);
  const industries = [
    ...toNamedList(profile?.startupIndustries),
    ...toNamedList(profile?.startupOtherIndustries),
  ];
  const technologies = [
    ...toNamedList(profile?.startupTechnologies),
    ...toNamedList(profile?.startupOtherTechnologies),
  ];
  const mentorshipAreas = toNamedList(profile?.mentorshipAreas);

  const targetFundraise = formatCurrencyINR(profile?.financials?.targetFundraise);
  const valuation = formatCurrencyINR(profile?.financials?.tentativeValuation);
  const totalFundRaised = formatCurrencyINR(profile?.financials?.totalFundRaised);
  const fundingStage = profile?.financials?.fundingStage?.name || '';
  const revenueStage = humanizeSnake(profile?.financials?.revenueStage) || '';

  const elevatorPitch = profile?.pitchDeck?.elevatorPitch || profile?.elevatorPitch || '';
  const about = stripHtml(
    profile?.longDescription ||
      profile?.briefDescription ||
      profile?.aboutUs ||
      profile?.shortDescription ||
      profile?.description ||
      '',
  );

  const socialLinks = resolveSocialLinks(profile);
  const founders: any[] = Array.isArray(profile?.founders) ? profile.founders : [];
  const advisoryBoards: any[] = Array.isArray(profile?.advisoryBoards)
    ? profile.advisoryBoards
    : [];

  const programs: any[] = Array.isArray(profile?.programs) ? profile.programs : [];
  const programTitles = programs
    .map((p: any) => p?.programTitle || p?.name || (typeof p === 'string' ? p : ''))
    .filter(Boolean);

  const cdnBases = [
    globalSetting?.imgKitUrl,
    globalSetting?.assetsImgKitUrl,
    globalSetting?.s3Url,
    tenantBaseUrl,
  ];

  return (
    <ProfileShell
      name={name}
      token={token}
      role="startups"
      user={user}
      resolvedUuid={resolvedUuid}
      connDetail={connDetail}
      currentUserId={currentUserId}
      currentUserNumericId={currentUserNumericId}
      currentUserAccountType={currentUserAccountType}
      setConnDetail={setConnDetail}
      primaryColor={primaryColor}
      isApproved={isApproved}
      isLoading={isLoading}
      onBack={onBack}
      onEditProfile={onEditProfile}
      onOpenChat={onOpenChat}>

      {/* Hero */}
      <ProfileHero profile={profile} primaryColor={primaryColor} logoBaseUrl={logoBaseUrl} />

      {isLoading ? (
        <ActivityIndicator color={primaryColor} style={styles.spinner} />
      ) : null}

      {/* Elevator pitch tagline */}
      {elevatorPitch ? (
        <View style={styles.taglineCard}>
          <Text style={styles.taglineText}>"{elevatorPitch}"</Text>
        </View>
      ) : null}

      {/* About */}
      {about ? (
        <SectionCard title="About" primaryColor={primaryColor}>
          <Text style={sStyles.valueText}>{about}</Text>
        </SectionCard>
      ) : null}

      {/* Business Details */}
      {(businessModels.length > 0 || mentorshipAreas.length > 0 || industries.length > 0 || technologies.length > 0) ? (
        <SectionCard title="Business Details" primaryColor={primaryColor}>
          {businessModels.length > 0 ? (
            <View style={sStyles.labelRow}>
              <Text style={sStyles.labelText}>Business Models</Text>
              <ChipList items={businessModels} />
            </View>
          ) : null}
          {mentorshipAreas.length > 0 ? (
            <>
              {businessModels.length > 0 ? <Divider /> : null}
              <View style={sStyles.labelRow}>
                <Text style={sStyles.labelText}>Looking mentorship for?</Text>
                <ChipList items={mentorshipAreas} />
              </View>
            </>
          ) : null}
          {industries.length > 0 ? (
            <>
              {(businessModels.length > 0 || mentorshipAreas.length > 0) ? <Divider /> : null}
              <View style={sStyles.labelRow}>
                <Text style={sStyles.labelText}>Industry Domain</Text>
                <ChipList items={industries} />
              </View>
            </>
          ) : null}
          {technologies.length > 0 ? (
            <>
              {(businessModels.length > 0 || mentorshipAreas.length > 0 || industries.length > 0) ? <Divider /> : null}
              <View style={sStyles.labelRow}>
                <Text style={sStyles.labelText}>Technology Domain</Text>
                <ChipList items={technologies} />
              </View>
            </>
          ) : null}
        </SectionCard>
      ) : null}

      {/* Funding Overview */}
      {(targetFundraise || valuation || fundingStage || revenueStage) ? (
        <SectionCard title="Funding" primaryColor={primaryColor}>
          {targetFundraise ? (
            <>
              <LabelRow label="Raising" value={targetFundraise} />
              {valuation ? <LabelRow label="At Valuation" value={valuation} /> : null}
            </>
          ) : null}
          {fundingStage ? (
            <>
              {targetFundraise ? <Divider /> : null}
              <LabelRow label="Funding Stage" value={fundingStage} />
            </>
          ) : null}
          {revenueStage ? (
            <>
              {(targetFundraise || fundingStage) ? <Divider /> : null}
              <LabelRow label="Revenue Stage" value={revenueStage} />
            </>
          ) : null}
        </SectionCard>
      ) : null}

      {/* Product Information */}
      {(profile?.productInformation?.productStage?.name || profile?.productInformation?.description) ? (
        <SectionCard title="Product Information" primaryColor={primaryColor}>
          {profile.productInformation?.productStage?.name ? (
            <LabelRow label="Product Stage" value={profile.productInformation.productStage.name} />
          ) : null}
          {profile.productInformation?.description ? (
            <>
              <Divider />
              <LabelRow label="Company Brief" value={profile.productInformation.description} />
            </>
          ) : null}
        </SectionCard>
      ) : null}

      {/* Funding Details */}
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
              {totalFundRaised ? <Divider /> : null}
              <LabelRow label="Previous Investors" value={profile.financials.pastFunding} />
            </>
          ) : null}
        </SectionCard>
      ) : null}

      {/* Social Links */}
      {socialLinks.length > 0 ? (
        <SectionCard title="Social Links" primaryColor={primaryColor}>
          <View style={sStyles.socialRow}>
            {socialLinks.map(item => (
              <Pressable
                key={item.key}
                onPress={() => openLink(item.url)}
                accessibilityRole="button"
                accessibilityLabel={item.label}>
                <Icon name={item.icon} size={22} color={primaryColor} />
              </Pressable>
            ))}
          </View>
        </SectionCard>
      ) : null}

      {/* Programs */}
      {programTitles.length > 0 ? (
        <SectionCard title="Programs" primaryColor={primaryColor}>
          <ChipList items={programTitles} />
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
  spinner: {marginTop: 20},
  taglineCard: {
    backgroundColor: '#e0e7ff',
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
  },
  taglineText: {
    color: '#334155',
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 20,
    textAlign: 'center',
  },
});
