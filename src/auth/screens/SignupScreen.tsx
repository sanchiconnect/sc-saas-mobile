import React, {useEffect, useState} from 'react';

import {AuthForm} from '../components/AuthForm';
import {SignupDraft} from '../models/auth.models';

type SignupScreenProps = {
  role: string;
  onContinue: (data: SignupDraft) => void;
  onLogin: () => void;
  isSubmitting?: boolean;
  message?: string;
  messageTone?: 'neutral' | 'success' | 'error';
};

export function SignupScreen({
  role,
  onContinue,
  onLogin,
  isSubmitting = false,
  message,
  messageTone = 'neutral',
}: SignupScreenProps) {
  const [form, setForm] = useState<SignupDraft>({
    companyName: '',
    fullName: '',
    email: '',
    mobile: '',
    role,
    acceptedTerms: true,
  });

  useEffect(() => {
    setForm(current => ({
      ...current,
      role,
    }));
  }, [role]);

  return (
    <AuthForm
      fields={[
        {
          key: 'companyName',
          label: 'Company Name',
          placeholder: 'Enter company name',
          value: form.companyName,
          autoCapitalize: 'none',
          onChangeText: value => setForm({...form, companyName: value}),
        },
        {
          key: 'fullName',
          label: 'Your Name',
          placeholder: 'Enter your name',
          value: form.fullName,
          autoCapitalize: 'none',
          onChangeText: value => setForm({...form, fullName: value}),
        },
        {
          key: 'email',
          label: 'Email',
          placeholder: 'Enter email',
          value: form.email,
          autoCapitalize: 'none',
          onChangeText: value => setForm({...form, email: value}),
          keyboardType: 'email-address',
        },
        {
          key: 'mobile',
          label: 'Mobile Number',
          placeholder: 'Enter mobile',
          value: form.mobile,
          autoCapitalize: 'none',
          onChangeText: value => setForm({...form, mobile: value}),
        },
      ]}
      isSubmitting={isSubmitting}
      message={message}
      messageTone={messageTone}
      title={`Signup as ${role}`}
      subtitle="For registration, please fill in the details below"
      primaryLabel="Send OTP"
      secondaryLabel="Back to Login"
      onPrimaryPress={() => onContinue(form)}
      onSecondaryPress={onLogin}
    />
  );
}
