import React, {useEffect, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {AppButton} from '../../../../core/components/AppButton';
import {AppTextField} from '../../../../core/components/AppTextField';
import {Icon} from '../../../../core/components/Icon';
import {authService} from '../../../auth/services/auth.service';

import {
  MultiSelectField,
  MultiSelectOption,
} from './MultiSelectField';

type Props = {
  token: string;
  primaryColor: string;
  initialData: Record<string, any> | null;
  // Reasons-to-connect options sourced from globalSettings.features in the
  // frontend. If the tenant hasn't configured a list, we render an empty array.
  reasonOptions: MultiSelectOption[];
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

export function CorporateEngagementTab({
  token,
  primaryColor,
  initialData,
  reasonOptions,
}: Props) {
  const [form, setForm] = useState<FormState>(() => seedForm(initialData));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    tone: 'success' | 'error';
  } | null>(null);

  useEffect(() => {
    setForm(seedForm(initialData));
  }, [initialData]);

  const onSave = async () => {
    setMessage(null);
    setSaving(true);
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
        // Frontend sends as comma-separated string.
        connectionRequirements: form.connectionRequirements.join(','),
      });
      setMessage({text: 'Engagement details saved.', tone: 'success'});
    } catch (error) {
      setMessage({
        text:
          error instanceof Error
            ? error.message
            : 'Could not save engagement details.',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Engagement</Text>
      <Text style={styles.subtitle}>
        How your organisation engages with startups on the platform.
      </Text>

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
