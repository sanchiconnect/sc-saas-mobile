import {useCallback, useMemo, useState} from 'react';

import {Validator} from './validators';

// Tiny form-state + validation hook.
//
// Errors are surfaced under each field only when the field is `touched`
// (i.e. has been blurred at least once) OR after the first submit attempt.
// This matches the frontend's UX: don't yell at users mid-typing, but don't
// hide errors after they've tried to submit either.
//
// Usage:
//   const form = useFormValidation({
//     initial: {email: '', name: ''},
//     validators: {
//       email: combine(required('Email'), email),
//       name: required('Name'),
//     },
//   });
//   form.values.email          // current value
//   form.errors.email          // string | undefined (only when touched/submitted)
//   form.setValue('email', x)  // change value, clear error
//   form.setTouched('email')   // mark touched (call onBlur)
//   form.handleSubmit(values => ...)  // marks all touched + invokes if valid

export type FieldValidators<T extends Record<string, any>> = {
  [K in keyof T]?: Validator<T[K]>;
};

type Options<T extends Record<string, any>> = {
  initial: T;
  validators?: FieldValidators<T>;
};

export function useFormValidation<T extends Record<string, any>>({
  initial,
  validators = {},
}: Options<T>) {
  const [values, setValues] = useState<T>(initial);
  const [touched, setTouched] = useState<
    Partial<Record<keyof T, boolean>>
  >({});
  const [submitted, setSubmitted] = useState(false);

  const rawErrors = useMemo(() => {
    const out: Partial<Record<keyof T, string>> = {};
    (Object.keys(validators) as Array<keyof T>).forEach(key => {
      const v = validators[key];
      if (!v) return;
      const error = v(values[key]);
      if (error) {
        out[key] = error;
      }
    });
    return out;
  }, [values, validators]);

  // Visible errors: only show after the user has touched the field or
  // submitted the form. Avoids "Email is required" flashing at the user
  // before they've typed anything.
  const errors = useMemo(() => {
    const out: Partial<Record<keyof T, string>> = {};
    (Object.keys(rawErrors) as Array<keyof T>).forEach(key => {
      if (submitted || touched[key]) {
        out[key] = rawErrors[key];
      }
    });
    return out;
  }, [rawErrors, submitted, touched]);

  const setValue = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues(prev => ({...prev, [key]: value}));
  }, []);

  const markTouched = useCallback(<K extends keyof T>(key: K) => {
    setTouched(prev => ({...prev, [key]: true}));
  }, []);

  const isValid = Object.keys(rawErrors).length === 0;

  // Mark every validator key touched and either invoke the callback or
  // resolve to `false`. Returns whether submission proceeded.
  const handleSubmit = useCallback(
    (onValid: (values: T) => void | Promise<void>): boolean => {
      setSubmitted(true);
      const allTouched: Partial<Record<keyof T, boolean>> = {};
      (Object.keys(validators) as Array<keyof T>).forEach(k => {
        allTouched[k] = true;
      });
      setTouched(prev => ({...prev, ...allTouched}));
      if (Object.keys(rawErrors).length > 0) {
        return false;
      }
      onValid(values);
      return true;
    },
    [validators, values, rawErrors],
  );

  const reset = useCallback(
    (next?: Partial<T>) => {
      setValues(prev => (next ? {...prev, ...next} : initial));
      setTouched({});
      setSubmitted(false);
    },
    [initial],
  );

  return {
    values,
    errors,
    rawErrors,
    touched,
    submitted,
    isValid,
    setValue,
    setTouched: markTouched,
    handleSubmit,
    reset,
  };
}
