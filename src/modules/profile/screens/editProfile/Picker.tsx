import React, {useMemo, useState} from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {Icon} from '../../../../core/components/Icon';

type PickerProps = {
  visible: boolean;
  title: string;
  options: string[];
  selected?: string;
  primaryColor: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  emptyMessage?: string;
  // Opt-in client-side search above the option list. Use it for long lists
  // like Country / State / City.
  searchable?: boolean;
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
  searchable = false,
}: PickerProps) {
  const [query, setQuery] = useState('');

  const visibleOptions = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const needle = query.trim().toLowerCase();
    return options.filter(o => o.toLowerCase().includes(needle));
  }, [options, query, searchable]);

  // Reset the query whenever the modal opens for a new picker so we don't
  // carry stale text across e.g. country → state.
  React.useEffect(() => {
    if (!visible) setQuery('');
  }, [visible]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>

          {searchable && options.length > 0 ? (
            <View style={styles.searchRow}>
              <Icon name="magnify" size={18} color="#94a3b8" />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Search"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
              {query.length > 0 ? (
                <Pressable hitSlop={6} onPress={() => setQuery('')}>
                  <Icon name="close-circle" size={18} color="#94a3b8" />
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {options.length === 0 ? (
            <Text style={styles.empty}>
              {emptyMessage || 'No options available.'}
            </Text>
          ) : visibleOptions.length === 0 ? (
            <Text style={styles.empty}>No matches for "{query}".</Text>
          ) : (
            <ScrollView
              style={styles.list}
              keyboardShouldPersistTaps="handled">
              {visibleOptions.map(option => {
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
  searchRow: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    color: '#0f172a',
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  list: {
    maxHeight: '85%',
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
