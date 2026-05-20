import React, {useContext, useEffect, useRef, useState} from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {AppButton} from '../../../core/components/AppButton';
import {AppCard} from '../../../core/components/AppCard';
import {TenantContext} from '../../../core/tenant/TenantProvider';
import {useToast} from '../../../core/toast/ToastProvider';
import {radii, shadows, spacing, typography} from '../../../core/theme/colors';

type Props = {
  email: string;
  onVerify: (otp: string) => void;
  onResend?: () => void;
  onLogin: () => void;
  isSubmitting?: boolean;
  message?: string;
  messageTone?: 'neutral' | 'success' | 'error';
};

export function OtpScreen({
  email,
  onVerify,
  onResend,
  onLogin,
  isSubmitting = false,
  message,
  messageTone = 'neutral',
}: Props) {
  const [otp, setOtp] = useState(['', '', '', '']);
  const [focusIndex, setFocusIndex] = useState(0);
  const inputs = useRef<Array<TextInput | null>>([]);
  const {globalSetting, theme} = useContext(TenantContext);
  const toast = useToast();
  const accent = theme?.primary || '#0f172a';

  // Surface backend messages as a Toast — feels much more polished than the
  // small green/red inline text. Triggered any time `message` prop changes.
  const lastShownMessage = useRef<string | null>(null);
  useEffect(() => {
    if (!message || message === lastShownMessage.current) return;
    lastShownMessage.current = message;
    if (messageTone === 'success') toast.success(message);
    else if (messageTone === 'error') toast.error(message);
    else toast.info(message);
  }, [message, messageTone, toast]);

  // Resend cooldown — 30s after each tap. Prevents abusive resends and gives
  // the user a clear sense of "wait, the code is on its way."
  const [resendCooldown, setResendCooldown] = useState(0);
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [resendCooldown]);
  const canResend = resendCooldown === 0 && !isSubmitting;
  const handleResend = () => {
    if (!canResend) return;
    setResendCooldown(30);
    onResend?.();
  };

  const logoBaseUrl = globalSetting?.imgKitUrl || globalSetting?.assetsImgKitUrl;
  const logoPath = globalSetting?.logo;
  const logoUri =
    logoBaseUrl && logoPath
      ? `${logoBaseUrl.replace(/\/$/, '')}/${logoPath.replace(/^\//, '')}`
      : null;

  const handleChange = (value: string, index: number) => {
    if (!/^\d*$/.test(value)) return;

    // Handle paste (multiple digits)
    if (value.length > 1) {
      const otpArray = value.slice(0, 4).split('');
      const padded = [
        otpArray[0] || '',
        otpArray[1] || '',
        otpArray[2] || '',
        otpArray[3] || '',
      ];
      setOtp(padded);
      inputs.current[3]?.focus();
      setFocusIndex(3);
      return;
    }

    const nextOtp = [...otp];
    nextOtp[index] = value;
    setOtp(nextOtp);

    if (value && index < nextOtp.length - 1) {
      setTimeout(() => {
        inputs.current[index + 1]?.focus();
      }, 50);
    }
  };

  const handleBackspace = (index: number) => {
    if (!otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const finalOtp = otp.join('');
  const canVerify = finalOtp.length === 4 && !isSubmitting;

  const maskEmail = (currentEmail: string) => {
    const [name = '', domain = ''] = currentEmail.split('@');
    if (!name || !domain) return currentEmail;
    return `${name.slice(0, 2)}****@${domain}`;
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.page}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled">
        <AppCard>
          <View style={styles.container}>
            {logoUri ? (
              <Image source={{uri: logoUri}} style={styles.logo} />
            ) : null}

            <View style={styles.headerWrap}>
              <Text style={styles.title}>Verify your OTP</Text>
              <Text style={styles.subtitle}>
                We sent a 4-digit code to
              </Text>
              <Text style={styles.email}>{maskEmail(email)}</Text>
            </View>

            <View style={styles.otpContainer}>
              {otp.map((digit, index) => {
                const isFilled = digit.length > 0;
                const isFocused = focusIndex === index;
                return (
                  <TextInput
                    key={index}
                    ref={ref => {
                      if (ref) inputs.current[index] = ref;
                    }}
                    style={[
                      styles.otpInput,
                      isFilled && {
                        backgroundColor: '#ffffff',
                        borderColor: accent,
                        color: accent,
                      },
                      isFocused &&
                        !isFilled && {
                          backgroundColor: '#ffffff',
                          borderColor: accent,
                        },
                    ]}
                    keyboardType="number-pad"
                    maxLength={1}
                    value={digit}
                    autoFocus={index === 0}
                    textContentType="oneTimeCode"
                    importantForAutofill="yes"
                    onFocus={() => setFocusIndex(index)}
                    onChangeText={text => handleChange(text, index)}
                    onKeyPress={({nativeEvent}) => {
                      if (nativeEvent.key === 'Backspace') {
                        handleBackspace(index);
                      }
                    }}
                  />
                );
              })}
            </View>

            <AppButton
              label="Verify OTP"
              disabled={!canVerify}
              loading={isSubmitting}
              onPress={() => onVerify(finalOtp)}
            />

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Didn't get the code?{' '}
                <Text
                  style={[
                    styles.resendLink,
                    {color: canResend ? accent : '#94a3b8'},
                  ]}
                  onPress={handleResend}>
                  {canResend ? 'Resend' : `Resend in ${resendCooldown}s`}
                </Text>
              </Text>
            </View>

            <Pressable onPress={onLogin} style={styles.backLinkWrap}>
              <Text style={[styles.backLink, {color: accent}]}>
                ← Back to Login
              </Text>
            </Pressable>
          </View>
        </AppCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  container: {
    gap: spacing.lg,
  },
  logo: {
    alignSelf: 'center',
    width: 140,
    height: 60,
    resizeMode: 'contain',
    marginBottom: spacing.sm,
  },
  headerWrap: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    fontSize: typography.heading,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  subtitle: {
    color: '#64748b',
    fontSize: typography.body,
    textAlign: 'center',
  },
  email: {
    fontWeight: '600',
    color: '#0f172a',
    fontSize: typography.bodyLg,
    marginTop: 2,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginVertical: spacing.sm,
  },
  otpInput: {
    width: 64,
    height: 68,
    borderRadius: radii.lg,
    backgroundColor: '#f1f5f9',
    borderWidth: 1.5,
    borderColor: 'transparent',
    textAlign: 'center',
    fontSize: 26,
    fontWeight: '700',
    color: '#0f172a',
    ...shadows.sm,
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  footerText: {
    color: '#64748b',
    fontSize: typography.body,
  },
  resendLink: {
    fontWeight: '700',
  },
  backLinkWrap: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
  },
  backLink: {
    fontSize: typography.body,
    fontWeight: '600',
  },
});

