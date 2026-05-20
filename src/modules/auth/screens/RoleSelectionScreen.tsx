import React, {useContext, useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {TenantContext} from '../../../core/tenant/TenantProvider';
import {AppButton} from '../../../core/components/AppButton';

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
  enabled: boolean;
};

type Props = {
  onNext: (selection: {role: RoleValue; investorType?: string}) => void;
  onLogin?: () => void;
};

const investorOptions = [
  {value: 'organization', label: 'Organization'},
  {value: 'individual', label: 'Individual Investor'},
  {value: 'syndicate', label: 'Syndicate'},
] as const;

const toSingular = (value?: string) => {
  const text = String(value || '').trim();

  if (!text) {
    return '';
  }

  if (text.endsWith('ies')) {
    return `${text.slice(0, -3)}y`;
  }

  if (text.endsWith('s')) {
    return text.slice(0, -1);
  }

  return text;
};

export function RoleSelectionScreen({onNext, onLogin}: Props) {
  const [selectedRole, setSelectedRole] = useState<RoleValue | null>(null);
  const [selectedInvestorType, setSelectedInvestorType] = useState<
    string | null
  >(null);
  const {globalSetting} = useContext(TenantContext);

  const roleOptions = useMemo<RoleOption[]>(() => {
    const users = globalSetting?.users || {};
    const features = globalSetting?.features || {};

    const options: RoleOption[] = [
      {
        value: 'startup',
        label: 'Startup',
        enabled: Boolean(users?.startups && users?.startups_registration),
      },
      {
        value: 'investor',
        label: 'Investor',
        enabled: Boolean(users?.investors && users?.investors_registration),
      },
      {
        value: 'corporate',
        label: 'Corporate',
        enabled: Boolean(users?.corporates && users?.corporates_registration),
      },
      {
        value: 'mentor',
        label: toSingular(features?.mentors_title) || 'Mentor',
        enabled: Boolean(users?.mentors),
      },
      {
        value: 'service_provider',
        label:
          toSingular(features?.service_providers_title) || 'Service Provider',
        enabled: Boolean(
          users?.service_providers && users?.service_providers_registration,
        ),
      },
      {
        value: 'partner',
        label: toSingular(features?.partners_title) || 'Partner',
        enabled: Boolean(users?.partner_registration),
      },
      {
        value: 'job_seeker',
        label: 'Job Seeker',
        enabled: Boolean(users?.job_seekers_registration),
      },
      {
        value: 'program_office',
        label:
          toSingular(features?.program_offices_title) ||
          'Program Office Member',
        enabled: Boolean(
          users?.program_offices && users?.program_offices_registration,
        ),
      },
      {
        value: 'individual',
        label: toSingular(features?.individuals_title) || 'Individual',
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
    <SafeAreaProvider style={styles.container}>
      <Pressable onPress={onLogin}>
        <Text style={styles.topLink}>
          {'<-'} Already have an account? <Text style={styles.login}>Login</Text>
        </Text>
      </Pressable>

      <Text style={styles.heading}>I am</Text>

      <View style={styles.grid}>
        {roleOptions.map(role => {
          const isSelected = selectedRole === role.value;

          return (
            <Pressable
              key={role.value}
              style={[styles.card, isSelected ? styles.cardSelected : null]}
              onPress={() => {
                setSelectedRole(role.value);
                if (role.value !== 'investor') {
                  setSelectedInvestorType(null);
                }
              }}>
              <View
                style={[styles.radio, isSelected ? styles.radioSelected : null]}
              />

              <Text style={styles.cardText}>{role.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {selectedRole === 'investor' ? (
        <View style={styles.investorSection}>
          <Text style={styles.sectionHeading}>Investing as</Text>

          <View style={styles.grid}>
            {availableInvestorOptions.map(option => {
              const isSelected = selectedInvestorType === option.value;

              return (
                <Pressable
                  key={option.value}
                  style={[styles.card, isSelected ? styles.cardSelected : null]}
                  onPress={() => setSelectedInvestorType(option.value)}>
                  <View
                    style={[
                      styles.radio,
                      isSelected ? styles.radioSelected : null,
                    ]}
                  />
                  <Text style={styles.cardText}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.footer}>
        <AppButton
          label="CONTINUE"
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
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  topLink: {
    fontSize: 14,
    color: '#334155',
    marginBottom: 20,
  },
  login: {
    fontWeight: '600',
    color: '#0f172a',
  },
  heading: {
    fontSize: 40,
    fontWeight: '700',
    marginBottom: 20,
    color: '#000',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardSelected: {
    borderColor: '#0f172a',
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#cbd5e1',
  },
  radioSelected: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  cardText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0f172a',
    flexShrink: 1,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 20,
  },
  investorSection: {
    marginTop: 16,
  },
  sectionHeading: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 14,
    color: '#0f172a',
  },
});
