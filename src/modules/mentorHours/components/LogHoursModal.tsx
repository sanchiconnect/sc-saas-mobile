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

import {CalendarPicker} from '../../../core/components/CalendarPicker';
import {Icon} from '../../../core/components/Icon';
import {formatTimeLabel, TimePicker} from '../../../core/components/TimePicker';
import {TenantContext} from '../../../core/tenant/TenantProvider';
import {colors} from '../../../core/theme/colors';
import {useToast} from '../../../core/toast/ToastProvider';
import {
  ENTRY_MODE_LABELS,
  ENTRY_MODE_OPTIONS,
  mentorHoursService,
} from '../services/mentorHours.service';
import type {
  EntryMode,
  MentorshipParty,
} from '../services/mentorHours.service';

type Props = {
  visible: boolean;
  token: string;
  parties: MentorshipParty[];
  loadingParties?: boolean;
  // 'startup' for a mentor account logging hours against a mentee startup,
  // 'mentor' for a startup account logging hours against a connected mentor.
  partyLabel: string;
  isStartupAccount: boolean;
  // Own numeric id — mentorId for a mentor account, startupId for a startup
  // account. The manual-entry payload needs both sides of the pairing.
  ownId: number | string | null | undefined;
  onClose: () => void;
  onSubmitted: () => void;
};

const formatDateLabel = (iso: string): string => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString(undefined, {day: 'numeric', month: 'short', year: 'numeric'});
};

const pad2 = (n: number): string => String(n).padStart(2, '0');
const getTodayIso = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const getNowTime = (): string => {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

export function LogHoursModal({
  visible,
  token,
  parties,
  loadingParties,
  partyLabel,
  isStartupAccount,
  ownId,
  onClose,
  onSubmitted,
}: Props) {
  const {theme} = useContext(TenantContext);
  const primaryColor = theme?.primary || colors.primary;
  const toast = useToast();

  const [partyId, setPartyId] = useState<MentorshipParty['id'] | ''>('');
  const [mode, setMode] = useState<EntryMode | null>(null);
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [showPartyPicker, setShowPartyPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setPartyId('');
    setMode(null);
    setDate('');
    setStartTime('');
    setEndTime('');
  }, [visible]);

  const isToday = date === getTodayIso();
  const minTime = isToday ? getNowTime() : undefined;

  // The date changed to today (or minute ticked over) — drop any already
  // selected times that are now in the past instead of leaving a stale pick
  // the filtered list no longer shows.
  useEffect(() => {
    if (!isToday) return;
    const now = getNowTime();
    if (startTime && startTime < now) setStartTime('');
    if (endTime && endTime < now) setEndTime('');
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedPartyName = parties.find(s => s.id === partyId)?.name;

  const handleSubmit = async () => {
    if (!partyId) return toast.error(`Please select a ${partyLabel}.`);
    if (!mode) return toast.error('Please select a mode.');
    if (!date) return toast.error('Please choose a date.');
    if (!startTime || !endTime) return toast.error('Please choose start and end time.');
    if (endTime <= startTime) return toast.error('End time must be after start time.');
    if (!ownId) {
      return toast.error(
        `Your profile is missing a ${isStartupAccount ? 'startup' : 'mentor'} id — contact support.`,
      );
    }

    setSubmitting(true);
    try {
      await mentorHoursService.logHours(token, {
        startupId: isStartupAccount ? ownId : partyId,
        mentorId: isStartupAccount ? partyId : ownId,
        mode,
        date,
        startTime,
        endTime,
      });
      toast.success('Hours logged for approval.');
      onSubmitted();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || 'Could not log hours.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Log Hours</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              onPress={onClose}
              style={[styles.closeButton, {borderColor: primaryColor}]}>
              <Icon name="close" size={18} color="#0f172a" />
            </Pressable>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            <Text style={styles.fieldLabel}>
              Select {partyLabel}<Text style={styles.required}> *</Text>
            </Text>
            <Pressable style={styles.fieldBox} onPress={() => setShowPartyPicker(true)}>
              <Text style={selectedPartyName ? styles.fieldValue : styles.fieldPlaceholder}>
                {selectedPartyName || `Choose a ${partyLabel}`}
              </Text>
              <Icon name="chevron-down" size={16} color="#64748b" />
            </Pressable>

            <Text style={[styles.fieldLabel, styles.spacedLabel]}>
              Mode<Text style={styles.required}> *</Text>
            </Text>
            <View style={styles.modeRow}>
              {ENTRY_MODE_OPTIONS.map(opt => {
                const selected = mode === opt;
                return (
                  <Pressable
                    key={opt}
                    style={[styles.modeOption, selected && {borderColor: primaryColor}]}
                    onPress={() => setMode(opt)}>
                    <View
                      style={[
                        styles.radioOuter,
                        selected && {borderColor: primaryColor},
                      ]}>
                      {selected ? (
                        <View style={[styles.radioInner, {backgroundColor: primaryColor}]} />
                      ) : null}
                    </View>
                    <Text style={styles.modeOptionText}>{ENTRY_MODE_LABELS[opt]}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, styles.spacedLabel]}>
              Date<Text style={styles.required}> *</Text>
            </Text>
            <Pressable style={styles.fieldBox} onPress={() => setShowDatePicker(true)}>
              <Text style={date ? styles.fieldValue : styles.fieldPlaceholder}>
                {date ? formatDateLabel(date) : 'Choose a date'}
              </Text>
              <Icon name="calendar" size={16} color="#64748b" />
            </Pressable>

            <View style={styles.timeRow}>
              <View style={styles.timeCol}>
                <Text style={styles.fieldLabel}>
                  Start Time<Text style={styles.required}> *</Text>
                </Text>
                <Pressable style={styles.fieldBox} onPress={() => setShowStartTimePicker(true)}>
                  <Text style={startTime ? styles.fieldValue : styles.fieldPlaceholder}>
                    {startTime ? formatTimeLabel(startTime) : '--:-- --'}
                  </Text>
                  <Icon name="clock-outline" size={16} color="#64748b" />
                </Pressable>
              </View>
              <View style={styles.timeCol}>
                <Text style={styles.fieldLabel}>
                  End Time<Text style={styles.required}> *</Text>
                </Text>
                <Pressable style={styles.fieldBox} onPress={() => setShowEndTimePicker(true)}>
                  <Text style={endTime ? styles.fieldValue : styles.fieldPlaceholder}>
                    {endTime ? formatTimeLabel(endTime) : '--:-- --'}
                  </Text>
                  <Icon name="clock-outline" size={16} color="#64748b" />
                </Pressable>
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable style={styles.cancelBtn} onPress={onClose} disabled={submitting}>
              <Text style={styles.cancelBtnText}>CANCEL</Text>
            </Pressable>
            <Pressable
              style={[styles.submitBtn, {backgroundColor: primaryColor}, submitting && {opacity: 0.7}]}
              onPress={handleSubmit}
              disabled={submitting}>
              {submitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.submitBtnText}>SUBMIT</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>

      {showPartyPicker ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowPartyPicker(false)}>
          <Pressable style={styles.overlay} onPress={() => setShowPartyPicker(false)}>
            <Pressable style={styles.pickerSheet} onPress={e => e.stopPropagation()}>
              <Text style={styles.headerTitle}>Select {partyLabel}</Text>
              {loadingParties ? (
                <ActivityIndicator style={styles.pickerLoading} color={primaryColor} />
              ) : parties.length === 0 ? (
                <Text style={styles.pickerEmpty}>No connected {partyLabel}s found.</Text>
              ) : (
                <ScrollView style={styles.pickerList}>
                  {parties.map(s => {
                    const selected = s.id === partyId;
                    return (
                      <Pressable
                        key={String(s.id)}
                        style={[styles.pickerRow, selected && {backgroundColor: colors.surfaceMuted}]}
                        onPress={() => {
                          setPartyId(s.id);
                          setShowPartyPicker(false);
                        }}>
                        <Text style={[styles.pickerRowText, selected && {fontWeight: '700'}]}>
                          {s.name}
                        </Text>
                        {selected ? <Icon name="check" size={16} color={primaryColor} /> : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      <CalendarPicker
        visible={showDatePicker}
        value={date}
        onSelect={iso => {
          setDate(iso);
          setShowDatePicker(false);
        }}
        onClose={() => setShowDatePicker(false)}
      />

      <TimePicker
        visible={showStartTimePicker}
        value={startTime}
        minTime={minTime}
        title="Start time"
        onSelect={time => {
          setStartTime(time);
          setShowStartTimePicker(false);
        }}
        onClose={() => setShowStartTimePicker(false)}
      />

      <TimePicker
        visible={showEndTimePicker}
        value={endTime}
        minTime={minTime}
        title="End time"
        onSelect={time => {
          setEndTime(time);
          setShowEndTimePicker(false);
        }}
        onClose={() => setShowEndTimePicker(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  backdrop: {...StyleSheet.absoluteFill},
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    maxHeight: '85%',
    padding: 20,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitle: {color: '#0f172a', fontSize: 20, fontWeight: '800'},
  closeButton: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  body: {marginBottom: 12},
  fieldLabel: {color: '#0f172a', fontSize: 14, fontWeight: '700', marginBottom: 8},
  spacedLabel: {marginTop: 18},
  required: {color: '#dc2626'},
  fieldBox: {
    alignItems: 'center',
    borderColor: '#e2e8f0',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  fieldPlaceholder: {color: '#94a3b8', fontSize: 14},
  fieldValue: {color: '#0f172a', fontSize: 14, fontWeight: '600'},
  modeRow: {flexDirection: 'row', gap: 12},
  modeOption: {
    alignItems: 'center',
    borderColor: '#e2e8f0',
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  modeOptionText: {color: '#0f172a', fontSize: 14, fontWeight: '600'},
  radioOuter: {
    alignItems: 'center',
    borderColor: '#cbd5e1',
    borderRadius: 10,
    borderWidth: 2,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  radioInner: {borderRadius: 5, height: 10, width: 10},
  timeRow: {flexDirection: 'row', gap: 12, marginTop: 18},
  timeCol: {flex: 1},
  footer: {
    borderTopColor: '#e2e8f0',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
    paddingTop: 16,
  },
  cancelBtn: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  cancelBtnText: {color: '#334155', fontSize: 13, fontWeight: '800', letterSpacing: 0.4},
  submitBtn: {
    alignItems: 'center',
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  submitBtnText: {color: '#ffffff', fontSize: 13, fontWeight: '800', letterSpacing: 0.4},
  pickerSheet: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    maxHeight: '70%',
    padding: 20,
    width: '85%',
  },
  pickerLoading: {marginTop: 16},
  pickerEmpty: {color: '#64748b', fontSize: 13, marginTop: 12},
  pickerList: {marginTop: 12},
  pickerRow: {
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  pickerRowText: {color: '#0f172a', fontSize: 14},
});
