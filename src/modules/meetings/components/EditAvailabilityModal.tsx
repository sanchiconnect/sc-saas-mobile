import React, {useContext, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {Icon} from '../../../core/components/Icon';
import {TenantContext} from '../../../core/tenant/TenantProvider';
import {useToast} from '../../../core/toast/ToastProvider';
import {CalendarPicker} from '../../../core/components/CalendarPicker';
import {meetingsService} from '../../connections/services/meetings.service';
import type {
  AvailabilityDate,
  AvailabilityDay,
  AvailabilityPayload,
} from '../../connections/services/meetings.service';

type Props = {
  visible: boolean;
  token: string;
  onClose: () => void;
};

// Mirror web's METTING_AVAILABILITY enum.
const ANYTIME = 'anytime';
const TEMPORARY_UNAVAILABLE = 'temporary_unavailable';
const SPECIFIC_DAYS = 'specific_days';

const OPTIONS: {label: string; value: string}[] = [
  {label: 'Anytime', value: ANYTIME},
  {label: 'Temporary Unavailable', value: TEMPORARY_UNAVAILABLE},
  {label: 'Specific Days', value: SPECIFIC_DAYS},
];

// Web's `daysArr`. dayIndex 1 = Mon … 7 = Sun.
const DEFAULT_DAYS: AvailabilityDay[] = [
  {dayName: 'Mon', dayIndex: 1, closed: false, times: [{}]},
  {dayName: 'Tue', dayIndex: 2, closed: false, times: [{}]},
  {dayName: 'Wed', dayIndex: 3, closed: false, times: [{}]},
  {dayName: 'Thu', dayIndex: 4, closed: false, times: [{}]},
  {dayName: 'Fri', dayIndex: 5, closed: false, times: [{}]},
  {dayName: 'Sat', dayIndex: 6, closed: false, times: [{}]},
  {dayName: 'Sun', dayIndex: 7, closed: false, times: [{}]},
];

// 30-minute slot list (`generateTimeSlots(30)` in the web). "HH:MM"
// strings — same shape the API stores.
const TIME_SLOTS: string[] = (() => {
  const out: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return out;
})();

const to12Hour = (raw?: string | null): string => {
  if (!raw) return '';
  const m = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return raw;
  const h24 = Number(m[1]);
  const period = h24 >= 12 ? 'pm' : 'am';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, '0')}:${m[2]} ${period}`;
};

export function EditAvailabilityModal({visible, token, onClose}: Props) {
  const {theme} = useContext(TenantContext);
  const primaryColor = theme?.primary || '#0b0aa3';
  const insets = useSafeAreaInsets();
  const toast = useToast();

  // Form state — flat, no react-hook-form, no FormArray. Same data
  // shape the API expects so save is a direct JSON.stringify.
  const [availabilityHours, setAvailabilityHours] = useState<string>(ANYTIME);
  const [days, setDays] = useState<AvailabilityDay[]>(DEFAULT_DAYS);
  const [dates, setDates] = useState<AvailabilityDate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Picker UI state — which row's picker is open, and what value to
  // edit. Kept local so the modal stays in JSX (no global picker).
  const [timePicker, setTimePicker] = useState<{
    bucket: 'day' | 'date';
    rowIndex: number;
    field: 'startTime' | 'endTime';
  } | null>(null);
  const [datePicker, setDatePicker] = useState<{index: number} | null>(null);

  // Load on open.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setIsLoading(true);
    meetingsService
      .getMyAvailability(token)
      .then(p => {
        if (cancelled) return;
        setAvailabilityHours(p.availabilityHours || ANYTIME);
        // Merge server days into our default scaffold so any missing
        // dayIndex still renders with empty times.
        const incoming = new Map<number, AvailabilityDay>();
        (p.days || []).forEach(d => {
          if (typeof d.dayIndex === 'number') incoming.set(d.dayIndex, d);
        });
        setDays(
          DEFAULT_DAYS.map(d => {
            const found = incoming.get(d.dayIndex || 0);
            if (!found) return d;
            return {
              ...d,
              closed: !!found.closed,
              times: found.times?.length ? found.times : [{}],
            };
          }),
        );
        setDates(p.dates || []);
      })
      .catch(() => {
        if (!cancelled) toast.error('Could not load availability.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, token, toast]);

  // ---- day mutators ----
  const setDayClosed = (i: number, closed: boolean) => {
    setDays(prev => prev.map((d, idx) => (idx === i ? {...d, closed} : d)));
  };
  const setDayTime = (
    i: number,
    field: 'startTime' | 'endTime',
    value: string,
  ) => {
    setDays(prev =>
      prev.map((d, idx) => {
        if (idx !== i) return d;
        const t0 = d.times?.[0] || {};
        return {...d, times: [{...t0, [field]: value}]};
      }),
    );
  };

  // ---- date mutators ----
  const addDate = () => {
    setDates(prev => [
      ...prev,
      {date: '', closed: false, times: [{startTime: null, endTime: null}]},
    ]);
  };
  const removeDate = (i: number) => {
    setDates(prev => prev.filter((_, idx) => idx !== i));
  };
  const setDateDate = (i: number, iso: string) => {
    setDates(prev =>
      prev.map((d, idx) => (idx === i ? {...d, date: iso} : d)),
    );
  };
  const setDateClosed = (i: number, closed: boolean) => {
    setDates(prev =>
      prev.map((d, idx) => (idx === i ? {...d, closed} : d)),
    );
  };
  const setDateTime = (
    i: number,
    field: 'startTime' | 'endTime',
    value: string,
  ) => {
    setDates(prev =>
      prev.map((d, idx) => {
        if (idx !== i) return d;
        const t0 = d.times?.[0] || {};
        return {...d, times: [{...t0, [field]: value}]};
      }),
    );
  };

  // Normalize a `times` array so it ALWAYS contains at least one entry
  // with explicit nulls — the web's PATCH body keeps `[{startTime:
  // null, endTime: null}]` even when no time is picked.
  const normaliseTimes = (
    arr?: Array<{startTime?: string | null; endTime?: string | null}>,
  ) => {
    const first = arr?.[0] || {};
    return [
      {
        startTime: first.startTime ?? null,
        endTime: first.endTime ?? null,
      },
    ];
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Always send the FULL 7-day array and ALL date overrides regardless
      // of which radio is chosen. Matches the web's PATCH body verbatim —
      // the backend reads `availabilityHours` to decide which subset of
      // the data to honour, and rejects shorter payloads.
      const payload: AvailabilityPayload = {
        availabilityHours,
        days: days.map(d => ({
          closed: !!d.closed,
          dayName: d.dayName,
          dayIndex: d.dayIndex,
          times: normaliseTimes(d.times),
        })),
        dates: dates.map(d => ({
          closed: !!d.closed,
          date: d.date || '',
          times: normaliseTimes(d.times),
        })),
      };
      await meetingsService.setMyAvailability(token, payload);
      toast.success('Availability saved.');
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not save availability.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Pull the right time field for the current picker target. Falls back
  // to empty for unknown buckets/rows.
  const currentTimeValue = (() => {
    if (!timePicker) return '';
    const arr = timePicker.bucket === 'day' ? days : dates;
    const row = arr[timePicker.rowIndex];
    return row?.times?.[0]?.[timePicker.field] || '';
  })();

  const applyTime = (value: string) => {
    if (!timePicker) return;
    if (timePicker.bucket === 'day') {
      setDayTime(timePicker.rowIndex, timePicker.field, value);
    } else {
      setDateTime(timePicker.rowIndex, timePicker.field, value);
    }
    setTimePicker(null);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      transparent={false}>
      <View style={[styles.container, {paddingTop: insets.top}]}>
        {/* Header */}
        <View style={[styles.header, {backgroundColor: primaryColor}]}>
          <Text style={styles.headerTitle}>Manage Availability Hours</Text>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close">
            <Icon name="close" size={24} color="#ffffff" />
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={primaryColor} size="large" />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionTitle}>Choose an option</Text>
            <View style={styles.optionsRow}>
              {OPTIONS.map(opt => {
                const active = availabilityHours === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setAvailabilityHours(opt.value)}
                    style={[
                      styles.optionCard,
                      active && {borderColor: primaryColor},
                    ]}>
                    <View
                      style={[
                        styles.radioOuter,
                        {borderColor: primaryColor},
                      ]}>
                      {active ? (
                        <View
                          style={[
                            styles.radioInner,
                            {backgroundColor: primaryColor},
                          ]}
                        />
                      ) : null}
                    </View>
                    <Text style={styles.optionLabel}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Weekday hours — only when Specific Days. */}
            {availabilityHours === SPECIFIC_DAYS ? (
              <>
                <Text style={styles.sectionTitle}>Weekly Hours</Text>
                <View style={styles.tableWrap}>
                  {days.map((d, i) => (
                    <View key={d.dayIndex} style={styles.tableRow}>
                      <Text style={styles.tableDay}>{d.dayName}</Text>
                      <Pressable
                        style={styles.checkboxRow}
                        onPress={() => setDayClosed(i, !d.closed)}>
                        <View
                          style={[
                            styles.checkbox,
                            d.closed && {
                              backgroundColor: primaryColor,
                              borderColor: primaryColor,
                            },
                          ]}>
                          {d.closed ? (
                            <Icon name="check" size={12} color="#ffffff" />
                          ) : null}
                        </View>
                        <Text style={styles.checkboxLabel}>N/A</Text>
                      </Pressable>
                      {!d.closed ? (
                        <View style={styles.timeCol}>
                          <Pressable
                            onPress={() =>
                              setTimePicker({
                                bucket: 'day',
                                rowIndex: i,
                                field: 'startTime',
                              })
                            }
                            style={styles.timePill}>
                            <Text
                              style={[
                                styles.timePillText,
                                !d.times?.[0]?.startTime &&
                                  styles.timePillPlaceholder,
                              ]}>
                              {to12Hour(d.times?.[0]?.startTime) || 'Start'}
                            </Text>
                          </Pressable>
                          <Text style={styles.timeSep}>–</Text>
                          <Pressable
                            onPress={() =>
                              setTimePicker({
                                bucket: 'day',
                                rowIndex: i,
                                field: 'endTime',
                              })
                            }
                            style={styles.timePill}>
                            <Text
                              style={[
                                styles.timePillText,
                                !d.times?.[0]?.endTime &&
                                  styles.timePillPlaceholder,
                              ]}>
                              {to12Hour(d.times?.[0]?.endTime) || 'End'}
                            </Text>
                          </Pressable>
                        </View>
                      ) : (
                        <Text style={styles.naText}>Closed all day</Text>
                      )}
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            {/* Specific Dates — for Anytime + Specific Days only. */}
            {availabilityHours !== TEMPORARY_UNAVAILABLE ? (
              <>
                <Text style={styles.sectionTitle}>Specific Dates</Text>
                <View style={styles.tableWrap}>
                  {dates.length === 0 ? (
                    <View style={styles.emptyRow}>
                      <Text style={styles.emptyText}>
                        No specific dates added yet
                      </Text>
                    </View>
                  ) : (
                    dates.map((d, i) => (
                      <View key={`date-${i}`} style={styles.tableRow}>
                        <Pressable
                          onPress={() => setDatePicker({index: i})}
                          style={styles.datePill}>
                          <Text
                            style={[
                              styles.datePillText,
                              !d.date && styles.timePillPlaceholder,
                            ]}>
                            {d.date || 'Select date'}
                          </Text>
                        </Pressable>
                        <Pressable
                          style={styles.checkboxRow}
                          onPress={() => setDateClosed(i, !d.closed)}>
                          <View
                            style={[
                              styles.checkbox,
                              d.closed && {
                                backgroundColor: primaryColor,
                                borderColor: primaryColor,
                              },
                            ]}>
                            {d.closed ? (
                              <Icon
                                name="check"
                                size={12}
                                color="#ffffff"
                              />
                            ) : null}
                          </View>
                          <Text style={styles.checkboxLabel}>N/A</Text>
                        </Pressable>
                        {!d.closed ? (
                          <View style={styles.timeCol}>
                            <Pressable
                              onPress={() =>
                                setTimePicker({
                                  bucket: 'date',
                                  rowIndex: i,
                                  field: 'startTime',
                                })
                              }
                              style={styles.timePill}>
                              <Text
                                style={[
                                  styles.timePillText,
                                  !d.times?.[0]?.startTime &&
                                    styles.timePillPlaceholder,
                                ]}>
                                {to12Hour(d.times?.[0]?.startTime) || 'Start'}
                              </Text>
                            </Pressable>
                            <Text style={styles.timeSep}>–</Text>
                            <Pressable
                              onPress={() =>
                                setTimePicker({
                                  bucket: 'date',
                                  rowIndex: i,
                                  field: 'endTime',
                                })
                              }
                              style={styles.timePill}>
                              <Text
                                style={[
                                  styles.timePillText,
                                  !d.times?.[0]?.endTime &&
                                    styles.timePillPlaceholder,
                                ]}>
                                {to12Hour(d.times?.[0]?.endTime) || 'End'}
                              </Text>
                            </Pressable>
                          </View>
                        ) : (
                          <Text style={styles.naText}>Closed</Text>
                        )}
                        <Pressable
                          onPress={() => removeDate(i)}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel="Remove date">
                          <Icon
                            name="close-circle-outline"
                            size={20}
                            color="#ef4444"
                          />
                        </Pressable>
                      </View>
                    ))
                  )}
                  <Pressable onPress={addDate} style={styles.addBtn}>
                    <Icon name="plus" size={14} color="#ffffff" />
                    <Text style={styles.addBtnText}>Add new</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </ScrollView>
        )}

        {/* Footer */}
        <View
          style={[
            styles.footer,
            {paddingBottom: Math.max(12, insets.bottom)},
          ]}>
          <Pressable
            onPress={onClose}
            style={[styles.footerBtn, styles.footerBtnGhost]}>
            <Text style={styles.footerBtnGhostText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={isSaving}
            style={[
              styles.footerBtn,
              {backgroundColor: primaryColor},
              isSaving && {opacity: 0.6},
            ]}>
            {isSaving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.footerBtnText}>Save</Text>
            )}
          </Pressable>
        </View>

        {/* Time picker overlay */}
        <Modal
          visible={timePicker !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setTimePicker(null)}>
          <Pressable
            style={styles.pickerScrim}
            onPress={() => setTimePicker(null)}>
            <Pressable style={styles.pickerCard} onPress={() => undefined}>
              <Text style={styles.pickerTitle}>Select time</Text>
              <ScrollView style={{maxHeight: 360}}>
                {TIME_SLOTS.map(t => (
                  <Pressable
                    key={t}
                    onPress={() => applyTime(t)}
                    style={[
                      styles.pickerOption,
                      currentTimeValue === t && {
                        backgroundColor: `${primaryColor}1a`,
                      },
                    ]}>
                    <Text style={styles.pickerOptionLabel}>{to12Hour(t)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Date picker */}
        <CalendarPicker
          visible={datePicker !== null}
          value={datePicker ? dates[datePicker.index]?.date || '' : ''}
          onClose={() => setDatePicker(null)}
          onSelect={iso => {
            if (datePicker) setDateDate(datePicker.index, iso);
            setDatePicker(null);
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: {
    color: '#ffffff',
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  body: {
    gap: 16,
    padding: 16,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
    marginTop: 8,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  optionCard: {
    alignItems: 'center',
    borderColor: '#e2e8f0',
    borderRadius: 10,
    borderWidth: 1.5,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  radioOuter: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 2,
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
  radioInner: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  optionLabel: {
    color: '#0f172a',
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  tableWrap: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 10,
    borderWidth: 1,
    padding: 8,
  },
  tableRow: {
    alignItems: 'center',
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  tableDay: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
    width: 40,
  },
  checkboxRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  checkbox: {
    alignItems: 'center',
    borderColor: '#cbd5e1',
    borderRadius: 4,
    borderWidth: 1.5,
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
  checkboxLabel: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
  },
  timeCol: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'flex-end',
  },
  timePill: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  timePillText: {
    color: '#0f172a',
    fontSize: 11,
    fontWeight: '700',
  },
  timePillPlaceholder: {
    color: '#94a3b8',
    fontWeight: '500',
  },
  timeSep: {
    color: '#64748b',
    fontSize: 11,
  },
  naText: {
    color: '#94a3b8',
    flex: 1,
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'right',
  },
  datePill: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  datePillText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyRow: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  addBtn: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  footer: {
    borderTopColor: '#e2e8f0',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  footerBtn: {
    alignItems: 'center',
    borderRadius: 10,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 14,
  },
  footerBtnGhost: {
    backgroundColor: '#f1f5f9',
  },
  footerBtnGhostText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  footerBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  pickerScrim: {
    alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.45)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  pickerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    width: '100%',
  },
  pickerTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 8,
  },
  pickerOption: {
    borderBottomColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  pickerOptionLabel: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
  },
});
