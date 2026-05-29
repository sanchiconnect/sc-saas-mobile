import React, {useContext, useEffect, useRef} from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {AppButton} from '../../../core/components/AppButton';
import {AppCard} from '../../../core/components/AppCard';
import {AppTextField} from '../../../core/components/AppTextField';
import {FormScrollView} from '../../../core/components/FormScrollView';
import {TenantContext} from '../../../core/tenant/TenantProvider';
import {useToast} from '../../../core/toast/ToastProvider';
import {spacing, typography} from '../../../core/theme/colors';

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
  // Secondary action is rendered as a subtle text link below the primary
  // button, NOT as a full-width button. The pattern is "<prefix> <link>",
  // e.g. "Don't have an account?  Sign up". Trim the secondaryLabel and
  // optionally split via `secondaryPrefix` to drive the visual hierarchy.
  secondaryLabel: string;
  secondaryPrefix?: string;
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
  secondaryPrefix,
  fields,
  onPrimaryPress,
  onSecondaryPress,
  isSubmitting = false,
  message,
  messageTone = 'neutral',
}: AuthFormProps) {
  const {theme, globalSetting} = useContext(TenantContext);
  const toast = useToast();
  const accent = theme?.primary || '#0f172a';
  const logoBaseUrl = globalSetting?.imgKitUrl || globalSetting?.assetsImgKitUrl;
  const logoPath = globalSetting?.logo;
  const logoUri =
    logoBaseUrl && logoPath
      ? `${logoBaseUrl.replace(/\/$/, '')}/${logoPath.replace(/^\//, '')}`
      : null;

  // Surface backend messages via Toast. Inline status text under the form
  // looks amateur next to a real toast.
  const lastShownMessage = useRef<string | null>(null);
  useEffect(() => {
    if (!message || message === lastShownMessage.current) return;
    lastShownMessage.current = message;
    if (messageTone === 'success') toast.success(message);
    else if (messageTone === 'error') toast.error(message);
    else toast.info(message);
  }, [message, messageTone, toast]);

  return (
    <FormScrollView
      style={styles.page}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}>
        <AppCard>
          <View style={styles.card}>
            {logoUri ? (
              <Image source={{uri: logoUri}} style={styles.logo} />
            ) : globalSetting?.brandName ? (
              <Text style={[styles.brandFallback, {color: accent}]}>
                {globalSetting.brandName}
              </Text>
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

            <AppButton
              disabled={isSubmitting}
              label={primaryLabel}
              loading={isSubmitting}
              onPress={onPrimaryPress}
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
        </AppCard>
    </FormScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#f8fafc',
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  logo: {
    alignSelf: 'center',
    width: 140,
    height: 60,
    resizeMode: 'contain',
    marginBottom: spacing.sm,
  },
  brandFallback: {
    alignSelf: 'center',
    fontSize: typography.titleLg,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  card: {
    gap: spacing.md,
    width: '100%',
  },
  title: {
    color: '#0f172a',
    fontSize: typography.heading,
    fontWeight: '700',
  },
  subtitle: {
    color: '#475569',
    fontSize: typography.bodyLg,
    lineHeight: 22,
    marginBottom: spacing.xs,
  },
  secondaryWrap: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  secondaryPrefix: {
    color: '#64748b',
    fontSize: typography.body,
  },
  secondaryLink: {
    fontWeight: '700',
    fontSize: typography.body,
  },
});

