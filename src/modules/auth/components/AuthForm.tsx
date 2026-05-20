import React, {useContext} from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {AppButton} from '../../../core/components/AppButton';
import {AppCard} from '../../../core/components/AppCard';
import {AppTextField} from '../../../core/components/AppTextField';
import { TenantContext } from '../../../core/tenant/TenantProvider';


type AuthField = {
  key: string;
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  required?: boolean;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
};

type AuthFormProps = {
  title: string;
  subtitle: string;
  primaryLabel: string;
  secondaryLabel: string;
  fields: AuthField[];
  onPrimaryPress: () => void;
  onSecondaryPress: () => void;
  onForgotPasswordPress?: () => void;
  isSubmitting?: boolean;
  message?: string;
  messageTone?: 'neutral' | 'success' | 'error';
};

export function AuthForm({
  title,
  subtitle,
  primaryLabel,
  secondaryLabel,
  fields,
  onPrimaryPress,
  onSecondaryPress,
  isSubmitting = false,
  message,
  messageTone = 'neutral',
}: AuthFormProps) {
  const {theme, globalSetting} = useContext(TenantContext);
  const logoBaseUrl = globalSetting?.imgKitUrl || globalSetting?.assetsImgKitUrl;
  const logoPath = globalSetting?.logo;
  const logoUri =
    logoBaseUrl && logoPath
      ? `${logoBaseUrl.replace(/\/$/, '')}/${logoPath.replace(/^\//, '')}`
      : null;

  const styles = StyleSheet.create({
    page: {
      backgroundColor: '#f8fafc',
      flex: 1,
    },
    scroll: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    logo: {
      alignSelf: 'center',
      width: 132,
      height: 56,
      resizeMode: 'contain',
      marginBottom: 10,
    },
    brandFallback: {
      alignSelf: 'center',
      fontSize: 24,
      fontWeight: '700',
      color: theme?.primary || '#0f172a',
      marginBottom: 10,
    },
    card: {
      gap: 14,
      width: '100%',
    },
    title: {
      color: '#000',
      fontSize: 28,
      fontWeight: '700',
    },
    subtitle: {
      color: '#475569',
      fontSize: 15,
      lineHeight: 22,
      marginBottom: 8,
    },
    message: {
      fontSize: 14,
      lineHeight: 20,
    },
    neutralMessage: {
      color: '#334155',
    },
    successMessage: {
      color: theme?.success || '#15803d',
    },
    errorMessage: {
      color: theme?.danger || '#dc2626',
    },
  });
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.page}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
      <AppCard>
        <View style={styles.card}>
        {logoUri ? (
          <Image source={{uri: logoUri}} style={styles.logo} />
        ) : globalSetting?.brandName ? (
          <Text style={styles.brandFallback}>{globalSetting.brandName}</Text>
        ) : null}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        {fields.map(field => (
          <AppTextField
            autoCapitalize={field.autoCapitalize}
            key={field.key}
            keyboardType={field.keyboardType}
            label={field.label}
            onChangeText={field.onChangeText}
            onBlur={field.onBlur}
            error={field.error}
            required={field.required}
            placeholder={field.placeholder}
            secureTextEntry={field.secureTextEntry}
            value={field.value}
          />
        ))}

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


        <AppButton
          disabled={isSubmitting}
          label={primaryLabel}
          loading={isSubmitting}
          onPress={onPrimaryPress}
        />

        <AppButton
          disabled={isSubmitting}
          label={secondaryLabel}
          onPress={onSecondaryPress}
          variant="secondary"
        />
        </View>
      </AppCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}


