import React from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';

import {Icon} from '../../../../core/components/Icon';
import {stripHtml} from '../../../chat/utils';
import {
  ChipList,
  DetailScreenProps,
  Divider,
  LabelRow,
  ProfileHero,
  ProfileShell,
  SectionCard,
  openLink,
  resolveSocialLinks,
  sStyles,
  toNamedList,
} from '../../components/profile/SharedProfileUI';
import {useProfileDetail} from '../../hooks/useProfileDetail';
import {resolveName} from '../../utils';

// Response keys specific to the corporate profile endpoint:
//   GET /api/v1/corporates/public/corporate-information/{uuid}
//   GET /api/v1/forms-management/profile/data/corporate/{uuid}
//
// Web-verified field names (angular template):
//   companyName, companyLogo, size, programName, totalSupported,
//   connectionRequirements (comma-separated string), briefDescription,
//   sectoralInterestIds[], sectoralInterestOthers[],
//   registeredCityR.name, registeredStateR.name, registeredCountryR.name

type Props = DetailScreenProps;

export function CorporateProfileScreen({
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
  const {profile, isLoading, connDetail, setConnDetail, resolvedUuid} =
    useProfileDetail(token, 'corporates', user, currentUserNumericId);

  const name = resolveName(profile);

  // ── corporate-specific field mapping ─────────────────────────────────────

  const companySize = profile?.size || profile?.companySize || '';

  // "Headquartered in" = city + state + country (matches web `get headquaters()`)
  const headquarters = [
    profile?.registeredCityR?.name,
    profile?.registeredStateR?.name,
    profile?.registeredCountryR?.name,
  ]
    .filter(Boolean)
    .join(', ');

  // Industries: top-level sectoralInterestIds (objects with .name) + sectoralInterestOthers (strings)
  const industries = [
    ...toNamedList(profile?.sectoralInterestIds),
    ...toNamedList(profile?.sectoralInterestOthers),
  ];

  const programName = profile?.programName || '';
  const totalSupported =
    profile?.totalSupported != null ? String(profile.totalSupported) : '';

  // connectionRequirements is a comma-separated string on corporate (web: .split(','))
  // toNamedList already handles both string (splits on comma) and array
  const connectionRequirements = toNamedList(profile?.connectionRequirements);

  // About: web uses briefDescription (falls back through standard chain)
  const about = stripHtml(
    profile?.briefDescription ||
      profile?.longDescription ||
      profile?.aboutUs ||
      profile?.shortDescription ||
      profile?.description ||
      '',
  );

  const socialLinks = resolveSocialLinks(profile);

  const hasTopCard = Boolean(companySize || headquarters || industries.length > 0);
  const hasProgramCard = Boolean(programName || totalSupported || connectionRequirements.length > 0);

  return (
    <ProfileShell
      name={name}
      token={token}
      role="corporates"
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

      <ProfileHero profile={profile} primaryColor={primaryColor} logoBaseUrl={logoBaseUrl} />

      {isLoading ? (
        <ActivityIndicator color={primaryColor} style={styles.spinner} />
      ) : null}

      {/* Row 1: Company Size | Headquartered in | Industry Domain */}
      {hasTopCard ? (
        <SectionCard title="Company Details" primaryColor={primaryColor}>
          {companySize ? <LabelRow label="Company Size" value={companySize} /> : null}
          {headquarters ? (
            <>
              {companySize ? <Divider /> : null}
              <LabelRow label="Headquartered in" value={headquarters} />
            </>
          ) : null}
          {industries.length > 0 ? (
            <>
              {(companySize || headquarters) ? <Divider /> : null}
              <View style={sStyles.labelRow}>
                <Text style={sStyles.labelText}>Industry Domain</Text>
                <ChipList items={industries} />
              </View>
            </>
          ) : null}
        </SectionCard>
      ) : null}

      {/* Row 2: Name of Program | Total startups supported | Reason to connect */}
      {hasProgramCard ? (
        <SectionCard title="Program & Engagement" primaryColor={primaryColor}>
          {programName ? <LabelRow label="Name of Program" value={programName} /> : null}
          {totalSupported ? (
            <>
              {programName ? <Divider /> : null}
              <LabelRow label="Total startups supported" value={totalSupported} />
            </>
          ) : null}
          {connectionRequirements.length > 0 ? (
            <>
              {(programName || totalSupported) ? <Divider /> : null}
              <View style={sStyles.labelRow}>
                <Text style={sStyles.labelText}>Reason to connect with startups</Text>
                <ChipList items={connectionRequirements} />
              </View>
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

      {/* About */}
      {about ? (
        <SectionCard title="About" primaryColor={primaryColor}>
          <Text style={sStyles.valueText}>{about}</Text>
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
});
