import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {AppButton} from '../../../../core/components/AppButton';
import {authService} from '../../../auth/services/auth.service';

import {MultiSelectField, MultiSelectOption} from './MultiSelectField';

type Props = {
  token: string;
  primaryColor: string;
  initialData: Record<string, any> | null;
  industryOptions: MultiSelectOption[];
  // Cap from tenant config; defaults to the frontend's hard cap of 5.
  maxIndustries?: number;
};

const seedIndustryIds = (
  data: Record<string, any> | null,
): Array<number | string> => {
  const raw =
    (Array.isArray(data?.sectoralInterestIds) && data?.sectoralInterestIds) ||
    (Array.isArray(data?.sectoralInterests) && data?.sectoralInterests) ||
    [];
  return raw
    .map((item: any) => Number(item?.id ?? item))
    .filter((id: number) => Number.isFinite(id));
};

export function ServiceProviderIndustryTab({
  token,
  primaryColor,
  initialData,
  industryOptions,
  maxIndustries = 5,
}: Props) {
  const [industries, setIndustries] = useState<Array<number | string>>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    tone: 'success' | 'error';
  } | null>(null);

  useEffect(() => {
    setIndustries(seedIndustryIds(initialData));
  }, [initialData]);

  const onSave = async () => {
    setMessage(null);
    setSaving(true);
    try {
      await authService.updateProfile(
        token,
        {sectoralInterestIds: industries.map(Number)},
        'service_provider',
      );
      setMessage({text: 'Industries saved.', tone: 'success'});
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
      <Text style={styles.title}>Industry / Vertical Focus</Text>
      <Text style={styles.subtitle}>
        Which sectors do you actively serve?
      </Text>

      <MultiSelectField
        label="Industries"
        hint={`Select up to ${maxIndustries}`}
        options={industryOptions}
        selected={industries}
        primaryColor={primaryColor}
        max={maxIndustries}
        onChange={setIndustries}
        initiallyExpanded
      />

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
