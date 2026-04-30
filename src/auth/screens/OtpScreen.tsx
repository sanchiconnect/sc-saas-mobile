import React, {useContext, useRef, useState} from 'react';
import {Image, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';

import {AppButton} from '../../shared/components/AppButton';
import {AppCard} from '../../shared/components/AppCard';
import {TenantContext} from '../../context/TenantProvider';

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
  const inputs = useRef<Array<TextInput | null>>([]);
  const {globalSetting} = useContext(TenantContext);
  const logoBaseUrl = globalSetting?.imgKitUrl || globalSetting?.assetsImgKitUrl;
  const logoPath = globalSetting?.logo;
  const logoUri =
    logoBaseUrl && logoPath
      ? `${logoBaseUrl.replace(/\/$/, '')}/${logoPath.replace(/^\//, '')}`
      : null;

  const handleChange = (value: string, index: number) => {
    if (!/^[0-9]?$/.test(value)) {
      return;
    }

    const nextOtp = [...otp];
    nextOtp[index] = value;
    setOtp(nextOtp);

    if (value && index < nextOtp.length - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleBackspace = (index: number) => {
    if (!otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const finalOtp = otp.join('');

  const maskEmail = (currentEmail: string) => {
    const [name = '', domain = ''] = currentEmail.split('@');

    if (!name || !domain) {
      return currentEmail;
    }

    return `${name.slice(0, 2)}****@${domain}`;
  };

  return (
    <View style={styles.page}>
      <AppCard>
        <View style={styles.container}>
          {logoUri ? <Image source={{uri: logoUri}} style={styles.logo} /> : null}
          <Text style={styles.title}>Verify your OTP</Text>

          <Text style={styles.subtitle}>
            Enter the 4 digit verification code sent to your email
          </Text>

          <Text style={styles.email}>{maskEmail(email)}</Text>

          {message ? (
            <Text
              style={[
                styles.message,
                messageTone === 'error'
                  ? styles.errorMessage
                  : messageTone === 'success'
                    ? styles.successMessage
                    : styles.neutralMessage,
              ]}>
              {message}
            </Text>
          ) : null}

          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={ref => {
                  inputs.current[index] = ref;
                }}
                style={[styles.otpInput, digit ? styles.otpActive : null]}
                keyboardType="number-pad"
                maxLength={1}
                value={digit}
                onChangeText={text => handleChange(text, index)}
                onKeyPress={({nativeEvent}) => {
                  if (nativeEvent.key === 'Backspace') {
                    handleBackspace(index);
                  }
                }}
              />
            ))}
          </View>

          <AppButton
            label="Verify OTP"
            disabled={finalOtp.length !== 4 || isSubmitting}
            loading={isSubmitting}
            onPress={() => onVerify(finalOtp)}
          />

          <View style={styles.footer}>
            <Text style={styles.text}>
              Didn't get the code?{' '}
              <Text style={styles.link} onPress={onResend}>
                Resend
              </Text>
            </Text>
          </View>

          <Pressable onPress={onLogin}>
            <Text style={styles.link}>Back to Login</Text>
          </Pressable>
        </View>
      </AppCard>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    padding: 24,
  },
  container: {
    gap: 16,
  },
  logo: {
    alignSelf: 'center',
    width: 132,
    height: 56,
    resizeMode: 'contain',
    marginBottom: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    color: '#000',
  },
  subtitle: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 14,
  },
  email: {
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 10,
  },
  message: {
    textAlign: 'center',
    fontSize: 14,
  },
  neutralMessage: {
    color: '#334155',
  },
  successMessage: {
    color: '#15803d',
  },
  errorMessage: {
    color: '#dc2626',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 20,
  },
  otpInput: {
    width: 55,
    height: 55,
    borderRadius: 10,
    backgroundColor: '#e5e7eb',
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '600',
  },
  otpActive: {
    borderWidth: 1,
    borderColor: '#a16207',
    backgroundColor: '#fff',
  },
  footer: {
    alignItems: 'center',
    marginTop: 10,
  },
  text: {
    color: '#64748b',
  },
  link: {
    color: '#a16207',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 20,
  },
});
