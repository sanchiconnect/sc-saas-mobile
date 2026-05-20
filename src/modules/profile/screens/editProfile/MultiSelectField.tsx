import React, {useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {Icon} from '../../../../core/components/Icon';

export type MultiSelectOption = {
  id: number | string;
  name: string;
};

type Props = {
  label: string;
  hint?: string;
  options: MultiSelectOption[];
  selected: Array<number | string>;
  primaryColor: string;
  // Hard cap on selection count; once reached, additional picks are blocked.
  // Mirrors the frontend's per-field caps (investorMaxInvestabilityMetrics,
  // mentorMaxIndustries, etc.). Pass undefined for "unlimited".
  max?: number;
  onChange: (next: Array<number | string>) => void;
  initiallyExpanded?: boolean;
};

export function MultiSelectField({
  label,
  hint,
  options,
  selected,
  primaryColor,
  max,
  onChange,
  initiallyExpanded = false,
}: Props) {
  const [expanded, setExpanded] = useState(initiallyExpanded);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const atCap = max != null && selectedSet.size >= max;

  const toggle = (id: number | string) => {
    if (selectedSet.has(id)) {
      onChange(selected.filter(s => s !== id));
      return;
    }
    if (atCap) {
      return;
    }
    onChange([...selected, id]);
  };

  const summary =
    selectedSet.size === 0
      ? 'None selected'
      : options
          .filter(o => selectedSet.has(o.id))
          .map(o => o.name)
          .slice(0, 3)
          .join(', ') + (selectedSet.size > 3 ? `  +${selectedSet.size - 3}` : '');

  return (
    <View style={styles.wrap}>
      <Pressable
        style={styles.header}
        onPress={() => setExpanded(prev => !prev)}>
        <View style={{flex: 1}}>
          <Text style={styles.label}>{label}</Text>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
          {!expanded ? <Text style={styles.summary}>{summary}</Text> : null}
        </View>
        <Icon
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#64748b"
        />
      </Pressable>

      {expanded ? (
        <View style={styles.optionsList}>
          {max != null ? (
            <Text style={styles.capHint}>
              {selectedSet.size}/{max} selected
            </Text>
          ) : null}
          {options.map(option => {
            const isSelected = selectedSet.has(option.id);
            const disabled = !isSelected && atCap;
            return (
              <Pressable
                key={String(option.id)}
                style={[styles.option, disabled && styles.optionDisabled]}
                onPress={() => toggle(option.id)}
                disabled={disabled}>
                <View
                  style={[
                    styles.checkbox,
                    isSelected && {
                      backgroundColor: primaryColor,
                      borderColor: primaryColor,
                    },
                  ]}>
                  {isSelected ? (
                    <Icon name="check" size={14} color="#ffffff" />
                  ) : null}
                </View>
                <Text
                  style={[styles.optionLabel, disabled && styles.optionLabelDisabled]}>
                  {option.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '600',
  },
  hint: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  summary: {
    color: '#475569',
    fontSize: 13,
    marginTop: 6,
  },
  optionsList: {
    marginTop: 12,
    gap: 10,
  },
  capHint: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 2,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionDisabled: {
    opacity: 0.4,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    color: '#0f172a',
    fontSize: 14,
    flex: 1,
  },
  optionLabelDisabled: {
    color: '#94a3b8',
  },
});
