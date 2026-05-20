import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {AppButton} from '../../../../core/components/AppButton';
import {authService} from '../../../auth/services/auth.service';

import {
  MultiSelectField,
  MultiSelectOption,
} from './MultiSelectField';

type Props = {
  token: string;
  primaryColor: string;
  initialData: Record<string, any> | null;
  industryOptions: MultiSelectOption[];
  technologyOptions: MultiSelectOption[];
  domainAreaOptions: MultiSelectOption[];
  // Caps come from tenant config (globalSettings.mentorMaxIndustries, etc.).
  maxIndustries?: number;
  maxTechnologies?: number;
  maxDomainAreas?: number;
};

const seedSelected = (
  data: Record<string, any> | null,
  primaryKey: string,
  fallbackKey: string,
): Array<number | string> => {
  const raw =
    (Array.isArray(data?.[primaryKey]) && data?.[primaryKey]) ||
    (Array.isArray(data?.[fallbackKey]) && data?.[fallbackKey]) ||
    [];
  return raw
    .map((item: any) => Number(item?.id ?? item))
    .filter((id: number) => Number.isFinite(id));
};

export function MentorDomainExpertiseTab({
  token,
  primaryColor,
  initialData,
  industryOptions,
  technologyOptions,
  domainAreaOptions,
  maxIndustries = 5,
  maxTechnologies = 5,
  maxDomainAreas = 5,
}: Props) {
  const [industries, setIndustries] = useState<Array<number | string>>([]);
  const [technologies, setTechnologies] = useState<Array<number | string>>([]);
  const [domainAreas, setDomainAreas] = useState<Array<number | string>>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    tone: 'success' | 'error';
  } | null>(null);

  useEffect(() => {
    setIndustries(
      seedSelected(initialData, 'sectoralInterestIds', 'sectoralInterests'),
    );
    setTechnologies(seedSelected(initialData, 'technologies', 'technologyIds'));
    setDomainAreas(seedSelected(initialData, 'domainAreas', 'domainAreaIds'));
  }, [initialData]);

  const onSave = async () => {
    setMessage(null);
    setSaving(true);
    try {
      // Mentor info save endpoint same as basic-info; just send the picker IDs.
      await authService.updateProfile(
        token,
        {
          sectoralInterestIds: industries.map(Number),
          technologies: technologies.map(Number),
          domainAreas: domainAreas.map(Number),
        },
        'mentor',
      );
      setMessage({text: 'Domain expertise saved.', tone: 'success'});
    } catch (error) {
      setMessage({
        text:
          error instanceof Error
            ? error.message
            : 'Could not save domain expertise.',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Domain Expertise</Text>
      <Text style={styles.subtitle}>
        The industries, technologies and domain areas you can mentor in.
      </Text>

      <MultiSelectField
        label="Industries"
        hint={`Select up to ${maxIndustries}`}
        options={industryOptions}
        selected={industries}
        primaryColor={primaryColor}
        max={maxIndustries}
        onChange={setIndustries}
      />
      <MultiSelectField
        label="Technologies"
        hint={`Select up to ${maxTechnologies}`}
        options={technologyOptions}
        selected={technologies}
        primaryColor={primaryColor}
        max={maxTechnologies}
        onChange={setTechnologies}
      />
      {domainAreaOptions.length > 0 ? (
        <MultiSelectField
          label="Domain Areas"
          hint={`Select up to ${maxDomainAreas}`}
          options={domainAreaOptions}
          selected={domainAreas}
          primaryColor={primaryColor}
          max={maxDomainAreas}
          onChange={setDomainAreas}
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
