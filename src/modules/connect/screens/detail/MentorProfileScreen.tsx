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

// Response keys specific to the mentor profile endpoint:
//   GET /api/v1/mentors/public/mentor-information/{uuid}
//   GET /api/v1/forms-management/profile/data/mentor/{uuid}
//
// Web-verified field names (angular template):
//   name, avatar, designation, currentOrganization,
//   shortDescription (italic tagline below hero),
//   domainAreas[], domainAreasPrimary[],
//   sectoralInterestIds[], sectoralInterestOthers[],
//   technologies[], briefDescription, websiteUrl,
//   facebookUrl, linkedinUrl, twitterUrl, youtubeUrl, instagramUrl

type Props = DetailScreenProps;

export function MentorProfileScreen({
  token,
  user,
  primaryColor,
  logoBaseUrl,
  onBack,
  isApproved,
  currentUserId,
  onEditProfile,
}: Props) {
  const {profile, isLoading, connState, setConnState, resolvedUuid} =
    useProfileDetail(token, 'mentors', user, currentUserId);

  const name = resolveName(profile);

  // ── mentor-specific field mapping ─────────────────────────────────────────

  const designation = profile?.designation || '';
  const currentOrganization = profile?.currentOrganization || '';

  // Italic tagline shown below the hero card (web: shortDescription)
  const tagline = stripHtml(profile?.shortDescription || '');

  // "Areas of expertise" — domainAreasPrimary (highlighted) + domainAreas
  const expertiseAreas = [
    ...toNamedList(profile?.domainAreasPrimary),
    ...toNamedList(profile?.domainAreas),
  ].filter((v, i, arr) => arr.indexOf(v) === i); // deduplicate

  // Industries label on web: "I would want to be a mentor to startups in the following industries"
  const industries = [
    ...toNamedList(profile?.sectoralInterestIds),
    ...toNamedList(profile?.sectoralInterestOthers),
  ];

  // Technology preference — only shown when a domain area contains "technology"
  const domainNames = toNamedList(profile?.domainAreas).map(s => s.toLowerCase());
  const hasTechDomain = domainNames.some(d => d.includes('technology'));
  const technologies = hasTechDomain ? toNamedList(profile?.technologies) : [];

  // Website: web uses websiteUrl (not displayWebsite)
  const websiteUrl = profile?.websiteUrl || profile?.displayWebsite || '';

  // About: web uses briefDescription
  const about = stripHtml(
    profile?.briefDescription ||
      profile?.longDescription ||
      profile?.aboutUs ||
      profile?.description ||
      profile?.bio ||
      '',
  );

  const socialLinks = resolveSocialLinks(profile);

  const hasExpertiseCard =
    expertiseAreas.length > 0 ||
    industries.length > 0 ||
    technologies.length > 0 ||
    Boolean(websiteUrl);

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
      isLoading={isLoading}
      onBack={onBack}
      currentUserId={currentUserId}
      onEditProfile={onEditProfile}>

      {/* Hero — designation + currentOrganization as children (below location) */}
      <ProfileHero profile={profile} primaryColor={primaryColor} logoBaseUrl={logoBaseUrl}>
        {(designation || currentOrganization) ? (
          <View style={styles.designationRow}>
            <Icon name="office-building-outline" size={13} color="#475569" />
            <Text style={styles.designationText} numberOfLines={2}>
              {[designation, currentOrganization].filter(Boolean).join(', ')}
            </Text>
          </View>
        ) : null}
      </ProfileHero>

      {isLoading ? (
        <ActivityIndicator color={primaryColor} style={styles.spinner} />
      ) : null}

      {/* Italic tagline (web: shortDescription shown below hero) */}
      {tagline ? (
        <View style={styles.taglineCard}>
          <Text style={styles.taglineText}>"{tagline}"</Text>
        </View>
      ) : null}

      {/* Expertise card: Areas of expertise | Industries | Technology | Website */}
      {hasExpertiseCard ? (
        <SectionCard title="Expertise" primaryColor={primaryColor}>
          {expertiseAreas.length > 0 ? (
            <View style={sStyles.labelRow}>
              <Text style={sStyles.labelText}>Areas of expertise</Text>
              <ChipList items={expertiseAreas} />
            </View>
          ) : null}
          {industries.length > 0 ? (
            <>
              {expertiseAreas.length > 0 ? <Divider /> : null}
              <View style={sStyles.labelRow}>
                <Text style={sStyles.labelText}>
                  I would want to be a mentor to startups in the following industries
                </Text>
                <ChipList items={industries} />
              </View>
            </>
          ) : null}
          {technologies.length > 0 ? (
            <>
              {(expertiseAreas.length > 0 || industries.length > 0) ? <Divider /> : null}
              <View style={sStyles.labelRow}>
                <Text style={sStyles.labelText}>Technology preference</Text>
                <ChipList items={technologies} />
              </View>
            </>
          ) : null}
          {websiteUrl ? (
            <>
              {(expertiseAreas.length > 0 || industries.length > 0 || technologies.length > 0) ? <Divider /> : null}
              <LabelRow label="Website" value={websiteUrl} />
            </>
          ) : null}
        </SectionCard>
      ) : null}

      {/* Social links — title: "Connect with me on" (web-exact) */}
      {socialLinks.length > 0 ? (
        <SectionCard title="Connect with me on" primaryColor={primaryColor}>
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
  designationRow: {flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4},
  designationText: {color: '#475569', fontSize: 12, fontWeight: '600', flex: 1},
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
