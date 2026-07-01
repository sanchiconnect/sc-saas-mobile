import React from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';

import {Icon} from '../../../../core/components/Icon';
import {stripHtml} from '../../../chat/utils';
import {
  ChipList,
  DetailScreenProps,
  Divider,
  LabelRow,
  PersonCard,
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

// Response keys specific to the partner profile endpoint:
//   GET /api/v1/partners/public/partner-information/{uuid}
//   GET /api/v1/forms-management/profile/data/partner/{uuid}
//
// Web-verified field names (angular template):
//   name, logo (avatar),
//   tagline (h4 subtitle in hero),
//   shortDescription (italic tagline below hero),
//   partnerType (plain string — titlecase),
//   address, registeredStateR.name, registeredCountryR.name,
//   partnerIndustries[], partnerOtherIndustries[],
//   partnerTechnologies[], partnerOtherTechnologies[],
//   longDescription (About — NOT briefDescription),
//   peopleList[]

type Props = DetailScreenProps;

export function PartnerProfileScreen({
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
    useProfileDetail(token, 'partners', user, currentUserId);

  const name = resolveName(profile);

  // ── partner-specific field mapping ────────────────────────────────────────

  // Tagline shown as subtitle below name in hero
  const tagline = stripHtml(profile?.tagline || '');

  // Italic tagline shown below hero card (web: shortDescription)
  const shortDesc = stripHtml(profile?.shortDescription || '');

  // Partner Type: plain string on web (uses titlecase pipe, not .name)
  const partnerType: string =
    typeof profile?.partnerType === 'string'
      ? profile.partnerType
      : profile?.partnerType?.name || '';

  // Location: address + state + country (web-exact combination)
  const location = [
    profile?.address,
    profile?.registeredStateR?.name,
    profile?.registeredCountryR?.name,
  ]
    .filter(Boolean)
    .join(', ');

  // Tags: partnerIndustries + partnerOtherIndustries + partnerTechnologies + partnerOtherTechnologies
  const tags = [
    ...toNamedList(profile?.partnerIndustries),
    ...toNamedList(profile?.partnerOtherIndustries),
    ...toNamedList(profile?.partnerTechnologies),
    ...toNamedList(profile?.partnerOtherTechnologies),
  ];

  // About: web uses longDescription (not briefDescription)
  const about = stripHtml(
    profile?.longDescription ||
      profile?.briefDescription ||
      profile?.aboutUs ||
      profile?.shortDescription ||
      profile?.description ||
      '',
  );

  const socialLinks = resolveSocialLinks(profile);

  // People list (web: peopleList carousel)
  const peopleList: any[] = Array.isArray(profile?.peopleList) ? profile.peopleList : [];

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

      {/* Hero — tagline as child subtitle (web: h4 below name) */}
      <ProfileHero profile={profile} primaryColor={primaryColor} logoBaseUrl={logoBaseUrl}>
        {tagline ? (
          <Text style={styles.heroTagline}>{tagline}</Text>
        ) : null}
      </ProfileHero>

      {isLoading ? (
        <ActivityIndicator color={primaryColor} style={styles.spinner} />
      ) : null}

      {/* Italic short description below hero (web: shortDescription italic) */}
      {shortDesc ? (
        <View style={styles.taglineCard}>
          <Text style={styles.taglineText}>"{shortDesc}"</Text>
        </View>
      ) : null}

      {/* Details: Partner Type + Location + Tags */}
      {(partnerType || location || tags.length > 0) ? (
        <SectionCard title="Details" primaryColor={primaryColor}>
          {partnerType ? (
            <LabelRow
              label="Partner Type"
              value={partnerType.replace(/\b\w/g, c => c.toUpperCase())}
            />
          ) : null}
          {location ? (
            <>
              {partnerType ? <Divider /> : null}
              <LabelRow label="Location" value={location} />
            </>
          ) : null}
          {tags.length > 0 ? (
            <>
              {(partnerType || location) ? <Divider /> : null}
              <View style={sStyles.labelRow}>
                <Text style={sStyles.labelText}>Tags</Text>
                <ChipList items={tags} />
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

      {/* About: web uses longDescription */}
      {about ? (
        <SectionCard title="About" primaryColor={primaryColor}>
          <Text style={sStyles.valueText}>{about}</Text>
        </SectionCard>
      ) : null}

      {/* People (web: peopleList carousel) */}
      {peopleList.length > 0 ? (
        <SectionCard title="People" primaryColor={primaryColor}>
          <View style={sStyles.peopleGrid}>
            {peopleList.map((p: any, idx: number) => (
              <PersonCard
                key={p.uuid || p.id || idx}
                name={p.name || p.fullName || 'Team member'}
                sub={p.designation || p.role}
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
  heroTagline: {
    color: '#334155',
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 4,
  },
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
