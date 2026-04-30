import React from 'react';
import {Modal, Pressable, ScrollView, StyleSheet, Text} from 'react-native';

import {Icon} from '../../../shared/components/Icon';

type PickerProps = {
  visible: boolean;
  title: string;
  options: string[];
  selected?: string;
  primaryColor: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  emptyMessage?: string;
};

export function Picker({
  visible,
  title,
  options,
  selected,
  primaryColor,
  onSelect,
  onClose,
  emptyMessage,
}: PickerProps) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          {options.length === 0 ? (
            <Text style={styles.empty}>
              {emptyMessage || 'No options available.'}
            </Text>
          ) : (
            <ScrollView style={styles.list}>
              {options.map(option => {
                const isActive = option === selected;
                return (
                  <Pressable
                    key={option}
                    style={[
                      styles.option,
                      isActive && {backgroundColor: `${primaryColor}14`},
                    ]}
                    onPress={() => onSelect(option)}>
                    <Text
                      style={[
                        styles.optionText,
                        isActive && {color: primaryColor, fontWeight: '700'},
                      ]}>
                      {option}
                    </Text>
                    {isActive ? (
                      <Icon name="check" size={20} color={primaryColor} />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 24,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  title: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  list: {
    maxHeight: '90%',
  },
  option: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  optionText: {
    color: '#0f172a',
    fontSize: 15,
  },
  empty: {
    color: '#64748b',
    fontSize: 14,
    paddingHorizontal: 4,
    paddingVertical: 24,
    textAlign: 'center',
  },
});
