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

// Response keys specific to the service-provider profile endpoint:
//   GET /api/v1/service-providers/public/service-provider-information/{uuid}
//   GET /api/v1/forms-management/profile/data/service-provider/{uuid}

type Props = DetailScreenProps;

export function ServiceProviderProfileScreen({
  token,
  user,
  primaryColor,
  logoBaseUrl,
  onBack,
  isApproved,
  currentUserId,
}: Props) {
  const {profile, isLoading, connState, setConnState, resolvedUuid} =
    useProfileDetail(token, 'service-providers', user, currentUserId);

  const name = resolveName(profile);

  // ── service-provider-specific field mapping ───────────────────────────────
  const serviceTypes = toNamedList(profile?.serviceTypes);
  const specializations = toNamedList(profile?.specializations);
  const industries = [
    ...toNamedList(profile?.sectoralInterestSubCategoryIds),
    ...toNamedList(profile?.sectoralInterestIds),
    ...toNamedList(profile?.sectoralInterestOthers),
  ];
  const connectionRequirements = toNamedList(profile?.connectionRequirements);

  const about = stripHtml(
    profile?.longDescription ||
      profile?.briefDescription ||
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

      {(serviceTypes.length > 0 || specializations.length > 0 || industries.length > 0 || connectionRequirements.length > 0) ? (
        <SectionCard title="Services" primaryColor={primaryColor}>
          {serviceTypes.length > 0 ? (
            <View style={sStyles.labelRow}>
              <Text style={sStyles.labelText}>Service Types</Text>
              <ChipList items={serviceTypes} />
            </View>
          ) : null}
          {specializations.length > 0 ? (
            <>
              {serviceTypes.length > 0 ? <Divider /> : null}
              <View style={sStyles.labelRow}>
                <Text style={sStyles.labelText}>Specializations</Text>
                <ChipList items={specializations} />
              </View>
            </>
          ) : null}
          {industries.length > 0 ? (
            <>
              {(serviceTypes.length > 0 || specializations.length > 0) ? <Divider /> : null}
              <View style={sStyles.labelRow}>
                <Text style={sStyles.labelText}>Industry Domain</Text>
                <ChipList items={industries} />
              </View>
            </>
          ) : null}
          {connectionRequirements.length > 0 ? (
            <>
              {(serviceTypes.length > 0 || specializations.length > 0 || industries.length > 0) ? <Divider /> : null}
              <View style={sStyles.labelRow}>
                <Text style={sStyles.labelText}>Looking to connect with</Text>
                <ChipList items={connectionRequirements} />
              </View>
            </>
          ) : null}
        </SectionCard>
      ) : null}

      {profile?.website ? (
        <SectionCard title="Website" primaryColor={primaryColor}>
          <LabelRow label="Website" value={profile.website} />
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
