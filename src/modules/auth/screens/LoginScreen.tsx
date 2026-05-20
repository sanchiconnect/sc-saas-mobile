import React from 'react';

import {useFormValidation} from '../../../core/form/useFormValidation';
import {combine, email, required} from '../../../core/form/validators';
import {AuthForm} from '../components/AuthForm';
import {LoginRequestPayload} from '../models/auth.models';

type LoginScreenProps = {
  onLogin: (payload: LoginRequestPayload) => void;
  onSignup: () => void;
  isSubmitting?: boolean;
  message?: string;
  messageTone?: 'neutral' | 'success' | 'error';
};

export function LoginScreen({
  onLogin,
  onSignup,
  isSubmitting = false,
  message,
  messageTone = 'neutral',
}: LoginScreenProps) {
  const form = useFormValidation({
    initial: {email: ''},
    validators: {
      email: combine(required('Email'), email),
    },
  });

  return (
    <AuthForm
      fields={[
        {
          key: 'email',
          label: 'Email address',
          placeholder: 'you@example.com',
          value: form.values.email,
          onChangeText: v => form.setValue('email', v),
          onBlur: () => form.setTouched('email'),
          error: form.errors.email,
          required: true,
          autoCapitalize: 'none',
          keyboardType: 'email-address',
        },
      ]}
      isSubmitting={isSubmitting}
      message={message}
      messageTone={messageTone}
      title="Login"
      subtitle="If you are already registered, enter your email address to receive a login OTP."
      primaryLabel="Send OTP"
      secondaryLabel="Don't have an account? Sign up"
      onPrimaryPress={() =>
        form.handleSubmit(values =>
          onLogin({email: values.email.trim().toLowerCase()}),
        )
      }
      onSecondaryPress={onSignup}
    />
  );
}
