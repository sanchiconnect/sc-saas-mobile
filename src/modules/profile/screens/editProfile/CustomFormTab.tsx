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
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {launchImageLibrary} from 'react-native-image-picker';
import {pick, types as docTypes} from '@react-native-documents/picker';

import {Picker as ModalPicker} from './Picker';

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
  | 'year'
  | 'phone'
  | 'file'
  | 'select'
  | 'multi-select'
  | 'checkbox'
  | 'radio'
  | 'country'
  | 'geography'
  | 'range'
  | 'radio-grid'
  | 'checkbox-grid'
  | 'text-grid'
  | 'number-grid';

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
  // Numeric / range_slider bounds + step.
  min_value?: string | number;
  max_value?: string | number;
  step?: string | number;
  // Grid types use rows × columns to define the matrix layout.
  rows?: string[];
  columns?: string[];
  // Geography picker uses these flags to decide which legs to render and
  // whether each is mandatory. Mirrors the backend shape exactly.
  geography_settings?: {
    country_visible?: string;
    country_mandatory?: string;
    state_visible?: string;
    state_mandatory?: string;
    city_visible?: string;
    city_mandatory?: string;
  };
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
    // Phone field shape: empty when `number` is blank.
    if ('number' in value && typeof value.number !== 'object') {
      return String(value.number ?? '').trim().length === 0;
    }
    // Geography picker: empty when no leg is selected.
    if ('country' in value || 'state' in value || 'city' in value) {
      return !value.country && !value.state && !value.city;
    }
    // Grids and other Record shapes: empty when no row carries data.
    return Object.values(value).every(v => isEmptyValue(v));
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

// PanResponder-driven range slider. Built inline because the project doesn't
// ship `@react-native-community/slider` — this avoids a new native dep.
function RangeSlider({
  value,
  min,
  max,
  step,
  onChange,
  primaryColor,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  primaryColor: string;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  // Keep latest state visible to the PanResponder closures, which are
  // created once via useRef and would otherwise capture stale values.
  const stateRef = useRef({trackWidth, min, max, step, onChange});
  stateRef.current = {trackWidth, min, max, step, onChange};

  const computeFromX = (x: number): number => {
    const s = stateRef.current;
    if (s.trackWidth <= 0 || s.max <= s.min) return s.min;
    const ratio = Math.max(0, Math.min(1, x / s.trackWidth));
    let v = s.min + ratio * (s.max - s.min);
    if (s.step > 0) {
      v = Math.round((v - s.min) / s.step) * s.step + s.min;
    }
    return Math.max(s.min, Math.min(s.max, v));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: evt => {
        stateRef.current.onChange(computeFromX(evt.nativeEvent.locationX));
      },
      onPanResponderMove: evt => {
        stateRef.current.onChange(computeFromX(evt.nativeEvent.locationX));
      },
    }),
  ).current;

  const ratio =
    trackWidth > 0 && max > min
      ? Math.max(0, Math.min(1, (value - min) / (max - min)))
      : 0;
  const thumbCenter = ratio * trackWidth;

  // Pill width estimate so we can clamp it inside the track bounds.
  const pillHalfWidth = 16;
  const pillLeft = Math.max(
    0,
    Math.min(trackWidth - pillHalfWidth * 2, thumbCenter - pillHalfWidth),
  );

  return (
    <View style={rangeStyles.wrap}>
      <View style={rangeStyles.bounds}>
        <Text style={rangeStyles.boundsLabel}>{min}</Text>
        <Text style={rangeStyles.boundsLabel}>{max}</Text>
      </View>
      <View
        style={rangeStyles.track}
        onLayout={e => setTrackWidth(e.nativeEvent.layout.width)}
        {...panResponder.panHandlers}>
        {/* Grey rail spanning the full track. The blue fill sits on top. */}
        <View style={rangeStyles.trackRail} pointerEvents="none" />
        <View
          style={[
            rangeStyles.trackFill,
            {width: thumbCenter, backgroundColor: primaryColor},
          ]}
          pointerEvents="none"
        />
        <View
          style={[
            rangeStyles.thumb,
            {
              left: Math.max(0, thumbCenter - 10),
              backgroundColor: primaryColor,
              borderColor: primaryColor,
            },
          ]}
          pointerEvents="none"
        />
      </View>
      {/* Value pill floats above the thumb so the user always sees the
          current value at the drag point — matches the web's design. */}
      <View
        style={[
          rangeStyles.valuePill,
          {backgroundColor: primaryColor, left: pillLeft},
        ]}
        pointerEvents="none">
        <Text style={rangeStyles.valuePillText}>{value}</Text>
      </View>
    </View>
  );
}

const rangeStyles = StyleSheet.create({
  // Slider has 3 rows logically (bounds above, track in middle, value pill
  // above the thumb). The pill is absolutely positioned so we leave it room
  // by giving the wrap some bottom padding instead of using a layout row.
  wrap: {gap: 4, marginTop: 4, paddingTop: 28, position: 'relative'},
  bounds: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  boundsLabel: {color: '#0f172a', fontSize: 13, fontWeight: '600'},
  valuePill: {
    position: 'absolute',
    top: 0,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 32,
    alignItems: 'center',
  },
  valuePillText: {color: '#ffffff', fontSize: 13, fontWeight: '700'},
  track: {height: 28, justifyContent: 'center', paddingVertical: 12},
  trackRail: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
  },
  trackFill: {position: 'absolute', left: 0, height: 4, borderRadius: 2},
  thumb: {
    position: 'absolute',
    top: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 3,
    shadowColor: '#0f172a',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
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
  if (t === 'date' || t === 'date-field' || t === 'date-picker') return 'date';
  if (t === 'year' || t === 'year-picker' || t === 'year-field') return 'year';
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
    t === 'dropdown-field' ||
    t === 'selectbox-field'
  ) {
    return 'select';
  }
  if (
    t === 'multi-select' ||
    t === 'multiselect' ||
    t === 'checkbox-group' ||
    t === 'multi-select-field' ||
    t === 'multi-selectbox-field'
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
  if (t === 'radio' || t === 'radio-field' || t === 'radio-button') {
    return 'radio';
  }
  if (t === 'country' || t === 'country-picker' || t === 'country-field') {
    return 'country';
  }
  if (
    t === 'geography' ||
    t === 'geography-picker' ||
    t === 'location-picker'
  ) {
    return 'geography';
  }
  if (t === 'range' || t === 'range-slider' || t === 'slider') return 'range';
  if (t === 'radio-grid') return 'radio-grid';
  if (t === 'checkbox-grid') return 'checkbox-grid';
  if (t === 'text-input-grid' || t === 'text-grid') return 'text-grid';
  if (t === 'number-input-grid' || t === 'number-grid') return 'number-grid';
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
    min_value: value.min_value,
    max_value: value.max_value,
    step: value.step,
    rows: Array.isArray(value.rows) ? value.rows : undefined,
    columns: Array.isArray(value.columns) ? value.columns : undefined,
    geography_settings: value.geography_settings,
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

const toOptions = (
  raw?: Array<DynamicFieldOption | string | number>,
): MultiSelectOption[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o, i) => {
      // Schema commonly ships plain string options (e.g. ["asds", "bdf"]) —
      // treat the raw scalar as both the id and the label.
      if (typeof o === 'string' || typeof o === 'number') {
        return {id: String(o), name: String(o)};
      }
      return {
        id: (o?.id ?? o?.value ?? i) as number | string,
        name: String(o?.name || o?.label || o?.value || ''),
      };
    })
    .filter(o => String(o.name).length > 0);
};

const seedDefault = (field: DynamicField): any => {
  const type = normaliseType(String(field.type || ''));
  const def = field.default_value;
  if (type === 'multi-select') {
    return Array.isArray(def) ? def : [];
  }
  if (type === 'checkbox') {
    // checkbox_field with options is multi-select; without options is boolean.
    if (Array.isArray(field.options) && field.options.length > 0) {
      return Array.isArray(def) ? def : [];
    }
    return Boolean(def);
  }
  // Grid types store a Record keyed by row name. Cells inside are either
  // a string (selected column for radio-grid / text-grid / number-grid)
  // or a string[] (multi-checkbox-grid).
  if (
    type === 'radio-grid' ||
    type === 'text-grid' ||
    type === 'number-grid' ||
    type === 'checkbox-grid'
  ) {
    return def && typeof def === 'object' ? def : {};
  }
  if (type === 'geography') {
    return def && typeof def === 'object'
      ? def
      : {country: '', state: '', city: ''};
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
  const {globalSetting, baseUrl} = useContext(TenantContext);
  // Stored file values are S3 paths; resolve to a full URL for the <Image>
  // preview using the tenant's imgKit / assetsImgKit URL (whichever is set).
  const imgKitUrl =
    globalSetting?.imgKitUrl || globalSetting?.assetsImgKitUrl || '';
  // Lazily-fetched location lists for country_picker / geography_picker.
  // Countries load once when any geo field is present; states/cities load
  // per-selection so we don't fetch them unless the user opens the picker.
  const [countryList, setCountryList] = useState<Array<{id: number; name: string}>>([]);
  const [stateLists, setStateLists] = useState<
    Record<string, Array<{id: number; name: string}>>
  >({});
  const [cityLists, setCityLists] = useState<
    Record<string, Array<{id: number; name: string}>>
  >({});
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
  // Currently-open picker modal (one global picker; only one open at a time).
  // `kind` tells the render which list to show + how to apply the selection.
  type PickerKind =
    | {kind: 'select'; fieldName: string; title: string; options: string[]}
    | {kind: 'country'; fieldName: string}
    | {kind: 'geo-country'; fieldName: string}
    | {kind: 'geo-state'; fieldName: string; countryId: number}
    | {kind: 'geo-city'; fieldName: string; stateId: number}
    | {kind: 'year'; fieldName: string}
    | {kind: 'month'; fieldName: string; year: string}
    | {kind: 'day'; fieldName: string; year: string; month: string};
  const [activePicker, setActivePicker] = useState<PickerKind | null>(null);
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

    if (type === 'number' || type === 'range') {
      const n = Number(value);
      if (!Number.isFinite(n)) {
        return `${label} must be a number.`;
      }
      const minV = numberOrNull(field.min_value);
      const maxV = numberOrNull(field.max_value);
      if (minV !== null && n < minV) {
        return `${label} must be at least ${minV}.`;
      }
      if (maxV !== null && n > maxV) {
        return `${label} must be at most ${maxV}.`;
      }
    }

    if (type === 'year') {
      const s = String(value || '');
      if (!/^\d{4}$/.test(s)) {
        return `${label} must be a 4-digit year.`;
      }
    }

    return '';
  };

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Load countries lazily — only when the form actually uses country_picker
  // or geography_picker. Avoids hitting /global/countries for forms that
  // don't need it.
  useEffect(() => {
    if (!baseUrl || countryList.length > 0) return;
    let needs = false;
    forEachLeafField(form.fields, f => {
      const t = normaliseType(String(f.type || ''));
      if (t === 'country' || t === 'geography') needs = true;
    });
    if (!needs) return;
    let cancelled = false;
    fetch(`${baseUrl.replace(/\/$/, '')}/api/v1/public/global/countries`)
      .then(r => r.json())
      .then(payload => {
        if (cancelled) return;
        const raw = payload?.data || payload?.results || payload || [];
        if (!Array.isArray(raw)) return;
        setCountryList(
          raw
            .map((c: any) => ({
              id: Number(c?.id ?? c?.value ?? c?._id),
              name: String(c?.name ?? c?.label ?? ''),
            }))
            .filter(c => Number.isFinite(c.id) && c.name.length > 0),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [baseUrl, form.fields, countryList.length]);

  // Fetch states for a country and stash by field+country key so revisiting
  // doesn't refetch.
  const ensureStates = async (
    fieldName: string,
    countryId: number,
  ): Promise<Array<{id: number; name: string}>> => {
    const key = `${fieldName}:${countryId}`;
    if (stateLists[key]) return stateLists[key];
    if (!baseUrl) return [];
    try {
      const res = await fetch(
        `${baseUrl.replace(/\/$/, '')}/api/v1/public/global/states/${countryId}`,
      );
      const payload = await res.json();
      const raw = payload?.data || payload?.results || payload || [];
      if (!Array.isArray(raw)) return [];
      const list = raw
        .map((s: any) => ({
          id: Number(s?.id ?? s?.value ?? s?._id),
          name: String(s?.name ?? s?.label ?? ''),
        }))
        .filter((s: {id: number; name: string}) => Number.isFinite(s.id) && s.name.length > 0);
      setStateLists(prev => ({...prev, [key]: list}));
      return list;
    } catch {
      return [];
    }
  };

  const ensureCities = async (
    fieldName: string,
    stateId: number,
  ): Promise<Array<{id: number; name: string}>> => {
    const key = `${fieldName}:${stateId}`;
    if (cityLists[key]) return cityLists[key];
    if (!baseUrl) return [];
    try {
      const res = await fetch(
        `${baseUrl.replace(/\/$/, '')}/api/v1/public/global/cities/${stateId}`,
      );
      const payload = await res.json();
      const raw = payload?.data || payload?.results || payload || [];
      if (!Array.isArray(raw)) return [];
      const list = raw
        .map((c: any) => ({
          id: Number(c?.id ?? c?.value ?? c?._id),
          name: String(c?.name ?? c?.label ?? ''),
        }))
        .filter((c: {id: number; name: string}) => Number.isFinite(c.id) && c.name.length > 0);
      setCityLists(prev => ({...prev, [key]: list}));
      return list;
    } catch {
      return [];
    }
  };

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

  // Schema's file_types are UPPERCASE extension names (PDF/DOC/...). Map
  // them to the document-picker MIME constants so the OS picker only shows
  // what the form actually accepts.
  const fileExtToMime = (ext: string): string[] => {
    const e = ext.toUpperCase();
    const t = docTypes as any;
    if (e === 'PDF') return [t.pdf];
    if (e === 'DOC') return [t.doc];
    if (e === 'DOCX') return [t.docx];
    if (e === 'PPT') return [t.ppt];
    if (e === 'PPTX') return [t.pptx];
    if (e === 'XLS') return [t.xls];
    if (e === 'XLSX') return [t.xlsx];
    if (e === 'CSV') {
      return Array.isArray(t.csv) ? t.csv.slice() : [t.csv];
    }
    if (e === 'TXT') return [t.plainText];
    if (e === 'JSON') return [t.json];
    if (e === 'ZIP') return [t.zip];
    if (e === 'PNG' || e === 'JPG' || e === 'JPEG' || e === 'GIF') {
      return [t.images];
    }
    return [];
  };

  const pickFromGallery = async (
    field: DynamicField,
  ): Promise<{uri: string; name: string; type: string} | null> => {
    if (typeof launchImageLibrary !== 'function') {
      Alert.alert(
        'Upload unavailable',
        'Image picker is not ready. Rebuild the app and try again.',
      );
      return null;
    }
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      includeBase64: false,
    });
    if (result.didCancel) return null;
    if (result.errorCode) {
      Alert.alert(
        'Upload failed',
        result.errorMessage || 'Could not open the image picker.',
      );
      return null;
    }
    const asset = result.assets?.[0];
    if (!asset?.uri) {
      Alert.alert('Upload failed', 'No image was selected.');
      return null;
    }
    const allowedTypes = (field.file_types || []).map(t => t.toUpperCase());
    if (allowedTypes.length > 0) {
      const ext = (asset.fileName || asset.uri).split('.').pop()?.toUpperCase();
      if (ext && !allowedTypes.includes(ext)) {
        Alert.alert(
          'Unsupported format',
          `Please choose one of: ${allowedTypes.join(', ')}`,
        );
        return null;
      }
    }
    const maxSizeMb = Number(field.max_file_size) || 0;
    if (maxSizeMb > 0 && (asset.fileSize ?? 0) > maxSizeMb * 1024 * 1024) {
      Alert.alert(
        'File too large',
        `Please choose a file smaller than ${maxSizeMb} MB.`,
      );
      return null;
    }
    const mime = asset.type || 'image/png';
    const extFromMime = mime.split('/')[1] || 'png';
    return {
      uri: asset.uri,
      name: asset.fileName || `upload-${Date.now()}.${extFromMime}`,
      type: mime,
    };
  };

  const pickFromDocuments = async (
    field: DynamicField,
  ): Promise<{uri: string; name: string; type: string} | null> => {
    const allowedTypes = (field.file_types || []).map(t => t.toUpperCase());
    const mimeList = Array.from(
      new Set(allowedTypes.flatMap(ext => fileExtToMime(ext))),
    ).filter(Boolean);
    try {
      const [result] = await pick({
        type: mimeList.length > 0 ? mimeList : [docTypes.allFiles],
        allowMultiSelection: false,
      });
      if (!result?.uri) {
        Alert.alert('Upload failed', 'No file was selected.');
        return null;
      }
      if (allowedTypes.length > 0) {
        const ext = (result.name || result.uri)
          .split('.')
          .pop()
          ?.toUpperCase();
        if (ext && !allowedTypes.includes(ext)) {
          Alert.alert(
            'Unsupported format',
            `Please choose one of: ${allowedTypes.join(', ')}`,
          );
          return null;
        }
      }
      const maxSizeMb = Number(field.max_file_size) || 0;
      if (maxSizeMb > 0 && (result.size ?? 0) > maxSizeMb * 1024 * 1024) {
        Alert.alert(
          'File too large',
          `Please choose a file smaller than ${maxSizeMb} MB.`,
        );
        return null;
      }
      return {
        uri: result.uri,
        name: result.name || `upload-${Date.now()}`,
        type: result.type || 'application/octet-stream',
      };
    } catch (err: any) {
      const code = err?.code || err?.userInfo?.code || '';
      if (typeof code === 'string' && /cancel/i.test(code)) return null;
      Alert.alert(
        'Upload failed',
        err instanceof Error ? err.message : 'Could not open the file picker.',
      );
      return null;
    }
  };

  const handleFileUpload = async (field: DynamicField) => {
    try {
      // image_upload sticks with the image library; file_upload goes through
      // the document picker so users can attach PDFs / DOCX / XLSX / etc.
      const rawType = String(field.type || '').toLowerCase();
      const useImagePicker =
        rawType.includes('image') ||
        ((field.file_types || []).length > 0 &&
          (field.file_types || []).every(t =>
            ['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP'].includes(t.toUpperCase()),
          ));
      const picked = useImagePicker
        ? await pickFromGallery(field)
        : await pickFromDocuments(field);
      if (!picked) return;

      setUploadingFields(prev => ({...prev, [field.name]: true}));
      const res = await authService.uploadProfileFormFile(
        token,
        form.uuid,
        picked,
      );
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

        if (type === 'year') {
          // 4-digit numeric input — same pattern Basic Info uses for
          // "Year of Incorporation". Strips non-digits and clamps to 4 chars.
          return (
            <AppTextField
              key={field.name}
              label={label}
              required={required}
              error={fieldError}
              placeholder={field.placeholder || 'YYYY'}
              keyboardType="number-pad"
              value={String(value || '')}
              onChangeText={text =>
                setValue(text.replace(/[^0-9]/g, '').slice(0, 4))
              }
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
          // When the schema ships `options[]`, `checkbox_field` is really a
          // bounded multi-select (max_selections caps the picks). When
          // options are absent, it's a plain boolean toggle.
          const opts = toOptions(field.options);
          if (opts.length > 0) {
            const selected = Array.isArray(value) ? value : [];
            const cap = Number(field.max_selections) || 0;
            const toggle = (name: string) => {
              if (selected.includes(name)) {
                setValue(selected.filter(n => n !== name));
              } else {
                if (cap > 0 && selected.length >= cap) return;
                setValue([...selected, name]);
              }
            };
            const capSuffix = cap > 0 ? ` (Max ${cap})` : '';
            return (
              <View key={field.name} style={styles.fieldGroup}>
                <Text style={styles.fieldGroupLabel}>
                  {label}
                  {required ? <Text style={styles.required}> *</Text> : null}
                  {capSuffix ? (
                    <Text style={styles.optionsHint}>{capSuffix}</Text>
                  ) : null}
                </Text>
                {field.placeholder ? (
                  <Text style={styles.optionsHint}>{field.placeholder}</Text>
                ) : null}
                <View style={styles.optionsGrid}>
                  {opts.map(opt => {
                    const isOn = selected.includes(String(opt.name));
                    return (
                      <Pressable
                        key={String(opt.id)}
                        onPress={() => toggle(String(opt.name))}
                        style={[
                          styles.optionCard,
                          isOn && styles.optionCardSelected,
                          isOn && {borderColor: primaryColor},
                        ]}>
                        <View
                          style={[
                            styles.checkboxOuter,
                            isOn && {
                              backgroundColor: primaryColor,
                              borderColor: primaryColor,
                            },
                          ]}>
                          {isOn ? (
                            <Text style={styles.checkboxTick}>✓</Text>
                          ) : null}
                        </View>
                        <Text style={styles.optionCardLabel}>{opt.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {fieldError ? (
                  <Text style={styles.fileError}>{fieldError}</Text>
                ) : null}
              </View>
            );
          }
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

        if (type === 'radio') {
          // Single-select rendered as bordered option cards.
          const opts = toOptions(field.options);
          return (
            <View key={field.name} style={styles.fieldGroup}>
              <Text style={styles.fieldGroupLabel}>
                {label}
                {required ? <Text style={styles.required}> *</Text> : null}
              </Text>
              {field.placeholder ? (
                <Text style={styles.optionsHint}>{field.placeholder}</Text>
              ) : null}
              <View style={styles.optionsGrid}>
                {opts.map(opt => {
                  const selected = String(value) === String(opt.name);
                  return (
                    <Pressable
                      key={String(opt.id)}
                      onPress={() => setValue(opt.name)}
                      style={[
                        styles.optionCard,
                        selected && styles.optionCardSelected,
                        selected && {borderColor: primaryColor},
                      ]}>
                      <View
                        style={[
                          styles.radioOuter,
                          selected && {borderColor: primaryColor},
                        ]}>
                        {selected ? (
                          <View
                            style={[
                              styles.radioInner,
                              {backgroundColor: primaryColor},
                            ]}
                          />
                        ) : null}
                      </View>
                      <Text style={styles.optionCardLabel}>{opt.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {fieldError ? (
                <Text style={styles.fileError}>{fieldError}</Text>
              ) : null}
            </View>
          );
        }

        if (type === 'country') {
          // Live country list from /global/countries. Stores the selected
          // country's `name` for now (web stores it the same way for this
          // field type).
          const display = String(value || '');
          return (
            <View key={field.name}>
              <Pressable
                style={styles.dropdownTrigger}
                onPress={() =>
                  setActivePicker({kind: 'country', fieldName: field.name})
                }>
                <View style={{flex: 1}}>
                  <Text style={styles.dropdownLabel}>
                    {label}
                    {required ? (
                      <Text style={styles.required}> *</Text>
                    ) : null}
                  </Text>
                  <Text
                    style={[
                      styles.dropdownValue,
                      !display && styles.dropdownPlaceholder,
                    ]}>
                    {display || field.placeholder || 'Please choose a country'}
                  </Text>
                </View>
                <Text style={styles.dropdownCaret}>▾</Text>
              </Pressable>
              {fieldError ? (
                <Text style={styles.fileError}>{fieldError}</Text>
              ) : null}
            </View>
          );
        }

        if (type === 'geography') {
          // Cascading country / state / city pickers. Stored value shape is
          // {country, countryId, state, stateId, city, cityId} so the backend
          // can pick names or IDs depending on what it expects.
          const settings = field.geography_settings || {};
          const showCountry = settings.country_visible !== '0';
          const showState = settings.state_visible !== '0';
          const showCity = settings.city_visible !== '0';
          const reqCountry = settings.country_mandatory === '1';
          const reqState = settings.state_mandatory === '1';
          const reqCity = settings.city_mandatory === '1';
          const geo: {
            country?: string;
            countryId?: number;
            state?: string;
            stateId?: number;
            city?: string;
            cityId?: number;
          } = value && typeof value === 'object' ? value : {};
          return (
            <View key={field.name} style={styles.fieldGroup}>
              <Text style={styles.fieldGroupLabel}>
                {label}
                {required ? <Text style={styles.required}> *</Text> : null}
              </Text>
              {field.placeholder ? (
                <Text style={styles.optionsHint}>{field.placeholder}</Text>
              ) : null}
              {showCountry ? (
                <Pressable
                  style={styles.dropdownTrigger}
                  onPress={() =>
                    setActivePicker({
                      kind: 'geo-country',
                      fieldName: field.name,
                    })
                  }>
                  <View style={{flex: 1}}>
                    <Text style={styles.dropdownLabel}>
                      Country
                      {reqCountry ? (
                        <Text style={styles.required}> *</Text>
                      ) : null}
                    </Text>
                    <Text
                      style={[
                        styles.dropdownValue,
                        !geo.country && styles.dropdownPlaceholder,
                      ]}>
                      {geo.country || 'Choose a country'}
                    </Text>
                  </View>
                  <Text style={styles.dropdownCaret}>▾</Text>
                </Pressable>
              ) : null}
              {showState ? (
                <Pressable
                  style={styles.dropdownTrigger}
                  onPress={() => {
                    if (!geo.countryId) return;
                    setActivePicker({
                      kind: 'geo-state',
                      fieldName: field.name,
                      countryId: geo.countryId,
                    });
                  }}>
                  <View style={{flex: 1}}>
                    <Text style={styles.dropdownLabel}>
                      State
                      {reqState ? (
                        <Text style={styles.required}> *</Text>
                      ) : null}
                    </Text>
                    <Text
                      style={[
                        styles.dropdownValue,
                        !geo.state && styles.dropdownPlaceholder,
                      ]}>
                      {geo.state ||
                        (geo.countryId ? 'Choose a state' : 'Pick a country first')}
                    </Text>
                  </View>
                  <Text style={styles.dropdownCaret}>▾</Text>
                </Pressable>
              ) : null}
              {showCity ? (
                <Pressable
                  style={styles.dropdownTrigger}
                  onPress={() => {
                    if (!geo.stateId) return;
                    setActivePicker({
                      kind: 'geo-city',
                      fieldName: field.name,
                      stateId: geo.stateId,
                    });
                  }}>
                  <View style={{flex: 1}}>
                    <Text style={styles.dropdownLabel}>
                      City
                      {reqCity ? <Text style={styles.required}> *</Text> : null}
                    </Text>
                    <Text
                      style={[
                        styles.dropdownValue,
                        !geo.city && styles.dropdownPlaceholder,
                      ]}>
                      {geo.city ||
                        (geo.stateId ? 'Choose a city' : 'Pick a state first')}
                    </Text>
                  </View>
                  <Text style={styles.dropdownCaret}>▾</Text>
                </Pressable>
              ) : null}
              {fieldError ? (
                <Text style={styles.fileError}>{fieldError}</Text>
              ) : null}
            </View>
          );
        }

        if (type === 'date') {
          // 3-step picker: year → month → day. Stores YYYY-MM-DD.
          const display = String(value || '');
          return (
            <View key={field.name}>
              <Pressable
                style={styles.dropdownTrigger}
                onPress={() =>
                  setActivePicker({kind: 'year', fieldName: field.name})
                }>
                <View style={{flex: 1}}>
                  <Text style={styles.dropdownLabel}>
                    {label}
                    {required ? (
                      <Text style={styles.required}> *</Text>
                    ) : null}
                  </Text>
                  <Text
                    style={[
                      styles.dropdownValue,
                      !display && styles.dropdownPlaceholder,
                    ]}>
                    {display || field.placeholder || 'Choose a date'}
                  </Text>
                </View>
                <Text style={styles.dropdownCaret}>▾</Text>
              </Pressable>
              {fieldError ? (
                <Text style={styles.fileError}>{fieldError}</Text>
              ) : null}
            </View>
          );
        }

        if (type === 'range') {
          const min = numberOrNull(field.min_value) ?? 0;
          const max = numberOrNull(field.max_value) ?? 100;
          const step = numberOrNull(field.step) ?? 1;
          const numericValue = (() => {
            const n = Number(value);
            return Number.isFinite(n) ? n : min;
          })();
          return (
            <View key={field.name} style={styles.fieldGroup}>
              <Text style={styles.fieldGroupLabel}>
                {label}
                {required ? <Text style={styles.required}> *</Text> : null}
              </Text>
              <RangeSlider
                value={numericValue}
                min={min}
                max={max}
                step={step}
                primaryColor={primaryColor}
                onChange={v => setValue(v)}
              />
              {fieldError ? (
                <Text style={styles.fileError}>{fieldError}</Text>
              ) : null}
            </View>
          );
        }

        if (
          type === 'radio-grid' ||
          type === 'checkbox-grid' ||
          type === 'text-grid' ||
          type === 'number-grid'
        ) {
          // Unified table layout — horizontally scrollable. Row labels are
          // the first column; data cells span the remaining columns.
          //   • radio-grid:    value = { [row]: selectedColumn }
          //   • checkbox-grid: value = { [row]: string[] of selected columns }
          //   • text-grid:     value = { [row]: { [col]: string } }
          //   • number-grid:   same as text-grid, numeric-only input
          const rows = field.rows || [];
          const columns = field.columns || [];
          const grid =
            value && typeof value === 'object' ? (value as Record<string, any>) : {};

          // Render the whole cell as either a Pressable (radio/checkbox grids)
          // or a View containing the TextInput (text/number grids). The cell
          // IS the touch target so taps anywhere in the 120×N area register.
          const renderCell = (row: string, col: string, cIdx: number) => {
            if (type === 'radio-grid') {
              const selected = grid[row] === col;
              return (
                <Pressable
                  key={`${col}-${cIdx}`}
                  onPress={() => setValue({...grid, [row]: col})}
                  style={styles.gridTableCell}>
                  <View
                    style={[
                      styles.radioOuter,
                      selected && {borderColor: primaryColor},
                    ]}>
                    {selected ? (
                      <View
                        style={[
                          styles.radioInner,
                          {backgroundColor: primaryColor},
                        ]}
                      />
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.gridTableCellLabel,
                      selected && {color: primaryColor, fontWeight: '700'},
                    ]}
                    numberOfLines={2}>
                    {col}
                  </Text>
                </Pressable>
              );
            }
            if (type === 'checkbox-grid') {
              const current = Array.isArray(grid[row]) ? grid[row] : [];
              const selected = current.includes(col);
              return (
                <Pressable
                  key={`${col}-${cIdx}`}
                  onPress={() => {
                    const next = selected
                      ? current.filter((c: string) => c !== col)
                      : [...current, col];
                    setValue({...grid, [row]: next});
                  }}
                  style={styles.gridTableCell}>
                  <View
                    style={[
                      styles.checkboxOuter,
                      selected && {
                        backgroundColor: primaryColor,
                        borderColor: primaryColor,
                      },
                    ]}>
                    {selected ? (
                      <Text style={styles.checkboxTick}>✓</Text>
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.gridTableCellLabel,
                      selected && {color: primaryColor, fontWeight: '700'},
                    ]}
                    numberOfLines={2}>
                    {col}
                  </Text>
                </Pressable>
              );
            }
            const isNumeric = type === 'number-grid';
            const cellVal = String(grid[row]?.[col] ?? '');
            return (
              <View key={`${col}-${cIdx}`} style={styles.gridTableCell}>
                <TextInput
                  value={cellVal}
                  keyboardType={isNumeric ? 'numeric' : 'default'}
                  onChangeText={text => {
                    const rowVals = grid[row] || {};
                    setValue({
                      ...grid,
                      [row]: {
                        ...rowVals,
                        [col]: isNumeric
                          ? text.replace(/[^0-9.\-]/g, '')
                          : text,
                      },
                    });
                  }}
                  style={styles.gridTableCellInput}
                  placeholder=""
                />
              </View>
            );
          };

          return (
            <View key={field.name} style={styles.fieldGroup}>
              <Text style={styles.fieldGroupLabel}>
                {label}
                {required ? <Text style={styles.required}> *</Text> : null}
              </Text>
              {field.placeholder ? (
                <Text style={styles.optionsHint}>{field.placeholder}</Text>
              ) : null}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.gridTable}>
                <View>
                  <View style={styles.gridTableHeader}>
                    <View style={styles.gridTableHeaderCell} />
                    {columns.map((col, i) => (
                      <View
                        key={`${col}-${i}`}
                        style={styles.gridTableHeaderCell}>
                        <Text style={styles.gridTableHeaderText}>{col}</Text>
                      </View>
                    ))}
                  </View>
                  {rows.map((row, rIdx) => (
                    <View
                      key={`${row}-${rIdx}`}
                      style={[
                        styles.gridTableRow,
                        rIdx === rows.length - 1 && styles.gridTableRowLast,
                      ]}>
                      <View style={styles.gridTableRowLabel}>
                        <Text style={styles.gridTableRowLabelText}>{row}</Text>
                      </View>
                      {columns.map((col, cIdx) => renderCell(row, col, cIdx))}
                    </View>
                  ))}
                </View>
              </ScrollView>
              {type === 'number-grid' ? (
                <Text style={styles.gridHint}>
                  * Enter numeric values only
                </Text>
              ) : null}
              {fieldError ? (
                <Text style={styles.fileError}>{fieldError}</Text>
              ) : null}
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

      {/* One ModalPicker — driven by activePicker.kind. Handles country,
          cascading geography, and the 3-step date selection. */}
      {activePicker ? (() => {
        const close = () => setActivePicker(null);
        if (activePicker.kind === 'country') {
          return (
            <ModalPicker
              visible
              title="Choose a country"
              options={countryList.map(c => c.name)}
              selected={String(values[activePicker.fieldName] || '')}
              primaryColor={primaryColor}
              searchable
              onClose={close}
              onSelect={name => {
                setValues(prev => ({...prev, [activePicker.fieldName]: name}));
                close();
              }}
            />
          );
        }
        if (activePicker.kind === 'geo-country') {
          const fieldName = activePicker.fieldName;
          const geo = values[fieldName] || {};
          return (
            <ModalPicker
              visible
              title="Choose a country"
              options={countryList.map(c => c.name)}
              selected={String(geo.country || '')}
              primaryColor={primaryColor}
              searchable
              onClose={close}
              onSelect={name => {
                const match = countryList.find(c => c.name === name);
                setValues(prev => ({
                  ...prev,
                  [fieldName]: {
                    ...geo,
                    country: name,
                    countryId: match?.id,
                    // Reset downstream legs when country changes.
                    state: '',
                    stateId: undefined,
                    city: '',
                    cityId: undefined,
                  },
                }));
                close();
                if (match?.id) ensureStates(fieldName, match.id);
              }}
            />
          );
        }
        if (activePicker.kind === 'geo-state') {
          const fieldName = activePicker.fieldName;
          const geo = values[fieldName] || {};
          const stateKey = `${fieldName}:${activePicker.countryId}`;
          const list = stateLists[stateKey] || [];
          if (list.length === 0) {
            ensureStates(fieldName, activePicker.countryId);
          }
          return (
            <ModalPicker
              visible
              title="Choose a state"
              options={list.map(s => s.name)}
              selected={String(geo.state || '')}
              primaryColor={primaryColor}
              searchable
              emptyMessage="Loading states…"
              onClose={close}
              onSelect={name => {
                const match = list.find(s => s.name === name);
                setValues(prev => ({
                  ...prev,
                  [fieldName]: {
                    ...geo,
                    state: name,
                    stateId: match?.id,
                    city: '',
                    cityId: undefined,
                  },
                }));
                close();
                if (match?.id) ensureCities(fieldName, match.id);
              }}
            />
          );
        }
        if (activePicker.kind === 'geo-city') {
          const fieldName = activePicker.fieldName;
          const geo = values[fieldName] || {};
          const cityKey = `${fieldName}:${activePicker.stateId}`;
          const list = cityLists[cityKey] || [];
          if (list.length === 0) {
            ensureCities(fieldName, activePicker.stateId);
          }
          return (
            <ModalPicker
              visible
              title="Choose a city"
              options={list.map(c => c.name)}
              selected={String(geo.city || '')}
              primaryColor={primaryColor}
              searchable
              emptyMessage="Loading cities…"
              onClose={close}
              onSelect={name => {
                const match = list.find(c => c.name === name);
                setValues(prev => ({
                  ...prev,
                  [fieldName]: {
                    ...geo,
                    city: name,
                    cityId: match?.id,
                  },
                }));
                close();
              }}
            />
          );
        }
        if (activePicker.kind === 'year') {
          const now = new Date().getFullYear();
          const years: string[] = [];
          for (let y = now + 5; y >= now - 100; y--) years.push(String(y));
          const current = String(values[activePicker.fieldName] || '').split('-');
          return (
            <ModalPicker
              visible
              title="Year"
              options={years}
              selected={current[0] || ''}
              primaryColor={primaryColor}
              searchable
              onClose={close}
              onSelect={y => {
                setActivePicker({
                  kind: 'month',
                  fieldName: activePicker.fieldName,
                  year: y,
                });
              }}
            />
          );
        }
        if (activePicker.kind === 'month') {
          const months = [
            '01', '02', '03', '04', '05', '06',
            '07', '08', '09', '10', '11', '12',
          ];
          return (
            <ModalPicker
              visible
              title="Month"
              options={months}
              selected=""
              primaryColor={primaryColor}
              onClose={close}
              onSelect={m => {
                setActivePicker({
                  kind: 'day',
                  fieldName: activePicker.fieldName,
                  year: activePicker.year,
                  month: m,
                });
              }}
            />
          );
        }
        if (activePicker.kind === 'day') {
          const days: string[] = [];
          for (let d = 1; d <= 31; d++) {
            days.push(String(d).padStart(2, '0'));
          }
          return (
            <ModalPicker
              visible
              title="Day"
              options={days}
              selected=""
              primaryColor={primaryColor}
              onClose={close}
              onSelect={d => {
                const date = `${activePicker.year}-${activePicker.month}-${d}`;
                setValues(prev => ({
                  ...prev,
                  [activePicker.fieldName]: date,
                }));
                close();
              }}
            />
          );
        }
        return null;
      })() : null}
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
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 12,
    borderWidth: 1,
    gap: 14,
    marginTop: 12,
    padding: 14,
  },
  // Bordered grouping for radio / geography / range / grid field renders.
  fieldGroup: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 10,
    marginTop: 4,
  },
  fieldGroupLabel: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
  optionsHint: {
    color: '#94a3b8',
    fontSize: 12,
    fontStyle: 'italic',
  },
  optionsGrid: {gap: 8},
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
  },
  // Web's design uses a dashed accent border on the selected option pill.
  // We apply it via render-time prop override (borderStyle: 'dashed').
  optionCardSelected: {
    borderStyle: 'dashed',
    borderWidth: 1.5,
  },
  optionCardLabel: {flex: 1, color: '#0f172a', fontSize: 14},
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {width: 10, height: 10, borderRadius: 5},
  checkboxOuter: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxTick: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  // Tap-to-open dropdown row used by country / geography / date pickers.
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
    marginTop: 4,
  },
  dropdownLabel: {color: '#334155', fontSize: 12, fontWeight: '600'},
  dropdownValue: {color: '#0f172a', fontSize: 15, marginTop: 2},
  dropdownPlaceholder: {color: '#94a3b8'},
  dropdownCaret: {color: '#64748b', fontSize: 14, fontWeight: '700'},
  // Grid table — horizontally scrollable matrix used by *_grid types.
  gridTable: {
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  gridTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
  },
  gridTableRow: {
    flexDirection: 'row',
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  gridTableRowLast: {borderBottomWidth: 0},
  gridTableHeaderCell: {
    width: 120,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightColor: '#e2e8f0',
    borderRightWidth: 1,
  },
  gridTableHeaderText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  gridTableRowLabel: {
    width: 120,
    paddingVertical: 18,
    paddingHorizontal: 8,
    backgroundColor: '#f8fafc',
    borderRightColor: '#e2e8f0',
    borderRightWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridTableRowLabelText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  gridTableCell: {
    width: 120,
    paddingVertical: 18,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightColor: '#e2e8f0',
    borderRightWidth: 1,
    gap: 6,
  },
  gridTableCellInput: {
    minWidth: 90,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: '#ffffff',
    fontSize: 13,
    color: '#0f172a',
  },
  // Column-value label shown beneath the radio/checkbox in grid cells so
  // users see what each cell represents on narrow phones where the header
  // may be scrolled off-screen.
  gridTableCellLabel: {
    color: '#475569',
    fontSize: 11,
    textAlign: 'center',
    maxWidth: 100,
  },
  gridHint: {
    color: '#94a3b8',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 4,
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
