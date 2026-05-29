import React, {forwardRef} from 'react';
import {ScrollView} from 'react-native';
import {
  KeyboardAwareScrollView,
  KeyboardAwareScrollViewProps,
} from 'react-native-keyboard-controller';

export type FormScrollViewProps = KeyboardAwareScrollViewProps;

/**
 * Drop-in replacement for the old `KeyboardAvoidingView + ScrollView` pattern
 * used across every form screen. Wraps keyboard-controller's
 * `KeyboardAwareScrollView`, which automatically scrolls the focused field
 * above the keyboard (on both iOS and Android) so its contents stay visible
 * while editing — no per-screen KeyboardAvoidingView needed.
 *
 * Requires the app to be wrapped in <KeyboardProvider> (see App.tsx).
 *
 * Defaults chosen for this app:
 *  - keyboardShouldPersistTaps="handled" — taps on buttons/links inside the
 *    form work on the first tap even while the keyboard is open (matches the
 *    behaviour the auth screens previously relied on).
 *  - bottomOffset 24 — gap kept between the focused field and the keyboard so
 *    the field (and its label) is comfortably visible, not flush against it.
 * Any prop can be overridden by the caller.
 */
export const FormScrollView = forwardRef<ScrollView, FormScrollViewProps>(
  ({children, ...props}, ref) => {
    return (
      <KeyboardAwareScrollView
        ref={ref as never}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
        {...props}>
        {children}
      </KeyboardAwareScrollView>
    );
  },
);

FormScrollView.displayName = 'FormScrollView';
