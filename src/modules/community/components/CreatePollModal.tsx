import React, {useState} from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {Icon} from '../../../core/components/Icon';
import {radii, spacing, typography} from '../../../core/theme/colors';

// A poll attached to a post. `timeLine` matches the backend enum the feed
// already reads (one_day / one_week / one_month).
export type PollDraft = {
  question: string;
  options: string[];
  timeLine: string;
};

type Props = {
  visible: boolean;
  primaryColor: string;
  // Existing draft to edit (re-opening the poll), or null for a fresh one.
  initial?: PollDraft | null;
  onClose: () => void;
  onSave: (poll: PollDraft) => void;
};

const DURATIONS: {value: string; label: string}[] = [
  {value: 'one_day', label: '1 Day'},
  {value: 'three_days', label: '3 Days'},
  {value: 'one_week', label: '1 Week'},
  {value: 'two_weeks', label: '2 Week'},
];

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;

export function CreatePollModal({
  visible,
  primaryColor,
  initial,
  onClose,
  onSave,
}: Props) {
  const [question, setQuestion] = useState(initial?.question ?? '');
  const [options, setOptions] = useState<string[]>(
    initial?.options?.length ? initial.options : ['', ''],
  );
  const [timeLine, setTimeLine] = useState(initial?.timeLine ?? 'one_day');
  const [isDurationOpen, setIsDurationOpen] = useState(false);

  const filledOptions = options.map(o => o.trim()).filter(Boolean);
  const canSave = question.trim().length > 0 && filledOptions.length >= MIN_OPTIONS;
  const durationLabel =
    DURATIONS.find(d => d.value === timeLine)?.label ?? '1 Day';

  const updateOption = (index: number, value: string) => {
    setOptions(prev => prev.map((o, i) => (i === index ? value : o)));
  };

  const addOption = () => {
    setOptions(prev => (prev.length < MAX_OPTIONS ? [...prev, ''] : prev));
  };

  const removeOption = (index: number) => {
    setOptions(prev =>
      prev.length > MIN_OPTIONS ? prev.filter((_, i) => i !== index) : prev,
    );
  };

  const handleSave = () => {
    if (!canSave) return;
    onSave({question: question.trim(), options: filledOptions, timeLine});
    onClose();
  };

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>CREATE POLL</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}>
              <Icon name="close" size={24} color="#0f172a" />
            </Pressable>
          </View>

          <View style={styles.divider} />

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {/* Question */}
            <Text style={styles.label}>
              Your Question <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your question"
              placeholderTextColor="#94a3b8"
              value={question}
              onChangeText={setQuestion}
            />

            {/* Options */}
            <Text style={[styles.label, styles.labelSpaced]}>
              Options <Text style={styles.required}>*</Text>
            </Text>
            {options.map((option, index) => (
              <View key={index} style={styles.optionRow}>
                <TextInput
                  style={[styles.input, styles.optionInput]}
                  placeholder={`Option ${index + 1}`}
                  placeholderTextColor="#94a3b8"
                  value={option}
                  onChangeText={value => updateOption(index, value)}
                />
                {/* First two options are required; only extras (3rd onward)
                    can be removed. */}
                {index >= MIN_OPTIONS ? (
                  <Pressable
                    style={styles.optionRemove}
                    onPress={() => removeOption(index)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove option ${index + 1}`}
                    hitSlop={6}>
                    <Icon name="close" size={20} color="#94a3b8" />
                  </Pressable>
                ) : null}
              </View>
            ))}

            {options.length < MAX_OPTIONS ? (
              <Pressable
                style={[styles.addOption, {backgroundColor: primaryColor}]}
                onPress={addOption}
                accessibilityRole="button"
                accessibilityLabel="Add option">
                <Icon name="plus" size={18} color="#ffffff" />
                <Text style={styles.addOptionText}>Add Option</Text>
              </Pressable>
            ) : null}

            {/* Duration */}
            <Text style={[styles.label, styles.labelSpaced]}>
              Poll Duration <Text style={styles.required}>*</Text>
            </Text>
            <Pressable
              style={styles.select}
              onPress={() => setIsDurationOpen(open => !open)}
              accessibilityRole="button"
              accessibilityLabel="Select poll duration">
              <Text style={styles.selectText}>{durationLabel}</Text>
              <Icon
                name={isDurationOpen ? 'chevron-up' : 'chevron-down'}
                size={22}
                color="#475569"
              />
            </Pressable>
            {isDurationOpen ? (
              <View style={styles.dropdown}>
                {DURATIONS.map(d => (
                  <Pressable
                    key={d.value}
                    style={({pressed}) => [
                      styles.dropdownItem,
                      pressed && styles.dropdownItemPressed,
                    ]}
                    onPress={() => {
                      setTimeLine(d.value);
                      setIsDurationOpen(false);
                    }}>
                    <Text
                      style={[
                        styles.dropdownItemText,
                        d.value === timeLine && {color: primaryColor},
                      ]}>
                      {d.label}
                    </Text>
                    {d.value === timeLine ? (
                      <Icon name="check" size={18} color={primaryColor} />
                    ) : null}
                  </Pressable>
                ))}
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              style={[
                styles.saveButton,
                {backgroundColor: canSave ? primaryColor : '#e2e8f0'},
              ]}
              onPress={handleSave}
              disabled={!canSave}
              accessibilityRole="button"
              accessibilityLabel="Save poll">
              <Text
                style={[
                  styles.saveButtonText,
                  {color: canSave ? '#ffffff' : '#94a3b8'},
                ]}>
                SAVE
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.56)',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: radii.xl,
    maxHeight: '88%',
    maxWidth: 560,
    paddingBottom: spacing.lg,
    paddingTop: spacing.lg,
    width: '100%',
    zIndex: 2,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  title: {
    color: '#0f172a',
    fontSize: typography.title,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  divider: {
    backgroundColor: '#e2e8f0',
    height: 1,
    marginTop: spacing.md,
  },
  body: {
    maxHeight: 460,
  },
  bodyContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  label: {
    color: '#0f172a',
    fontSize: typography.subhead,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  labelSpaced: {
    marginTop: spacing.lg,
  },
  required: {
    color: '#dc2626',
  },
  input: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: radii.md,
    borderWidth: 1,
    color: '#0f172a',
    fontSize: typography.bodyLg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
  },
  optionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  optionInput: {
    flex: 1,
  },
  optionRemove: {
    padding: spacing.xs,
  },
  addOption: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  addOptionText: {
    color: '#ffffff',
    fontSize: typography.body,
    fontWeight: '800',
  },
  select: {
    alignItems: 'center',
    borderColor: '#e2e8f0',
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
  },
  selectText: {
    color: '#0f172a',
    fontSize: typography.bodyLg,
  },
  dropdown: {
    borderColor: '#e2e8f0',
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.xs,
    overflow: 'hidden',
  },
  dropdownItem: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  dropdownItemPressed: {
    backgroundColor: '#f1f5f9',
  },
  dropdownItemText: {
    color: '#0f172a',
    fontSize: typography.bodyLg,
  },
  footer: {
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  saveButton: {
    alignItems: 'center',
    borderRadius: radii.md,
    minWidth: 120,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md + 2,
  },
  saveButtonText: {
    fontSize: typography.subhead,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
