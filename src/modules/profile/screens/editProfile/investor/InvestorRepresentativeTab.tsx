import React, {forwardRef, useEffect, useImperativeHandle, useRef} from 'react';

import {AppTextField} from '../../../../../core/components/AppTextField';
import {useToast} from '../../../../../core/toast/ToastProvider';
import {useFormValidation} from '../../../../../core/form/useFormValidation';
import {
  combine,
  email,
  mobileNumber,
  required,
  url,
} from '../../../../../core/form/validators';
import {authService} from '../../../../auth/services/auth.service';

import {ProfileTabCard} from '../shared/ProfileTabCard';
import type {SecondaryTabHandle} from '../mentor/MentorDomainExpertiseTab';

type Props = {
  token: string;
  primaryColor: string;
  // The web loads representative data from organization-information under
  // data.representative — pass profileData here so we read from the same source.
  initialData?: Record<string, any> | null;
  onSaveSuccess?: () => void;
  onValidChange?: (valid: boolean) => void;
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
function InvestorRepresentativeTab({token, initialData, onSaveSuccess, onValidChange}: Props, ref) {
  const toast = useToast();

  const form = useFormValidation<FormState>({
    initial: EMPTY,
    validators: {
      personName: required('Represented by'),
      designation: required('Designation'),
      mobileNumber: combine(required('Mobile number'), mobileNumber(7, 15)),
      email: combine(required('Email'), email),
      linkedinUrl: combine(required('LinkedIn profile'), url),
    },
  });

  // Web reads representative data from organization-information → data.representative.
  useEffect(() => {
    if (!initialData) return;
    const rep = initialData?.representative || {};
    form.reset({
      personName: String(rep.personName || ''),
      designation: String(rep.designation || ''),
      mobileNumber: rep.mobileNumber != null ? String(rep.mobileNumber) : '',
      email: String(rep.email || ''),
      linkedinUrl: String(rep.linkedinUrl || ''),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData]);

  // Notify parent when all required fields are filled so the tab dot updates.
  useEffect(() => {
    const v = form.values;
    const valid =
      Boolean(v.personName.trim()) &&
      Boolean(v.designation.trim()) &&
      v.mobileNumber.replace(/\D/g, '').length >= 7 &&
      Boolean(v.email.trim()) &&
      Boolean(v.linkedinUrl.trim());
    onValidChange?.(valid);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values]);

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
    <ProfileTabCard
      title="Representative Details"
      subtitle="The point-of-contact at your organisation. Shown to startups when you connect with them."
    >
      <AppTextField
        label="Represented by"
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
        label="Mobile Number (Whatsapp Preferred)"
        required
        error={form.errors.mobileNumber}
        keyboardType="number-pad"
        value={form.values.mobileNumber}
        onChangeText={t => form.setValue('mobileNumber', t)}
        onBlur={() => form.setTouched('mobileNumber')}
      />
      <AppTextField
        label="Email"
        required
        error={form.errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        value={form.values.email}
        onChangeText={t => form.setValue('email', t)}
        onBlur={() => form.setTouched('email')}
      />
      <AppTextField
        label="LinkedIn Profile"
        required
        error={form.errors.linkedinUrl}
        keyboardType="url"
        autoCapitalize="none"
        value={form.values.linkedinUrl}
        onChangeText={t => form.setValue('linkedinUrl', t)}
        onBlur={() => form.setTouched('linkedinUrl')}
      />
    </ProfileTabCard>
  );
});
