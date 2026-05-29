import React, {forwardRef} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ScrollViewProps,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from 'react-native';

export type FormScrollViewProps = ScrollViewProps & {
  // Extra space kept between the bottom of the scrollable content and the
  // keyboard. Replaces the keyboard-controller `bottomOffset` prop — we
  // simply pad the content area, which works the same for both iOS and
  // Android.
  bottomOffset?: number;
};

/**
 * Drop-in scrollable form host that keeps the focused input visible while
 * the on-screen keyboard is open — using only React Native's built-in
 * primitives so no native module / autolinking step is required.
 *
 * Implementation:
 *  - iOS: wrapped in `KeyboardAvoidingView` with `behavior="padding"` so
 *    the content slides up by the keyboard's height.
 *  - Android: relies on `android:windowSoftInputMode="adjustResize"` (set
 *    in AndroidManifest.xml) — the activity itself shrinks when the
 *    keyboard opens, so the inner `ScrollView` can scroll to the focused
 *    field. No KeyboardAvoidingView behavior needed.
 *
 * Defaults chosen for this app:
 *  - keyboardShouldPersistTaps="handled" — taps on buttons/links inside
 *    the form work on the first tap even while the keyboard is open.
 *  - bottomOffset 24 — gap between the focused field and the keyboard so
 *    the field (and its label) is comfortably visible.
 * Any prop can be overridden by the caller.
 */
export const FormScrollView = forwardRef<ScrollView, FormScrollViewProps>(
  (
    {
      children,
      style,
      contentContainerStyle,
      bottomOffset = 24,
      keyboardShouldPersistTaps = 'handled',
      ...rest
    },
    ref,
  ) => {
    const combinedContentStyle: StyleProp<ViewStyle> = [
      contentContainerStyle,
      {paddingBottom: bottomOffset},
    ];

    return (
      <KeyboardAvoidingView
        style={[styles.flex, style as StyleProp<ViewStyle>]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        // Small offset on iOS keeps the content from undershooting when
        // there's a status bar or notch above the scroll area.
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
        <ScrollView
          ref={ref}
          contentContainerStyle={combinedContentStyle}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          {...rest}>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  },
);

FormScrollView.displayName = 'FormScrollView';

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
