import React, {useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';

import {AppButton} from '../../../../core/components/AppButton';
import {AppTextField} from '../../../../core/components/AppTextField';
import {authService} from '../../../auth/services/auth.service';

import {
  MultiSelectField,
  MultiSelectOption,
} from './MultiSelectField';

// Subset of the frontend's DynamicFormFieldType. File upload + conditional
// visibility intentionally omitted — see MULTITENANCY.md note.
type DynamicFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'url'
  | 'date'
  | 'select'
  | 'multi-select'
  | 'checkbox';

type DynamicFieldOption = {
  id?: number | string;
  value?: string;
  name?: string;
  label?: string;
};

export type DynamicField = {
  name: string;
  label?: string;
  placeholder?: string;
  type: DynamicFieldType | string;
  required?: string | boolean;
  default_value?: any;
  min_chars?: string | number;
  max_chars?: string | number;
  max_selections?: string | number;
  options?: DynamicFieldOption[];
};

export type DynamicForm = {
  uuid: string;
  formTitle?: string;
  formCode?: string;
  fields: DynamicField[];
};

type Props = {
  token: string;
  form: DynamicForm;
  primaryColor: string;
};

const normaliseType = (raw: string): DynamicFieldType | 'unsupported' => {
  const t = raw.toLowerCase().replace(/_/g, '-');
  if (t === 'text' || t === 'string' || t === 'input') return 'text';
  if (t === 'textarea' || t === 'long-text') return 'textarea';
  if (t === 'number' || t === 'numeric' || t === 'int') return 'number';
  if (t === 'email') return 'email';
  if (t === 'url') return 'url';
  if (t === 'date') return 'date';
  if (t === 'select' || t === 'dropdown' || t === 'single-select') {
    return 'select';
  }
  if (t === 'multi-select' || t === 'multiselect' || t === 'checkbox-group') {
    return 'multi-select';
  }
  if (t === 'checkbox' || t === 'boolean') return 'checkbox';
  return 'unsupported';
};

const toOptions = (raw?: DynamicFieldOption[]): MultiSelectOption[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o, i) => ({
      id: o.id ?? o.value ?? i,
      name: String(o.name || o.label || o.value || ''),
    }))
    .filter(o => o.name.length > 0);
};

const seedDefault = (field: DynamicField): any => {
  const type = normaliseType(String(field.type || ''));
  const def = field.default_value;
  if (type === 'multi-select') {
    return Array.isArray(def) ? def : [];
  }
  if (type === 'checkbox') {
    return Boolean(def);
  }
  return def == null ? '' : String(def);
};

export function CustomFormTab({token, form, primaryColor}: Props) {
  const [values, setValues] = useState<Record<string, any>>(() => {
    const seeded: Record<string, any> = {};
    form.fields.forEach(f => {
      seeded[f.name] = seedDefault(f);
    });
    return seeded;
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    tone: 'success' | 'error';
  } | null>(null);

  // Fetch existing submission once.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    authService
      .getProfileFormSubmission(token, form.uuid)
      .then(res => {
        if (cancelled) return;
        const submitted = res?.data || res || {};
        const merged: Record<string, any> = {};
        form.fields.forEach(field => {
          if (submitted[field.name] !== undefined) {
            merged[field.name] = submitted[field.name];
          } else {
            merged[field.name] = seedDefault(field);
          }
        });
        setValues(merged);
      })
      .catch(() => {
        // No prior submission — keep defaults.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, form.uuid, form.fields]);

  // Required-field validation: schema `field.required` is '1' / true / 'true'
  // (the frontend uses strings). Empty value → block save with a per-field error.
  const isRequiredField = (field: DynamicField): boolean => {
    const raw = field.required;
    if (typeof raw === 'boolean') return raw;
    const s = String(raw ?? '').toLowerCase();
    return s === '1' || s === 'true' || s === 'yes';
  };

  const isEmptyValue = (value: any): boolean => {
    if (value == null) return true;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'boolean') return false;
    return String(value).trim().length === 0;
  };

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const onSave = async () => {
    // Validate required fields locally before hitting the API.
    const nextErrors: Record<string, string> = {};
    form.fields.forEach(f => {
      if (isRequiredField(f) && isEmptyValue(values[f.name])) {
        nextErrors[f.name] = `${f.label || f.name} is required.`;
      }
    });
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setMessage({
        text: 'Please complete the highlighted fields.',
        tone: 'error',
      });
      return;
    }
    setMessage(null);
    setSaving(true);
    try {
      await authService.submitProfileForm(token, form.uuid, values);
      setMessage({text: 'Saved.', tone: 'success'});
    } catch (error) {
      setMessage({
        text:
          error instanceof Error ? error.message : 'Could not save this form.',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const renderedFields = useMemo(
    () =>
      form.fields.map(field => {
        const type = normaliseType(String(field.type || ''));
        const label = field.label || field.name;
        const value = values[field.name];
        const required = isRequiredField(field);
        const fieldError = fieldErrors[field.name];
        const setValue = (next: any) => {
          setValues(prev => ({...prev, [field.name]: next}));
          // Clear this field's error as soon as the user starts typing/picking.
          if (fieldError) {
            setFieldErrors(prev => {
              const {[field.name]: _, ...rest} = prev;
              return rest;
            });
          }
        };

        if (type === 'unsupported') {
          return (
            <View key={field.name} style={styles.unsupported}>
              <Text style={styles.unsupportedLabel}>{label}</Text>
              <Text style={styles.unsupportedHint}>
                Field type "{String(field.type)}" isn't supported on mobile yet
                — open the web app to fill this in.
              </Text>
            </View>
          );
        }

        if (type === 'textarea') {
          return (
            <AppTextField
              key={field.name}
              label={label}
              required={required}
              error={fieldError}
              placeholder={field.placeholder}
              value={String(value || '')}
              onChangeText={setValue}
              multiline
              numberOfLines={4}
            />
          );
        }

        if (type === 'number') {
          return (
            <AppTextField
              key={field.name}
              label={label}
              required={required}
              error={fieldError}
              placeholder={field.placeholder}
              keyboardType="numeric"
              value={String(value || '')}
              onChangeText={setValue}
            />
          );
        }

        if (type === 'email') {
          return (
            <AppTextField
              key={field.name}
              label={label}
              required={required}
              error={fieldError}
              placeholder={field.placeholder}
              keyboardType="email-address"
              autoCapitalize="none"
              value={String(value || '')}
              onChangeText={setValue}
            />
          );
        }

        if (type === 'url') {
          return (
            <AppTextField
              key={field.name}
              label={label}
              required={required}
              error={fieldError}
              placeholder={field.placeholder}
              keyboardType="url"
              autoCapitalize="none"
              value={String(value || '')}
              onChangeText={setValue}
            />
          );
        }

        if (type === 'date') {
          // Minimal: accept ISO-ish text. Mobile-native date picker is a Phase-2 polish item.
          return (
            <AppTextField
              key={field.name}
              label={label}
              required={required}
              error={fieldError}
              placeholder={field.placeholder || 'YYYY-MM-DD'}
              value={String(value || '')}
              onChangeText={setValue}
            />
          );
        }

        if (type === 'select') {
          const opts = toOptions(field.options);
          const selected =
            value != null && value !== ''
              ? [Number(value) || String(value)]
              : [];
          return (
            <MultiSelectField
              key={field.name}
              label={label}
              hint="Select one"
              options={opts}
              selected={selected}
              primaryColor={primaryColor}
              max={1}
              onChange={next => setValue(next[0] ?? '')}
            />
          );
        }

        if (type === 'multi-select') {
          const opts = toOptions(field.options);
          const selected = Array.isArray(value) ? value : [];
          const max = field.max_selections
            ? Number(field.max_selections) || undefined
            : undefined;
          return (
            <MultiSelectField
              key={field.name}
              label={label}
              hint={max ? `Select up to ${max}` : 'Select all that apply'}
              options={opts}
              selected={selected}
              primaryColor={primaryColor}
              max={max}
              onChange={setValue}
            />
          );
        }

        if (type === 'checkbox') {
          return (
            <View key={field.name} style={styles.checkboxRow}>
              <AppButton
                label={`${label}: ${value ? 'Yes' : 'No'}`}
                variant="secondary"
                onPress={() => setValue(!value)}
              />
            </View>
          );
        }

        // Plain text fallback.
        return (
          <AppTextField
            key={field.name}
            label={label}
            required={required}
            error={fieldError}
            placeholder={field.placeholder}
            value={String(value || '')}
            onChangeText={setValue}
          />
        );
      }),
    [form.fields, values, primaryColor],
  );

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{form.formTitle || 'Profile Form'}</Text>
      <Text style={styles.subtitle}>
        Additional information requested by your platform.
      </Text>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={primaryColor} />
        </View>
      ) : null}

      {renderedFields}

      {message ? (
        <Text
          style={[
            styles.message,
            message.tone === 'success'
              ? styles.messageSuccess
              : styles.messageError,
          ]}>
          {message.text}
        </Text>
      ) : null}

      <AppButton
        label={saving ? 'Saving…' : 'Save'}
        disabled={loading || saving}
        loading={saving}
        onPress={onSave}
        style={{backgroundColor: primaryColor}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    gap: 14,
    marginBottom: 24,
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
  loading: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  checkboxRow: {
    alignSelf: 'flex-start',
  },
  unsupported: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 14,
  },
  unsupportedLabel: {
    fontWeight: '600',
    color: '#0f172a',
    fontSize: 14,
  },
  unsupportedHint: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
  },
  messageSuccess: {
    color: '#15803d',
  },
  messageError: {
    color: '#dc2626',
  },
});
