import React, {forwardRef, useEffect, useImperativeHandle, useRef, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {AppTextField} from '../../../../core/components/AppTextField';
import {useToast} from '../../../../core/toast/ToastProvider';
import {useFormValidation} from '../../../../core/form/useFormValidation';
import {
  combine,
  email,
  mobileNumber,
  required,
  url,
} from '../../../../core/form/validators';
import {authService} from '../../../auth/services/auth.service';

import type {SecondaryTabHandle} from './MentorDomainExpertiseTab';

type Props = {
  token: string;
  primaryColor: string;
  onSaveSuccess?: () => void;
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

export const InvestorRepresentativeTab = forwardRef<SecondaryTabHandle, Props>(
function InvestorRepresentativeTab({token, primaryColor, onSaveSuccess}: Props, ref) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);

  const form = useFormValidation<FormState>({
    initial: EMPTY,
    validators: {
      personName: required('Full name'),
      designation: required('Designation'),
      mobileNumber: combine(required('Mobile number'), mobileNumber(7, 15)),
      email: combine(required('Email'), email),
      // LinkedIn URL is required per the frontend FormGroup (LINKDIN_URL_REGEX).
      linkedinUrl: combine(required('LinkedIn URL'), url),
    },
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    authService
      .getInvestorRepresentative(token)
      .then(res => {
        if (cancelled) return;
        const data = res?.data || res || {};
        form.reset({
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
          // No representative on file yet — keep empty form.
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const submitNetwork = async (values: FormState) => {
    try {
      await authService.updateInvestorRepresentative(token, {
        personName: values.personName.trim(),
        designation: values.designation.trim(),
        mobileNumber: Number(values.mobileNumber.replace(/\D/g, '')),
        email: values.email.trim(),
        linkedinUrl: values.linkedinUrl.trim(),
      });
      toast.success('Representative details saved.');
      onSaveSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not save representative details.',
      );
    }
  };

  const saveRef = useRef(() => form.handleSubmit(submitNetwork));
  saveRef.current = () => form.handleSubmit(submitNetwork);
  useImperativeHandle(ref, () => ({
    triggerSave: () => { saveRef.current(); return Promise.resolve(); },
  }));

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Representative Details</Text>
      <Text style={styles.subtitle}>
        The point-of-contact at your organisation. Shown to startups when you
        connect with them.
      </Text>

      <AppTextField
        label="Full Name"
        required
        error={form.errors.personName}
        value={form.values.personName}
        onChangeText={t => form.setValue('personName', t)}
        onBlur={() => form.setTouched('personName')}
      />
      <AppTextField
        label="Designation"
        required
        error={form.errors.designation}
        value={form.values.designation}
        onChangeText={t => form.setValue('designation', t)}
        onBlur={() => form.setTouched('designation')}
      />
      <AppTextField
        label="Mobile Number"
        required
        error={form.errors.mobileNumber}
        keyboardType="number-pad"
        value={form.values.mobileNumber}
        onChangeText={t => form.setValue('mobileNumber', t)}
        onBlur={() => form.setTouched('mobileNumber')}
      />
      <AppTextField
        label="Email Address"
        required
        error={form.errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        value={form.values.email}
        onChangeText={t => form.setValue('email', t)}
        onBlur={() => form.setTouched('email')}
      />
      <AppTextField
        label="LinkedIn URL"
        required
        error={form.errors.linkedinUrl}
        keyboardType="url"
        autoCapitalize="none"
        value={form.values.linkedinUrl}
        onChangeText={t => form.setValue('linkedinUrl', t)}
        onBlur={() => form.setTouched('linkedinUrl')}
      />

    </View>
  );
});

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
});
