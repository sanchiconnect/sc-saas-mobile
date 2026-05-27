import React, {
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {launchImageLibrary} from 'react-native-image-picker';

import {AppButton} from '../../../../core/components/AppButton';
import {AppTextField} from '../../../../core/components/AppTextField';
import {TenantContext} from '../../../../core/tenant/TenantProvider';
import {authService} from '../../../auth/services/auth.service';

import {
  MultiSelectField,
  MultiSelectOption,
} from './MultiSelectField';

// Subset of the frontend's DynamicFormFieldType. Phone returns an object
// payload (number + dialCode + ...); file values are S3 paths shown read-only
// (uploads still happen on web — see MULTITENANCY.md).
type DynamicFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'url'
  | 'date'
  | 'phone'
  | 'file'
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
  // Image / file upload constraints from the backend schema.
  file_types?: string[];
  max_file_size?: string | number;
  // Container types (form_section, section, group, fieldset) wrap nested
  // fields. Submissions stay flat — leaves keep their own `name` keys.
  fields?: DynamicField[];
  children?: DynamicField[];
  subFields?: DynamicField[];
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

// Visit every leaf field exactly once — used for default seeding,
// required-field validation, and diff comparisons. Sections are walked
// through, not visited themselves.
const forEachLeafField = (
  fields: DynamicField[],
  cb: (field: DynamicField) => void,
): void => {
  fields.forEach(f => {
    if (isSectionField(f)) {
      forEachLeafField(getNestedFields(f), cb);
    } else {
      cb(f);
    }
  });
};

// Required-field gate: backend uses '1' / '0' (strings) plus the usual
// boolean variants. Anything else is treated as optional.
const isRequiredField = (field: DynamicField): boolean => {
  const raw = field.required;
  if (typeof raw === 'boolean') return raw;
  const s = String(raw ?? '').toLowerCase();
  return s === '1' || s === 'true' || s === 'yes';
};

// Treats `null` / `undefined`, empty strings, empty arrays, and phone
// objects with a blank `number` as empty. Booleans count as filled
// (false isn't "empty" for a checkbox).
const isEmptyValue = (value: any): boolean => {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'boolean') return false;
  if (typeof value === 'object') {
    return String(value?.number ?? '').trim().length === 0;
  }
  return String(value).trim().length === 0;
};

// Returns the configured upper char limit, or 0 if no limit is set.
const maxCharsOf = (field: DynamicField): number => {
  const n = Number(field.max_chars);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// Returns the configured lower char limit, or 0 if no min is set.
const minCharsOf = (field: DynamicField): number => {
  const n = Number(field.min_chars);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// Wraps a text-like input with the "0/1000 characters" counter when the
// schema declares any char limit. Rendered below the field.
function CharCounter({
  field,
  value,
}: {
  field: DynamicField;
  value: any;
}) {
  const max = maxCharsOf(field);
  const min = minCharsOf(field);
  if (!max && !min) return null;
  const len =
    typeof value === 'string' ? value.length : String(value || '').length;
  const tooShort = min > 0 && len > 0 && len < min;
  const overLimit = max > 0 && len > max;
  return (
    <Text
      style={[
        charCounterStyles.counter,
        (tooShort || overLimit) && charCounterStyles.counterWarn,
      ]}>
      {max > 0 ? `${len}/${max} characters` : `${len} characters`}
      {min > 0 && len > 0 && len < min ? ` (min ${min})` : ''}
    </Text>
  );
}

const charCounterStyles = StyleSheet.create({
  counter: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 6,
    textAlign: 'right',
  },
  counterWarn: {
    color: '#dc2626',
  },
});

// True iff every required leaf field has a non-empty value. Used by the
// parent screen to colour the form's tab dot green vs red.
export const isFormComplete = (
  fields: DynamicField[],
  values: Record<string, any>,
): boolean => {
  let complete = true;
  forEachLeafField(fields, field => {
    if (isRequiredField(field) && isEmptyValue(values[field.name])) {
      complete = false;
    }
  });
  return complete;
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
  // Reports whether every required leaf field currently has a value. Fires
  // once after the initial submission load, and again on each value change.
  // Parent uses it to colour the form's tab dot.
  onCompletionChange?: (complete: boolean) => void;
};

const normaliseType = (raw: string): DynamicFieldType | 'unsupported' => {
  const t = raw.toLowerCase().replace(/_/g, '-');
  if (t === 'text' || t === 'string' || t === 'input' || t === 'text-field') {
    return 'text';
  }
  if (t === 'textarea' || t === 'long-text' || t === 'text-area') {
    return 'textarea';
  }
  if (
    t === 'number' ||
    t === 'numeric' ||
    t === 'int' ||
    t === 'number-field'
  ) {
    return 'number';
  }
  if (t === 'email' || t === 'email-field' || t === 'email-address-field') {
    return 'email';
  }
  if (t === 'url' || t === 'url-field' || t === 'website-field') return 'url';
  if (t === 'date' || t === 'date-field') return 'date';
  if (
    t === 'phone' ||
    t === 'tel' ||
    t === 'phone-number' ||
    t === 'phone-field' ||
    t === 'phone-number-field'
  ) {
    return 'phone';
  }
  if (
    t === 'file' ||
    t === 'upload' ||
    t === 'image' ||
    t === 'image-upload' ||
    t === 'file-upload'
  ) {
    return 'file';
  }
  if (
    t === 'select' ||
    t === 'dropdown' ||
    t === 'single-select' ||
    t === 'select-field' ||
    t === 'dropdown-field'
  ) {
    return 'select';
  }
  if (
    t === 'multi-select' ||
    t === 'multiselect' ||
    t === 'checkbox-group' ||
    t === 'multi-select-field'
  ) {
    return 'multi-select';
  }
  if (
    t === 'checkbox' ||
    t === 'boolean' ||
    t === 'checkbox-field' ||
    t === 'boolean-field'
  ) {
    return 'checkbox';
  }
  return 'unsupported';
};

// Backend schema returns each section's children as JSON-encoded strings (not
// parsed objects), and uses `key` for the field identifier with `name` for
// the display label. This helper recursively normalises a raw API field into
// the shape the rest of this component expects: `name` = identifier, `label`
// = display, with nested children fully parsed and mapped.
export const normalizeRawField = (raw: any): DynamicField | null => {
  let value: any = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object') return null;

  const identifier = String(value.key || value.name || '');
  if (!identifier) return null;

  const type = String(value.type || '');
  const isSection = isSectionField({name: identifier, type} as DynamicField);
  const rawChildren =
    (Array.isArray(value.fields) && value.fields) ||
    (Array.isArray(value.children) && value.children) ||
    (Array.isArray(value.subFields) && value.subFields) ||
    null;

  const normalisedChildren =
    isSection && rawChildren
      ? rawChildren
          .map((child: any) => normalizeRawField(child))
          .filter((f: DynamicField | null): f is DynamicField => f !== null)
      : undefined;

  return {
    name: identifier,
    // For sections the display "label" is also the `name` returned by the
    // backend (e.g. "Basic Form"). For leaf fields the same applies.
    label: String(value.name || value.label || ''),
    type,
    placeholder: value.placeholder ? String(value.placeholder) : undefined,
    required: value.required,
    default_value: value.default_value,
    min_chars: value.min_chars,
    max_chars: value.max_chars,
    max_selections: value.max_selections,
    options: Array.isArray(value.options) ? value.options : undefined,
    file_types: Array.isArray(value.file_types) ? value.file_types : undefined,
    max_file_size: value.max_file_size,
    fields: normalisedChildren,
  };
};

// Stored phone values are objects ({number, dialCode, ...}). Pull the editable
// number for the input; everything else is preserved in `setValue`.
const phoneNumberOf = (value: any): string => {
  if (value == null) return '';
  if (typeof value === 'object') return String(value.number ?? '');
  return String(value);
};

const setPhoneNumber = (current: any, next: string): any => {
  if (current && typeof current === 'object') {
    return {...current, number: next};
  }
  return {number: next};
};

// Deep-equal sufficient for form values (primitives + arrays + plain objects
// like the phone payload). Avoids pulling lodash for one call site.
const isEqual = (a: any, b: any): boolean => {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => isEqual(v, b[i]));
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    return ak.every(k => isEqual(a[k], b[k]));
  }
  return false;
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

// Imperative handle the parent EditProfileScreen drives from the global
// footer SAVE button. `save()` returns a result the parent can surface in its
// own save message; `isBusy` lets the parent disable the footer while
// validation, upload, or PATCH is in flight.
export type CustomFormTabHandle = {
  save: () => Promise<{ok: boolean; message?: string}>;
  isBusy: boolean;
};

export const CustomFormTab = forwardRef<CustomFormTabHandle, Props>(function CustomFormTab(
  {token, form, primaryColor, onCompletionChange}: Props,
  ref,
) {
  const {globalSetting} = useContext(TenantContext);
  // Stored file values are S3 paths; resolve to a full URL for the <Image>
  // preview using the tenant's imgKit / assetsImgKit URL (whichever is set).
  const imgKitUrl =
    globalSetting?.imgKitUrl || globalSetting?.assetsImgKitUrl || '';
  const [values, setValues] = useState<Record<string, any>>(() => {
    const seeded: Record<string, any> = {};
    forEachLeafField(form.fields, f => {
      seeded[f.name] = seedDefault(f);
    });
    return seeded;
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Per-field upload-in-progress flag. Save is disabled while any field is
  // uploading so we don't PATCH stale paths.
  const [uploadingFields, setUploadingFields] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<{
    text: string;
    tone: 'success' | 'error';
  } | null>(null);
  // Whether a prior submission exists for this form. PATCH if yes, POST if no.
  const [hasExistingSubmission, setHasExistingSubmission] = useState(false);
  // Initial values snapshot — used to diff at save time so the PATCH body
  // only carries the fields the user actually touched.
  const initialValuesRef = useRef<Record<string, any>>({});

  // Fetch existing submission once.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    authService
      .getProfileFormSubmission(token, form.uuid)
      .then(res => {
        if (cancelled) return;
        // Response shape: { status_code, message, data: { ...metadata, data: { field_xxx: value, ... } } }.
        // The actual field values live at res.data.data; res.data alone is
        // the submission record. Older shapes may flatten it to res.data —
        // fall back to that for backwards compatibility.
        const submissionRecord =
          (res as any)?.data && typeof (res as any).data === 'object'
            ? (res as any).data
            : (res as any) || {};
        const fieldValues =
          submissionRecord?.data &&
          typeof submissionRecord.data === 'object' &&
          !Array.isArray(submissionRecord.data)
            ? submissionRecord.data
            : submissionRecord;

        const merged: Record<string, any> = {};
        forEachLeafField(form.fields, field => {
          if (
            fieldValues[field.name] !== undefined &&
            fieldValues[field.name] !== null
          ) {
            merged[field.name] = fieldValues[field.name];
          } else {
            merged[field.name] = seedDefault(field);
          }
        });
        setValues(merged);
        initialValuesRef.current = merged;
        // A submission record carries its own uuid; presence means we can PATCH.
        setHasExistingSubmission(Boolean(submissionRecord?.uuid || submissionRecord?.id));
      })
      .catch(() => {
        // No prior submission — keep seeded defaults; subsequent save will POST.
        const seeded: Record<string, any> = {};
        forEachLeafField(form.fields, f => {
          seeded[f.name] = seedDefault(f);
        });
        initialValuesRef.current = seeded;
        setHasExistingSubmission(false);
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
  const numberOrNull = (raw: any): number | null => {
    if (raw === null || raw === undefined || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  // Returns the first validation error for a single field, or '' if valid.
  // Skips empty optional fields; required-empty is handled separately.
  const validateField = (field: DynamicField, value: any): string => {
    const label = field.label || field.name;
    const required = isRequiredField(field);
    const empty = isEmptyValue(value);
    if (required && empty) return `${label} is required.`;
    if (empty) return '';

    const type = normaliseType(String(field.type || ''));

    if (
      type === 'text' ||
      type === 'textarea' ||
      type === 'email' ||
      type === 'url'
    ) {
      const s = String(value || '');
      const min = numberOrNull(field.min_chars);
      const max = numberOrNull(field.max_chars);
      if (min !== null && s.length < min) {
        return `${label} must be at least ${min} characters.`;
      }
      if (max !== null && s.length > max) {
        return `${label} must be at most ${max} characters.`;
      }
    }

    if (type === 'email') {
      const s = String(value || '').trim();
      // RFC-lite — same shape the auth flow's validator accepts.
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
        return `${label} must be a valid email address.`;
      }
    }

    if (type === 'url') {
      const s = String(value || '').trim();
      // Accept http(s)://... plus bare domains like example.com — the web
      // form does the same lenient check.
      if (!/^(https?:\/\/.+|[\w-]+(\.[\w-]+)+.*)$/i.test(s)) {
        return `${label} must be a valid URL.`;
      }
    }

    if (type === 'phone') {
      const number = String(value?.number ?? value ?? '').replace(/\D/g, '');
      if (number.length < 6 || number.length > 15) {
        return `${label} must be a valid phone number.`;
      }
    }

    return '';
  };

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Report completion to the parent whenever values change. Covers both the
  // initial load (values get set from the GET response) and live editing.
  useEffect(() => {
    if (!onCompletionChange) return;
    onCompletionChange(isFormComplete(form.fields, values));
    // form.fields is stable per form; onCompletionChange is a parent callback
    // assumed referentially stable enough for this purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values]);

  // Returns {ok, message} so the parent (EditProfileScreen footer) can decide
  // how to surface the result in its own save banner.
  const onSave = async (): Promise<{ok: boolean; message?: string}> => {
    // Validate every leaf field locally before hitting the API. Required-empty
    // and format/length errors are surfaced inline on the offending field.
    const nextErrors: Record<string, string> = {};
    forEachLeafField(form.fields, f => {
      const err = validateField(f, values[f.name]);
      if (err) nextErrors[f.name] = err;
    });
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return {ok: false, message: 'Please complete the highlighted fields.'};
    }
    setMessage(null);
    setSaving(true);
    try {
      // Backend treats /submission/:formUuid as a POST endpoint for both
      // create and update — same body shape either way. Always send the
      // full `data` object; the server overwrites the entire submission.
      await authService.submitProfileForm(token, form.uuid, values);
      if (!hasExistingSubmission) setHasExistingSubmission(true);
      // Refetch the submission so the form shows server-normalised values
      // (e.g. canonical S3 paths, trimmed strings).
      try {
        const res = await authService.getProfileFormSubmission(
          token,
          form.uuid,
        );
        const submissionRecord =
          (res as any)?.data && typeof (res as any).data === 'object'
            ? (res as any).data
            : (res as any) || {};
        const fieldValues =
          submissionRecord?.data &&
          typeof submissionRecord.data === 'object' &&
          !Array.isArray(submissionRecord.data)
            ? submissionRecord.data
            : submissionRecord;
        const refreshed: Record<string, any> = {};
        forEachLeafField(form.fields, field => {
          refreshed[field.name] =
            fieldValues[field.name] != null
              ? fieldValues[field.name]
              : values[field.name];
        });
        setValues(refreshed);
        initialValuesRef.current = refreshed;
      } catch {
        // Refetch failed — fall back to the locally-typed values as the
        // baseline so the diff stays correct.
        initialValuesRef.current = {...values};
      }
      return {ok: true, message: 'Saved successfully.'};
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error ? error.message : 'Could not save this form.',
      };
    } finally {
      setSaving(false);
    }
  };

  // Expose save() + isBusy so the parent's footer SAVE can drive this form.
  useImperativeHandle(
    ref,
    () => ({
      save: onSave,
      isBusy:
        loading || saving || Object.keys(uploadingFields).length > 0,
    }),
    // `onSave` and `isBusy` close over current state — recompute the handle
    // whenever any of those inputs change so the parent always sees fresh values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loading, saving, uploadingFields, values, hasExistingSubmission],
  );

  // Resolve a stored S3 path into a fetchable URL. Empty / already-absolute
  // values (e.g. http:// during an in-progress local preview) pass through.
  const resolveFileUrl = (value: any): string => {
    if (!value) return '';
    const raw = String(value);
    if (/^(https?:|file:|data:|content:)/i.test(raw)) return raw;
    if (!imgKitUrl) return '';
    return `${imgKitUrl.replace(/\/$/, '')}/${raw.replace(/^\//, '')}`;
  };

  const handleFileUpload = async (field: DynamicField) => {
    try {
      if (typeof launchImageLibrary !== 'function') {
        Alert.alert(
          'Upload unavailable',
          'Image picker is not ready. Rebuild the app and try again.',
        );
        return;
      }

      const result = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
        includeBase64: false,
      });
      if (result.didCancel) return;
      if (result.errorCode) {
        Alert.alert(
          'Upload failed',
          result.errorMessage || 'Could not open the image picker.',
        );
        return;
      }

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        Alert.alert('Upload failed', 'No image was selected.');
        return;
      }

      // Enforce schema-declared file constraints before hitting the server.
      const allowedTypes = (field.file_types || []).map(t => t.toUpperCase());
      if (allowedTypes.length > 0) {
        const ext = (asset.fileName || asset.uri)
          .split('.')
          .pop()
          ?.toUpperCase();
        if (ext && !allowedTypes.includes(ext)) {
          Alert.alert(
            'Unsupported format',
            `Please choose one of: ${allowedTypes.join(', ')}`,
          );
          return;
        }
      }
      const maxSizeMb = Number(field.max_file_size) || 0;
      if (maxSizeMb > 0 && (asset.fileSize ?? 0) > maxSizeMb * 1024 * 1024) {
        Alert.alert(
          'File too large',
          `Please choose a file smaller than ${maxSizeMb} MB.`,
        );
        return;
      }

      setUploadingFields(prev => ({...prev, [field.name]: true}));
      const mime = asset.type || 'image/png';
      const extFromMime = mime.split('/')[1] || 'png';
      const res = await authService.uploadProfileFormFile(token, form.uuid, {
        uri: asset.uri,
        name: asset.fileName || `upload-${Date.now()}.${extFromMime}`,
        type: mime,
      });
      // Backend response carries the stored path under a key that varies
      // per backend version. First look at the common candidates, then fall
      // back to walking the whole response for any path-shaped string.
      const responseRecord =
        (res as any)?.data && typeof (res as any).data === 'object'
          ? (res as any).data
          : (res as any) || {};
      const looksLikeFilePath = (s: string) =>
        s.length > 0 &&
        (/\.(png|jpg|jpeg|gif|webp|pdf|svg|mp4|mov)(\?|$)/i.test(s) ||
          /^https?:\/\//i.test(s) ||
          /^[\w-]+\/[\w-]+\//i.test(s));
      const pickPathString = (node: any, depth = 0): string => {
        if (!node || depth > 5) return '';
        if (typeof node === 'string') {
          return looksLikeFilePath(node) ? node : '';
        }
        if (Array.isArray(node)) {
          for (const item of node) {
            const found = pickPathString(item, depth + 1);
            if (found) return found;
          }
          return '';
        }
        if (typeof node === 'object') {
          // Try common explicit keys first for predictability.
          const priorityKeys = [
            'path',
            'filePath',
            'file_path',
            'fileUrl',
            'file_url',
            'url',
            'location',
            'key',
            's3Key',
            's3_key',
            'fileName',
            'file_name',
          ];
          for (const key of priorityKeys) {
            const v = node[key];
            if (typeof v === 'string' && looksLikeFilePath(v)) return v;
          }
          // Fall back to a depth-first walk for anything path-shaped.
          for (const k of Object.keys(node)) {
            const found = pickPathString(node[k], depth + 1);
            if (found) return found;
          }
        }
        return '';
      };
      const storedPath = pickPathString(responseRecord);
      if (!storedPath) {
        // Surface the response shape in dev so the next round can pin the
        // right key — in release builds this is a no-op.
        if (__DEV__) {
          console.warn(
            '[CustomFormTab] upload response had no path-shaped string:',
            JSON.stringify(responseRecord),
          );
        }
        throw new Error('Upload succeeded but no file path was returned.');
      }
      setValues(prev => ({...prev, [field.name]: storedPath}));
      // Clear any pending error for this field once a file is in place.
      setFieldErrors(prev => {
        if (!prev[field.name]) return prev;
        const {[field.name]: _, ...rest} = prev;
        return rest;
      });
    } catch (error) {
      Alert.alert(
        'Upload failed',
        error instanceof Error ? error.message : 'Could not upload the file.',
      );
    } finally {
      setUploadingFields(prev => {
        const {[field.name]: _, ...rest} = prev;
        return rest;
      });
    }
  };

  const renderField = (field: DynamicField): React.ReactNode => {
    // Section containers render a header + recursively render their children.
    // Submission data stays flat so children are still keyed by their own
    // `name` in `values`.
    if (isSectionField(field)) {
      const children = getNestedFields(field);
      return (
        <View key={`section-${field.name}`} style={styles.section}>
          {children.map(child => renderField(child))}
        </View>
      );
    }

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
          const max = maxCharsOf(field);
          return (
            <View key={field.name}>
              <AppTextField
                label={label}
                required={required}
                error={fieldError}
                placeholder={field.placeholder}
                value={String(value || '')}
                onChangeText={text =>
                  setValue(max > 0 ? text.slice(0, max) : text)
                }
                multiline
                numberOfLines={4}
              />
              <CharCounter field={field} value={value} />
            </View>
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
          const maxEmail = maxCharsOf(field);
          return (
            <View key={field.name}>
              <AppTextField
                label={label}
                required={required}
                error={fieldError}
                placeholder={field.placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
                value={String(value || '')}
                onChangeText={text =>
                  setValue(maxEmail > 0 ? text.slice(0, maxEmail) : text)
                }
              />
              <CharCounter field={field} value={value} />
            </View>
          );
        }

        if (type === 'url') {
          const maxUrl = maxCharsOf(field);
          return (
            <View key={field.name}>
              <AppTextField
                label={label}
                required={required}
                error={fieldError}
                placeholder={field.placeholder}
                keyboardType="url"
                autoCapitalize="none"
                value={String(value || '')}
                onChangeText={text =>
                  setValue(maxUrl > 0 ? text.slice(0, maxUrl) : text)
                }
              />
              <CharCounter field={field} value={value} />
            </View>
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

        if (type === 'phone') {
          // Backend stores phone as an object with {number, dialCode, ...}.
          // Edit the `number` field in-place and preserve the rest of the
          // object so PATCH sends back the same shape the server returned.
          return (
            <AppTextField
              key={field.name}
              label={label}
              required={required}
              error={fieldError}
              placeholder={field.placeholder || 'Phone number'}
              keyboardType="phone-pad"
              value={phoneNumberOf(value)}
              onChangeText={text => setValue(setPhoneNumber(value, text))}
            />
          );
        }

        if (type === 'file') {
          // Upload UI mirroring the BasicInfoForm logo block: tappable square
          // preview on the left, label + constraints copy on the right.
          const fileUrl = resolveFileUrl(value);
          const uploading = Boolean(uploadingFields[field.name]);
          const fileTypesHint =
            field.file_types && field.file_types.length > 0
              ? `File types: ${field.file_types
                  .map(t => t.toLowerCase())
                  .join(', ')}`
              : null;
          const maxSize = Number(field.max_file_size) || 0;
          const maxSizeHint = maxSize > 0 ? `Max size ${maxSize}mb` : null;
          return (
            <View key={field.name} style={styles.uploadRow}>
              <Pressable
                onPress={() => !uploading && handleFileUpload(field)}
                disabled={uploading}
                style={[
                  styles.uploadBox,
                  fileUrl && styles.uploadBoxFilled,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Upload ${label}`}>
                {uploading ? (
                  <ActivityIndicator color={primaryColor} />
                ) : fileUrl ? (
                  <Image
                    source={{uri: fileUrl}}
                    style={styles.uploadImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.uploadPlaceholder}>
                    <Text style={styles.uploadPlaceholderText}>Upload</Text>
                  </View>
                )}
              </Pressable>
              <View style={styles.uploadCopy}>
                <Text style={styles.uploadLabel}>
                  {label}
                  {required ? <Text style={styles.required}> *</Text> : null}
                </Text>
                {fileTypesHint || maxSizeHint ? (
                  <Text style={styles.uploadHint}>
                    {[fileTypesHint, maxSizeHint].filter(Boolean).join('\n')}
                  </Text>
                ) : null}
                <Pressable
                  onPress={() => !uploading && handleFileUpload(field)}
                  disabled={uploading}>
                  <Text style={[styles.uploadAction, {color: primaryColor}]}>
                    {uploading
                      ? 'Uploading…'
                      : fileUrl
                        ? 'Tap image box to change'
                        : 'Tap image box to choose file'}
                  </Text>
                </Pressable>
                {fieldError ? (
                  <Text style={styles.fileError}>{fieldError}</Text>
                ) : null}
              </View>
            </View>
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
    const maxText = maxCharsOf(field);
    return (
      <View key={field.name}>
        <AppTextField
          label={label}
          required={required}
          error={fieldError}
          placeholder={field.placeholder}
          value={String(value || '')}
          onChangeText={text =>
            setValue(maxText > 0 ? text.slice(0, maxText) : text)
          }
        />
        <CharCounter field={field} value={value} />
      </View>
    );
  };

  const formTitle = form.formTitle || form.formCode || '';

  return (
    <View style={styles.card}>
      {formTitle ? (
        <View style={styles.titleRow}>
          <View style={[styles.titleBar, {backgroundColor: primaryColor}]} />
          <Text style={styles.title}>{formTitle}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={primaryColor} />
        </View>
      ) : null}

      {form.fields.map(renderField)}

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
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    gap: 14,
    marginBottom: 24,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  titleBar: {
    width: 4,
    height: 22,
    borderRadius: 2,
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
  fileField: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderColor: '#e2e8f0',
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  uploadRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  uploadBox: {
    width: 90,
    height: 90,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  uploadBoxFilled: {
    backgroundColor: '#ffffff',
  },
  uploadImage: {
    width: '100%',
    height: '100%',
  },
  uploadPlaceholder: {
    alignItems: 'center',
    gap: 4,
  },
  uploadPlaceholderText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  uploadCopy: {
    flex: 1,
  },
  uploadLabel: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
  uploadHint: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18,
  },
  uploadAction: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  fileLabel: {
    fontWeight: '600',
    color: '#0f172a',
    fontSize: 14,
  },
  fileName: {
    color: '#0f172a',
    fontSize: 13,
  },
  fileEmpty: {
    color: '#94a3b8',
    fontSize: 13,
    fontStyle: 'italic',
  },
  fileHint: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 18,
  },
  fileError: {
    color: '#dc2626',
    fontSize: 12,
  },
  required: {
    color: '#dc2626',
  },
  section: {
    gap: 12,
    marginTop: 6,
  },
  sectionLabel: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
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
