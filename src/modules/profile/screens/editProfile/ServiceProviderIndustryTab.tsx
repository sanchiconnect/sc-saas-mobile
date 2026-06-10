import React, {forwardRef, useEffect, useImperativeHandle, useRef, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {useToast} from '../../../../core/toast/ToastProvider';
import {authService} from '../../../auth/services/auth.service';

import {MultiSelectField, MultiSelectOption} from './MultiSelectField';
import type {SecondaryTabHandle} from './MentorDomainExpertiseTab';

type Props = {
  token: string;
  primaryColor: string;
  initialData: Record<string, any> | null;
  industryOptions: MultiSelectOption[];
  maxIndustries?: number;
  onSaveSuccess?: () => void;
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

export const ServiceProviderIndustryTab = forwardRef<SecondaryTabHandle, Props>(
function ServiceProviderIndustryTab({
  token,
  primaryColor,
  initialData,
  industryOptions,
  maxIndustries = 5,
  onSaveSuccess,
}: Props, ref) {
  const toast = useToast();
  const [industries, setIndustries] = useState<Array<number | string>>([]);

  useEffect(() => {
    setIndustries(seedIndustryIds(initialData));
  }, [initialData]);

  const onSave = async () => {
    try {
      await authService.updateProfile(
        token,
        {sectoralInterestIds: industries.map(Number)},
        'service_provider',
      );
      toast.success('Industries saved.');
      onSaveSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not save industries.',
      );
    }
  };

  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  useImperativeHandle(ref, () => ({
    triggerSave: () => saveRef.current(),
  }));

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
    </View>
  );
});

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
});
