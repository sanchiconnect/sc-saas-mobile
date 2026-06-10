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

// Response keys specific to the program-office-team profile endpoint:
//   GET /api/v1/program-office-team/public/program-office-team-information/{uuid}
//   GET /api/v1/forms-management/profile/data/program-office-team/{uuid}

type Props = DetailScreenProps;

export function ProgramOfficeProfileScreen({
  token,
  user,
  primaryColor,
  logoBaseUrl,
  onBack,
  isApproved,
  currentUserId,
}: Props) {
  const {profile, isLoading, connState, setConnState, resolvedUuid} =
    useProfileDetail(token, 'program-office-team', user, currentUserId);

  const name = resolveName(profile);

  // ── program-office-team-specific field mapping ────────────────────────────
  const designation = profile?.designation || profile?.jobTitle || '';
  const expertise = toNamedList(profile?.expertiseAreas || profile?.domainAreas);
  const industries = [
    ...toNamedList(profile?.sectoralInterestSubCategoryIds),
    ...toNamedList(profile?.sectoralInterestIds),
    ...toNamedList(profile?.sectoralInterestOthers),
  ];
  const responsibilities = toNamedList(profile?.responsibilities);

  const about = stripHtml(
    profile?.longDescription ||
      profile?.briefDescription ||
      profile?.aboutUs ||
      profile?.bio ||
      profile?.shortDescription ||
      profile?.description ||
      '',
  );

  const socialLinks = resolveSocialLinks(profile);

  return (
    <ProfileShell
      name={name}
      token={token}
      user={user}
      resolvedUuid={resolvedUuid}
      connState={connState}
      setConnState={setConnState}
      primaryColor={primaryColor}
      isApproved={isApproved}
      onBack={onBack}>

      <ProfileHero profile={profile} primaryColor={primaryColor} logoBaseUrl={logoBaseUrl} />

      {isLoading ? (
        <ActivityIndicator color={primaryColor} style={styles.spinner} />
      ) : null}

      {designation ? (
        <View style={styles.designationCard}>
          <Text style={styles.designation}>{designation}</Text>
        </View>
      ) : null}

      {about ? (
        <SectionCard title="About" primaryColor={primaryColor}>
          <Text style={sStyles.valueText}>{about}</Text>
        </SectionCard>
      ) : null}

      {(expertise.length > 0 || responsibilities.length > 0 || industries.length > 0) ? (
        <SectionCard title="Expertise & Responsibilities" primaryColor={primaryColor}>
          {expertise.length > 0 ? (
            <View style={sStyles.labelRow}>
              <Text style={sStyles.labelText}>Areas of Expertise</Text>
              <ChipList items={expertise} />
            </View>
          ) : null}
          {responsibilities.length > 0 ? (
            <>
              {expertise.length > 0 ? <Divider /> : null}
              <View style={sStyles.labelRow}>
                <Text style={sStyles.labelText}>Responsibilities</Text>
                <ChipList items={responsibilities} />
              </View>
            </>
          ) : null}
          {industries.length > 0 ? (
            <>
              {(expertise.length > 0 || responsibilities.length > 0) ? <Divider /> : null}
              <View style={sStyles.labelRow}>
                <Text style={sStyles.labelText}>Industry Domain</Text>
                <ChipList items={industries} />
              </View>
            </>
          ) : null}
        </SectionCard>
      ) : null}

      {profile?.programName ? (
        <SectionCard title="Program" primaryColor={primaryColor}>
          <LabelRow label="Name of Program" value={profile.programName} />
        </SectionCard>
      ) : null}

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
  designationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
  },
  designation: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
});
