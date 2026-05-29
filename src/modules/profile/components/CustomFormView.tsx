import React, {useContext} from 'react';
import {Linking, Pressable, StyleSheet, Text, View} from 'react-native';

import {Icon} from '../../../core/components/Icon';
import {TenantContext} from '../../../core/tenant/TenantProvider';
import type {DynamicField, DynamicForm} from '../screens/editProfile/CustomFormTab';

type Props = {
  form: DynamicForm;
  values: Record<string, any>;
  primaryColor: string;
};

const SECTION_TYPES = new Set([
  'form-section',
  'section',
  'group',
  'fieldset',
]);

const isSectionField = (field: DynamicField): boolean => {
  const t = String(field.type || '').toLowerCase().replace(/_/g, '-');
  return SECTION_TYPES.has(t);
};

const getNestedFields = (field: DynamicField): DynamicField[] => {
  if (Array.isArray(field.fields)) return field.fields;
  if (Array.isArray(field.children)) return field.children;
  if (Array.isArray(field.subFields)) return field.subFields;
  return [];
};

// Format a single field's value for read-only display. Handles every shape
// the backend may ship: strings, numbers, booleans, arrays (multi-select /
// checkbox), and objects (phone has {number, dialCode, ...}; geography
// has {country, state, city}).
const formatValue = (
  field: DynamicField,
  value: any,
): {kind: 'text' | 'file'; text: string} => {
  const type = String(field.type || '').toLowerCase().replace(/_/g, '-');

  if (value === null || value === undefined || value === '') {
    return {kind: 'text', text: '—'};
  }

  if (type === 'file') {
    // File submissions are server paths/URLs; consumers render a Download
    // link. Empty fields fall through to the dash above.
    const path =
      typeof value === 'string'
        ? value
        : value?.url || value?.path || value?.filePath || '';
    return {kind: 'file', text: String(path || '')};
  }

  if (type === 'phone' && typeof value === 'object') {
    const dial = value?.dialCode || value?.dial_code || '';
    const num = value?.number || value?.phoneNumber || '';
    return {kind: 'text', text: [dial, num].filter(Boolean).join(' ').trim() || '—'};
  }

  if (type === 'geography' && typeof value === 'object') {
    const parts = [value?.city, value?.state, value?.country]
      .map((p: any) =>
        typeof p === 'object' ? p?.name || p?.label : p,
      )
      .filter(Boolean);
    return {kind: 'text', text: parts.join(', ') || '—'};
  }

  if (Array.isArray(value)) {
    const labels = value
      .map(v => {
        if (typeof v === 'string' || typeof v === 'number') return String(v);
        if (v && typeof v === 'object') return v.label || v.name || v.value || '';
        return '';
      })
      .filter(Boolean);
    // Map option ids back to labels if the field defines options.
    const opts = field.options || [];
    if (opts.length > 0) {
      const labelByValue = new Map<string, string>();
      opts.forEach(opt => {
        const key = String(opt?.value ?? opt?.id ?? '');
        const label = String(opt?.label ?? opt?.name ?? key);
        if (key) labelByValue.set(key, label);
      });
      const mapped = labels.map(l => labelByValue.get(l) || l);
      return {kind: 'text', text: mapped.join(', ') || '—'};
    }
    return {kind: 'text', text: labels.join(', ') || '—'};
  }

  if (typeof value === 'object') {
    // Generic object (range with min/max, etc.) — try common keys.
    const text =
      value.label ||
      value.name ||
      value.value ||
      [value.min, value.max].filter(Boolean).join(' – ');
    return {kind: 'text', text: String(text || '—')};
  }

  // select / radio with single value — map id to label if possible.
  if ((type === 'select' || type === 'radio') && field.options) {
    const opt = field.options.find(
      o => String(o?.value ?? o?.id ?? '') === String(value),
    );
    if (opt) {
      return {kind: 'text', text: String(opt.label ?? opt.name ?? value)};
    }
  }

  if (typeof value === 'boolean') {
    return {kind: 'text', text: value ? 'Yes' : 'No'};
  }

  return {kind: 'text', text: String(value)};
};

// Resolve a (possibly relative) server path against the tenant's CDN
// origins so the Download link points at a fetchable URL.
const resolveAssetUrl = (
  path: string,
  bases: Array<string | null | undefined>,
): string => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const base = bases.find(b => typeof b === 'string' && b.length > 0);
  if (!base) return path;
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
};

// Recursively render every leaf field as a Label / Value row. Section
// containers are walked through transparently — their nested fields
// appear at the same visual level as top-level fields, matching the
// web's flat read-only layout in the screenshot.
export function CustomFormView({form, values, primaryColor}: Props) {
  const {baseUrl, globalSetting} = useContext(TenantContext);
  const bases = [
    globalSetting?.imgKitUrl,
    globalSetting?.assetsImgKitUrl,
    globalSetting?.s3Url,
    baseUrl,
  ];

  const rows: React.ReactNode[] = [];

  const visit = (fields: DynamicField[]) => {
    fields.forEach(field => {
      if (isSectionField(field)) {
        visit(getNestedFields(field));
        return;
      }
      const formatted = formatValue(field, values[field.name]);
      const label = field.label || field.name;

      if (formatted.kind === 'file' && formatted.text) {
        const url = resolveAssetUrl(formatted.text, bases);
        rows.push(
          <View key={field.name} style={styles.row}>
            <Text style={styles.label}>{label}</Text>
            <Pressable
              onPress={() => Linking.openURL(url).catch(() => {})}
              style={({pressed}) => [
                styles.downloadBtn,
                {backgroundColor: primaryColor},
                pressed && {opacity: 0.85},
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Download ${label}`}>
              <Icon name="download" size={14} color="#ffffff" />
              <Text style={styles.downloadBtnText}>DOWNLOAD</Text>
            </Pressable>
          </View>,
        );
        return;
      }

      rows.push(
        <View key={field.name} style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value}>{formatted.text}</Text>
        </View>,
      );
    });
  };

  visit(form.fields);

  if (rows.length === 0) {
    return (
      <Text style={styles.empty}>No data submitted for this form yet.</Text>
    );
  }

  return <View>{rows}</View>;
}

const styles = StyleSheet.create({
  row: {
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    paddingVertical: 10,
  },
  label: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  value: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
  },
  downloadBtn: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  downloadBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  empty: {
    color: '#94a3b8',
    fontSize: 13,
    paddingVertical: 8,
  },
});
