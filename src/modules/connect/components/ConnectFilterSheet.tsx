import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {Icon} from '../../../core/components/Icon';
import {colors, withAlpha} from '../../../core/theme/colors';
import type {FilterGroup, FilterSelection} from '../types';

type Props = {
  visible: boolean;
  primaryColor: string;
  groups: FilterGroup[];
  isLoading: boolean;
  // The currently-applied selection; the sheet opens with this pre-checked and
  // edits a local draft so a Cancel discards changes.
  selection: FilterSelection;
  onClose: () => void;
  onApply: (next: FilterSelection) => void;
};

const countSelected = (sel: FilterSelection): number =>
  Object.values(sel).reduce((sum, vals) => sum + (vals?.length || 0), 0);

// Bottom-sheet filter picker: one collapsible group per FilterGroup, multi-
// select chips inside. Mirrors the web "ADD FILTER" panel driven by the
// public/global/custom option lists.
export function ConnectFilterSheet({
  visible,
  primaryColor,
  groups,
  isLoading,
  selection,
  onClose,
  onApply,
}: Props) {
  const [draft, setDraft] = useState<FilterSelection>(selection);

  // Re-sync the draft each time the sheet opens so it reflects the latest
  // applied selection (and discards any abandoned edits from a prior open).
  useEffect(() => {
    if (visible) setDraft(selection);
  }, [visible, selection]);

  const toggle = (groupKey: string, value: string) => {
    setDraft(prev => {
      const current = prev[groupKey] || [];
      const next = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return {...prev, [groupKey]: next};
    });
  };

  const draftCount = countSelected(draft);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>Filters</Text>
            <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
              <Icon name="close" size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          {isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={primaryColor} />
            </View>
          ) : groups.length === 0 ? (
            <View style={styles.centered}>
              <Text style={styles.emptyText}>No filters available.</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scroll}
              showsVerticalScrollIndicator={false}>
              {groups.map(group => (
                <View key={group.key} style={styles.group}>
                  <Text style={styles.groupLabel}>{group.label}</Text>
                  <View style={styles.chipsWrap}>
                    {group.options.map(opt => {
                      const isActive = (draft[group.key] || []).includes(
                        opt.value,
                      );
                      return (
                        <Pressable
                          key={opt.value}
                          onPress={() => toggle(group.key, opt.value)}
                          style={[
                            styles.chip,
                            isActive && {
                              backgroundColor: withAlpha(primaryColor, 0.12),
                              borderColor: primaryColor,
                            },
                          ]}>
                          <Text
                            style={[
                              styles.chipText,
                              isActive && {color: primaryColor},
                            ]}
                            numberOfLines={1}>
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          <View style={styles.footer}>
            <Pressable
              style={styles.clearBtn}
              onPress={() => setDraft({})}
              disabled={draftCount === 0}>
              <Text
                style={[
                  styles.clearText,
                  draftCount === 0 && styles.clearTextDisabled,
                ]}>
                Clear all
              </Text>
            </Pressable>
            <Pressable
              style={[styles.applyBtn, {backgroundColor: primaryColor}]}
              onPress={() => onApply(draft)}>
              <Text style={styles.applyText}>
                Apply{draftCount > 0 ? ` (${draftCount})` : ''}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.scrim,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 24,
    maxHeight: '80%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  centered: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  scroll: {
    marginTop: 4,
  },
  group: {
    marginBottom: 18,
  },
  groupLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  clearBtn: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  clearText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textMuted,
  },
  clearTextDisabled: {
    color: colors.borderStrong,
  },
  applyBtn: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 14,
  },
  applyText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
