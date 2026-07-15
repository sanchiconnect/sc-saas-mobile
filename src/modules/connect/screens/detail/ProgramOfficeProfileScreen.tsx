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
import {initials, resolveName} from '../../utils';
import {withAlpha} from '../../../../core/theme/colors';

// Response keys specific to the program-office-team profile endpoint:
//   GET /api/v1/program-office-team/public/program-office-team-information/{uuid}
//   GET /api/v1/forms-management/profile/data/program-office-team/{uuid}
//
// Web-verified field names (angular template):
//   name, avatar,
//   department (Role/Department),
//   designation,
//   keyInterestAreas (Headline),
//   technologies[] (only if domainAreas includes "technology"),
//   partnerDetails { name, partnerType, avatar } (Associated with),
//   shortDescription ("Who should reach out to you?"),
//   briefDescription (About)

type Props = DetailScreenProps;

export function ProgramOfficeProfileScreen({
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
    useProfileDetail(token, 'program-office-team', user, currentUserNumericId);

  const name = resolveName(profile);

  // ── program-office-specific field mapping ─────────────────────────────────

  const department = profile?.department || '';
  const designation = profile?.designation || '';
  const headline = profile?.keyInterestAreas || '';

  // Technology preference — only if a domain area contains "technology"
  const domainNames = toNamedList(profile?.domainAreas).map(s => s.toLowerCase());
  const hasTechDomain = domainNames.some(d => d.includes('technology'));
  const technologies = hasTechDomain ? toNamedList(profile?.technologies) : [];

  // Associated with: partner organization this person belongs to
  const partnerDetails = profile?.partnerDetails || null;

  // "Who should reach out to you?" — shortDescription
  const whoShouldReach = stripHtml(profile?.shortDescription || '');

  // About — briefDescription
  const about = stripHtml(
    profile?.briefDescription ||
      profile?.longDescription ||
      profile?.aboutUs ||
      profile?.description ||
      '',
  );

  const socialLinks = resolveSocialLinks(profile);

  return (
    <ProfileShell
      name={name}
      token={token}
      role="program-office-team"
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

      {/* Role card: Associated with + Department + Designation + Headline */}
      {(partnerDetails || department || designation || headline) ? (
        <SectionCard title="Details" primaryColor={primaryColor}>

          {/* Associated with: partner org (web: partnerDetails) */}
          {partnerDetails ? (
            <View style={styles.partnerRow}>
              {partnerDetails.avatar ? (
                <View style={styles.partnerAvatar}>
                  {/* Simple initials fallback — avoid heavy image import */}
                  <Text style={[styles.partnerInitials, {color: primaryColor}]}>
                    {initials(partnerDetails.name || '?') || '?'}
                  </Text>
                </View>
              ) : (
                <View style={[styles.partnerAvatar, {backgroundColor: withAlpha(primaryColor, 0.15)}]}>
                  <Text style={[styles.partnerInitials, {color: primaryColor}]}>
                    {initials(partnerDetails.name || '?') || '?'}
                  </Text>
                </View>
              )}
              <View style={styles.partnerInfo}>
                <Text style={styles.partnerLabel}>Associated with</Text>
                <Text style={styles.partnerName}>{partnerDetails.name}</Text>
                {partnerDetails.partnerType ? (
                  <Text style={styles.partnerType}>
                    {String(partnerDetails.partnerType).replace(/\b\w/g, c => c.toUpperCase())}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {department ? (
            <>
              {partnerDetails ? <Divider /> : null}
              <LabelRow label="Role / Department" value={department} />
            </>
          ) : null}

          {designation ? (
            <>
              {(partnerDetails || department) ? <Divider /> : null}
              <LabelRow label="Designation" value={designation} />
            </>
          ) : null}

          {headline ? (
            <>
              {(partnerDetails || department || designation) ? <Divider /> : null}
              <LabelRow label="Headline" value={headline} />
            </>
          ) : null}

          {technologies.length > 0 ? (
            <>
              {(partnerDetails || department || designation || headline) ? <Divider /> : null}
              <View style={sStyles.labelRow}>
                <Text style={sStyles.labelText}>Technology preference</Text>
                <ChipList items={technologies} />
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

      {/* Who should reach out to you? (web: shortDescription) */}
      {whoShouldReach ? (
        <SectionCard title="Who should reach out to you?" primaryColor={primaryColor}>
          <Text style={sStyles.valueText}>{whoShouldReach}</Text>
        </SectionCard>
      ) : null}

      {/* About (web: briefDescription) */}
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
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  partnerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerInitials: {
    fontSize: 14,
    fontWeight: '800',
  },
  partnerInfo: {
    flex: 1,
  },
  partnerLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  partnerName: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
  partnerType: {
    color: '#475569',
    fontSize: 12,
    marginTop: 1,
  },
});
