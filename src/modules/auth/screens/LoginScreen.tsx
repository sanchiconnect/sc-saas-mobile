import React, {useState} from 'react';

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
  const [email, setEmail] = useState('');

  return (
    <AuthForm
      fields={[
        {
          key: 'email',
          label: 'Email address',
          placeholder: 'Email address',
          value: email,
          onChangeText: setEmail,
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
      onPrimaryPress={() => onLogin({email: email.trim().toLowerCase()})}
      onSecondaryPress={onSignup}
    />
  );
}
