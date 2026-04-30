import React, {forwardRef, useContext, useState} from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import {TenantContext} from '../../context/TenantProvider';
import {colors} from '../theme/colors';

export type AppTextFieldProps = Omit<TextInputProps, 'style'> & {
  label?: string;
  helperText?: string;
  error?: string;
  required?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  leftAccessory?: React.ReactNode;
  rightAccessory?: React.ReactNode;
};

export const AppTextField = forwardRef<TextInput, AppTextFieldProps>(
  (
    {
      label,
      helperText,
      error,
      required,
      containerStyle,
      inputStyle,
      leftAccessory,
      rightAccessory,
      secureTextEntry,
      editable = true,
      onFocus,
      onBlur,
      ...rest
    },
    ref,
  ) => {
    const {theme} = useContext(TenantContext);
    const [focused, setFocused] = useState(false);
    const [secureVisible, setSecureVisible] = useState(false);

    const dangerColor = theme?.danger ?? colors.danger;
    const focusColor = theme?.primary ?? colors.primary;

    const borderColor = error
      ? dangerColor
      : focused
        ? focusColor
        : colors.border;

    const showToggle = Boolean(secureTextEntry);
    const isSecure = secureTextEntry && !secureVisible;

    return (
      <View style={[styles.field, containerStyle]}>
        {label ? (
          <Text style={styles.label}>
            {label}
            {required ? (
              <Text style={{color: dangerColor}}> *</Text>
            ) : null}
          </Text>
        ) : null}

        <View
          style={[
            styles.inputRow,
            {borderColor},
            !editable && styles.disabled,
          ]}>
          {leftAccessory ? (
            <View style={styles.accessory}>{leftAccessory}</View>
          ) : null}

          <TextInput
            ref={ref}
            editable={editable}
            placeholderTextColor={colors.placeholder}
            secureTextEntry={isSecure}
            onFocus={event => {
              setFocused(true);
              onFocus?.(event);
            }}
            onBlur={event => {
              setFocused(false);
              onBlur?.(event);
            }}
            style={[styles.input, inputStyle]}
            {...rest}
          />

          {showToggle ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                secureVisible ? 'Hide password' : 'Show password'
              }
              hitSlop={8}
              onPress={() => setSecureVisible(value => !value)}
              style={styles.accessory}>
              <Text style={styles.toggleText}>
                {secureVisible ? 'Hide' : 'Show'}
              </Text>
            </Pressable>
          ) : rightAccessory ? (
            <View style={styles.accessory}>{rightAccessory}</View>
          ) : null}
        </View>

        {error ? (
          <Text style={[styles.helper, {color: dangerColor}]}>{error}</Text>
        ) : helperText ? (
          <Text style={styles.helper}>{helperText}</Text>
        ) : null}
      </View>
    );
  },
);

AppTextField.displayName = 'AppTextField';

const styles = StyleSheet.create({
  field: {
    gap: 6,
  },
  label: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
  },
  inputRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 12,
  },
  input: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
  },
  accessory: {
    paddingHorizontal: 4,
  },
  toggleText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
  },
  helper: {
    color: colors.textMuted,
    fontSize: 12,
  },
  disabled: {
    backgroundColor: '#f1f5f9',
  },
});
