import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,

} from 'react-native';
import { AppButton } from '../../shared/components/AppButton';
import { SafeAreaProvider } from 'react-native-safe-area-context';
type Role =
  | 'Startup'
  | 'Investor'
  | 'Corporate'
  | 'Mentor'
  | 'Service Provider'
  | 'Partner'
  | 'Individual';

const roles: Role[] = [
  'Startup',
  'Investor',
  'Corporate',
  'Mentor',
  'Service Provider',
  'Partner',
  'Individual',
];

type Props = {
  onNext: (role: Role) => void;
  onLogin?: () => void;
};

export function RoleSelectionScreen({ onNext, onLogin }: Props) {
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  return (
    <SafeAreaProvider style={styles.container}>
      {/* Top link */}
      <Pressable onPress={onLogin}>
        <Text style={styles.topLink}>
          ← Already have an account? <Text style={styles.login}>Login</Text>
        </Text>
      </Pressable>

      {/* Heading */}
      <Text style={styles.heading}>I am</Text>

      {/* Grid */}
      <View style={styles.grid}>
        {roles.map(role => {
          const isSelected = selectedRole === role;

          return (
            <Pressable
              key={role}
              style={[
                styles.card,
                isSelected && styles.cardSelected,
              ]}
              onPress={() => setSelectedRole(role)}
            >
              {/* Radio */}
              <View
                style={[
                  styles.radio,
                  isSelected && styles.radioSelected,
                ]}
              />

              <Text style={styles.cardText}>{role}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Button */}
      <View style={styles.footer}>
        <AppButton
          label="CONTINUE"
          disabled={!selectedRole}
          onPress={() => selectedRole && onNext(selectedRole)}
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
    borderColor: '#cbd5f5',
  },

  radioSelected: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },

  cardText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0f172a',
  },

  footer: {
    marginTop: 'auto',
    paddingTop: 20,
  },
});