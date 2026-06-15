import React, {forwardRef, useEffect, useImperativeHandle, useRef, useState} from 'react';
import {StyleSheet, Switch, Text, TextInput, View} from 'react-native';

import {useToast} from '../../../../../core/toast/ToastProvider';
import {authService} from '../../../../auth/services/auth.service';

import {MultiSelectField, MultiSelectOption} from '../shared/MultiSelectField';
import {ProfileTabCard} from '../shared/ProfileTabCard';
import type {SecondaryTabHandle} from '../mentor/MentorDomainExpertiseTab';

type Props = {
  token: string;
  primaryColor: string;
  initialData: Record<string, any> | null;
  industryOptions: MultiSelectOption[];
  technologyOptions: MultiSelectOption[];
  onSaveSuccess?: () => void;
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

export const PartnerIndustryTab = forwardRef<SecondaryTabHandle, Props>(
function PartnerIndustryTab({
  token,
  primaryColor,
  initialData,
  industryOptions,
  technologyOptions,
  onSaveSuccess,
}: Props, ref) {
  const toast = useToast();
  const [industries, setIndustries] = useState<Array<number | string>>([]);
  const [technologies, setTechnologies] = useState<Array<number | string>>([]);
  const [otherIndustriesActive, setOtherIndustriesActive] = useState(false);
  const [otherIndustriesText, setOtherIndustriesText] = useState('');
  const [otherTechActive, setOtherTechActive] = useState(false);
  const [otherTechText, setOtherTechText] = useState('');

  useEffect(() => {
    setIndustries(seedIds(initialData, 'industryDomainIds', 'partnerIndustries'));
    setTechnologies(seedIds(initialData, 'technologyDomainIds', 'partnerTechnologies'));
    const oi = seedOthers(initialData, 'otherIndustryDomains');
    setOtherIndustriesActive(oi.active);
    setOtherIndustriesText(oi.text);
    const ot = seedOthers(initialData, 'otherTechnologyDomains');
    setOtherTechActive(ot.active);
    setOtherTechText(ot.text);
  }, [initialData]);

  const onSave = async () => {
    try {
      const splitCsv = (raw: string) =>
        raw.split(',').map(s => s.trim()).filter(Boolean);
      await authService.updateProfile(
        token,
        {
          industryDomainIds: industries.map(Number),
          technologyDomainIds: technologies.map(Number),
          otherIndustryDomains: otherIndustriesActive ? splitCsv(otherIndustriesText) : [],
          otherTechnologyDomains: otherTechActive ? splitCsv(otherTechText) : [],
        },
        'partner',
      );
      toast.success('Industries and technologies saved.');
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
    <ProfileTabCard
      title="Industry / Technology"
      subtitle="The sectors and tech areas your partnership covers."
    >

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
            if (!val) { setOtherIndustriesText(''); }
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
            if (!val) { setOtherTechText(''); }
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
    </ProfileTabCard>
  );
});

const styles = StyleSheet.create({
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
});
