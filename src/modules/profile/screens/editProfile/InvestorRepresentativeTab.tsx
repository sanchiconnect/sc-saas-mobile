import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {AppButton} from '../../../../core/components/AppButton';
import {AppTextField} from '../../../../core/components/AppTextField';
import {authService} from '../../../auth/services/auth.service';

type Props = {
  token: string;
  primaryColor: string;
};

type FormState = {
  personName: string;
  designation: string;
  mobileNumber: string;
  email: string;
  linkedinUrl: string;
};

const EMPTY: FormState = {
  personName: '',
  designation: '',
  mobileNumber: '',
  email: '',
  linkedinUrl: '',
};

export function InvestorRepresentativeTab({token, primaryColor}: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    tone: 'success' | 'error';
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    authService
      .getInvestorRepresentative(token)
      .then(res => {
        if (cancelled) return;
        const data = res?.data || res || {};
        setForm({
          personName: String(data.personName || ''),
          designation: String(data.designation || ''),
          mobileNumber:
            data.mobileNumber != null ? String(data.mobileNumber) : '',
          email: String(data.email || ''),
          linkedinUrl: String(data.linkedinUrl || ''),
        });
      })
      .catch(() => {
        if (!cancelled) {
          // Treat "no representative on file yet" as empty form.
          setForm(EMPTY);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const onSave = async () => {
    setMessage(null);
    setSaving(true);
    try {
      await authService.updateInvestorRepresentative(token, {
        personName: form.personName.trim(),
        designation: form.designation.trim(),
        mobileNumber: form.mobileNumber.trim()
          ? Number(form.mobileNumber.trim())
          : undefined,
        email: form.email.trim(),
        linkedinUrl: form.linkedinUrl.trim(),
      });
      setMessage({text: 'Representative details saved.', tone: 'success'});
    } catch (error) {
      setMessage({
        text:
          error instanceof Error
            ? error.message
            : 'Could not save representative details.',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Representative Details</Text>
      <Text style={styles.subtitle}>
        The point-of-contact at your organisation. Shown to startups when you
        connect with them.
      </Text>

      <AppTextField
        label="Full Name"
        value={form.personName}
        onChangeText={t => setForm(p => ({...p, personName: t}))}
      />
      <AppTextField
        label="Designation"
        value={form.designation}
        onChangeText={t => setForm(p => ({...p, designation: t}))}
      />
      <AppTextField
        label="Mobile Number"
        keyboardType="number-pad"
        value={form.mobileNumber}
        onChangeText={t => setForm(p => ({...p, mobileNumber: t}))}
      />
      <AppTextField
        label="Email Address"
        keyboardType="email-address"
        autoCapitalize="none"
        value={form.email}
        onChangeText={t => setForm(p => ({...p, email: t}))}
      />
      <AppTextField
        label="LinkedIn URL"
        keyboardType="url"
        autoCapitalize="none"
        value={form.linkedinUrl}
        onChangeText={t => setForm(p => ({...p, linkedinUrl: t}))}
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
        label={loading ? 'Loading…' : saving ? 'Saving…' : 'Save'}
        disabled={loading || saving}
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
    gap: 14,
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
