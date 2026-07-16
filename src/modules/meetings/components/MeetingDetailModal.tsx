import React, {useContext, useState} from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
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
import type {Conversation} from '../../chat/types';
import {meetingsService} from '../../connections/services/meetings.service';
import type {MeetingRow} from '../../connections/services/meetings.service';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const formatTime12 = (raw?: string): string => {
  if (!raw) return '';
  const m = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return raw;
  const h24 = Number(m[1]);
  const period = h24 >= 12 ? 'pm' : 'am';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, '0')}:${m[2]} ${period}`;
};

const parseIsoDate = (iso?: string): Date | null => {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
};

const counterpartyName = (m: MeetingRow): string => {
  const r = m.receiver || m.otherUser;
  return r?.name || (r as {fullName?: string})?.fullName || 'Member';
};

const counterpartyOrg = (m: MeetingRow): string => {
  const r = m.receiver as {companyName?: string; organizationName?: string} | null;
  return r?.companyName || r?.organizationName || '';
};

// GET /api/v1/meetings/{uuid} doesn't have a confirmed chat-id field
// (MeetingRow is loosely typed) — try the likely names, then fall back to
// the counterparty's user uuid, same defensive pattern + fallback chain as
// ConnectionsScreen.handleOpenChat.
const resolveChatTarget = (
  m: MeetingRow,
): {uuid: string; name: string; avatar?: string | null; accountType?: string} | null => {
  const r = (m.receiver || m.otherUser) as
    | {uuid?: string; avatar?: string | null; accountType?: string}
    | null;
  const convUuid =
    (m.groupChatUUID as string | undefined) ||
    (m.conversationUUID as string | undefined) ||
    (m.chatUUID as string | undefined) ||
    r?.uuid;
  if (!convUuid) return null;
  return {
    uuid: convUuid,
    name: counterpartyName(m),
    avatar: r?.avatar ?? null,
    accountType: r?.accountType,
  };
};

type StatusMeta = {label: string; bg: string; fg: string};

const resolveStatus = (m: MeetingRow): StatusMeta => {
  const s = String(m.acceptanceStatus || m.status || '').toLowerCase();
  if (s === 'accepted' || m.isAccepted) return {label: 'Accepted', bg: '#16a34a', fg: '#fff'};
  if (s === 'rejected' || s === 'declined') return {label: 'Rejected', bg: '#dc2626', fg: '#fff'};
  return {label: 'Pending Acceptance', bg: '#0f172a', fg: '#fff'};
};

type Props = {
  meeting: MeetingRow;
  token: string;
  onClose: () => void;
  // Called after accept/reject so the parent list can refresh.
  onStatusChanged?: () => void;
  // Called when user wants to propose a new time / schedule a followup —
  // parent opens ScheduleMeetingModal preset to this counterparty.
  onProposeNewTime?: (counterparty: {uuid: string; name: string}) => void;
  // Called when the user taps "Chat" — parent navigates to the chat
  // detail screen with a synthesized Conversation (same flow as
  // ConnectionsScreen's Chat button).
  onOpenChat?: (conversation: Conversation) => void;
};

export function MeetingDetailModal({
  meeting,
  token,
  onClose,
  onStatusChanged,
  onProposeNewTime,
  onOpenChat,
}: Props) {
  const {theme} = useContext(TenantContext);
  const primaryColor = theme?.primary || '#0b0aa3';
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  // Local accepted/rejected flag — overrides meeting.acceptanceStatus so
  // the UI updates immediately without waiting for a list refresh.
  const [localStatus, setLocalStatus] = useState<'accepted' | 'rejected' | null>(null);

  // Notes edit state
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [savedNotes, setSavedNotes] = useState('');

  const handleAccept = async () => {
    if (!meeting?.uuid || accepting || rejecting) return;
    setAccepting(true);
    try {
      await meetingsService.acceptMeeting(token, meeting.uuid);
      setLocalStatus('accepted');
      toast.success('Meeting accepted!');
      onStatusChanged?.();
    } catch (e: any) {
      toast.error(e?.message || 'Could not accept meeting.');
    } finally {
      setAccepting(false);
    }
  };

  const handleReject = async () => {
    if (!meeting?.uuid || accepting || rejecting) return;
    setRejecting(true);
    try {
      await meetingsService.rejectMeeting(token, meeting.uuid);
      setLocalStatus('rejected');
      toast.success('Meeting rejected.');
      onStatusChanged?.();
    } catch (e: any) {
      toast.error(e?.message || 'Could not reject meeting.');
    } finally {
      setRejecting(false);
    }
  };

  const handleProposeNewTime = () => {
    if (!meeting) return;
    const r = meeting.receiver || meeting.otherUser;
    const uuid = r?.uuid || '';
    const name = counterpartyName(meeting);
    if (!uuid) {
      toast.info('Cannot propose a new time — counterparty info missing.');
      return;
    }
    onClose();
    onProposeNewTime?.({uuid, name});
  };

  const handleChatPress = () => {
    const target = resolveChatTarget(meeting);
    if (!target) {
      toast.error('Chat is not available for this meeting yet.');
      return;
    }
    if (!onOpenChat) {
      toast.info('Chat will open from here once wiring is complete.');
      return;
    }
    onOpenChat({
      uuid: target.uuid,
      name: target.name,
      otherUser: {
        uuid: target.uuid,
        name: target.name,
        avatar: target.avatar || null,
        accountType: target.accountType,
      },
    });
  };

  const handleSaveNotes = () => {
    setSavedNotes(notesText);
    setEditingNotes(false);
  };

  const date = parseIsoDate(meeting.date);
  const dayNumber = date ? String(date.getDate()).padStart(2, '0') : '--';
  const monthLabel = date ? MONTH_NAMES[date.getMonth()] : '';
  const timeFrom = formatTime12(meeting.timeFrom);
  const timeTo = formatTime12(meeting.timeTo);
  const title = meeting.meetingTitle || 'Meeting';
  const other = counterpartyName(meeting);
  const orgName = counterpartyOrg(meeting);
  const agenda = (meeting.meetingDescription as string) || (meeting.agenda as string) || '';
  const locationType = (meeting.meetingLocationType as string) || (meeting.meetingMode as string) || 'virtual';
  const modeLabel = locationType === 'inperson' ? 'In-Person' : 'Online';

  // Use localStatus if set (post-RSVP), otherwise fall back to meeting fields.
  const effectiveMeeting = localStatus
    ? {...meeting, acceptanceStatus: localStatus}
    : meeting;
  const status = resolveStatus(effectiveMeeting);

  // Show RSVP only if the server says the user can accept/reject and they
  // haven't already done so (locally or from the server).
  const canRsvp =
    meeting.canReceiverAcceptReject === true &&
    !localStatus &&
    !meeting.isAccepted &&
    String(meeting.acceptanceStatus || '').toLowerCase() !== 'accepted' &&
    String(meeting.acceptanceStatus || '').toLowerCase() !== 'rejected';

  // "Create Followup Meeting" is always available (not RSVP-gated) as long
  // as there's a counterparty to schedule with.
  const counterpartyUuid = (meeting.receiver || meeting.otherUser)?.uuid;

  // Confirmed from GET /api/v1/meetings/ — the backend already computes
  // these per-viewer, so trust them directly rather than guessing from
  // title/type (which turned out unreliable — e.g. an "X <> Y"-titled row
  // can still have canJoinMeeting: true).
  const canJoin = meeting.canJoinMeeting === true;
  const canFollowup = meeting.canCreateFollowupMeeting === true;
  const handleGoToMeeting = () => {
    toast.info('Working on this feature.');
  };
  const handleAddToCalendar = () => {
    toast.info('Working on this feature.');
  };

  return (
    <Modal
      visible={true}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, {paddingBottom: insets.bottom + 16}]}>
          {/* Close button */}
          <Pressable
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close">
            <Icon name="close" size={20} color="#64748b" />
          </Pressable>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}>

            {/* Header — date tile + title + counterparty + time + status */}
            <View style={styles.headerRow}>
              {/* Calendar tile */}
              <View style={[styles.calTile, {borderColor: primaryColor}]}>
                <Text style={[styles.calDay, {color: primaryColor}]}>{dayNumber}</Text>
                <View style={[styles.calMonthBg, {backgroundColor: primaryColor}]}>
                  <Text style={styles.calMonth}>{monthLabel}</Text>
                </View>
              </View>

              {/* Title + meta */}
              <View style={styles.headerMeta}>
                <Text style={styles.meetingTitle} numberOfLines={2}>{title}</Text>
                <Text style={[styles.otherName, {color: primaryColor}]} numberOfLines={1}>
                  {other}
                  {orgName ? <Text style={styles.orgName}>{`(${orgName})`}</Text> : null}
                </Text>
                <View style={styles.timeStatusRow}>
                  {(timeFrom || timeTo) ? (
                    <Text style={styles.timeText}>
                      {timeFrom}{timeTo ? ` – ${timeTo}` : ''}
                    </Text>
                  ) : null}
                  <View style={[styles.statusBadge, {backgroundColor: status.bg}]}>
                    <Text style={[styles.statusText, {color: status.fg}]}>
                      {status.label}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Chat button */}
              <Pressable
                style={styles.chatBtn}
                onPress={handleChatPress}
                accessibilityRole="button"
                accessibilityLabel="Open chat">
                <Icon name="chat-processing-outline" size={16} color="#334155" />
                <Text style={styles.chatBtnText}>Chat</Text>
              </Pressable>
            </View>

            {/* Meeting details */}
            {modeLabel ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Meeting Mode:</Text>
                <Text style={styles.detailValue}>{modeLabel}</Text>
              </View>
            ) : null}

            {agenda ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Agenda:</Text>
                <Text style={styles.detailValue}>{agenda}</Text>
              </View>
            ) : null}

            {canJoin ? (
              <View style={styles.instantActionsRow}>
                <Pressable style={styles.calendarBtn} onPress={handleAddToCalendar}>
                  <Icon name="calendar-plus" size={16} color="#0f172a" />
                  <Text style={styles.calendarBtnText}>Add to calender</Text>
                </Pressable>
                <Pressable
                  style={[styles.followupBtn, styles.goToMeetingBtn, {backgroundColor: primaryColor}]}
                  onPress={handleGoToMeeting}>
                  <Text style={styles.followupBtnText}>GO TO MEETING</Text>
                </Pressable>
              </View>
            ) : null}

            {canFollowup && counterpartyUuid ? (
              <Pressable
                style={[styles.followupBtn, {backgroundColor: primaryColor}]}
                onPress={handleProposeNewTime}>
                <Text style={styles.followupBtnText}>CREATE FOLLOWUP MEETING</Text>
              </Pressable>
            ) : null}

            <View style={styles.divider} />

            {/* RSVP card — only for incoming pending requests */}
            {canRsvp ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>RSVP</Text>
                <View style={styles.rsvpRow}>
                  <Pressable
                    style={[styles.rsvpBtn, styles.rsvpAccept]}
                    onPress={handleAccept}
                    disabled={accepting || rejecting}>
                    {accepting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.rsvpBtnText}>ACCEPT</Text>
                    )}
                  </Pressable>

                  <Pressable
                    style={[styles.rsvpBtn, styles.rsvpReject]}
                    onPress={handleReject}
                    disabled={accepting || rejecting}>
                    {rejecting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.rsvpBtnText}>REJECT</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            ) : null}

            {/* Your Notes card */}
            <View style={styles.notesCard}>
              <View style={styles.notesHeader}>
                <Text style={[styles.notesTitle, {color: primaryColor}]}>Your Notes</Text>
                <View style={styles.notesBtns}>
                  <Pressable
                    style={styles.notesActionBtn}
                    onPress={() => {
                      setNotesText(savedNotes);
                      setEditingNotes(true);
                    }}>
                    <Text style={styles.notesActionText}>Edit</Text>
                  </Pressable>
                  <Pressable style={styles.notesActionBtn}>
                    <Text style={styles.notesActionText}>Share Notes</Text>
                  </Pressable>
                </View>
              </View>
              <View style={styles.notesDivider} />
              {editingNotes ? (
                <View>
                  <TextInput
                    style={styles.notesInput}
                    value={notesText}
                    onChangeText={setNotesText}
                    placeholder="Write your notes here..."
                    placeholderTextColor="#94a3b8"
                    multiline
                    autoFocus
                  />
                  <View style={styles.notesSaveRow}>
                    <Pressable
                      style={[styles.notesSaveBtn, {backgroundColor: primaryColor}]}
                      onPress={handleSaveNotes}>
                      <Text style={styles.notesSaveBtnText}>Save</Text>
                    </Pressable>
                    <Pressable
                      style={styles.notesCancelBtn}
                      onPress={() => setEditingNotes(false)}>
                      <Text style={styles.notesCancelText}>Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Text style={styles.notesContent}>
                  {savedNotes || 'No Notes found'}
                </Text>
              )}
            </View>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(15,23,42,0.4)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingTop: 8,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    marginRight: 16,
    marginTop: 8,
    padding: 4,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  // Header row: calendar tile + meta
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 14,
    marginBottom: 16,
  },
  calTile: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    minWidth: 56,
    overflow: 'hidden',
  },
  calDay: {
    fontSize: 22,
    fontWeight: '800',
    paddingVertical: 6,
  },
  calMonthBg: {
    alignItems: 'center',
    paddingVertical: 4,
    width: '100%',
  },
  calMonth: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  headerMeta: {
    flex: 1,
    gap: 3,
  },
  chatBtn: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chatBtnText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  followupBtn: {
    alignItems: 'center',
    borderRadius: 12,
    justifyContent: 'center',
    marginBottom: 16,
    paddingVertical: 14,
  },
  followupBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  instantActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  calendarBtn: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 14,
  },
  calendarBtnText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
  },
  goToMeetingBtn: {
    flex: 1,
    marginBottom: 0,
  },
  meetingTitle: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '800',
  },
  otherName: {
    fontSize: 14,
    fontWeight: '700',
  },
  orgName: {
    color: '#64748b',
    fontWeight: '600',
  },
  timeStatusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  timeText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  // Meeting detail rows
  detailRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 8,
  },
  detailLabel: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
  detailValue: {
    color: '#475569',
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  divider: {
    backgroundColor: '#e2e8f0',
    height: 1,
    marginVertical: 16,
  },
  // RSVP card
  card: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    marginBottom: 14,
    padding: 16,
  },
  cardTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 12,
  },
  rsvpRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rsvpBtn: {
    alignItems: 'center',
    borderRadius: 10,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rsvpAccept: {
    backgroundColor: '#16a34a',
    flex: 1,
  },
  rsvpReject: {
    backgroundColor: '#e11d48',
    flex: 1,
  },
  rsvpBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  // Notes card — dashed border
  notesCard: {
    borderColor: '#cbd5e1',
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    padding: 14,
  },
  notesHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  notesTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  notesBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  notesActionBtn: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  notesActionText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  notesDivider: {
    backgroundColor: '#e2e8f0',
    height: 1,
    marginBottom: 12,
  },
  notesContent: {
    color: '#64748b',
    fontSize: 14,
  },
  notesInput: {
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    color: '#0f172a',
    fontSize: 14,
    minHeight: 100,
    padding: 10,
    textAlignVertical: 'top',
  },
  notesSaveRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  notesSaveBtn: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  notesSaveBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  notesCancelBtn: {
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  notesCancelText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
});
