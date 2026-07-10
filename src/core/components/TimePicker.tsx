import React, {useContext, useMemo, useRef} from 'react';
import {FlatList, Modal, Pressable, StyleSheet, Text, View} from 'react-native';

import {TenantContext} from '../tenant/TenantProvider';
import {colors} from '../theme/colors';
import {Icon} from './Icon';

type Props = {
  visible: boolean;
  // 24h "HH:MM". Empty = no selection.
  value?: string;
  // 24h "HH:MM". Options before this are hidden — e.g. pass the current time
  // when the picked date is today so past slots don't show.
  minTime?: string;
  title?: string;
  onSelect: (time: string) => void;
  onClose: () => void;
};

const STEP_MINUTES = 15;

const TIME_OPTIONS: {value: string; label: string}[] = Array.from(
  {length: (24 * 60) / STEP_MINUTES},
  (_, i) => {
    const totalMinutes = i * STEP_MINUTES;
    const hour24 = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    const period = hour24 < 12 ? 'AM' : 'PM';
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    return {
      value: `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      label: `${hour12}:${String(minute).padStart(2, '0')} ${period}`,
    };
  },
);

export function formatTimeLabel(value?: string): string {
  if (!value) return '';
  const found = TIME_OPTIONS.find(o => o.value === value);
  return found?.label ?? value;
}

export function TimePicker({visible, value, minTime, title, onSelect, onClose}: Props) {
  const {theme} = useContext(TenantContext);
  const primaryColor = theme?.primary || colors.primary;
  const listRef = useRef<FlatList<{value: string; label: string}>>(null);

  const options = useMemo(
    () => (minTime ? TIME_OPTIONS.filter(o => o.value >= minTime) : TIME_OPTIONS),
    [minTime],
  );

  const selectedIndex = useMemo(
    () => options.findIndex(o => o.value === value),
    [options, value],
  );

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{title || 'Select time'}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              onPress={onClose}
              style={styles.closeButton}>
              <Icon name="close" size={18} color="#475569" />
            </Pressable>
          </View>

          <FlatList
            ref={listRef}
            data={options}
            keyExtractor={item => item.value}
            style={styles.list}
            initialScrollIndex={selectedIndex > 0 ? selectedIndex : undefined}
            getItemLayout={(_, index) => ({length: 44, offset: 44 * index, index})}
            onScrollToIndexFailed={() => undefined}
            renderItem={({item}) => {
              const isSelected = item.value === value;
              return (
                <Pressable
                  onPress={() => onSelect(item.value)}
                  style={[styles.row, isSelected && {backgroundColor: colors.surfaceMuted}]}>
                  <Text
                    style={[
                      styles.rowText,
                      isSelected && {color: primaryColor, fontWeight: '800'},
                    ]}>
                    {item.label}
                  </Text>
                  {isSelected ? <Icon name="check" size={16} color={primaryColor} /> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  backdrop: {...StyleSheet.absoluteFill},
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    elevation: 6,
    maxHeight: 420,
    padding: 18,
    shadowColor: '#0f172a',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.18,
    shadowRadius: 18,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerTitle: {color: '#0f172a', fontSize: 16, fontWeight: '800'},
  closeButton: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  list: {maxHeight: 340},
  row: {
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    height: 44,
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  rowText: {color: '#0f172a', fontSize: 14, fontWeight: '600'},
});
