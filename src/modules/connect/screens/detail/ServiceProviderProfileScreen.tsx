import React from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';

import {Icon} from '../../../../core/components/Icon';
import {stripHtml} from '../../../chat/utils';
import {
  DetailScreenProps,
  Divider,
  LabelRow,
  ProfileHero,
  ProfileShell,
  SectionCard,
  openLink,
  resolveSocialLinks,
  sStyles,
} from '../../components/profile/SharedProfileUI';
import {useProfileDetail} from '../../hooks/useProfileDetail';
import {resolveName} from '../../utils';

// Response keys specific to the service-provider profile endpoint:
//   GET /api/v1/service-providers/public/service-provider-information/{uuid}
//   GET /api/v1/forms-management/profile/data/service-provider/{uuid}
//
// Web-verified field names (angular template):
//   name, avatar, website (in hero),
//   providerCategory.name, providerType.name,
//   briefDescription, facebookUrl, linkedinUrl, twitterUrl, youtubeUrl, instagramUrl

type Props = DetailScreenProps;

export function ServiceProviderProfileScreen({
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
    useProfileDetail(token, 'service-providers', user, currentUserNumericId);

  const name = resolveName(profile);

  // ── service-provider-specific field mapping ───────────────────────────────

  // Web uses `website` field (not displayWebsite)
  const website = profile?.website || profile?.displayWebsite || profile?.websiteUrl || '';

  // Basic Details
  const providerCategory: string =
    profile?.providerCategory?.name || profile?.providerCategory || '';
  const providerType: string =
    profile?.providerType?.name || profile?.providerType || '';

  // About: web uses briefDescription
  const about = stripHtml(
    profile?.briefDescription ||
      profile?.longDescription ||
      profile?.aboutUs ||
      profile?.shortDescription ||
      profile?.description ||
      '',
  );

  const socialLinks = resolveSocialLinks(profile);

  return (
    <ProfileShell
      name={name}
      token={token}
      role="service-providers"
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

      {/* Hero — website shown as child since field is `website` not `displayWebsite` */}
      <ProfileHero profile={profile} primaryColor={primaryColor} logoBaseUrl={logoBaseUrl}>
        {website ? (
          <Pressable onPress={() => openLink(website)} style={styles.websiteRow}>
            <Icon name="link-variant" size={13} color={primaryColor} />
            <Text style={[styles.websiteText, {color: primaryColor}]} numberOfLines={1}>
              {website}
            </Text>
          </Pressable>
        ) : null}
      </ProfileHero>

      {isLoading ? (
        <ActivityIndicator color={primaryColor} style={styles.spinner} />
      ) : null}

      {/* Basic Details: Provider Category + Provider Type */}
      {(providerCategory || providerType) ? (
        <SectionCard title="Basic Details" primaryColor={primaryColor}>
          {providerCategory ? (
            <LabelRow label="Provider Category" value={providerCategory} />
          ) : null}
          {providerType ? (
            <>
              {providerCategory ? <Divider /> : null}
              <LabelRow label="Provider Type" value={providerType} />
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
  websiteRow: {flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4},
  websiteText: {fontSize: 12, fontWeight: '600', flex: 1},
});
