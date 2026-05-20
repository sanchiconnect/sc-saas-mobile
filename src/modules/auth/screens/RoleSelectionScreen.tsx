import React, {useContext, useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {TenantContext} from '../../../core/tenant/TenantProvider';
import {AppButton} from '../../../core/components/AppButton';
import {Icon} from '../../../core/components/Icon';
import {
  radii,
  shadows,
  spacing,
  typography,
  withAlpha,
} from '../../../core/theme/colors';

type RoleValue =
  | 'startup'
  | 'investor'
  | 'corporate'
  | 'mentor'
  | 'service_provider'
  | 'partner'
  | 'job_seeker'
  | 'program_office'
  | 'individual';

type RoleOption = {
  value: RoleValue;
  label: string;
  icon: string;
  enabled: boolean;
};

type Props = {
  onNext: (selection: {role: RoleValue; investorType?: string}) => void;
  onLogin?: () => void;
};

const investorOptions = [
  {value: 'organization', label: 'Organization', icon: 'office-building'},
  {value: 'individual', label: 'Individual Investor', icon: 'account-cash'},
  {value: 'syndicate', label: 'Syndicate', icon: 'account-group'},
] as const;

const ROLE_ICONS: Record<RoleValue, string> = {
  startup: 'rocket-launch',
  investor: 'cash-multiple',
  corporate: 'office-building',
  mentor: 'account-tie',
  service_provider: 'briefcase',
  partner: 'handshake',
  job_seeker: 'briefcase-search',
  program_office: 'account-group',
  individual: 'account',
};

const toSingular = (value?: string) => {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.endsWith('ies')) return `${text.slice(0, -3)}y`;
  if (text.endsWith('s')) return text.slice(0, -1);
  return text;
};

export function RoleSelectionScreen({onNext, onLogin}: Props) {
  const [selectedRole, setSelectedRole] = useState<RoleValue | null>(null);
  const [selectedInvestorType, setSelectedInvestorType] = useState<
    string | null
  >(null);
  const {globalSetting, theme} = useContext(TenantContext);
  const accent = theme?.primary || '#0f172a';
  const tint = withAlpha(accent, 0.08);

  const roleOptions = useMemo<RoleOption[]>(() => {
    const users = globalSetting?.users || {};
    const features = globalSetting?.features || {};

    const options: RoleOption[] = [
      {
        value: 'startup',
        label: 'Startup',
        icon: ROLE_ICONS.startup,
        enabled: Boolean(users?.startups && users?.startups_registration),
      },
      {
        value: 'investor',
        label: 'Investor',
        icon: ROLE_ICONS.investor,
        enabled: Boolean(users?.investors && users?.investors_registration),
      },
      {
        value: 'corporate',
        label: 'Corporate',
        icon: ROLE_ICONS.corporate,
        enabled: Boolean(users?.corporates && users?.corporates_registration),
      },
      {
        value: 'mentor',
        label: toSingular(features?.mentors_title) || 'Mentor',
        icon: ROLE_ICONS.mentor,
        enabled: Boolean(users?.mentors),
      },
      {
        value: 'service_provider',
        label:
          toSingular(features?.service_providers_title) || 'Service Provider',
        icon: ROLE_ICONS.service_provider,
        enabled: Boolean(
          users?.service_providers && users?.service_providers_registration,
        ),
      },
      {
        value: 'partner',
        label: toSingular(features?.partners_title) || 'Partner',
        icon: ROLE_ICONS.partner,
        enabled: Boolean(users?.partner_registration),
      },
      {
        value: 'job_seeker',
        label: 'Job Seeker',
        icon: ROLE_ICONS.job_seeker,
        enabled: Boolean(users?.job_seekers_registration),
      },
      {
        value: 'program_office',
        label:
          toSingular(features?.program_offices_title) ||
          'Program Office Member',
        icon: ROLE_ICONS.program_office,
        enabled: Boolean(
          users?.program_offices && users?.program_offices_registration,
        ),
      },
      {
        value: 'individual',
        label: toSingular(features?.individuals_title) || 'Individual',
        icon: ROLE_ICONS.individual,
        enabled: Boolean(users?.individuals && users?.individual_registration),
      },
    ];

    const enabledOptions = options.filter(option => option.enabled);
    return enabledOptions.length ? enabledOptions : options;
  }, [globalSetting]);

  const availableInvestorOptions = useMemo(() => {
    const features = globalSetting?.features || {};
    return investorOptions.filter(option => {
      if (option.value === 'individual') {
        return features?.individual_investor !== false;
      }
      if (option.value === 'syndicate') {
        return features?.syndicate !== false;
      }
      return true;
    });
  }, [globalSetting]);

  const canContinue =
    Boolean(selectedRole) &&
    (selectedRole !== 'investor' || Boolean(selectedInvestorType));

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>
        <Pressable
          onPress={onLogin}
          style={styles.backLinkWrap}
          accessibilityLabel="Back to login">
          <Icon name="arrow-left" size={18} color="#475569" />
          <Text style={styles.backText}>
            Already have an account?{' '}
            <Text style={[styles.loginLink, {color: accent}]}>Log in</Text>
          </Text>
        </Pressable>

        <View style={styles.headerWrap}>
          <View style={[styles.stepBadge, {backgroundColor: tint}]}>
            <Text style={[styles.stepText, {color: accent}]}>STEP 1 OF 2</Text>
          </View>
          <Text style={styles.heading}>I am a…</Text>
          <Text style={styles.subheading}>
            Choose the role that best describes you on the platform.
          </Text>
        </View>

        <View style={styles.grid}>
          {roleOptions.map(role => {
            const isSelected = selectedRole === role.value;
            return (
              <Pressable
                key={role.value}
                style={[
                  styles.card,
                  isSelected && {
                    borderColor: accent,
                    backgroundColor: tint,
                  },
                ]}
                onPress={() => {
                  setSelectedRole(role.value);
                  if (role.value !== 'investor') {
                    setSelectedInvestorType(null);
                  }
                }}>
                <View
                  style={[
                    styles.iconBubble,
                    isSelected && {backgroundColor: accent},
                  ]}>
                  <Icon
                    name={role.icon}
                    size={22}
                    color={isSelected ? '#ffffff' : '#475569'}
                  />
                </View>
                <Text
                  style={[
                    styles.cardText,
                    isSelected && {color: accent, fontWeight: '700'},
                  ]}
                  numberOfLines={2}>
                  {role.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {selectedRole === 'investor' ? (
          <View style={styles.investorSection}>
            <Text style={styles.sectionHeading}>Investing as</Text>
            <Text style={styles.sectionSubheading}>
              How do you invest? This shapes the rest of your profile.
            </Text>
            <View style={styles.grid}>
              {availableInvestorOptions.map(option => {
                const isSelected = selectedInvestorType === option.value;
                return (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.card,
                      isSelected && {
                        borderColor: accent,
                        backgroundColor: tint,
                      },
                    ]}
                    onPress={() => setSelectedInvestorType(option.value)}>
                    <View
                      style={[
                        styles.iconBubble,
                        isSelected && {backgroundColor: accent},
                      ]}>
                      <Icon
                        name={option.icon}
                        size={22}
                        color={isSelected ? '#ffffff' : '#475569'}
                      />
                    </View>
                    <Text
                      style={[
                        styles.cardText,
                        isSelected && {color: accent, fontWeight: '700'},
                      ]}
                      numberOfLines={2}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <AppButton
          label="Continue"
          disabled={!canContinue}
          onPress={() =>
            selectedRole &&
            onNext({
              role: selectedRole,
              investorType:
                selectedRole === 'investor'
                  ? selectedInvestorType || undefined
                  : undefined,
            })
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scroll: {
    padding: spacing.xl,
    paddingBottom: spacing.lg,
  },
  backLinkWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  backText: {
    fontSize: typography.body,
    color: '#475569',
  },
  loginLink: {
    fontWeight: '700',
  },
  headerWrap: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  stepBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  stepText: {
    fontSize: typography.caption,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  heading: {
    fontSize: typography.heading,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: spacing.xs,
  },
  subheading: {
    fontSize: typography.body,
    color: '#64748b',
    lineHeight: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  card: {
    width: '47%',
    flexGrow: 1,
    minHeight: 86,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: radii.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: '#ffffff',
    ...shadows.sm,
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    flex: 1,
    fontSize: typography.body,
    fontWeight: '600',
    color: '#0f172a',
  },
  investorSection: {
    marginTop: spacing.xxl,
    gap: spacing.md,
  },
  sectionHeading: {
    fontSize: typography.titleLg,
    fontWeight: '700',
    color: '#0f172a',
  },
  sectionSubheading: {
    fontSize: typography.body,
    color: '#64748b',
    marginBottom: spacing.xs,
  },
  footer: {
    padding: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
});
