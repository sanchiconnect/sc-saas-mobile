import React, {useEffect, useState} from 'react';
import {StyleSheet, Switch, Text, TextInput, View} from 'react-native';

import {AppButton} from '../../../../core/components/AppButton';
import {authService} from '../../../auth/services/auth.service';

import {MultiSelectField, MultiSelectOption} from './MultiSelectField';

type Props = {
  token: string;
  primaryColor: string;
  initialData: Record<string, any> | null;
  industryOptions: MultiSelectOption[];
  technologyOptions: MultiSelectOption[];
};

const seedIds = (
  data: Record<string, any> | null,
  ...keys: string[]
): Array<number | string> => {
  for (const k of keys) {
    if (Array.isArray(data?.[k])) {
      return data![k]
        .map((item: any) => Number(item?.id ?? item))
        .filter((n: number) => Number.isFinite(n));
    }
  }
  return [];
};

const seedOthers = (
  data: Record<string, any> | null,
  ...keys: string[]
): {active: boolean; text: string} => {
  for (const k of keys) {
    if (Array.isArray(data?.[k])) {
      const arr = data![k].filter(Boolean);
      return {active: arr.length > 0, text: arr.join(',')};
    }
  }
  return {active: false, text: ''};
};

export function PartnerIndustryTab({
  token,
  primaryColor,
  initialData,
  industryOptions,
  technologyOptions,
}: Props) {
  const [industries, setIndustries] = useState<Array<number | string>>([]);
  const [technologies, setTechnologies] = useState<Array<number | string>>([]);
  const [otherIndustriesActive, setOtherIndustriesActive] = useState(false);
  const [otherIndustriesText, setOtherIndustriesText] = useState('');
  const [otherTechActive, setOtherTechActive] = useState(false);
  const [otherTechText, setOtherTechText] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    tone: 'success' | 'error';
  } | null>(null);

  useEffect(() => {
    setIndustries(
      seedIds(initialData, 'industryDomainIds', 'partnerIndustries'),
    );
    setTechnologies(
      seedIds(initialData, 'technologyDomainIds', 'partnerTechnologies'),
    );
    const oi = seedOthers(initialData, 'otherIndustryDomains');
    setOtherIndustriesActive(oi.active);
    setOtherIndustriesText(oi.text);
    const ot = seedOthers(initialData, 'otherTechnologyDomains');
    setOtherTechActive(ot.active);
    setOtherTechText(ot.text);
  }, [initialData]);

  const onSave = async () => {
    setMessage(null);
    setSaving(true);
    try {
      const splitCsv = (raw: string) =>
        raw
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
      await authService.updateProfile(
        token,
        {
          industryDomainIds: industries.map(Number),
          technologyDomainIds: technologies.map(Number),
          otherIndustryDomains: otherIndustriesActive
            ? splitCsv(otherIndustriesText)
            : [],
          otherTechnologyDomains: otherTechActive
            ? splitCsv(otherTechText)
            : [],
        },
        'partner',
      );
      setMessage({text: 'Industries and technologies saved.', tone: 'success'});
    } catch (error) {
      setMessage({
        text:
          error instanceof Error
            ? error.message
            : 'Could not save industries.',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Industry / Technology</Text>
      <Text style={styles.subtitle}>
        The sectors and tech areas your partnership covers.
      </Text>

      <MultiSelectField
        label="Industries"
        options={industryOptions}
        selected={industries}
        primaryColor={primaryColor}
        onChange={setIndustries}
        initiallyExpanded
      />

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Add other industries</Text>
        <Switch
          value={otherIndustriesActive}
          onValueChange={val => {
            setOtherIndustriesActive(val);
            if (!val) setOtherIndustriesText('');
          }}
          trackColor={{false: '#cbd5e1', true: `${primaryColor}55`}}
          thumbColor={otherIndustriesActive ? primaryColor : '#f1f5f9'}
        />
      </View>
      {otherIndustriesActive ? (
        <TextInput
          style={styles.input}
          value={otherIndustriesText}
          onChangeText={setOtherIndustriesText}
          placeholder="Separate multiple entries with commas"
          placeholderTextColor="#94a3b8"
          autoCapitalize="words"
        />
      ) : null}

      <MultiSelectField
        label="Technologies"
        options={technologyOptions}
        selected={technologies}
        primaryColor={primaryColor}
        onChange={setTechnologies}
      />

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Add other technologies</Text>
        <Switch
          value={otherTechActive}
          onValueChange={val => {
            setOtherTechActive(val);
            if (!val) setOtherTechText('');
          }}
          trackColor={{false: '#cbd5e1', true: `${primaryColor}55`}}
          thumbColor={otherTechActive ? primaryColor : '#f1f5f9'}
        />
      </View>
      {otherTechActive ? (
        <TextInput
          style={styles.input}
          value={otherTechText}
          onChangeText={setOtherTechText}
          placeholder="Separate multiple entries with commas"
          placeholderTextColor="#94a3b8"
          autoCapitalize="words"
        />
      ) : null}

      {message ? (
        <Text
          style={[
            styles.message,
            message.tone === 'success'
              ? styles.messageSuccess
              : styles.messageError,
          ]}>
          {message.text}
        </Text>
      ) : null}

      <AppButton
        label={saving ? 'Saving…' : 'Save'}
        disabled={saving}
        loading={saving}
        onPress={onSave}
        style={{backgroundColor: primaryColor}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    gap: 16,
    marginBottom: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  toggleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  toggleLabel: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 10,
    borderWidth: 1,
    color: '#0f172a',
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
  },
  messageSuccess: {
    color: '#15803d',
  },
  messageError: {
    color: '#dc2626',
  },
});
