import React, {useContext, useEffect, useRef} from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {AppButton} from '../../../core/components/AppButton';
import {AppTextField} from '../../../core/components/AppTextField';
import {TenantContext} from '../../../core/tenant/TenantProvider';
import {useToast} from '../../../core/toast/ToastProvider';

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
  secondaryPrefix?: string;
  fields: AuthField[];
  onPrimaryPress: () => void;
  onSecondaryPress: () => void;
  onForgotPasswordPress?: () => void;
  disabled?: boolean;
  isSubmitting?: boolean;
  message?: string;
  messageTone?: 'neutral' | 'success' | 'error';
};

export function AuthForm({
  title,
  subtitle,
  primaryLabel,
  secondaryLabel,
  secondaryPrefix,
  fields,
  onPrimaryPress,
  onSecondaryPress,
  disabled = false,
  isSubmitting = false,
  message,
  messageTone = 'neutral',
}: AuthFormProps) {
  const {theme, globalSetting} = useContext(TenantContext);
  const toast = useToast();
  const accent = theme?.primary || '#5b5fc7';
  const logoBaseUrl = globalSetting?.imgKitUrl || globalSetting?.assetsImgKitUrl || '';
  const logoPath = globalSetting?.logo;
  const logoUri = logoPath
    ? /^https?:\/\//i.test(logoPath)
      ? logoPath
      : logoBaseUrl
        ? `${logoBaseUrl.replace(/\/$/, '')}/${logoPath.replace(/^\//, '')}`
        : null
    : null;

  const onboardingTitle = globalSetting?.startupOnboardingModal?.titleText;

  const lastShownMessage = useRef<string | null>(null);
  useEffect(() => {
    if (!message || message === lastShownMessage.current) return;
    lastShownMessage.current = message;
    if (messageTone === 'success') toast.success(message);
    else if (messageTone === 'error') toast.error(message);
    else toast.info(message);
  }, [message, messageTone, toast]);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* ── Hero ─────────────────────────────────────────────────── */}
        <View style={styles.hero}>
          {logoUri ? (
            <Image source={{uri: logoUri}} style={styles.logo} resizeMode="contain" />
          ) : globalSetting?.brandName ? (
            <Text style={[styles.heroBrand, {color: accent}]}>
              {globalSetting.brandName}
            </Text>
          ) : null}
          {onboardingTitle ? (
            <Text style={styles.heroTitle}>{onboardingTitle}</Text>
          ) : null}
        </View>

        {/* ── Form sheet ───────────────────────────────────────────── */}
        <View style={styles.sheet}>
          <Text style={styles.formTitle}>{title}</Text>
          <Text style={styles.formSubtitle}>{subtitle}</Text>

          <View style={styles.fields}>
            {fields.map(field => (
              <AppTextField
                key={field.key}
                autoCapitalize={field.autoCapitalize}
                keyboardType={field.keyboardType}
                label={field.label}
                placeholder={field.placeholder}
                value={field.value}
                onChangeText={field.onChangeText}
                onBlur={field.onBlur}
                error={field.error}
                required={field.required}
                secureTextEntry={field.secureTextEntry}
              />
            ))}
          </View>

          <AppButton
            disabled={disabled || isSubmitting}
            label={primaryLabel}
            loading={isSubmitting}
            onPress={onPrimaryPress}
            style={[styles.primaryBtn, {backgroundColor: accent}]}
          />

          <Pressable
            onPress={onSecondaryPress}
            disabled={isSubmitting}
            style={styles.secondaryWrap}
            hitSlop={10}>
            {secondaryPrefix ? (
              <Text style={styles.secondaryPrefix}>
                {secondaryPrefix}{' '}
                <Text style={[styles.secondaryLink, {color: accent}]}>
                  {secondaryLabel}
                </Text>
              </Text>
            ) : (
              <Text style={[styles.secondaryLink, {color: accent}]}>
                {secondaryLabel}
              </Text>
            )}
          </Pressable>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const HERO_BG = '#eef0ff';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: HERO_BG,
  },
  scroll: {
    flexGrow: 1,
  },
  // ── Hero ──────────────────────────────────────────────────────────
  hero: {
    backgroundColor: HERO_BG,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 28,
    gap: 16,
  },
  logo: {
    width: 150,
    height: 56,
  },
  heroBrand: {
    fontSize: 22,
    fontWeight: '800',
  },
  heroTitle: {
    color: '#1e1b4b',
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 32,
  },
  // ── Sheet ─────────────────────────────────────────────────────────
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    flex: 1,
    minHeight: 400,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    gap: 14,
  },
  formTitle: {
    color: '#0f172a',
    fontSize: 26,
    fontWeight: '700',
  },
  formSubtitle: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 19,
  },
  fields: {
    gap: 12,
  },
  primaryBtn: {
    marginTop: 4,
    borderRadius: 10,
  },
  secondaryWrap: {
    alignSelf: 'center',
    marginTop: 4,
    paddingVertical: 8,
  },
  secondaryPrefix: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
  },
  secondaryLink: {
    fontWeight: '700',
    fontSize: 14,
  },
});
