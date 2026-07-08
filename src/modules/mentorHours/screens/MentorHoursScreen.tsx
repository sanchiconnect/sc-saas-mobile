import React, {useCallback, useContext, useEffect, useState} from 'react';
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
import {TenantContext} from '../../../core/tenant/TenantProvider';
import {useToast} from '../../../core/toast/ToastProvider';
import {
  APPROVAL_STATUS_OPTIONS,
  ENTRY_MODE_OPTIONS,
  ENTRY_TYPE_OPTIONS,
  mentorHoursService,
} from '../services/mentorHours.service';
import type {
  ApprovalStatus,
  EntryMode,
  EntryType,
  MentorHourEntry,
  MentorHoursSummary,
} from '../services/mentorHours.service';

type Props = {
  token: string;
  onBack: () => void;
};

type FilterKey = 'approvalStatus' | 'entryType' | 'mode';

const humanize = (s: string): string =>
  s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export function MentorHoursScreen({token, onBack}: Props) {
  const {theme, globalSetting} = useContext(TenantContext);
  const primaryColor = theme?.primary || '#0b0aa3';
  const toast = useToast();

  const title = (globalSetting as any)?.mentor_hours_title || 'Mentor Hours';

  const [entries, setEntries] = useState<MentorHourEntry[]>([]);
  const [summary, setSummary] = useState<MentorHoursSummary>({timeMeterMinutes: 0, avgRating: 0});
  const [isLoading, setIsLoading] = useState(true);

  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus | null>(null);
  const [entryType, setEntryType] = useState<EntryType | null>(null);
  const [mode, setMode] = useState<EntryMode | null>(null);
  const [pickerFor, setPickerFor] = useState<FilterKey | null>(null);

  const toastRef = React.useRef(toast);
  toastRef.current = toast;

  const load = useCallback(async () => {
    try {
      const res = await mentorHoursService.listMentorHours(token, {approvalStatus, entryType, mode});
      setEntries(res.entries);
      setSummary(res.summary);
    } catch (e: any) {
      toastRef.current.error(e?.message || 'Could not load mentor hours.');
    }
  }, [token, approvalStatus, entryType, mode]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const notReady = () => toast.info('This action needs the backend endpoint — coming soon.');

  const handleClearFilters = () => {
    setApprovalStatus(null);
    setEntryType(null);
    setMode(null);
  };

  const pickerOptions: string[] =
    pickerFor === 'approvalStatus' ? APPROVAL_STATUS_OPTIONS
    : pickerFor === 'entryType' ? ENTRY_TYPE_OPTIONS
    : pickerFor === 'mode' ? ENTRY_MODE_OPTIONS
    : [];

  const selectOption = (value: string) => {
    if (pickerFor === 'approvalStatus') setApprovalStatus(value as ApprovalStatus);
    else if (pickerFor === 'entryType') setEntryType(value as EntryType);
    else if (pickerFor === 'mode') setMode(value as EntryMode);
    setPickerFor(null);
  };

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
          <Icon name="arrow-left" size={22} color="#0f172a" />
        </Pressable>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.statTile}>
          <Text style={[styles.statValue, {color: primaryColor}]}>{summary.timeMeterMinutes}</Text>
          <Text style={styles.statLabel}>Time Meter (mins)</Text>
        </View>
        <View style={styles.statTile}>
          <View style={styles.statValueRow}>
            <Icon name="star" size={14} color="#f59e0b" />
            <Text style={[styles.statValue, {color: primaryColor}]}>{summary.avgRating}</Text>
          </View>
          <Text style={styles.statLabel}>Avg. Ratings</Text>
        </View>
        <Pressable
          style={[styles.addBtn, {backgroundColor: primaryColor}]}
          onPress={notReady}
          accessibilityRole="button"
          accessibilityLabel="Add hours">
          <Icon name="plus" size={14} color="#ffffff" />
          <Text style={styles.addBtnText}>ADD HOURS</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.filtersCard}>
            <Text style={styles.filtersLabel}>Filters</Text>
            <View style={styles.filterRow}>
              <Pressable style={styles.filterDropdown} onPress={() => setPickerFor('approvalStatus')}>
                <Text style={styles.filterLabel}>Approval Status</Text>
                <View style={styles.filterValueRow}>
                  <Text style={approvalStatus ? styles.filterValue : styles.filterPlaceholder}>
                    {approvalStatus ? humanize(approvalStatus) : 'Choose a approval status'}
                  </Text>
                  <Icon name="chevron-down" size={16} color="#64748b" />
                </View>
              </Pressable>
              <Pressable style={styles.filterDropdown} onPress={() => setPickerFor('entryType')}>
                <Text style={styles.filterLabel}>Entry Type</Text>
                <View style={styles.filterValueRow}>
                  <Text style={entryType ? styles.filterValue : styles.filterPlaceholder}>
                    {entryType ? humanize(entryType) : 'Choose a entry type'}
                  </Text>
                  <Icon name="chevron-down" size={16} color="#64748b" />
                </View>
              </Pressable>
              <Pressable style={styles.filterDropdown} onPress={() => setPickerFor('mode')}>
                <Text style={styles.filterLabel}>Mode</Text>
                <View style={styles.filterValueRow}>
                  <Text style={mode ? styles.filterValue : styles.filterPlaceholder}>
                    {mode ? humanize(mode) : 'Choose a mode'}
                  </Text>
                  <Icon name="chevron-down" size={16} color="#64748b" />
                </View>
              </Pressable>
            </View>
            <Pressable style={styles.clearFiltersBtn} onPress={handleClearFilters}>
              <Text style={styles.clearFiltersText}>Clear filters</Text>
            </Pressable>
          </View>

          {entries.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Icon name="alert-circle-outline" size={52} color="#94a3b8" />
              </View>
              <Text style={styles.emptyTitle}>No hours added</Text>
              <Pressable
                style={[styles.addBtn, {backgroundColor: primaryColor, alignSelf: 'center', marginTop: 20}]}
                onPress={notReady}>
                <Icon name="plus" size={14} color="#ffffff" />
                <Text style={styles.addBtnText}>ADD HOURS</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      )}

      {pickerFor ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setPickerFor(null)}>
          <Pressable style={styles.pickerBackdrop} onPress={() => setPickerFor(null)}>
            <Pressable style={styles.pickerSheet} onPress={e => e.stopPropagation()}>
              <Text style={styles.pickerTitle}>
                {pickerFor === 'approvalStatus' ? 'Approval Status' : pickerFor === 'entryType' ? 'Entry Type' : 'Mode'}
              </Text>
              {pickerOptions.map(opt => {
                const selected =
                  (pickerFor === 'approvalStatus' && approvalStatus === opt) ||
                  (pickerFor === 'entryType' && entryType === opt) ||
                  (pickerFor === 'mode' && mode === opt);
                return (
                  <Pressable
                    key={opt}
                    style={[styles.pickerRow, selected && styles.pickerRowSelected]}
                    onPress={() => selectOption(opt)}>
                    <Text style={[styles.pickerRowText, selected && {fontWeight: '700'}]}>{humanize(opt)}</Text>
                    {selected ? <Icon name="check" size={18} color="#16a34a" /> : null}
                  </Pressable>
                );
              })}
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {backgroundColor: '#f1f5f9', flex: 1},
  header: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  headerTitle: {color: '#0f172a', flex: 1, fontSize: 18, fontWeight: '800', minWidth: 120},
  statTile: {
    alignItems: 'center',
    borderColor: '#e2e8f0',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  statValueRow: {alignItems: 'center', flexDirection: 'row', gap: 4},
  statValue: {fontSize: 16, fontWeight: '800'},
  statLabel: {color: '#64748b', fontSize: 11, fontWeight: '600', marginTop: 2},
  addBtn: {
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addBtnText: {color: '#ffffff', fontSize: 12, fontWeight: '800', letterSpacing: 0.4},
  centered: {alignItems: 'center', flex: 1, justifyContent: 'center'},
  scrollContent: {flexGrow: 1, padding: 14},
  filtersCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    marginBottom: 14,
    padding: 16,
  },
  filtersLabel: {color: '#0f172a', fontSize: 15, fontWeight: '800', marginBottom: 12},
  filterRow: {gap: 12},
  filterDropdown: {
    borderColor: '#e2e8f0',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  filterLabel: {color: '#0f172a', fontSize: 12, fontWeight: '700', marginBottom: 6},
  filterValueRow: {alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between'},
  filterPlaceholder: {color: '#94a3b8', fontSize: 13},
  filterValue: {color: '#0f172a', fontSize: 13, fontWeight: '700'},
  clearFiltersBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  clearFiltersText: {color: '#334155', fontSize: 12, fontWeight: '700'},
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 300,
    padding: 32,
  },
  emptyIconWrap: {
    alignItems: 'center',
    borderColor: '#cbd5e1',
    borderRadius: 50,
    borderWidth: 2,
    height: 96,
    justifyContent: 'center',
    width: 96,
  },
  emptyTitle: {color: '#0f172a', fontSize: 16, fontWeight: '700', marginTop: 20},
  pickerBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.4)',
    flex: 1,
    justifyContent: 'center',
  },
  pickerSheet: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    width: '80%',
  },
  pickerTitle: {color: '#0f172a', fontSize: 16, fontWeight: '800', marginBottom: 12},
  pickerRow: {
    alignItems: 'center',
    borderBottomColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 12,
  },
  pickerRowSelected: {backgroundColor: '#f0fdf4'},
  pickerRowText: {color: '#0f172a', fontSize: 14},
});
