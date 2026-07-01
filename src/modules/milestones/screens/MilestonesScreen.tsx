import React, {useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {Icon} from '../../../core/components/Icon';
import {TenantContext} from '../../../core/tenant/TenantProvider';
import {useToast} from '../../../core/toast/ToastProvider';
import {milestonesService} from '../services/milestones.service';
import type {Milestone, QuantitativeTask} from '../services/milestones.service';

type Props = {
  token: string;
  onBack: () => void;
};

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const formatDeadline = (iso?: string): string => {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
};

const statusColor = (s?: string): string => {
  const st = (s || '').toLowerCase();
  if (st === 'completed') return '#16a34a';
  if (st === 'in_progress' || st === 'in progress') return '#2563eb';
  if (st === 'pending') return '#d97706';
  return '#64748b';
};

const humanizeStatus = (s?: string): string => {
  if (!s) return 'Active';
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

// ── Main Screen ───────────────────────────────────────────────────────────────
export function MilestonesScreen({token, onBack}: Props) {
  const {theme, globalSetting} = useContext(TenantContext);
  const primaryColor = theme?.primary || '#0b0aa3';
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const title = (globalSetting as any)?.milestone_management_title || 'Milestones';

  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [addVisible, setAddVisible] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await milestonesService.listMilestones(token);
      setMilestones(data);
    } catch (e: any) {
      toast.error(e?.message || 'Could not load milestones.');
    }
  }, [token, toast]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return milestones;
    const q = search.toLowerCase();
    return milestones.filter(m =>
      (m.title || '').toLowerCase().includes(q) ||
      (m.description || '').toLowerCase().includes(q),
    );
  }, [milestones, search]);

  const activeCount = useMemo(
    () => milestones.filter(m => (m.status || '').toLowerCase() !== 'completed').length,
    [milestones],
  );

  return (
    <View style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
          <Icon name="arrow-left" size={22} color="#0f172a" />
        </Pressable>
        <Text style={styles.headerTitle}>{title}</Text>
        <Pressable
          style={[styles.addBtn, {backgroundColor: primaryColor}]}
          onPress={() => setAddVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Add milestone">
          <Icon name="plus" size={14} color="#ffffff" />
          <Text style={styles.addBtnText}>ADD MILESTONE</Text>
        </Pressable>
      </View>

      {/* Stats + Search bar */}
      <View style={styles.statsBar}>
        <Text style={styles.statsText}>
          You have <Text style={styles.statsCount}>{activeCount}</Text> active milestones
        </Text>
        <View style={styles.searchBox}>
          <Icon name="magnify" size={16} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search a milestone"
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Icon name="close-circle" size={16} color="#94a3b8" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={primaryColor}
              colors={[primaryColor]}
            />
          }>
          {filtered.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Icon name="alert-circle-outline" size={52} color="#94a3b8" />
              </View>
              <Text style={styles.emptyTitle}>No milestones created yet</Text>
              <Pressable
                style={[styles.addBtn, {backgroundColor: primaryColor, alignSelf: 'center', marginTop: 20}]}
                onPress={() => setAddVisible(true)}>
                <Icon name="plus" size={14} color="#ffffff" />
                <Text style={styles.addBtnText}>ADD MILESTONE</Text>
              </Pressable>
            </View>
          ) : (
            filtered.map(m => (
              <MilestoneCard key={m.uuid} milestone={m} primaryColor={primaryColor} />
            ))
          )}
        </ScrollView>
      )}

      {addVisible ? (
        <AddMilestoneModal
          token={token}
          primaryColor={primaryColor}
          insetBottom={insets.bottom}
          onClose={() => setAddVisible(false)}
          onCreated={() => { setAddVisible(false); load(); }}
        />
      ) : null}
    </View>
  );
}

// ── Milestone card ────────────────────────────────────────────────────────────
function MilestoneCard({milestone, primaryColor}: {milestone: Milestone; primaryColor: string}) {
  const reviewerName =
    milestone.reviewer?.name ||
    milestone.reviewer?.fullName ||
    (milestone.reviewer as any)?.otherUser?.name ||
    null;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {milestone.title || 'Untitled Milestone'}
        </Text>
        <View style={[styles.statusBadge, {backgroundColor: statusColor(milestone.status) + '22'}]}>
          <Text style={[styles.statusText, {color: statusColor(milestone.status)}]}>
            {humanizeStatus(milestone.status)}
          </Text>
        </View>
      </View>
      {milestone.description ? (
        <Text style={styles.cardDesc} numberOfLines={3}>{milestone.description}</Text>
      ) : null}
      <View style={styles.cardMeta}>
        {reviewerName ? (
          <View style={styles.metaRow}>
            <Icon name="account-outline" size={14} color="#64748b" />
            <Text style={styles.metaText}>{reviewerName}</Text>
          </View>
        ) : null}
        {(milestone.targetDate as string) || milestone.deadline ? (
          <View style={styles.metaRow}>
            <Icon name="calendar-outline" size={14} color="#64748b" />
            <Text style={styles.metaText}>
              {formatDeadline((milestone.targetDate as string) || (milestone.deadline as string))}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ── Add Milestone Modal ───────────────────────────────────────────────────────
type Reviewer = {uuid: string; name: string};

function AddMilestoneModal({
  token,
  primaryColor,
  insetBottom,
  onClose,
  onCreated,
}: {
  token: string;
  primaryColor: string;
  insetBottom: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();

  // Basic fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [progressReporting, setProgressReporting] = useState<'weekly' | 'monthly' | 'quarterly'>('monthly');

  // Reviewers
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [selectedReviewers, setSelectedReviewers] = useState<Reviewer[]>([]);
  const [reviewerPickerOpen, setReviewerPickerOpen] = useState(false);

  // Qualitative tasks — list of strings
  const [qualTasks, setQualTasks] = useState<string[]>(['']);

  // Quantitative tasks — list of {parameter, quantifiedValue, unit}
  const [quantTasks, setQuantTasks] = useState<QuantitativeTask[]>([
    {parameter: '', quantifiedValue: '', unit: ''},
  ]);

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    milestonesService.listReviewers(token).then(rows => {
      const mapped = rows
        .map(r => {
          const u = (r as any).otherUser || r;
          const uuid: string = String(u?.uuid || '');
          const name: string = String(u?.name || u?.fullName || '');
          return {uuid, name};
        })
        .filter((r): r is Reviewer => r.uuid.length > 0 && r.name.length > 0);
      setReviewers(mapped);
    }).catch(() => {});
  }, [token]);

  const toggleReviewer = (r: Reviewer) => {
    setSelectedReviewers(prev =>
      prev.find(x => x.uuid === r.uuid)
        ? prev.filter(x => x.uuid !== r.uuid)
        : [...prev, r],
    );
  };

  // Qualitative task helpers
  const updateQualTask = (idx: number, val: string) =>
    setQualTasks(prev => prev.map((t, i) => (i === idx ? val : t)));
  const addQualTask = () => setQualTasks(prev => [...prev, '']);
  const removeQualTask = (idx: number) =>
    setQualTasks(prev => prev.filter((_, i) => i !== idx));

  // Quantitative task helpers
  const updateQuantTask = (idx: number, field: keyof QuantitativeTask, val: string) =>
    setQuantTasks(prev =>
      prev.map((t, i) => (i === idx ? {...t, [field]: val} : t)),
    );
  const addQuantTask = () =>
    setQuantTasks(prev => [...prev, {parameter: '', quantifiedValue: '', unit: ''}]);
  const removeQuantTask = (idx: number) =>
    setQuantTasks(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error('Title is required.'); return; }
    if (!description.trim()) { toast.error('Brief Description is required.'); return; }
    if (!startDate.trim()) { toast.error('Start Date is required.'); return; }
    if (!targetDate.trim()) { toast.error('Target Date is required.'); return; }

    setIsSaving(true);
    try {
      await milestonesService.createMilestone(token, {
        title: title.trim(),
        description: description.trim(),
        reviewerIds: selectedReviewers.map(r => r.uuid),
        startDate: startDate.trim(),
        targetDate: targetDate.trim(),
        progressReporting,
        qualitativeTasks: qualTasks.filter(t => t.trim()),
        quantitativeTasks: quantTasks.filter(t => t.parameter.trim()),
      });
      toast.success('Milestone created!');
      onCreated();
    } catch (e: any) {
      toast.error(e?.message || 'Could not create milestone.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.modalSheet, {paddingBottom: insetBottom + 8}]}>
          {/* Modal header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create a new milestone</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Icon name="close" size={20} color="#64748b" />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.modalBody}>

            {/* Title */}
            <Text style={styles.fieldLabel}>Title <Text style={styles.req}>*</Text></Text>
            <TextInput
              style={styles.fieldInput}
              value={title}
              onChangeText={setTitle}
              placeholder="Title"
              placeholderTextColor="#94a3b8"
            />

            {/* Brief Description */}
            <Text style={styles.fieldLabel}>Brief Description <Text style={styles.req}>*</Text></Text>
            <TextInput
              style={[styles.fieldInput, styles.textarea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Write some description about milestone"
              placeholderTextColor="#94a3b8"
              multiline
              textAlignVertical="top"
            />

            {/* Reviewers */}
            <Text style={styles.fieldLabel}>Reviewers</Text>
            <Pressable
              style={styles.fieldInput}
              onPress={() => setReviewerPickerOpen(true)}>
              <Text style={selectedReviewers.length ? styles.pickerValueText : styles.pickerPlaceholderText}>
                {selectedReviewers.length
                  ? selectedReviewers.map(r => r.name).join(', ')
                  : 'Choose Reviewers'}
              </Text>
            </Pressable>

            {/* Start Date + Target Date */}
            <View style={styles.dateRow}>
              <View style={styles.dateField}>
                <Text style={styles.fieldLabel}>Start Date <Text style={styles.req}>*</Text></Text>
                <TextInput
                  style={styles.fieldInput}
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="yyyy-mm-dd"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={styles.dateField}>
                <Text style={styles.fieldLabel}>Target Date <Text style={styles.req}>*</Text></Text>
                <TextInput
                  style={styles.fieldInput}
                  value={targetDate}
                  onChangeText={setTargetDate}
                  placeholder="yyyy-mm-dd"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>

            {/* Progress Reporting */}
            <Text style={styles.fieldLabel}>
              Progress reporting <Text style={styles.req}>*</Text>
            </Text>
            <Text style={styles.fieldHint}>
              The platform will share updates on progress as per below mentioned frequency.
            </Text>
            <View style={styles.radioRow}>
              {(['weekly', 'monthly', 'quarterly'] as const).map(opt => (
                <Pressable
                  key={opt}
                  style={styles.radioItem}
                  onPress={() => setProgressReporting(opt)}>
                  <View style={[
                    styles.radioCircle,
                    progressReporting === opt && {borderColor: primaryColor},
                  ]}>
                    {progressReporting === opt ? (
                      <View style={[styles.radioDot, {backgroundColor: primaryColor}]} />
                    ) : null}
                  </View>
                  <Text style={styles.radioLabel}>
                    {opt === 'weekly' ? 'Every Week' : opt === 'monthly' ? 'Every Month' : 'Every Quarter'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* ── Qualitative Tasks ─────────────────────────────────────── */}
            <Text style={[styles.taskSectionTitle, {color: primaryColor}]}>
              Qualitative Tasks <Text style={styles.req}>*</Text>
            </Text>
            <Text style={styles.fieldHint}>Eg. Hire a developer to create CRM.</Text>

            {qualTasks.map((task, idx) => (
              <View key={idx} style={styles.taskRow}>
                <TextInput
                  style={[styles.fieldInput, styles.taskInput]}
                  value={task}
                  onChangeText={val => updateQualTask(idx, val)}
                  placeholder="Enter text"
                  placeholderTextColor="#94a3b8"
                />
                {qualTasks.length > 1 ? (
                  <Pressable onPress={() => removeQualTask(idx)} hitSlop={8} style={styles.deleteBtn}>
                    <Icon name="delete-outline" size={20} color="#dc2626" />
                  </Pressable>
                ) : null}
              </View>
            ))}
            <Pressable style={styles.addRowBtn} onPress={addQualTask}>
              <Text style={styles.addRowBtnText}>+ Add</Text>
            </Pressable>

            {/* ── Quantitative Tasks ────────────────────────────────────── */}
            <Text style={[styles.taskSectionTitle, {color: primaryColor}]}>
              Quantitative Tasks <Text style={styles.req}>*</Text>
            </Text>
            <Text style={styles.fieldHint}>Eg. Revenue of 50,00,000 INR</Text>

            {/* Column headers */}
            <View style={styles.quantHeader}>
              <Text style={[styles.quantHeaderText, {flex: 2}]}>Parameter</Text>
              <Text style={[styles.quantHeaderText, {flex: 2}]}>Quantified value</Text>
              <Text style={[styles.quantHeaderText, {flex: 1.5}]}>Unit</Text>
              <View style={{width: 28}} />
            </View>

            {quantTasks.map((task, idx) => (
              <View key={idx} style={styles.quantRow}>
                <TextInput
                  style={[styles.fieldInput, styles.quantCell, {flex: 2}]}
                  value={task.parameter}
                  onChangeText={val => updateQuantTask(idx, 'parameter', val)}
                  placeholder="Enter text"
                  placeholderTextColor="#94a3b8"
                />
                <TextInput
                  style={[styles.fieldInput, styles.quantCell, {flex: 2}]}
                  value={task.quantifiedValue}
                  onChangeText={val => updateQuantTask(idx, 'quantifiedValue', val)}
                  placeholder="eg. 20"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.fieldInput, styles.quantCell, {flex: 1.5}]}
                  value={task.unit}
                  onChangeText={val => updateQuantTask(idx, 'unit', val)}
                  placeholder="USD/INR/%"
                  placeholderTextColor="#94a3b8"
                />
                {quantTasks.length > 1 ? (
                  <Pressable onPress={() => removeQuantTask(idx)} hitSlop={8} style={styles.deleteBtn}>
                    <Icon name="delete-outline" size={20} color="#dc2626" />
                  </Pressable>
                ) : <View style={{width: 28}} />}
              </View>
            ))}
            <Pressable style={styles.addRowBtn} onPress={addQuantTask}>
              <Text style={styles.addRowBtnText}>+ Add</Text>
            </Pressable>

            {/* Submit */}
            <Pressable
              style={[styles.submitBtn, {backgroundColor: primaryColor}, isSaving && {opacity: 0.7}]}
              onPress={handleSubmit}
              disabled={isSaving}>
              {isSaving
                ? <ActivityIndicator size="small" color="#ffffff" />
                : <Text style={styles.submitBtnText}>SUBMIT</Text>}
            </Pressable>
          </ScrollView>
        </View>
      </View>

      {/* Reviewer picker modal */}
      {reviewerPickerOpen ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setReviewerPickerOpen(false)}>
          <Pressable style={styles.pickerBackdrop} onPress={() => setReviewerPickerOpen(false)}>
            <View style={styles.pickerSheet}>
              <Text style={styles.pickerTitle}>Choose Reviewers</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                {reviewers.length === 0 ? (
                  <Text style={styles.pickerEmpty}>No reviewers available.</Text>
                ) : (
                  reviewers.map(r => {
                    const selected = !!selectedReviewers.find(x => x.uuid === r.uuid);
                    return (
                      <Pressable
                        key={r.uuid}
                        style={[styles.pickerRow, selected && styles.pickerRowSelected]}
                        onPress={() => toggleReviewer(r)}>
                        <Text style={[styles.pickerRowText, selected && {fontWeight: '700'}]}>
                          {r.name}
                        </Text>
                        {selected ? <Icon name="check" size={18} color="#16a34a" /> : null}
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
              <Pressable
                style={[styles.pickerDoneBtn, {backgroundColor: primaryColor}]}
                onPress={() => setReviewerPickerOpen(false)}>
                <Text style={styles.pickerDoneText}>Done</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      ) : null}
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  page: {backgroundColor: '#f1f5f9', flex: 1},
  header: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  headerTitle: {color: '#0f172a', flex: 1, fontSize: 20, fontWeight: '800'},
  addBtn: {
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addBtnText: {color: '#ffffff', fontSize: 12, fontWeight: '800', letterSpacing: 0.4},
  statsBar: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statsText: {color: '#475569', flex: 1, fontSize: 14, minWidth: 160},
  statsCount: {color: '#0f172a', fontWeight: '800'},
  searchBox: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    minWidth: 160,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchInput: {color: '#0f172a', flex: 1, fontSize: 13, padding: 0},
  scrollContent: {flexGrow: 1, padding: 14},
  centered: {alignItems: 'center', flex: 1, justifyContent: 'center'},
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    flex: 1,
    justifyContent: 'center',
    minHeight: 360,
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
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    marginBottom: 10,
    padding: 16,
    shadowColor: '#0f172a',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {alignItems: 'flex-start', flexDirection: 'row', gap: 10, justifyContent: 'space-between', marginBottom: 8},
  cardTitle: {color: '#0f172a', flex: 1, fontSize: 15, fontWeight: '700'},
  statusBadge: {borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3},
  statusText: {fontSize: 11, fontWeight: '700'},
  cardDesc: {color: '#475569', fontSize: 13, lineHeight: 19, marginBottom: 10},
  cardMeta: {flexDirection: 'row', flexWrap: 'wrap', gap: 12},
  metaRow: {alignItems: 'center', flexDirection: 'row', gap: 4},
  metaText: {color: '#64748b', fontSize: 12, fontWeight: '600'},
  // Modal
  backdrop: {backgroundColor: 'rgba(15,23,42,0.4)', flex: 1, justifyContent: 'flex-end'},
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '95%',
    paddingTop: 8,
  },
  modalHeader: {
    alignItems: 'center',
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  modalTitle: {color: '#0f172a', fontSize: 17, fontWeight: '800'},
  modalBody: {padding: 20, paddingBottom: 32},
  fieldLabel: {color: '#0f172a', fontSize: 13, fontWeight: '700', marginTop: 14, marginBottom: 5},
  req: {color: '#dc2626'},
  fieldHint: {color: '#94a3b8', fontSize: 12, fontStyle: 'italic', marginBottom: 8},
  fieldInput: {
    borderColor: '#e2e8f0',
    borderRadius: 10,
    borderWidth: 1,
    color: '#0f172a',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  textarea: {minHeight: 100, textAlignVertical: 'top'},
  pickerValueText: {color: '#0f172a', fontSize: 14},
  pickerPlaceholderText: {color: '#94a3b8', fontSize: 14},
  dateRow: {flexDirection: 'row', gap: 10},
  dateField: {flex: 1},
  radioRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 6},
  radioItem: {alignItems: 'center', flexDirection: 'row', gap: 8},
  radioCircle: {
    alignItems: 'center',
    borderColor: '#cbd5e1',
    borderRadius: 12,
    borderWidth: 2,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  radioDot: {borderRadius: 6, height: 10, width: 10},
  radioLabel: {color: '#475569', fontSize: 13, fontWeight: '600'},
  taskSectionTitle: {fontSize: 15, fontWeight: '800', marginTop: 20, marginBottom: 4},
  taskRow: {alignItems: 'center', flexDirection: 'row', gap: 8, marginBottom: 8},
  taskInput: {flex: 1},
  deleteBtn: {padding: 4},
  addRowBtn: {
    alignSelf: 'flex-start',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  addRowBtnText: {color: '#475569', fontSize: 13, fontWeight: '700'},
  quantHeader: {flexDirection: 'row', gap: 6, marginBottom: 4},
  quantHeaderText: {color: '#64748b', fontSize: 11, fontWeight: '700'},
  quantRow: {alignItems: 'center', flexDirection: 'row', gap: 6, marginBottom: 8},
  quantCell: {paddingHorizontal: 8, paddingVertical: 8},
  submitBtn: {alignItems: 'center', borderRadius: 12, marginTop: 24, paddingVertical: 14},
  submitBtnText: {color: '#ffffff', fontSize: 14, fontWeight: '800', letterSpacing: 0.5},
  // Reviewer picker
  pickerBackdrop: {alignItems: 'center', backgroundColor: 'rgba(15,23,42,0.4)', flex: 1, justifyContent: 'center'},
  pickerSheet: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    maxHeight: '70%',
    padding: 20,
    width: '85%',
  },
  pickerTitle: {color: '#0f172a', fontSize: 16, fontWeight: '800', marginBottom: 12},
  pickerEmpty: {color: '#64748b', fontSize: 14, textAlign: 'center', paddingVertical: 20},
  pickerRow: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 12,
    borderBottomColor: '#f1f5f9',
    borderBottomWidth: 1,
  },
  pickerRowSelected: {backgroundColor: '#f0fdf4'},
  pickerRowText: {color: '#0f172a', fontSize: 14},
  pickerDoneBtn: {alignItems: 'center', borderRadius: 10, marginTop: 14, paddingVertical: 12},
  pickerDoneText: {color: '#ffffff', fontSize: 14, fontWeight: '800'},
});
