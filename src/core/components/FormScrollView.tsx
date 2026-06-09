import React, {forwardRef, useEffect, useState} from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  KeyboardEvent,
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
 * Why this is more than a ScrollView:
 *  - iOS: wrapped in `KeyboardAvoidingView` with `behavior="padding"` so the
 *    content slides up by the keyboard's height.
 *  - Android: `android:windowSoftInputMode="adjustResize"` shrinks the
 *    activity so the inner ScrollView can scroll to the focused field. On some
 *    real devices (OEM keyboards, gesture nav) that resize is unreliable —
 *    seen as "field hidden behind keyboard on the device but fine on the
 *    emulator". To make it robust we ALSO pad the content's bottom by the
 *    measured keyboard height while it's open, which guarantees there's enough
 *    scroll range to bring any field above the keyboard regardless of whether
 *    the window resized.
 *  - When the keyboard is open we drop any caller-supplied
 *    `justifyContent: 'center'`. Vertically-centering scrollable content that
 *    exceeds the viewport clips it symmetrically and traps the bottom field
 *    behind the keyboard with no way to scroll to it. Top alignment keeps the
 *    whole form reachable. The centered look is preserved while the keyboard
 *    is closed.
 *
 * Defaults chosen for this app:
 *  - keyboardShouldPersistTaps="handled" — taps on buttons/links inside the
 *    form work on the first tap even while the keyboard is open.
 *  - bottomOffset 24 — gap between the focused field and the keyboard.
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
    // Track the keyboard so we can (a) stop centering and (b) pad the content
    // bottom by its height while it's open.
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    useEffect(() => {
      const showEvent =
        Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
      const hideEvent =
        Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
      const onShow = (e: KeyboardEvent) => {
        setKeyboardHeight(e.endCoordinates?.height ?? 0);
      };
      const onHide = () => setKeyboardHeight(0);
      const showSub = Keyboard.addListener(showEvent, onShow);
      const hideSub = Keyboard.addListener(hideEvent, onHide);
      return () => {
        showSub.remove();
        hideSub.remove();
      };
    }, []);

    const keyboardOpen = keyboardHeight > 0;
    // iOS lifts content via KeyboardAvoidingView's padding behavior, so adding
    // content padding there too would double it. On Android (behavior is a
    // no-op) we add the keyboard height as scroll room.
    const androidKeyboardPad =
      keyboardOpen && Platform.OS === 'android' ? keyboardHeight : 0;

    const combinedContentStyle: StyleProp<ViewStyle> = [
      contentContainerStyle,
      {paddingBottom: bottomOffset + androidKeyboardPad},
      // Override any caller `justifyContent: 'center'` while typing so the
      // form stays fully scrollable.
      keyboardOpen ? styles.topAligned : null,
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
  topAligned: {
    justifyContent: 'flex-start',
  },
});
