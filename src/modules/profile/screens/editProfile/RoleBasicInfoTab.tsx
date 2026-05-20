import React, {useEffect} from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {AppButton} from '../../../../core/components/AppButton';
import {AppTextField} from '../../../../core/components/AppTextField';
import {useFormValidation} from '../../../../core/form/useFormValidation';
import {
  combine,
  required,
  url,
  Validator,
} from '../../../../core/form/validators';

import type {InvestorSubtype} from './tabConfig';

// Field key in the API response/payload for this role's "basic info" tab.
type FieldKey =
  | 'companyName'
  | 'organizationName'
  | 'name'
  | 'aboutUs'
  | 'briefDescription'
  | 'shortDescription'
  | 'designation'
  | 'currentOrganization'
  | 'portfolioSize'
  | 'keyInvestments'
  | 'displayWebsite'
  | 'website'
  | 'websiteUrl'
  | 'linkedinUrl'
  | 'twitterUrl';

type FieldConfig = {
  key: FieldKey;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'email-address' | 'url' | 'numeric';
  required?: boolean;
  validator?: Validator;
};

type RoleKey =
  | 'investor:organization'
  | 'investor:individual'
  | 'corporate'
  | 'mentor';

// Each role's field list mirrors the primary fields of the corresponding
// frontend basic-info tab. Required + format validators match the frontend's
// FormGroup definitions on each role's edit page.
const ROLE_FIELDS: Record<RoleKey, FieldConfig[]> = {
  'investor:organization': [
    {key: 'organizationName', label: 'Organization Name', required: true},
    {key: 'aboutUs', label: 'About', multiline: true, required: true},
    {key: 'portfolioSize', label: 'Portfolio Size', keyboardType: 'numeric'},
    {key: 'displayWebsite', label: 'Website', keyboardType: 'url'},
    {key: 'linkedinUrl', label: 'LinkedIn URL', keyboardType: 'url'},
    {key: 'twitterUrl', label: 'Twitter / X URL', keyboardType: 'url'},
  ],
  'investor:individual': [
    {key: 'organizationName', label: 'Your Name', required: true},
    {key: 'aboutUs', label: 'About', multiline: true, required: true},
    {
      key: 'keyInvestments',
      label: 'Key Investments',
      multiline: true,
      placeholder: 'Brief summary of notable portfolio companies',
      required: true,
    },
    {key: 'portfolioSize', label: 'Portfolio Size', keyboardType: 'numeric'},
    {key: 'linkedinUrl', label: 'LinkedIn URL', keyboardType: 'url', required: true},
  ],
  corporate: [
    {key: 'companyName', label: 'Company Name', required: true},
    {
      key: 'briefDescription',
      label: 'Brief Description',
      multiline: true,
      required: true,
    },
    {key: 'website', label: 'Website', keyboardType: 'url'},
    {key: 'linkedinUrl', label: 'LinkedIn URL', keyboardType: 'url'},
    {key: 'twitterUrl', label: 'Twitter / X URL', keyboardType: 'url'},
  ],
  mentor: [
    {key: 'name', label: 'Full Name', required: true},
    {key: 'shortDescription', label: 'Headline / Tagline', required: true},
    {key: 'briefDescription', label: 'About', multiline: true, required: true},
    {key: 'designation', label: 'Designation'},
    {key: 'currentOrganization', label: 'Current Organization'},
    {key: 'websiteUrl', label: 'Website', keyboardType: 'url'},
    {key: 'linkedinUrl', label: 'LinkedIn URL', keyboardType: 'url', required: true},
  ],
};

// Pre-compute per-field validators based on the FieldConfig flags.
const buildValidators = (
  fields: FieldConfig[],
): Record<string, Validator> => {
  const map: Record<string, Validator> = {};
  fields.forEach(field => {
    const validators: Validator[] = [];
    if (field.required) {
      validators.push(required(field.label));
    }
    if (field.keyboardType === 'url') {
      validators.push(url);
    }
    if (field.validator) {
      validators.push(field.validator);
    }
    if (validators.length > 0) {
      map[field.key] = validators.length === 1 ? validators[0] : combine(...validators);
    }
  });
  return map;
};

const resolveRoleKey = (
  accountType: string,
  investorSubtype: InvestorSubtype,
): RoleKey | null => {
  const type = accountType.toLowerCase();
  if (type === 'investor') {
    return investorSubtype === 'individual'
      ? 'investor:individual'
      : 'investor:organization';
  }
  if (type === 'corporate') {
    return 'corporate';
  }
  if (type === 'mentor') {
    return 'mentor';
  }
  return null;
};

type Props = {
  accountType: string;
  investorSubtype: InvestorSubtype;
  initialData: Record<string, any> | null;
  primaryColor: string;
  isSaving?: boolean;
  onSave: (payload: Record<string, any>) => Promise<void> | void;
};

export function RoleBasicInfoTab({
  accountType,
  investorSubtype,
  initialData,
  primaryColor,
  isSaving = false,
  onSave,
}: Props) {
  const roleKey = resolveRoleKey(accountType, investorSubtype);
  const fields = roleKey ? ROLE_FIELDS[roleKey] : [];

  const form = useFormValidation({
    initial: seedValues(fields, initialData),
    validators: buildValidators(fields),
  });

  useEffect(() => {
    form.reset(seedValues(fields, initialData));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData, roleKey]);

  if (!roleKey) {
    return null;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Basic Information</Text>
      <Text style={styles.subtitle}>
        Keep these details up to date so the rest of the platform can recognise
        your profile.
      </Text>

      {fields.map(field => (
        <AppTextField
          key={field.key}
          label={field.label}
          required={field.required}
          error={form.errors[field.key]}
          placeholder={field.placeholder}
          keyboardType={field.keyboardType}
          multiline={field.multiline}
          autoCapitalize={
            field.keyboardType === 'url' || field.keyboardType === 'email-address'
              ? 'none'
              : undefined
          }
          value={form.values[field.key] || ''}
          onChangeText={text => form.setValue(field.key, text)}
          onBlur={() => form.setTouched(field.key)}
        />
      ))}

      <AppButton
        label={isSaving ? 'Saving…' : 'Save'}
        disabled={isSaving}
        loading={isSaving}
        onPress={() =>
          form.handleSubmit(values => onSave(buildPayload(values)))
        }
        style={{backgroundColor: primaryColor}}
      />
    </View>
  );
}

const seedValues = (
  fields: FieldConfig[],
  data: Record<string, any> | null,
): Record<string, string> => {
  const seed: Record<string, string> = {};
  fields.forEach(field => {
    const raw = data?.[field.key];
    seed[field.key] = raw == null ? '' : String(raw);
  });
  return seed;
};

const buildPayload = (
  values: Record<string, string>,
): Record<string, any> => {
  // Only include non-empty fields so we don't blow away existing values
  // the user didn't touch.
  const payload: Record<string, any> = {};
  Object.entries(values).forEach(([key, value]) => {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      payload[key] = key === 'portfolioSize' ? Number(trimmed) : trimmed;
    }
  });
  return payload;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    gap: 16,
    marginBottom: 24,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 4},
    elevation: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
});
