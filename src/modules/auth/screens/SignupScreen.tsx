import React, {useContext, useEffect, useMemo, useState} from 'react';
import {
  Image,
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
  !value.trim() || /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,})([/\w .-]*)*\/?$/.test(value.trim());

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

  const updateField = <K extends keyof SignupDraft>(key: K, value: SignupDraft[K]) => {
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

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <AppCard>
          <View style={styles.card}>
            {logoUri ? <Image source={{uri: logoUri}} style={styles.logo} /> : null}

            <Pressable onPress={onLogin}>
              <Text style={styles.backLink}>
                {'<-'} Already have an account? <Text style={styles.linkStrong}>Login</Text>
              </Text>
            </Pressable>

            <Text style={styles.title}>Create Profile</Text>
            <Text style={styles.subtitle}>
              Signup as {roleLabel}
              {investorType ? ` (${formatRoleLabel(investorType)})` : ''}
            </Text>

            {requiresOrganizationName ? (
              <AppTextField
                label="Organization Name"
                placeholder="Enter organization name"
                value={form.organizationName || ''}
                onChangeText={value => updateField('organizationName', value)}
                onBlur={() => markTouched('organizationName')}
                error={getFieldError('organizationName')}
              />
            ) : null}

            {requiresWebsite ? (
              <AppTextField
                label="Website"
                placeholder="Enter website"
                value={form.website || ''}
                onChangeText={value => updateField('website', value)}
                autoCapitalize="none"
                keyboardType="default"
                onBlur={() => markTouched('website')}
                error={getFieldError('website')}
              />
            ) : null}

            {requiresCompanyName ? (
              <AppTextField
                label="Company Name"
                placeholder="Enter company name"
                value={form.companyName}
                onChangeText={value => updateField('companyName', value)}
                onBlur={() => markTouched('companyName')}
                error={getFieldError('companyName')}
              />
            ) : null}

            {requiresDesignation ? (
              <AppTextField
                label="Designation"
                placeholder="Enter designation"
                value={form.designation || ''}
                onChangeText={value => updateField('designation', value)}
                onBlur={() => markTouched('designation')}
                error={getFieldError('designation')}
              />
            ) : null}

            <AppTextField
              label="Your Name"
              placeholder="Enter your name"
              value={form.fullName}
              onChangeText={value => updateField('fullName', value)}
              onBlur={() => markTouched('fullName')}
              error={getFieldError('fullName')}
            />

            <AppTextField
              label="Email Address"
              placeholder="Enter email address"
              value={form.email}
              onChangeText={value => updateField('email', value)}
              autoCapitalize="none"
              keyboardType="email-address"
              onBlur={() => markTouched('email')}
              error={getFieldError('email')}
            />

            <AppTextField
              label="Mobile Number"
              placeholder="Enter mobile number"
              value={form.mobile}
              onChangeText={value =>
                updateField('mobile', value.replace(/[^0-9+]/g, ''))
              }
              keyboardType="default"
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
                  form.acceptedTerms
                    ? {backgroundColor: theme?.primary || '#a16207'}
                    : null,
                ]}>
                {form.acceptedTerms ? <Text style={styles.checkboxTick}>✓</Text> : null}
              </View>
              <Text style={styles.termsText}>
                By checking, you accept the terms and conditions and privacy
                policy.
              </Text>
            </Pressable>

            {getFieldError('acceptedTerms') ? (
              <Text style={styles.errorText}>{getFieldError('acceptedTerms')}</Text>
            ) : null}

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
              label="Send OTP"
              disabled={isSubmitting}
              loading={isSubmitting}
              onPress={handleSubmit}
            />

            <AppButton
              label="Back to Login"
              disabled={isSubmitting}
              onPress={onLogin}
              variant="secondary"
            />
          </View>
        </AppCard>
      </ScrollView>
    </View>
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
    padding: 24,
  },
  card: {
    gap: 14,
  },
  logo: {
    alignSelf: 'center',
    width: 132,
    height: 56,
    resizeMode: 'contain',
    marginBottom: 10,
  },
  backLink: {
    fontSize: 14,
    color: '#334155',
  },
  linkStrong: {
    color: '#0f172a',
    fontWeight: '700',
  },
  title: {
    color: '#000',
    fontSize: 28,
    fontWeight: '700',
    marginTop: 8,
  },
  subtitle: {
    color: '#475569',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  termsRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxTick: {
    color: '#fff',
    fontWeight: '700',
  },
  termsText: {
    flex: 1,
    color: '#334155',
    fontSize: 14,
    lineHeight: 20,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
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
  errorText: {
    color: '#dc2626',
    fontSize: 12,
  },
});
