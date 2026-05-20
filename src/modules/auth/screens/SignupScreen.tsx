import React, {useContext, useEffect, useMemo, useRef, useState} from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {TenantContext} from '../../../core/tenant/TenantProvider';
import {AppButton} from '../../../core/components/AppButton';
import {AppCard} from '../../../core/components/AppCard';
import {AppTextField} from '../../../core/components/AppTextField';
import {Icon} from '../../../core/components/Icon';
import {useToast} from '../../../core/toast/ToastProvider';
import {
  radii,
  spacing,
  typography,
  withAlpha,
} from '../../../core/theme/colors';
import {SignupDraft} from '../models/auth.models';
import {authService} from '../services/auth.service';

type SignupScreenProps = {
  role: string;
  investorType?: string;
  onContinue: (data: SignupDraft) => void;
  onLogin: () => void;
  isSubmitting?: boolean;
  message?: string;
  messageTone?: 'neutral' | 'success' | 'error';
};

const formatRoleLabel = (role: string) =>
  role
    .split('_')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const isValidWebsite = (value: string) =>
  !value.trim() ||
  /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,})([/\w .-]*)*\/?$/.test(
    value.trim(),
  );

export function SignupScreen({
  role,
  investorType,
  onContinue,
  onLogin,
  isSubmitting = false,
  message,
  messageTone = 'neutral',
}: SignupScreenProps) {
  const {theme, globalSetting} = useContext(TenantContext);
  const toast = useToast();
  const accent = theme?.primary || '#0f172a';
  const tint = withAlpha(accent, 0.08);
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [mobileAvailabilityError, setMobileAvailabilityError] = useState('');
  const [form, setForm] = useState<SignupDraft>({
    companyName: '',
    organizationName: '',
    fullName: '',
    email: '',
    mobile: '',
    designation: '',
    website: '',
    role,
    investorType,
    acceptedTerms: false,
  });

  useEffect(() => {
    setForm(current => ({
      ...current,
      role,
      investorType,
    }));
  }, [role, investorType]);

  useEffect(() => {
    const mobile = form.mobile.trim();

    if (!mobile || mobile.length < 4) {
      setMobileAvailabilityError('');
      return;
    }

    let isActive = true;

    const timer = setTimeout(async () => {
      try {
        const nextError = await authService.verifySignupMobile(
          mobile,
          role,
          investorType,
        );

        if (isActive) {
          setMobileAvailabilityError(nextError || '');
        }
      } catch {
        if (isActive) {
          setMobileAvailabilityError('');
        }
      }
    }, 500);

    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, [form.mobile, investorType, role]);

  // Surface backend messages via Toast (matches Login/OTP pattern).
  const lastShownMessage = useRef<string | null>(null);
  useEffect(() => {
    if (!message || message === lastShownMessage.current) return;
    lastShownMessage.current = message;
    if (messageTone === 'success') toast.success(message);
    else if (messageTone === 'error') toast.error(message);
    else toast.info(message);
  }, [message, messageTone, toast]);

  const logoBaseUrl = globalSetting?.imgKitUrl || globalSetting?.assetsImgKitUrl;
  const logoPath = globalSetting?.logo;
  const logoUri =
    logoBaseUrl && logoPath
      ? `${logoBaseUrl.replace(/\/$/, '')}/${logoPath.replace(/^\//, '')}`
      : null;

  const roleLabel = formatRoleLabel(role);
  const isInvestor = role === 'investor';
  const isInvestorIndividual = isInvestor && investorType === 'individual';
  const isInvestorSyndicate = isInvestor && investorType === 'syndicate';
  const isCorporate = role === 'corporate';
  const isPartner = role === 'partner';
  const hidesCompanyName = [
    'mentor',
    'program_office',
    'job_seeker',
    'partner',
    'individual',
  ].includes(role);

  const requiresOrganizationName =
    (isInvestor && !isInvestorIndividual) || isPartner;
  const requiresCompanyName =
    (!isInvestor && !hidesCompanyName) || isCorporate;
  const requiresDesignation = isCorporate;
  const requiresWebsite = isInvestorSyndicate;

  const errors = useMemo(() => {
    const nextErrors: Record<string, string> = {};

    if (requiresOrganizationName && !form.organizationName?.trim()) {
      nextErrors.organizationName = 'Organization name is required.';
    }

    if (requiresCompanyName && !form.companyName.trim()) {
      nextErrors.companyName = 'Company name is required.';
    }

    if (requiresDesignation && !form.designation?.trim()) {
      nextErrors.designation = 'Designation is required.';
    }

    if (!form.fullName.trim()) {
      nextErrors.fullName = 'Your name is required.';
    }

    if (!form.email.trim()) {
      nextErrors.email = 'Email address is required.';
    } else if (!isValidEmail(form.email)) {
      nextErrors.email = 'Enter a valid email address.';
    }

    if (!form.mobile.trim()) {
      nextErrors.mobile = 'Mobile number is required.';
    } else if (form.mobile.trim().length < 4) {
      nextErrors.mobile = 'Enter a valid mobile number.';
    } else if (mobileAvailabilityError) {
      nextErrors.mobile = mobileAvailabilityError;
    }

    if (requiresWebsite && !form.website?.trim()) {
      nextErrors.website = 'Website is required.';
    } else if (requiresWebsite && !isValidWebsite(form.website || '')) {
      nextErrors.website = 'Enter a valid website URL.';
    }

    if (!form.acceptedTerms) {
      nextErrors.acceptedTerms = 'Please accept the terms and privacy policy.';
    }

    return nextErrors;
  }, [
    form,
    mobileAvailabilityError,
    requiresCompanyName,
    requiresDesignation,
    requiresOrganizationName,
    requiresWebsite,
  ]);

  const canSubmit = Object.keys(errors).length === 0;

  const updateField = <K extends keyof SignupDraft>(
    key: K,
    value: SignupDraft[K],
  ) => {
    setForm(current => ({
      ...current,
      [key]: value,
    }));
  };

  const markTouched = (key: string) => {
    setTouched(current => ({
      ...current,
      [key]: true,
    }));
  };

  const getFieldError = (key: string) =>
    submitted || touched[key] ? errors[key] : undefined;

  const handleSubmit = () => {
    setSubmitted(true);

    if (!canSubmit) {
      return;
    }

    onContinue(form);
  };

  // Light wrapper around Linking.openURL — no-ops if the URL isn't set.
  const openExternal = (target?: string) => {
    if (!target) return;
    Linking.openURL(target).catch(() => {});
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.page}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
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

            <Pressable
              onPress={onLogin}
              style={styles.backLinkWrap}
              hitSlop={10}
              accessibilityLabel="Back to login">
              <Icon name="arrow-left" size={18} color="#475569" />
              <Text style={styles.backText}>
                Have an account?{' '}
                <Text style={[styles.loginLink, {color: accent}]}>Log in</Text>
              </Text>
            </Pressable>

            <View style={styles.headerWrap}>
              <View style={[styles.stepBadge, {backgroundColor: tint}]}>
                <Text style={[styles.stepText, {color: accent}]}>
                  STEP 2 OF 2
                </Text>
              </View>
              <Text style={styles.title}>Create your profile</Text>
              <Text style={styles.subtitle}>
                Signing up as {roleLabel}
                {investorType ? ` (${formatRoleLabel(investorType)})` : ''}
              </Text>
            </View>

            {requiresOrganizationName ? (
              <AppTextField
                label="Organization Name"
                required
                placeholder="e.g. Acme Ventures"
                value={form.organizationName || ''}
                onChangeText={value => updateField('organizationName', value)}
                onBlur={() => markTouched('organizationName')}
                error={getFieldError('organizationName')}
              />
            ) : null}

            {requiresWebsite ? (
              <AppTextField
                label="Website"
                required
                placeholder="https://acme.vc"
                value={form.website || ''}
                onChangeText={value => updateField('website', value)}
                autoCapitalize="none"
                keyboardType="url"
                onBlur={() => markTouched('website')}
                error={getFieldError('website')}
              />
            ) : null}

            {requiresCompanyName ? (
              <AppTextField
                label="Company Name"
                required
                placeholder="e.g. Acme Inc."
                value={form.companyName}
                onChangeText={value => updateField('companyName', value)}
                onBlur={() => markTouched('companyName')}
                error={getFieldError('companyName')}
              />
            ) : null}

            {requiresDesignation ? (
              <AppTextField
                label="Designation"
                required
                placeholder="e.g. Innovation Lead"
                value={form.designation || ''}
                onChangeText={value => updateField('designation', value)}
                onBlur={() => markTouched('designation')}
                error={getFieldError('designation')}
              />
            ) : null}

            <AppTextField
              label="Your Name"
              required
              placeholder="Jane Doe"
              value={form.fullName}
              onChangeText={value => updateField('fullName', value)}
              onBlur={() => markTouched('fullName')}
              error={getFieldError('fullName')}
            />

            <AppTextField
              label="Email Address"
              required
              placeholder="you@example.com"
              value={form.email}
              onChangeText={value => updateField('email', value)}
              autoCapitalize="none"
              keyboardType="email-address"
              onBlur={() => markTouched('email')}
              error={getFieldError('email')}
            />

            <AppTextField
              label="Mobile Number"
              required
              placeholder="10-digit mobile number"
              value={form.mobile}
              onChangeText={value =>
                updateField('mobile', value.replace(/[^0-9+]/g, ''))
              }
              keyboardType="number-pad"
              onBlur={() => markTouched('mobile')}
              error={getFieldError('mobile')}
            />

            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{checked: form.acceptedTerms}}
              onPress={() => {
                markTouched('acceptedTerms');
                updateField('acceptedTerms', !form.acceptedTerms);
              }}
              style={styles.termsRow}>
              <View
                style={[
                  styles.checkbox,
                  form.acceptedTerms && {
                    backgroundColor: accent,
                    borderColor: accent,
                  },
                ]}>
                {form.acceptedTerms ? (
                  <Icon name="check" size={14} color="#ffffff" />
                ) : null}
              </View>
              <Text style={styles.termsText}>
                I agree to the{' '}
                <Text
                  style={[styles.termsLink, {color: accent}]}
                  onPress={() =>
                    openExternal(globalSetting?.features?.terms_url)
                  }>
                  Terms of Service
                </Text>{' '}
                and{' '}
                <Text
                  style={[styles.termsLink, {color: accent}]}
                  onPress={() =>
                    openExternal(globalSetting?.features?.privacy_url)
                  }>
                  Privacy Policy
                </Text>
                .
              </Text>
            </Pressable>

            {getFieldError('acceptedTerms') ? (
              <Text style={styles.errorText}>
                {getFieldError('acceptedTerms')}
              </Text>
            ) : null}

            <AppButton
              label="Send OTP"
              disabled={isSubmitting}
              loading={isSubmitting}
              onPress={handleSubmit}
            />

            <Pressable
              onPress={onLogin}
              disabled={isSubmitting}
              style={styles.secondaryWrap}
              hitSlop={10}>
              <Text style={styles.secondaryPrefix}>
                Already registered?{' '}
                <Text style={[styles.secondaryLink, {color: accent}]}>
                  Log in
                </Text>
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  card: {
    gap: spacing.md,
  },
  logo: {
    alignSelf: 'center',
    width: 140,
    height: 60,
    resizeMode: 'contain',
    marginBottom: spacing.xs,
  },
  brandFallback: {
    alignSelf: 'center',
    fontSize: typography.titleLg,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  backLinkWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backText: {
    fontSize: typography.body,
    color: '#475569',
  },
  loginLink: {
    fontWeight: '700',
  },
  headerWrap: {
    gap: spacing.xs,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  stepBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  stepText: {
    fontSize: typography.caption,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  title: {
    color: '#0f172a',
    fontSize: typography.heading,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  subtitle: {
    color: '#64748b',
    fontSize: typography.body,
    lineHeight: 20,
  },
  termsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    marginTop: spacing.xs,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  termsText: {
    flex: 1,
    color: '#334155',
    fontSize: typography.body,
    lineHeight: 20,
  },
  termsLink: {
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  errorText: {
    color: '#dc2626',
    fontSize: typography.small,
  },
  secondaryWrap: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
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
