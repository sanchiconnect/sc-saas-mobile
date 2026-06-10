import React from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';

import {Icon} from '../../../../core/components/Icon';
import {stripHtml} from '../../../chat/utils';
import {
  ChipList,
  DetailScreenProps,
  Divider,
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

// Response keys specific to the mentor profile endpoint:
//   GET /api/v1/mentors/public/mentor-information/{uuid}
//   GET /api/v1/forms-management/profile/data/mentor/{uuid}

type Props = DetailScreenProps;

export function MentorProfileScreen({
  token,
  user,
  primaryColor,
  logoBaseUrl,
  onBack,
  isApproved,
  currentUserId,
}: Props) {
  const {profile, isLoading, connState, setConnState, resolvedUuid} =
    useProfileDetail(token, 'mentors', user, currentUserId);

  const name = resolveName(profile);

  // ── mentor-specific field mapping ────────────────────────────────────────
  const expertiseAreas = toNamedList(profile?.domainAreas);
  const mentorshipAreas = toNamedList(profile?.mentorshipAreas);
  const industries = [
    ...toNamedList(profile?.sectoralInterestSubCategoryIds),
    ...toNamedList(profile?.sectoralInterestIds),
    ...toNamedList(profile?.sectoralInterestOthers),
  ];

  const about = stripHtml(
    profile?.longDescription ||
      profile?.briefDescription ||
      profile?.aboutUs ||
      profile?.shortDescription ||
      profile?.description ||
      profile?.bio ||
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

      {about ? (
        <SectionCard title="About" primaryColor={primaryColor}>
          <Text style={sStyles.valueText}>{about}</Text>
        </SectionCard>
      ) : null}

      {(expertiseAreas.length > 0 || mentorshipAreas.length > 0 || industries.length > 0) ? (
        <SectionCard title="Expertise" primaryColor={primaryColor}>
          {expertiseAreas.length > 0 ? (
            <View style={sStyles.labelRow}>
              <Text style={sStyles.labelText}>Domain Areas</Text>
              <ChipList items={expertiseAreas} />
            </View>
          ) : null}
          {mentorshipAreas.length > 0 ? (
            <>
              {expertiseAreas.length > 0 ? <Divider /> : null}
              <View style={sStyles.labelRow}>
                <Text style={sStyles.labelText}>Mentorship Areas</Text>
                <ChipList items={mentorshipAreas} />
              </View>
            </>
          ) : null}
          {industries.length > 0 ? (
            <>
              {(expertiseAreas.length > 0 || mentorshipAreas.length > 0) ? <Divider /> : null}
              <View style={sStyles.labelRow}>
                <Text style={sStyles.labelText}>Industries of Interest</Text>
                <ChipList items={industries} />
              </View>
            </>
          ) : null}
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
});
