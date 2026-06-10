import React, {forwardRef, useEffect, useImperativeHandle, useRef, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {AppTextField} from '../../../../core/components/AppTextField';
import {Icon} from '../../../../core/components/Icon';
import {useToast} from '../../../../core/toast/ToastProvider';
import {authService} from '../../../auth/services/auth.service';

import {
  MultiSelectField,
  MultiSelectOption,
} from './MultiSelectField';
import {ProfileTabCard} from './ProfileTabCard';

import type {SecondaryTabHandle} from './MentorDomainExpertiseTab';
export type {SecondaryTabHandle};

type Props = {
  token: string;
  primaryColor: string;
  initialData: Record<string, any> | null;
  reasonOptions: MultiSelectOption[];
  onSaveSuccess?: () => void;
};

type FormState = {
  hasInternalInnovationProgram: boolean;
  programName: string;
  totalSupported: string;
  connectWithStartups: boolean;
  connectionRequirements: Array<number | string>;
};

const seedForm = (data: Record<string, any> | null): FormState => ({
  hasInternalInnovationProgram: Boolean(data?.hasInternalInnovationProgram),
  programName: String(data?.programName || ''),
  totalSupported:
    data?.totalSupported != null ? String(data.totalSupported) : '',
  connectWithStartups:
    data?.connectWithStartups !== undefined
      ? Boolean(data.connectWithStartups)
      : true,
  connectionRequirements: Array.isArray(data?.connectionRequirements)
    ? data.connectionRequirements
    : typeof data?.connectionRequirements === 'string'
    ? data.connectionRequirements
        .split(',')
        .map((v: string) => v.trim())
        .filter(Boolean)
    : [],
});

export const CorporateEngagementTab = forwardRef<SecondaryTabHandle, Props>(
function CorporateEngagementTab({
  token,
  primaryColor,
  initialData,
  reasonOptions,
  onSaveSuccess,
}: Props, ref) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(() => seedForm(initialData));

  useEffect(() => {
    setForm(seedForm(initialData));
  }, [initialData]);

  const onSave = async () => {
    try {
      await authService.updateCorporateEngagement(token, {
        hasInternalInnovationProgram: form.hasInternalInnovationProgram,
        programName: form.hasInternalInnovationProgram
          ? form.programName.trim()
          : '',
        totalSupported: form.hasInternalInnovationProgram
          ? Number(form.totalSupported || 0)
          : 0,
        connectWithStartups: form.connectWithStartups,
        connectionRequirements: form.connectionRequirements.join(','),
      });
      toast.success('Engagement details saved.');
      onSaveSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not save engagement details.',
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
      title="Engagement"
      subtitle="How your organisation engages with startups on the platform."
    >

      <View>
        <Text style={styles.fieldLabel}>
          Do you run an internal innovation program?
        </Text>
        <View style={styles.toggleRow}>
          <Pressable
            style={[
              styles.toggle,
              form.hasInternalInnovationProgram && {
                borderColor: primaryColor,
                backgroundColor: `${primaryColor}11`,
              },
            ]}
            onPress={() =>
              setForm(p => ({...p, hasInternalInnovationProgram: true}))
            }>
            <Text style={styles.toggleLabel}>Yes</Text>
          </Pressable>
          <Pressable
            style={[
              styles.toggle,
              !form.hasInternalInnovationProgram && {
                borderColor: primaryColor,
                backgroundColor: `${primaryColor}11`,
              },
            ]}
            onPress={() =>
              setForm(p => ({...p, hasInternalInnovationProgram: false}))
            }>
            <Text style={styles.toggleLabel}>No</Text>
          </Pressable>
        </View>
      </View>

      {form.hasInternalInnovationProgram ? (
        <>
          <AppTextField
            label="Program Name"
            value={form.programName}
            onChangeText={t => setForm(p => ({...p, programName: t}))}
          />
          <AppTextField
            label="Startups Supported (count)"
            keyboardType="number-pad"
            value={form.totalSupported}
            onChangeText={t => setForm(p => ({...p, totalSupported: t}))}
          />
        </>
      ) : null}

      <Pressable
        style={styles.checkRow}
        onPress={() =>
          setForm(p => ({...p, connectWithStartups: !p.connectWithStartups}))
        }>
        <View
          style={[
            styles.checkbox,
            form.connectWithStartups && {
              backgroundColor: primaryColor,
              borderColor: primaryColor,
            },
          ]}>
          {form.connectWithStartups ? (
            <Icon name="check" size={14} color="#ffffff" />
          ) : null}
        </View>
        <Text style={styles.checkLabel}>
          I want to connect with startups on the platform
        </Text>
      </Pressable>

      {reasonOptions.length > 0 ? (
        <MultiSelectField
          label="Why do you want to connect with startups?"
          hint="Select all that apply"
          options={reasonOptions}
          selected={form.connectionRequirements}
          primaryColor={primaryColor}
          onChange={next =>
            setForm(p => ({...p, connectionRequirements: next}))
          }
        />
      ) : null}

    </ProfileTabCard>
  );
});

const styles = StyleSheet.create({
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  toggle: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '600',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkLabel: {
    flex: 1,
    color: '#0f172a',
    fontSize: 14,
  },
});
