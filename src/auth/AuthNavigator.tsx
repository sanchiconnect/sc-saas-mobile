import React, {useEffect, useState} from 'react';

import {
  AuthSession,
  LoginPayload,
  LoginRequestPayload,
  OtpRequestPayload,
  OtpRequestResult,
  SignupDraft,
  SignupPayload,
} from './models/auth.models';

import {LoginScreen} from './screens/LoginScreen';
import {OtpScreen} from './screens/OtpScreen';
import {RoleSelectionScreen} from './screens/RoleSelectionScreen';
import {SignupScreen} from './screens/SignupScreen';

import {AUTH_SCREENS, AuthScreen} from './types';

type Props = {
  currentScreen: AuthScreen;
  onLogin: (payload: LoginPayload) => Promise<AuthSession>;
  onSignup: (payload: SignupPayload) => Promise<AuthSession>;
  onSendOtp: (payload: OtpRequestPayload) => Promise<OtpRequestResult>;
  onNavigate: (screen: AuthScreen) => void;
};

export function AuthNavigator({
  currentScreen,
  onLogin,
  onSignup,
  onSendOtp,
  onNavigate,
}: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string>();
  const [messageTone, setMessageTone] = useState<
    'neutral' | 'success' | 'error'
  >('neutral');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [signupData, setSignupData] = useState<SignupDraft | null>(null);
  const [loginData, setLoginData] = useState<LoginRequestPayload | null>(null);
  const [otpFlow, setOtpFlow] = useState<'login' | 'signup' | null>(null);

  useEffect(() => {
    setMessage(undefined);
    setMessageTone('neutral');
  }, [currentScreen]);

  const runSubmission = async (action: () => Promise<void>) => {
    try {
      setIsSubmitting(true);
      setMessage(undefined);
      await action();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Something went wrong.',
      );
      setMessageTone('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  switch (currentScreen) {
    case AUTH_SCREENS.ROLE:
      return (
        <RoleSelectionScreen
          onLogin={() => onNavigate(AUTH_SCREENS.LOGIN)}
          onNext={(role: string) => {
            setSelectedRole(role);
            onNavigate(AUTH_SCREENS.SIGNUP);
          }}
        />
      );

    case AUTH_SCREENS.SIGNUP:
      return (
        <SignupScreen
          isSubmitting={isSubmitting}
          message={message}
          messageTone={messageTone}
          role={selectedRole || ''}
          onLogin={() => onNavigate(AUTH_SCREENS.LOGIN)}
          onContinue={data =>
            runSubmission(async () => {
              if (!data.email) {
                throw new Error('Email is required.');
              }

              const payload = {
                ...data,
                role: selectedRole || '',
              };

              setOtpFlow('signup');
              const otpResult = await onSendOtp({
                email: payload.email,
                mobile: payload.mobile,
                type: 'email',
                flow: 'signup',
                fullName: payload.fullName,
              });
              setSignupData({
                ...payload,
                emailVerificationId: otpResult.emailVerificationId,
              });

              setMessage('OTP sent to your email address.');
              setMessageTone('success');
              onNavigate(AUTH_SCREENS.OTP);
            })
          }
        />
      );

    case AUTH_SCREENS.OTP:
      return (
        <OtpScreen
          email={
            otpFlow === 'login'
              ? loginData?.email || ''
              : signupData?.email || ''
          }
          isSubmitting={isSubmitting}
          message={message}
          messageTone={messageTone}
          onLogin={() => onNavigate(AUTH_SCREENS.LOGIN)}
          onResend={() =>
            runSubmission(async () => {
              if (otpFlow === 'login' && loginData?.email) {
                await onSendOtp({
                  email: loginData.email,
                  type: 'email',
                  flow: 'login',
                });
                setMessage('OTP sent again.');
                setMessageTone('success');
                return;
              }

              if (otpFlow === 'signup' && signupData?.email) {
                await onSendOtp({
                  email: signupData.email,
                  mobile: signupData.mobile,
                  type: 'email',
                  flow: 'signup',
                  fullName: signupData.fullName,
                });
                setMessage('OTP sent again.');
                setMessageTone('success');
                return;
              }

              throw new Error('No OTP request is available to resend.');
            })
          }
          onVerify={otp =>
            runSubmission(async () => {
              if (!otp) {
                throw new Error('OTP is required.');
              }

              if (otpFlow === 'login') {
                if (!loginData?.email) {
                  throw new Error('Login email is missing.');
                }

                await onLogin({
                  email: loginData.email,
                  otp,
                });
                return;
              }

              if (!signupData) {
                throw new Error('Signup data is missing.');
              }

              await onSignup({
                ...signupData,
                otp,
              });
            })
          }
        />
      );

    case AUTH_SCREENS.LOGIN:
    default:
      return (
        <LoginScreen
          isSubmitting={isSubmitting}
          message={message}
          messageTone={messageTone}
          onLogin={payload =>
            runSubmission(async () => {
              if (!payload.email) {
                throw new Error('Email is required.');
              }

              setLoginData(payload);
              setOtpFlow('login');

              await onSendOtp({
                email: payload.email,
                type: 'email',
                flow: 'login',
              });

              setMessage('OTP sent to your email address.');
              setMessageTone('success');
              onNavigate(AUTH_SCREENS.OTP);
            })
          }
          onSignup={() => onNavigate(AUTH_SCREENS.ROLE)}
        />
      );
  }
}
