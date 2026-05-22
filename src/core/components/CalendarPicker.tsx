import React, {useContext, useMemo, useState} from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {TenantContext} from '../tenant/TenantProvider';
import {colors, withAlpha} from '../theme/colors';
import {Icon} from './Icon';

type Props = {
  visible: boolean;
  // ISO yyyy-mm-dd string. Empty = default to today.
  value?: string;
  // ISO yyyy-mm-dd. Dates before this are disabled (inclusive). Defaults to
  // today so callers can't pick the past for availability overrides.
  minDate?: string;
  onSelect: (isoDate: string) => void;
  onClose: () => void;
};

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const pad2 = (n: number) => String(n).padStart(2, '0');
const toIso = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const parseIso = (iso?: string): Date | null => {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  const [, y, mo, da] = m;
  const d = new Date(Number(y), Number(mo) - 1, Number(da));
  if (Number.isNaN(d.getTime())) return null;
  return d;
};

const startOfDay = (d: Date) => {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
};

export function CalendarPicker({
  visible,
  value,
  minDate,
  onSelect,
  onClose,
}: Props) {
  const {theme} = useContext(TenantContext);
  const primaryColor = theme?.primary || colors.primary;

  const today = useMemo(() => startOfDay(new Date()), []);
  const minBoundary = useMemo(() => {
    const parsed = parseIso(minDate);
    return parsed ? startOfDay(parsed) : today;
  }, [minDate, today]);

  const initial = parseIso(value) ?? today;
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  // Pre-select today (or the incoming value) so the Select button is
  // immediately actionable — users were tapping the today-highlight expecting
  // it to be the chosen date and then finding Select disabled.
  const [selected, setSelected] = useState<Date | null>(
    parseIso(value) ?? today,
  );

  // Sync state to the incoming value each time the picker opens so reopening
  // it doesn't show a stale previously-picked date.
  React.useEffect(() => {
    if (!visible) return;
    const next = parseIso(value) ?? today;
    setViewMonth(next.getMonth());
    setViewYear(next.getFullYear());
    setSelected(parseIso(value) ?? today);
  }, [visible, value, today]);

  const goPrev = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const goNext = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const cells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const leadingBlanks = first.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const totalCells = Math.ceil((leadingBlanks + daysInMonth) / 7) * 7;
    const arr: Array<{day: number; date: Date} | null> = [];
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - leadingBlanks + 1;
      if (dayNum < 1 || dayNum > daysInMonth) {
        arr.push(null);
      } else {
        arr.push({day: dayNum, date: new Date(viewYear, viewMonth, dayNum)});
      }
    }
    return arr;
  }, [viewMonth, viewYear]);

  const handleConfirm = () => {
    if (!selected) return;
    onSelect(toIso(selected));
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Select date</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              onPress={onClose}
              style={styles.closeButton}>
              <Icon name="close" size={18} color="#475569" />
            </Pressable>
          </View>

          <View style={styles.monthNav}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              hitSlop={8}
              onPress={goPrev}
              style={styles.navButton}>
              <Icon name="chevron-left" size={22} color="#0f172a" />
            </Pressable>
            <Text style={styles.monthLabel}>
              {MONTH_LABELS[viewMonth]} {viewYear}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next month"
              hitSlop={8}
              onPress={goNext}
              style={styles.navButton}>
              <Icon name="chevron-right" size={22} color="#0f172a" />
            </Pressable>
          </View>

          <View style={styles.weekHeader}>
            {DAY_LABELS.map((d, i) => (
              <Text key={`${d}-${i}`} style={styles.weekHeaderText}>
                {d}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((cell, idx) => {
              if (!cell) {
                return <View key={`blank-${idx}`} style={styles.cell} />;
              }
              const isToday = toIso(cell.date) === toIso(today);
              const isSelected =
                selected && toIso(cell.date) === toIso(selected);
              const isBelowMin = startOfDay(cell.date) < minBoundary;
              return (
                <Pressable
                  key={`d-${cell.day}`}
                  disabled={isBelowMin}
                  onPress={() => setSelected(cell.date)}
                  style={[
                    styles.cell,
                    isSelected && {backgroundColor: primaryColor},
                    !isSelected &&
                      isToday && {
                        borderColor: primaryColor,
                        borderWidth: 1.5,
                      },
                  ]}>
                  <Text
                    style={[
                      styles.cellText,
                      isBelowMin && styles.cellTextDisabled,
                      isToday && !isSelected && {color: primaryColor},
                      isSelected && styles.cellTextSelected,
                    ]}>
                    {cell.day}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={styles.cancelButton}>
              <Text style={styles.cancelLabel}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={!selected}
              onPress={handleConfirm}
              style={[
                styles.confirmButton,
                {backgroundColor: primaryColor},
                !selected && styles.confirmButtonDisabled,
              ]}>
              <Text style={styles.confirmLabel}>Select</Text>
            </Pressable>
          </View>
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
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    elevation: 6,
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
    marginBottom: 14,
  },
  headerTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  monthNav: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navButton: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 10,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  monthLabel: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
  },
  weekHeader: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekHeaderText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
    textTransform: 'uppercase',
    width: `${100 / 7}%`,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    alignItems: 'center',
    aspectRatio: 1,
    borderRadius: 10,
    justifyContent: 'center',
    marginVertical: 2,
    width: `${100 / 7}%`,
  },
  cellText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
  },
  cellTextDisabled: {
    color: '#cbd5e1',
  },
  cellTextSelected: {
    color: '#ffffff',
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  cancelButton: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 13,
  },
  cancelLabel: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
  },
  confirmButton: {
    alignItems: 'center',
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 13,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
