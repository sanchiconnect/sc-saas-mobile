import React, {useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  errorCodes,
  isErrorWithCode,
  pick,
  types as DocumentPickerTypes,
} from '@react-native-documents/picker';

import {Icon} from '../../../core/components/Icon';
import {TenantContext} from '../../../core/tenant/TenantProvider';
import {useToast} from '../../../core/toast/ToastProvider';
import {milestonesService} from '../services/milestones.service';
import type {
  Milestone,
  MilestoneDetail,
  MilestoneNote,
  MilestoneQuantitativeItem,
} from '../services/milestones.service';

type QuantTaskInput = {parameter: string; quantifiedValue: string; unit: string};

type Props = {
  token: string;
  onBack: () => void;
};

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_FULL = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const formatDeadline = (iso?: string): string => {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
};

const formatNoteDate = (iso?: string): string => {
  if (!iso) return '—';
  const m = iso.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${MONTH_FULL[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

const formatLogDate = (iso?: string): string => {
  if (!iso) return '—';
  const m = iso.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

const statusColor = (label: string): string => {
  const st = label.toLowerCase();
  if (st === 'completed') return '#16a34a';
  if (st === 'in progress') return '#2563eb';
  if (st === 'inactive' || st === 'pending') return '#d97706';
  return '#64748b';
};

// API returns `status` as a boolean and completion via `completedOnDate`,
// not a lifecycle string — derive a human label from those instead.
const getStatusLabel = (m: Milestone): string => {
  if (m.completedOnDate) return 'Completed';
  if (typeof m.status === 'string') {
    return m.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
  return m.status === false ? 'Inactive' : 'Active';
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
  const [detailUuid, setDetailUuid] = useState<string | null>(null);

  const toastRef = React.useRef(toast);
  toastRef.current = toast;

  const load = useCallback(async () => {
    try {
      const data = await milestonesService.listMilestones(token);
      setMilestones(data);
    } catch (e: any) {
      toastRef.current.error(e?.message || 'Could not load milestones.');
    }
  }, [token]);

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
    () => milestones.filter(m => getStatusLabel(m) !== 'Completed').length,
    [milestones],
  );

  const handleDelete = useCallback((m: Milestone) => {
    if (!m.uuid) return;
    Alert.alert(
      'Delete milestone?',
      `"${m.title || 'This milestone'}" will be permanently deleted.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await milestonesService.deleteMilestone(token, m.uuid as string);
              toastRef.current.success('Milestone deleted.');
              load();
            } catch (e: any) {
              toastRef.current.error(e?.message || 'Could not delete milestone.');
            }
          },
        },
      ],
    );
  }, [token, load]);

  if (detailUuid) {
    return (
      <>
        <MilestoneDetailView
          token={token}
          uuid={detailUuid}
          primaryColor={primaryColor}
          onBack={() => setDetailUuid(null)}
          onAddMilestone={() => setAddVisible(true)}
        />
        {addVisible ? (
          <AddMilestoneModal
            token={token}
            primaryColor={primaryColor}
            insetBottom={insets.bottom}
            onClose={() => setAddVisible(false)}
            onCreated={() => { setAddVisible(false); load(); }}
          />
        ) : null}
      </>
    );
  }

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
              <MilestoneCard
                key={m.uuid}
                milestone={m}
                primaryColor={primaryColor}
                onDetails={() => m.uuid && setDetailUuid(m.uuid)}
                onDelete={() => handleDelete(m)}
              />
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
function MilestoneCard({
  milestone,
  primaryColor,
  onDetails,
  onDelete,
}: {
  milestone: Milestone;
  primaryColor: string;
  onDetails: () => void;
  onDelete: () => void;
}) {
  const reviewerName =
    milestone.reviewer?.name ||
    milestone.reviewer?.fullName ||
    (milestone.reviewer as any)?.otherUser?.name ||
    null;
  const statusLabel = getStatusLabel(milestone);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {milestone.title || 'Untitled Milestone'}
        </Text>
        <View style={[styles.statusBadge, {backgroundColor: statusColor(statusLabel) + '22'}]}>
          <Text style={[styles.statusText, {color: statusColor(statusLabel)}]}>
            {statusLabel}
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
      <View style={styles.cardFooter}>
        <Pressable
          style={[styles.detailsBtn, {borderColor: primaryColor}]}
          onPress={onDetails}
          accessibilityRole="button"
          accessibilityLabel="View details">
          <Text style={[styles.detailsBtnText, {color: primaryColor}]}>DETAILS</Text>
        </Pressable>
        <Pressable
          onPress={onDelete}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Delete milestone">
          <Icon name="delete-outline" size={20} color="#dc2626" />
        </Pressable>
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
  const [progressFrequency, setProgressFrequency] = useState<'every_week' | 'every_month' | 'every_quarter'>('every_month');

  // Reviewers
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [selectedReviewers, setSelectedReviewers] = useState<Reviewer[]>([]);
  const [reviewerPickerOpen, setReviewerPickerOpen] = useState(false);

  // Qualitative tasks — list of strings
  const [qualTasks, setQualTasks] = useState<string[]>(['']);

  // Quantitative tasks — list of {parameter, quantifiedValue, unit}
  const [quantTasks, setQuantTasks] = useState<QuantTaskInput[]>([
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
  const updateQuantTask = (idx: number, field: keyof QuantTaskInput, val: string) =>
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
        // TODO: backend rejects reviewer UUIDs here ("must be an integer number") — send empty until that's fixed server-side.
        reviewersIds: [],
        startDate: startDate.trim(),
        targetDate: targetDate.trim(),
        progressFrequency,
        qualitativeMilestones: qualTasks
          .filter(t => t.trim())
          .map(t => ({title: t.trim()})),
        quantitativeMilestones: quantTasks
          .filter(t => t.parameter.trim())
          .map(t => ({
            parameter: t.parameter.trim(),
            unit: t.unit.trim(),
            value: Number(t.quantifiedValue) || 0,
          })),
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
              {(['every_week', 'every_month', 'every_quarter'] as const).map(opt => (
                <Pressable
                  key={opt}
                  style={styles.radioItem}
                  onPress={() => setProgressFrequency(opt)}>
                  <View style={[
                    styles.radioCircle,
                    progressFrequency === opt && {borderColor: primaryColor},
                  ]}>
                    {progressFrequency === opt ? (
                      <View style={[styles.radioDot, {backgroundColor: primaryColor}]} />
                    ) : null}
                  </View>
                  <Text style={styles.radioLabel}>
                    {opt === 'every_week' ? 'Every Week' : opt === 'every_month' ? 'Every Month' : 'Every Quarter'}
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

// ── Milestone Detail View ─────────────────────────────────────────────────────
const humanizeFrequency = (f?: string): string => {
  if (!f) return '—';
  if (f === 'every_week') return 'Every Week';
  if (f === 'every_month') return 'Every Month';
  if (f === 'every_quarter') return 'Every Quarter';
  return f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

function MilestoneDetailView({
  token,
  uuid,
  primaryColor,
  onBack,
  onAddMilestone,
}: {
  token: string;
  uuid: string;
  primaryColor: string;
  onBack: () => void;
  onAddMilestone: () => void;
}) {
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [detail, setDetail] = useState<MilestoneDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [quantInputs, setQuantInputs] = useState<Record<string, string>>({});
  const [updatingQuantId, setUpdatingQuantId] = useState<string | null>(null);
  const [completingQualId, setCompletingQualId] = useState<string | null>(null);
  const [logsFor, setLogsFor] = useState<MilestoneQuantitativeItem | null>(null);

  const [editTargetDateOpen, setEditTargetDateOpen] = useState(false);
  const [targetDateInput, setTargetDateInput] = useState('');
  const [savingTargetDate, setSavingTargetDate] = useState(false);

  const [editReviewersOpen, setEditReviewersOpen] = useState(false);
  const [reviewers, setReviewers] = useState<Array<{uuid: string; name: string}>>([]);
  const [selectedReviewerUuids, setSelectedReviewerUuids] = useState<string[]>([]);

  const [notes, setNotes] = useState<MilestoneNote[]>([]);
  const [addNoteOpen, setAddNoteOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<MilestoneNote | null>(null);
  const [togglingNotification, setTogglingNotification] = useState(false);

  const toastRef = React.useRef(toast);
  toastRef.current = toast;

  const loadDetail = useCallback(() => {
    return milestonesService
      .getMilestoneDetail(token, uuid)
      .then(data => setDetail(data))
      .catch((e: any) => {
        toastRef.current.error(e?.message || 'Could not load milestone.');
      });
  }, [token, uuid]);

  const loadNotes = useCallback(() => {
    return milestonesService
      .listNotes(token, uuid)
      .then(data => setNotes(data))
      .catch(() => {});
  }, [token, uuid]);

  useEffect(() => {
    setIsLoading(true);
    loadDetail().finally(() => setIsLoading(false));
    loadNotes();
  }, [loadDetail, loadNotes]);

  const notReady = () => toast.info('This action needs the backend endpoint — coming soon.');

  const handleToggleNotification = async () => {
    if (!detail || togglingNotification) return;
    const previous = detail.notifyProgress;
    setTogglingNotification(true);
    setDetail(prev => (prev ? {...prev, notifyProgress: !prev.notifyProgress} : prev));
    try {
      await milestonesService.toggleNotification(token, uuid);
    } catch (e: any) {
      setDetail(prev => (prev ? {...prev, notifyProgress: previous} : prev));
      toast.error(e?.message || 'Could not update notification setting.');
    } finally {
      setTogglingNotification(false);
    }
  };

  const handleDownloadFiles = (note: MilestoneNote) => {
    const files = note.files || [];
    if (files.length === 0) return;
    files.forEach(f => {
      if (f.url) {
        Linking.openURL(f.url).catch(() => toast.error(`Could not open ${f.name || 'file'}.`));
      }
    });
  };

  const handleDeleteNote = (note: MilestoneNote) => {
    if (!note.uuid) return;
    Alert.alert(
      'Delete note?',
      'This note will be permanently deleted.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await milestonesService.deleteNote(token, uuid, note.uuid as string);
              toast.success('Note deleted.');
              loadNotes();
            } catch (e: any) {
              toast.error(e?.message || 'Could not delete note.');
            }
          },
        },
      ],
    );
  };

  const openTargetDateEditor = () => {
    setTargetDateInput(detail?.targetDate || '');
    setEditTargetDateOpen(true);
  };

  const handleSaveTargetDate = async () => {
    if (!targetDateInput.trim()) {
      toast.error('Target Date is required.');
      return;
    }
    setSavingTargetDate(true);
    try {
      await milestonesService.updateTargetDate(token, uuid, targetDateInput.trim());
      toast.success('Target date updated.');
      setEditTargetDateOpen(false);
      await loadDetail();
    } catch (e: any) {
      toast.error(e?.message || 'Could not update target date.');
    } finally {
      setSavingTargetDate(false);
    }
  };

  const openReviewersEditor = () => {
    setSelectedReviewerUuids(detail?.reviewerIds || []);
    setEditReviewersOpen(true);
    if (reviewers.length === 0) {
      milestonesService.listReviewers(token).then(rows => {
        const mapped = rows
          .map(r => {
            const u = (r as any).otherUser || r;
            return {uuid: String(u?.uuid || ''), name: String(u?.name || u?.fullName || '')};
          })
          .filter(r => r.uuid.length > 0 && r.name.length > 0);
        setReviewers(mapped);
      }).catch(() => {});
    }
  };

  const toggleReviewerSelection = (reviewerUuid: string) => {
    setSelectedReviewerUuids(prev =>
      prev.includes(reviewerUuid) ? prev.filter(id => id !== reviewerUuid) : [...prev, reviewerUuid],
    );
  };

  const handleMarkQualitativeCompleted = async (itemUuid?: string) => {
    if (!itemUuid) return;
    setCompletingQualId(itemUuid);
    try {
      await milestonesService.markQualitativeCompleted(token, uuid, itemUuid);
      toast.success('Task marked as completed.');
      await loadDetail();
    } catch (e: any) {
      toast.error(e?.message || 'Could not mark task completed.');
    } finally {
      setCompletingQualId(null);
    }
  };

  const handleUpdateQuantValue = async (item: MilestoneQuantitativeItem) => {
    const itemUuid = item.uuid;
    if (!itemUuid) return;
    const raw = quantInputs[itemUuid];
    const numeric = Number(raw);
    if (!raw || !raw.trim() || Number.isNaN(numeric)) {
      toast.error('Enter a valid number.');
      return;
    }
    setUpdatingQuantId(itemUuid);
    try {
      await milestonesService.updateQuantitativeValue(token, uuid, itemUuid, numeric);
      toast.success('Value updated.');
      setQuantInputs(prev => ({...prev, [itemUuid]: ''}));
      await loadDetail();
    } catch (e: any) {
      toast.error(e?.message || 'Could not update value.');
    } finally {
      setUpdatingQuantId(null);
    }
  };

  const qualPercent = Math.round(
    (detail?.qualitativeMilestonePercent ?? detail?.qualitativePercent ?? 0) as number,
  );
  const quantPercent = Math.round(
    (detail?.quantitativeMilestoneStats ?? detail?.quantitativeStats ?? 0) as number,
  );

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
          <Icon name="arrow-left" size={22} color="#0f172a" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {detail?.title || 'Milestone'}
        </Text>
        <Pressable
          style={[styles.addBtn, {backgroundColor: primaryColor}]}
          onPress={onAddMilestone}
          accessibilityRole="button"
          accessibilityLabel="Add milestone">
          <Icon name="plus" size={14} color="#ffffff" />
          <Text style={styles.addBtnText}>ADD MILESTONE</Text>
        </Pressable>
      </View>

      {isLoading || !detail ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Brief + Progress */}
          <View style={styles.detailRow}>
            <View style={[styles.detailCard, styles.detailCardHalf]}>
              <View style={styles.detailSectionTitleRow}>
                <View style={[styles.detailAccentBar, {backgroundColor: primaryColor}]} />
                <Text style={styles.detailSectionTitle}>Brief</Text>
              </View>
              <Text style={styles.detailBrief}>{detail.description || '—'}</Text>
              <View style={styles.detailDivider} />
              <View style={styles.detailMetaRow}>
                <View style={styles.detailMetaCol}>
                  <Text style={styles.detailMetaLabel}>Start Date</Text>
                  <Text style={styles.detailMetaValue}>{formatDeadline(detail.startDate)}</Text>
                </View>
                <View style={styles.detailMetaCol}>
                  <Text style={styles.detailMetaLabel}>Target Date</Text>
                  <View style={styles.metaValueRow}>
                    <Text style={styles.detailMetaValue}>{formatDeadline(detail.targetDate)}</Text>
                    <Pressable onPress={openTargetDateEditor} hitSlop={8} accessibilityRole="button" accessibilityLabel="Edit target date">
                      <Icon name="pencil-outline" size={15} color="#0f172a" />
                    </Pressable>
                  </View>
                </View>
              </View>
              <View style={styles.detailMetaRow}>
                <View style={styles.detailMetaCol}>
                  <Text style={styles.detailMetaLabel}>Notification Frequency</Text>
                  <View style={styles.notifyRow}>
                    <Switch
                      value={!!detail.notifyProgress}
                      onValueChange={handleToggleNotification}
                      disabled={togglingNotification}
                      trackColor={{false: '#e2e8f0', true: primaryColor}}
                      thumbColor="#ffffff"
                    />
                    <Text style={styles.detailMetaValue}>{humanizeFrequency(detail.progressFrequency)}</Text>
                  </View>
                </View>
                <View style={styles.detailMetaCol}>
                  <Text style={styles.detailMetaLabel}>Reviewers</Text>
                  <Pressable onPress={openReviewersEditor} accessibilityRole="button" accessibilityLabel="Edit reviewers">
                    <Icon name="pencil-outline" size={15} color="#0f172a" />
                  </Pressable>
                </View>
              </View>
            </View>

            <View style={[styles.detailCard, styles.detailCardHalf]}>
              <View style={styles.detailSectionTitleRow}>
                <View style={[styles.detailAccentBar, {backgroundColor: primaryColor}]} />
                <Text style={styles.detailSectionTitle}>Your progress</Text>
              </View>
              <View style={styles.progressRingRow}>
                <View style={styles.progressTile}>
                  <View style={[styles.progressCircle, {borderColor: primaryColor}]}>
                    <Text style={styles.progressCircleText}>{qualPercent}%</Text>
                  </View>
                  <Text style={styles.progressTileLabel}>Qualitative</Text>
                </View>
                <View style={styles.progressTile}>
                  <View style={[styles.progressCircle, {borderColor: primaryColor}]}>
                    <Text style={styles.progressCircleText}>{quantPercent}%</Text>
                  </View>
                  <Text style={styles.progressTileLabel}>Quantitative</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Qualitative Tasks */}
          <View style={styles.detailCard}>
            <View style={styles.detailSectionHeaderRow}>
              <View style={styles.detailSectionTitleRow}>
                <View style={[styles.detailAccentBar, {backgroundColor: primaryColor}]} />
                <Text style={styles.detailSectionTitle}>Qualitative Tasks</Text>
              </View>
              <Text style={styles.detailSectionCount}>
                {(detail.milestoneQualitative || []).filter(t => t.isCompleted).length}/
                {(detail.milestoneQualitative || []).length} completed
              </Text>
            </View>
            {(detail.milestoneQualitative || []).length === 0 ? (
              <Text style={styles.detailEmptyText}>No qualitative tasks added.</Text>
            ) : (
              (detail.milestoneQualitative || []).map(t => {
                const isCompleting = completingQualId === t.uuid;
                return (
                  <View key={t.uuid || t.id} style={styles.taskListRow}>
                    <Text style={styles.taskListRowText} numberOfLines={2}>{t.title}</Text>
                    {t.isCompleted ? (
                      <View style={styles.completedPill}>
                        <Icon name="check" size={14} color="#16a34a" />
                        <Text style={styles.completedPillText}>Completed</Text>
                      </View>
                    ) : (
                      <Pressable
                        style={[styles.markCompleteBtn, isCompleting && {opacity: 0.6}]}
                        onPress={() => handleMarkQualitativeCompleted(t.uuid)}
                        disabled={isCompleting}>
                        {isCompleting
                          ? <ActivityIndicator size="small" color="#ffffff" />
                          : <Text style={styles.markCompleteBtnText}>Mark Completed</Text>}
                      </Pressable>
                    )}
                  </View>
                );
              })
            )}
          </View>

          {/* Quantitative Tasks */}
          <View style={styles.detailCard}>
            <View style={styles.detailSectionHeaderRow}>
              <View style={styles.detailSectionTitleRow}>
                <View style={[styles.detailAccentBar, {backgroundColor: primaryColor}]} />
                <Text style={styles.detailSectionTitle}>Quantitative Tasks</Text>
              </View>
            </View>
            {(detail.milestoneQuantitative || []).length === 0 ? (
              <Text style={styles.detailEmptyText}>No quantitative tasks added.</Text>
            ) : (
              (detail.milestoneQuantitative || []).map(t => {
                const itemUuid = t.uuid || '';
                const isUpdating = updatingQuantId === itemUuid;
                return (
                  <View key={itemUuid || t.id} style={styles.quantDetailRow}>
                    <View style={styles.quantTextRow}>
                      <Text style={styles.taskListRowText} numberOfLines={1}>
                        {t.parameter}{'  '}
                        <Text style={styles.taskListRowBold}>
                          {t.valueCompleted ?? 0}/{t.value ?? 0}
                        </Text>{' '}
                        {t.unit}
                      </Text>
                      <Pressable onPress={() => setLogsFor(t)} hitSlop={8} accessibilityRole="button" accessibilityLabel="View update logs">
                        <Icon name="information-outline" size={16} color="#94a3b8" />
                      </Pressable>
                    </View>
                    <View style={styles.quantUpdateGroup}>
                      <TextInput
                        style={styles.quantValueInput}
                        value={quantInputs[itemUuid] || ''}
                        onChangeText={val => setQuantInputs(prev => ({...prev, [itemUuid]: val}))}
                        placeholder="Add Value"
                        placeholderTextColor="#94a3b8"
                        keyboardType="numeric"
                        editable={!isUpdating}
                      />
                      <Pressable
                        style={[styles.markCompleteBtn, isUpdating && {opacity: 0.6}]}
                        onPress={() => handleUpdateQuantValue(t)}
                        disabled={isUpdating}>
                        {isUpdating
                          ? <ActivityIndicator size="small" color="#ffffff" />
                          : <Text style={styles.markCompleteBtnText}>+ Update</Text>}
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* Notes */}
          <View style={[styles.detailCard, {marginBottom: insets.bottom + 20}]}>
            <View style={styles.detailSectionHeaderRow}>
              <View style={styles.detailSectionTitleRow}>
                <View style={[styles.detailAccentBar, {backgroundColor: primaryColor}]} />
                <Text style={styles.detailSectionTitle}>Notes</Text>
              </View>
              <Pressable style={[styles.addNoteBtn, {backgroundColor: primaryColor}]} onPress={() => setAddNoteOpen(true)}>
                <Text style={styles.addNoteBtnText}>+ ADD NOTE</Text>
              </Pressable>
            </View>
            {notes.length === 0 ? (
              <Text style={styles.detailEmptyText}>No notes found</Text>
            ) : (
              notes.map(n => {
                const hasFiles = (n.files || []).length > 0;
                return (
                  <View key={n.uuid} style={styles.noteRow}>
                    <Text style={styles.noteText}>{n.text}</Text>
                    <Text style={styles.noteMetaText}>
                      Created: <Text style={styles.noteMetaBold}>{formatNoteDate(n.createdAt as string)}</Text>
                      {'   '}Creator: <Text style={styles.noteMetaBold}>{n.user?.name || '—'}</Text>
                    </Text>
                    <View style={styles.noteActionsRow}>
                      <Pressable
                        style={[styles.noteActionBtn, !hasFiles && {opacity: 0.4}]}
                        onPress={() => handleDownloadFiles(n)}
                        disabled={!hasFiles}>
                        <Text style={styles.noteActionBtnText}>Download Files</Text>
                      </Pressable>
                      <Pressable style={styles.noteActionBtn} onPress={() => setEditingNote(n)}>
                        <Text style={styles.noteActionBtnText}>Edit</Text>
                      </Pressable>
                      <Pressable onPress={() => handleDeleteNote(n)} hitSlop={8}>
                        <Icon name="delete-outline" size={20} color="#dc2626" />
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}

      {/* Edit Target Date modal */}
      {editTargetDateOpen ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setEditTargetDateOpen(false)}>
          <Pressable style={styles.pickerBackdrop} onPress={() => setEditTargetDateOpen(false)}>
            <Pressable style={styles.editSheet} onPress={e => e.stopPropagation()}>
              <Text style={styles.fieldLabel}>Target Date <Text style={styles.req}>*</Text></Text>
              <TextInput
                style={styles.fieldInput}
                value={targetDateInput}
                onChangeText={setTargetDateInput}
                placeholder="yyyy-mm-dd"
                placeholderTextColor="#94a3b8"
                keyboardType="numbers-and-punctuation"
              />
              <Pressable
                style={[styles.submitBtn, {backgroundColor: primaryColor}, savingTargetDate && {opacity: 0.7}]}
                onPress={handleSaveTargetDate}
                disabled={savingTargetDate}>
                {savingTargetDate
                  ? <ActivityIndicator size="small" color="#ffffff" />
                  : <Text style={styles.submitBtnText}>SAVE</Text>}
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {/* Edit Reviewers modal */}
      {editReviewersOpen ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setEditReviewersOpen(false)}>
          <Pressable style={styles.pickerBackdrop} onPress={() => setEditReviewersOpen(false)}>
            <Pressable style={styles.editSheet} onPress={e => e.stopPropagation()}>
              <Text style={styles.fieldLabel}>Reviewers</Text>
              <ScrollView style={styles.reviewerEditList} showsVerticalScrollIndicator={false}>
                {reviewers.length === 0 ? (
                  <Text style={styles.pickerEmpty}>No reviewers available.</Text>
                ) : (
                  reviewers.map(r => {
                    const selected = selectedReviewerUuids.includes(r.uuid);
                    return (
                      <Pressable
                        key={r.uuid}
                        style={[styles.pickerRow, selected && styles.pickerRowSelected]}
                        onPress={() => toggleReviewerSelection(r.uuid)}>
                        <Text style={[styles.pickerRowText, selected && {fontWeight: '700'}]}>{r.name}</Text>
                        {selected ? <Icon name="check" size={18} color="#16a34a" /> : null}
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
              <Pressable
                style={[styles.submitBtn, {backgroundColor: primaryColor}]}
                onPress={() => { setEditReviewersOpen(false); notReady(); }}>
                <Text style={styles.submitBtnText}>SAVE</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {/* Quantitative update Logs modal */}
      {logsFor ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setLogsFor(null)}>
          <View style={styles.pickerBackdrop}>
            <View style={styles.logsSheet}>
              <View style={styles.noteModalHeader}>
                <Text style={styles.noteModalTitle}>Logs</Text>
                <Pressable onPress={() => setLogsFor(null)} hitSlop={10} style={styles.noteCloseBtn}>
                  <Icon name="close" size={18} color="#0f172a" />
                </Pressable>
              </View>
              <View style={styles.noteModalDivider} />
              <ScrollView style={styles.logsList} showsVerticalScrollIndicator={false}>
                {(logsFor.updateLogs || []).length === 0 ? (
                  <Text style={[styles.detailEmptyText, {padding: 20}]}>No update logs yet.</Text>
                ) : (
                  (logsFor.updateLogs || []).map((log, idx) => (
                    <View key={idx} style={styles.logRow}>
                      <Text style={styles.logValue}>{log.value ?? 0}</Text>
                      <Text style={styles.logDate}>{formatLogDate(log.createdAt)}</Text>
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}

      {addNoteOpen || editingNote ? (
        <AddNoteModal
          token={token}
          milestoneUuid={uuid}
          note={editingNote || undefined}
          primaryColor={primaryColor}
          onClose={() => { setAddNoteOpen(false); setEditingNote(null); }}
          onCreated={() => { setAddNoteOpen(false); setEditingNote(null); loadNotes(); }}
        />
      ) : null}
    </View>
  );
}

// ── Add Note Modal ────────────────────────────────────────────────────────────
const NOTE_ATTACHMENT_TYPES = [
  DocumentPickerTypes.images,
  DocumentPickerTypes.pdf,
  DocumentPickerTypes.doc,
  DocumentPickerTypes.docx,
  DocumentPickerTypes.ppt,
  DocumentPickerTypes.pptx,
  DocumentPickerTypes.xls,
  DocumentPickerTypes.xlsx,
];

type PendingAttachment = {url?: string; name: string};

// GET returns a presigned S3 URL; PATCH/POST expect the raw storage key back
// (the same relative path the upload endpoint originally returned).
const toStorageKey = (url?: string): string | undefined => {
  if (!url) return undefined;
  const withoutQuery = url.split('?')[0];
  const match = withoutQuery.match(/(users\/.+)$/);
  return match ? match[1] : withoutQuery;
};

function AddNoteModal({
  token,
  milestoneUuid,
  note,
  primaryColor,
  onClose,
  onCreated,
}: {
  token: string;
  milestoneUuid: string;
  note?: MilestoneNote;
  primaryColor: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [description, setDescription] = useState(note?.text || '');
  const [attachments, setAttachments] = useState<PendingAttachment[]>(
    () => (note?.files || []).map(f => ({url: toStorageKey(f.url), name: f.name || 'Attachment'})),
  );
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUpload = async () => {
    if (isUploading) return;
    try {
      const [picked] = await pick({type: NOTE_ATTACHMENT_TYPES});
      if (!picked?.uri) return;
      const name = picked.name || `file-${attachments.length + 1}`;
      const type = picked.type || 'application/octet-stream';
      setIsUploading(true);
      const res = await milestonesService.uploadNoteFile(token, milestoneUuid, {uri: picked.uri, name, type});
      const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      const item = list[0] || {};
      setAttachments(prev => [...prev, {url: item?.url, name: item?.name || name}]);
    } catch (err: any) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
        return;
      }
      toast.error(err?.message || 'Could not upload file.');
    } finally {
      setIsUploading(false);
    }
  };

  const removeAttachment = (idx: number) =>
    setAttachments(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast.error('Description is required.');
      return;
    }
    setIsSubmitting(true);
    try {
      const files = attachments
        .filter((a): a is PendingAttachment & {url: string} => !!a.url)
        .map(a => ({url: a.url, name: a.name}));
      const payload = {text: description.trim(), ...(files.length ? {files} : {})};
      if (note?.uuid) {
        await milestonesService.updateNote(token, milestoneUuid, note.uuid, payload);
        toast.success('Note updated.');
      } else {
        await milestonesService.createNote(token, milestoneUuid, payload);
        toast.success('Note added.');
      }
      onCreated();
    } catch (e: any) {
      toast.error(e?.message || 'Could not save note.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.pickerBackdrop}>
        <View style={styles.noteModalSheet}>
          <View style={styles.noteModalHeader}>
            <Text style={styles.noteModalTitle}>{note ? 'Edit note' : 'Add Note'}</Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.noteCloseBtn}>
              <Icon name="close" size={18} color="#0f172a" />
            </Pressable>
          </View>
          <View style={styles.noteModalDivider} />

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.noteModalBody}>
            <Text style={styles.fieldLabel}>Description <Text style={styles.req}>*</Text></Text>
            <TextInput
              style={[styles.fieldInput, styles.textarea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Enter text..."
              placeholderTextColor="#94a3b8"
              multiline
              textAlignVertical="top"
            />

            <Text style={[styles.fieldLabel, {marginTop: 20}]}>Add Attachments</Text>
            <View style={styles.uploadBox}>
              <Text style={styles.uploadBoxText}>
                Click or Drop file in this box to upload.{'\n'}
                Accepted formats: png, jpg, jpeg, ppt, pptx, doc, docx, pdf, xls, xlsx
              </Text>
              <Pressable style={styles.uploadBtn} onPress={handleUpload} disabled={isUploading}>
                {isUploading ? (
                  <ActivityIndicator size="small" color="#0f172a" />
                ) : (
                  <>
                    <Icon name="cloud-upload-outline" size={16} color="#0f172a" />
                    <Text style={styles.uploadBtnText}>Upload</Text>
                  </>
                )}
              </Pressable>
            </View>

            {attachments.length > 0 ? (
              <View style={styles.noteAttachmentRow}>
                {attachments.map((a, idx) => (
                  <View key={a.url || idx} style={styles.noteAttachmentChip}>
                    <Icon name="paperclip" size={12} color="#64748b" />
                    <Text style={styles.noteAttachmentText} numberOfLines={1}>{a.name}</Text>
                    <Pressable onPress={() => removeAttachment(idx)} hitSlop={6}>
                      <Icon name="close" size={12} color="#64748b" />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.noteModalDivider} />
          <View style={styles.noteModalFooter}>
            <Pressable style={styles.noteCancelBtn} onPress={onClose}>
              <Text style={styles.noteCancelBtnText}>CANCEL</Text>
            </Pressable>
            <Pressable
              style={[styles.noteSubmitBtn, {backgroundColor: primaryColor}, isSubmitting && {opacity: 0.7}]}
              onPress={handleSubmit}
              disabled={isSubmitting}>
              {isSubmitting
                ? <ActivityIndicator size="small" color="#ffffff" />
                : <Text style={styles.noteSubmitBtnText}>SUBMIT</Text>}
            </Pressable>
          </View>
        </View>
      </View>
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
  cardFooter: {
    alignItems: 'center',
    borderTopColor: '#f1f5f9',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
  },
  detailsBtn: {
    borderRadius: 8,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  detailsBtnText: {fontSize: 12, fontWeight: '800', letterSpacing: 0.4},
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
  // Detail view
  detailRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 14},
  detailCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    marginBottom: 14,
    padding: 16,
    shadowColor: '#0f172a',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  detailCardHalf: {flexBasis: '100%', flexGrow: 1},
  detailSectionTitleRow: {alignItems: 'center', flexDirection: 'row', gap: 8, marginBottom: 12},
  detailAccentBar: {borderRadius: 2, height: 16, width: 4},
  detailSectionTitle: {color: '#0f172a', fontSize: 15, fontWeight: '800'},
  detailSectionHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  detailSectionCount: {color: '#64748b', fontSize: 12, fontWeight: '700'},
  detailBrief: {color: '#475569', fontSize: 13, lineHeight: 19},
  detailDivider: {backgroundColor: '#e2e8f0', height: 1, marginVertical: 14},
  detailMetaRow: {flexDirection: 'row', gap: 20, marginBottom: 14},
  detailMetaCol: {flex: 1},
  detailMetaLabel: {color: '#94a3b8', fontSize: 11, fontWeight: '700', marginBottom: 4},
  detailMetaValue: {color: '#0f172a', fontSize: 14, fontWeight: '700'},
  progressRingRow: {flexDirection: 'row', gap: 16, justifyContent: 'space-around'},
  progressTile: {alignItems: 'center', gap: 8},
  progressCircle: {
    alignItems: 'center',
    borderRadius: 50,
    borderWidth: 4,
    height: 92,
    justifyContent: 'center',
    width: 92,
  },
  progressCircleText: {color: '#0f172a', fontSize: 18, fontWeight: '800'},
  progressTileLabel: {color: '#64748b', fontSize: 12, fontWeight: '700'},
  detailEmptyText: {color: '#94a3b8', fontSize: 13, paddingVertical: 10, textAlign: 'center'},
  taskListRow: {
    alignItems: 'center',
    borderColor: '#e2e8f0',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  taskListRowText: {color: '#0f172a', flex: 1, fontSize: 13, fontWeight: '600'},
  taskListRowBold: {fontWeight: '800'},
  quantDetailRow: {
    alignItems: 'center',
    borderColor: '#e2e8f0',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  quantTextRow: {alignItems: 'center', flex: 1, flexDirection: 'row', gap: 6},
  quantUpdateGroup: {alignItems: 'center', flexDirection: 'row', gap: 8},
  quantValueInput: {
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    color: '#0f172a',
    fontSize: 13,
    minWidth: 90,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  markCompleteBtn: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  markCompleteBtnText: {color: '#ffffff', fontSize: 11, fontWeight: '700'},
  completedPill: {
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  completedPillText: {color: '#16a34a', fontSize: 11, fontWeight: '700'},
  addNoteBtn: {borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8},
  addNoteBtnText: {color: '#ffffff', fontSize: 11, fontWeight: '800', letterSpacing: 0.3},
  metaValueRow: {alignItems: 'center', flexDirection: 'row', gap: 8},
  notifyRow: {alignItems: 'center', flexDirection: 'row', gap: 8},
  editSheet: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    maxHeight: '75%',
    padding: 20,
    width: '85%',
  },
  reviewerEditList: {marginBottom: 14, maxHeight: 260},
  noteRow: {
    borderColor: '#e2e8f0',
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
    padding: 14,
  },
  noteText: {color: '#0f172a', fontSize: 14, fontWeight: '600', marginBottom: 8},
  noteMetaText: {color: '#94a3b8', fontSize: 12},
  noteMetaBold: {color: '#64748b', fontWeight: '700'},
  noteActionsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  noteActionBtn: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  noteActionBtnText: {color: '#ffffff', fontSize: 12, fontWeight: '700'},
  noteAttachmentRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8},
  noteAttachmentChip: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 6,
    maxWidth: 180,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  noteAttachmentText: {color: '#475569', fontSize: 11, fontWeight: '600'},
  noteModalSheet: {
    alignSelf: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    maxHeight: '85%',
    width: '90%',
  },
  logsSheet: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    maxHeight: '70%',
    width: '85%',
  },
  logsList: {padding: 20},
  logRow: {
    borderBottomColor: '#f1f5f9',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  logValue: {color: '#0f172a', fontSize: 14, fontWeight: '800'},
  logDate: {color: '#64748b', fontSize: 13},
  noteModalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  noteModalTitle: {color: '#0f172a', fontSize: 20, fontWeight: '800'},
  noteCloseBtn: {
    borderColor: '#fcd9b8',
    borderRadius: 8,
    borderWidth: 1,
    padding: 6,
  },
  noteModalDivider: {backgroundColor: '#e2e8f0', height: 1},
  noteModalBody: {padding: 20},
  uploadBox: {
    alignItems: 'center',
    borderColor: '#cbd5e1',
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  uploadBoxText: {color: '#64748b', fontSize: 12, textAlign: 'center'},
  uploadBtn: {
    alignItems: 'center',
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  uploadBtnText: {color: '#0f172a', fontSize: 13, fontWeight: '700'},
  noteModalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
  },
  noteCancelBtn: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    flex: 1,
    paddingVertical: 14,
  },
  noteCancelBtnText: {color: '#475569', fontSize: 14, fontWeight: '800', letterSpacing: 0.5},
  noteSubmitBtn: {
    alignItems: 'center',
    borderRadius: 12,
    flex: 1,
    paddingVertical: 14,
  },
  noteSubmitBtnText: {color: '#ffffff', fontSize: 14, fontWeight: '800', letterSpacing: 0.5},
});
