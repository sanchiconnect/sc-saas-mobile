import React, {useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {Icon} from '../../../core/components/Icon';
import {TenantContext} from '../../../core/tenant/TenantProvider';
import {useToast} from '../../../core/toast/ToastProvider';
import {meetingsService} from '../../connections/services/meetings.service';
import type {MeetingRow} from '../../connections/services/meetings.service';
import {ScheduleMeetingModal} from '../components/ScheduleMeetingModal';
import {EditAvailabilityModal} from '../components/EditAvailabilityModal';

type Props = {
  token: string;
  // Kept in the API for symmetry with other screens — pending direction
  // comes from the server's `canReceiverAcceptReject` flag now, so we
  // don't actually need this for bin assignment.
  currentUserUuid?: string;
  // Display name used to compose the `meetingTitle` field in the
  // Schedule modal (`{me} <> {them}`).
  currentUserName?: string;
  onBack: () => void;
};

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const MONTH_FULL_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Convert military "HH:MM" → "h:MM am/pm". Passes through anything that
// doesn't parse cleanly.
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

// Pending-acceptance direction comes from a single server flag:
//   canReceiverAcceptReject === true  → user is the receiver (Meeting
//                                       Request, incoming).
//   canReceiverAcceptReject === false → user is the sender (Sent
//                                       Request, outgoing, awaiting
//                                       the other side).
// Web does the same split: `list.filter(e => e.canReceiverAcceptReject)`.

const isInThisWeek = (d: Date | null): boolean => {
  if (!d) return false;
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday start
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  return d >= startOfWeek && d < endOfWeek;
};

// Read the counterparty's display name off whichever field the backend
// ships (receiver / otherUser).
const counterpartyName = (m: MeetingRow): string => {
  const r = m.receiver || m.otherUser;
  return r?.name || (r as {fullName?: string})?.fullName || 'Member';
};

export function MyMeetingsScreen({token, currentUserName, onBack}: Props) {
  const {theme} = useContext(TenantContext);
  const primaryColor = theme?.primary || '#0b0aa3';
  const toast = useToast();
  const [scheduleVisible, setScheduleVisible] = useState(false);
  const [availabilityVisible, setAvailabilityVisible] = useState(false);
  // Top-level tabs at the head of the screen — "All Meetings" shows the
  // calendar + lists, "Meeting Notes" is a placeholder while the notes
  // feed isn't wired up yet (matches the web header layout).
  const [topTab, setTopTab] = useState<'all' | 'notes'>('all');
  // Calendar grid state — current visible month / year, and the day
  // the user has tapped so the inline list filters to it.
  const today = new Date();
  const [viewMonth, setViewMonth] = useState<number>(today.getMonth());
  const [viewYear, setViewYear] = useState<number>(today.getFullYear());
  const [selectedDayIso, setSelectedDayIso] = useState<string | null>(null);

  // Two independent server lists feed this screen:
  //   /meetings/                  → full list, source for "Meetings this week"
  //   /meetings/pending-acceptance → source for Requests / Sent tabs
  // Mirrors the web `getMeetings()` + `fetchMeetingsWithPendingAcceptance()`
  // calls fired on mount.
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [pending, setPending] = useState<MeetingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Active list tab — Meeting Requests (incoming) vs Sent Requests
  // (outgoing). Matches the web layout.
  const [activeTab, setActiveTab] = useState<'requests' | 'sent'>('requests');

  const loadAll = useCallback(async () => {
    try {
      const [allRes, pendRes] = await Promise.all([
        meetingsService.listMeetings(token),
        meetingsService.fetchPendingAcceptance(token),
      ]);
      setMeetings(allRes);
      setPending(pendRes);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not load meetings.',
      );
    }
  }, [token, toast]);

  useEffect(() => {
    setIsLoading(true);
    loadAll().finally(() => setIsLoading(false));
  }, [loadAll]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadAll();
    setIsRefreshing(false);
  }, [loadAll]);

  // Bin pending list by the server-set `canReceiverAcceptReject` flag.
  // `true` → user can accept = incoming = Meeting Requests tab.
  // `false` → user is the sender = outgoing = Sent Requests tab.
  const {pendingIncoming, pendingOutgoing} = useMemo(() => {
    const incoming: MeetingRow[] = [];
    const outgoing: MeetingRow[] = [];
    for (const m of pending) {
      if (m.canReceiverAcceptReject) incoming.push(m);
      else outgoing.push(m);
    }
    return {pendingIncoming: incoming, pendingOutgoing: outgoing};
  }, [pending]);

  // "Meetings this week" — pulled from the main /meetings list, filtered
  // by date. Web does the same: `meetingsList.filter(isDateInCurrentWeek)`.
  const thisWeek = useMemo(() => {
    return meetings.filter(m => isInThisWeek(parseIsoDate(m.date)));
  }, [meetings]);

  // Build a YYYY-MM-DD → MeetingRow[] index so the calendar grid can
  // render dots in O(1) per day and the day-list can be sliced just as
  // cheaply. Recomputed only when `meetings` changes.
  const meetingsByDay = useMemo(() => {
    const idx: Record<string, MeetingRow[]> = {};
    for (const m of meetings) {
      const key = String(m.date || '');
      if (!key) continue;
      (idx[key] = idx[key] || []).push(m);
    }
    return idx;
  }, [meetings]);

  // 6-week month matrix for the visible (viewMonth, viewYear). Cells
  // outside the visible month are marked so they render dimmed but stay
  // tappable — matches the web's `mwl-calendar-month-view` layout.
  const monthCells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const startDow = first.getDay(); // 0 = Sunday
    const start = new Date(viewYear, viewMonth, 1 - startDow);
    const cells: {date: Date; inMonth: boolean; iso: string}[] = [];
    const pad = (n: number) => String(n).padStart(2, '0');
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      cells.push({
        date: d,
        inMonth: d.getMonth() === viewMonth,
        iso: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      });
    }
    return cells;
  }, [viewMonth, viewYear]);

  const monthLabel = useMemo(() => {
    return `${MONTH_FULL_NAMES[viewMonth]} ${viewYear}`;
  }, [viewMonth, viewYear]);

  const goPrevMonth = () => {
    setViewMonth(m => (m === 0 ? 11 : m - 1));
    if (viewMonth === 0) setViewYear(y => y - 1);
  };
  const goNextMonth = () => {
    setViewMonth(m => (m === 11 ? 0 : m + 1));
    if (viewMonth === 11) setViewYear(y => y + 1);
  };
  const goToday = () => {
    const now = new Date();
    setViewMonth(now.getMonth());
    setViewYear(now.getFullYear());
    const pad = (n: number) => String(n).padStart(2, '0');
    setSelectedDayIso(
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    );
  };

  // Meetings on the currently-selected calendar day (used for the
  // inline list that appears under the grid after a day is tapped).
  const selectedDayMeetings = selectedDayIso
    ? meetingsByDay[selectedDayIso] || []
    : [];

  const activeList =
    activeTab === 'requests' ? pendingIncoming : pendingOutgoing;

  const handleScheduleTap = () => {
    setScheduleVisible(true);
  };

  const handleMeetingTap = (_m: MeetingRow) => {
    // TODO: route to a meeting detail screen / modal. For now we just
    // ack the tap so the user knows the row is interactive.
    toast.info('Meeting detail view coming soon.');
  };

  return (
    <View style={styles.page}>
      {/* Header: back button, title, schedule CTA. Mirrors the web's
          top toolbar (page-title + Schedule Meeting button). */}
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back">
          <Icon name="arrow-left" size={22} color="#0f172a" />
        </Pressable>
        <Text style={styles.headerTitle}>Meetings</Text>
        <Pressable
          onPress={handleScheduleTap}
          style={({pressed}) => [
            styles.scheduleBtn,
            {backgroundColor: primaryColor},
            pressed && {opacity: 0.85},
          ]}
          accessibilityRole="button"
          accessibilityLabel="Schedule meeting">
          <Icon name="plus" size={14} color="#ffffff" />
          <Text style={styles.scheduleBtnText}>Schedule</Text>
        </Pressable>
        <Pressable
          onPress={() => setAvailabilityVisible(true)}
          style={({pressed}) => [
            styles.availabilityBtn,
            pressed && {opacity: 0.85},
          ]}
          accessibilityRole="button"
          accessibilityLabel="Edit availability">
          <Icon name="pencil-outline" size={14} color="#ffffff" />
          <Text style={styles.availabilityBtnText}>Availability</Text>
        </Pressable>
      </View>

      {/* Top tabs — All Meetings vs Meeting Notes. Matches the web's
          header row tabs. Notes is a placeholder until the notes feed
          is wired. */}
      <View style={styles.topTabsRow}>
        <Pressable
          style={[
            styles.topTab,
            topTab === 'all' && {
              backgroundColor: '#eef3ff',
            },
          ]}
          onPress={() => setTopTab('all')}>
          <Text
            style={[
              styles.topTabText,
              topTab === 'all' && {
                color: primaryColor,
                fontWeight: '800',
              },
            ]}>
            All Meetings
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.topTab,
            topTab === 'notes' && {
              backgroundColor: '#eef3ff',
            },
          ]}
          onPress={() => setTopTab('notes')}>
          <Text
            style={[
              styles.topTabText,
              topTab === 'notes' && {
                color: primaryColor,
                fontWeight: '800',
              },
            ]}>
            Meeting Notes
          </Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={primaryColor} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={primaryColor}
              colors={[primaryColor]}
            />
          }
          showsVerticalScrollIndicator={false}>
          {topTab === 'notes' ? (
            <View style={styles.card}>
              <View style={styles.empty}>
                <Text style={styles.emptyText}>
                  Meeting notes will appear here.
                </Text>
              </View>
            </View>
          ) : null}

          {/* Calendar — month grid with day-of-week labels, navigation
              buttons, and dots on days that have meetings. Tap a day
              to filter the list directly below to that date. */}
          {topTab === 'all' ? (
            <View style={styles.card}>
              <View style={styles.calendarHeader}>
                <Text style={[styles.monthLabel, {color: primaryColor}]}>
                  {monthLabel}
                </Text>
                <View style={styles.calendarNavRow}>
                  <Pressable
                    onPress={goPrevMonth}
                    style={styles.calendarNavBtn}>
                    <Text style={styles.calendarNavText}>PREVIOUS</Text>
                  </Pressable>
                  <Pressable
                    onPress={goToday}
                    style={styles.calendarNavBtn}>
                    <Text style={styles.calendarNavText}>TODAY</Text>
                  </Pressable>
                  <Pressable
                    onPress={goNextMonth}
                    style={styles.calendarNavBtn}>
                    <Text style={styles.calendarNavText}>NEXT</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.dowRow}>
                {DOW_LABELS.map(l => (
                  <Text key={l} style={styles.dowLabel}>
                    {l}
                  </Text>
                ))}
              </View>

              <View style={styles.gridWrap}>
                {monthCells.map((cell, i) => {
                  const dayMeetings = meetingsByDay[cell.iso] || [];
                  const isSelected = selectedDayIso === cell.iso;
                  const isToday =
                    cell.date.getFullYear() === today.getFullYear() &&
                    cell.date.getMonth() === today.getMonth() &&
                    cell.date.getDate() === today.getDate();
                  return (
                    <Pressable
                      key={`${cell.iso}-${i}`}
                      onPress={() =>
                        setSelectedDayIso(
                          isSelected ? null : cell.iso,
                        )
                      }
                      style={[
                        styles.gridCell,
                        isToday && {backgroundColor: '#dcfce7'},
                        isSelected && {
                          backgroundColor: `${primaryColor}1a`,
                          borderColor: primaryColor,
                          borderWidth: 1,
                        },
                      ]}>
                      <Text
                        style={[
                          styles.gridCellDay,
                          !cell.inMonth && styles.gridCellDayMuted,
                          isSelected && {
                            color: primaryColor,
                            fontWeight: '800',
                          },
                        ]}>
                        {cell.date.getDate()}
                      </Text>
                      {dayMeetings.length > 0 ? (
                        <View style={styles.dotsRow}>
                          {dayMeetings.slice(0, 3).map((_, j) => (
                            <View
                              key={j}
                              style={[
                                styles.dot,
                                {backgroundColor: '#f97316'},
                              ]}
                            />
                          ))}
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              {selectedDayIso && selectedDayMeetings.length > 0 ? (
                <View style={styles.dayListWrap}>
                  {selectedDayMeetings.map((m, i) => (
                    <MeetingRowItem
                      key={m.uuid || `sel-${i}`}
                      meeting={m}
                      primaryColor={primaryColor}
                      isLast={i === selectedDayMeetings.length - 1}
                      onPress={() => handleMeetingTap(m)}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Tabs: Meeting Requests / Sent Requests. Hidden on the
              Meeting Notes tab — only the notes feed shows there. */}
          {topTab === 'all' ? (
          <View style={styles.card}>
            <View style={styles.tabsRow}>
              <Pressable
                style={[
                  styles.tab,
                  activeTab === 'requests' && {
                    borderBottomColor: primaryColor,
                  },
                ]}
                onPress={() => setActiveTab('requests')}>
                <Text
                  style={[
                    styles.tabText,
                    activeTab === 'requests' && {
                      color: primaryColor,
                      fontWeight: '800',
                    },
                  ]}>
                  Meeting Requests
                  {pendingIncoming.length > 0
                    ? `  (${pendingIncoming.length})`
                    : ''}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.tab,
                  activeTab === 'sent' && {
                    borderBottomColor: primaryColor,
                  },
                ]}
                onPress={() => setActiveTab('sent')}>
                <Text
                  style={[
                    styles.tabText,
                    activeTab === 'sent' && {
                      color: primaryColor,
                      fontWeight: '800',
                    },
                  ]}>
                  Sent Requests
                  {pendingOutgoing.length > 0
                    ? `  (${pendingOutgoing.length})`
                    : ''}
                </Text>
              </Pressable>
            </View>

            {activeList.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No meetings found</Text>
              </View>
            ) : (
              activeList.map((m, i) => (
                <MeetingRowItem
                  key={m.uuid || `${activeTab}-${i}`}
                  meeting={m}
                  primaryColor={primaryColor}
                  isLast={i === activeList.length - 1}
                  onPress={() => handleMeetingTap(m)}
                />
              ))
            )}
          </View>
          ) : null}

          {/* Meetings this week — separate card, mirrors the web. Hidden
              on the Meeting Notes tab. */}
          {topTab === 'all' ? (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>Meetings this week</Text>
              {thisWeek.length > 0 ? (
                <View
                  style={[
                    styles.countBadge,
                    {backgroundColor: '#22c55e'},
                  ]}>
                  <Text style={styles.countBadgeText}>{thisWeek.length}</Text>
                </View>
              ) : null}
            </View>
            {thisWeek.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No meetings this week</Text>
              </View>
            ) : (
              thisWeek.map((m, i) => (
                <MeetingRowItem
                  key={m.uuid || `week-${i}`}
                  meeting={m}
                  primaryColor={primaryColor}
                  isLast={i === thisWeek.length - 1}
                  onPress={() => handleMeetingTap(m)}
                />
              ))
            )}
          </View>
          ) : null}
        </ScrollView>
      )}

      <ScheduleMeetingModal
        visible={scheduleVisible}
        token={token}
        currentUserName={currentUserName}
        onClose={() => setScheduleVisible(false)}
        onCreated={loadAll}
      />

      <EditAvailabilityModal
        visible={availabilityVisible}
        token={token}
        onClose={() => setAvailabilityVisible(false)}
      />
    </View>
  );
}

// Single row inside a card. Left: a small calendar-tile with day/month.
// Right: title, counterparty (primary-colored), and time range.
function MeetingRowItem({
  meeting,
  primaryColor,
  isLast,
  onPress,
}: {
  meeting: MeetingRow;
  primaryColor: string;
  isLast: boolean;
  onPress: () => void;
}) {
  const date = parseIsoDate(meeting.date);
  const dayNumber = date ? String(date.getDate()).padStart(2, '0') : '--';
  const monthLabel = date ? MONTH_NAMES[date.getMonth()] : '';
  const title = meeting.meetingTitle || 'Meeting';
  const other = counterpartyName(meeting);
  const timeFrom = formatTime12(meeting.timeFrom);
  const timeTo = formatTime12(meeting.timeTo);

  return (
    <>
      <Pressable
        onPress={onPress}
        style={({pressed}) => [
          styles.row,
          pressed && {backgroundColor: '#f8fafc'},
        ]}>
        <View style={[styles.dateTile, {borderColor: primaryColor}]}>
          <Text style={[styles.dateDay, {color: primaryColor}]}>
            {dayNumber}
          </Text>
          <Text style={[styles.dateMonth, {color: primaryColor}]}>
            {monthLabel}
          </Text>
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.rowOther, {color: primaryColor}]} numberOfLines={1}>
            {other}
          </Text>
          {timeFrom ? (
            <Text style={styles.rowTime}>
              {timeFrom}
              {timeTo ? ` – ${timeTo}` : ''}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {!isLast ? <View style={styles.separator} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#f1f5f9',
    flex: 1,
  },
  header: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  headerTitle: {
    color: '#0f172a',
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
  },
  scheduleBtn: {
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  scheduleBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  // Dark "Availability" button next to Schedule — matches the web's
  // black/gray secondary action button.
  availabilityBtn: {
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  availabilityBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  // Top-level page tabs (All Meetings / Meeting Notes). Sit under the
  // header, above the cards. Inactive looks like text; active gets a
  // light blue pill.
  topTabsRow: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  topTab: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  topTabText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
  },
  // Calendar grid block — title row + Prev/Today/Next buttons, then
  // day-of-week labels, then the 6×7 day matrix with meeting dots.
  calendarHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  monthLabel: {
    fontSize: 18,
    fontWeight: '800',
  },
  calendarNavRow: {
    flexDirection: 'row',
    gap: 4,
  },
  calendarNavBtn: {
    backgroundColor: '#e2e8f0',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  calendarNavText: {
    color: '#0f172a',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  dowRow: {
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    marginTop: 12,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  dowLabel: {
    color: '#475569',
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  gridCell: {
    alignItems: 'center',
    borderRadius: 8,
    gap: 4,
    margin: 2,
    minHeight: 52,
    paddingTop: 6,
    width: `${100 / 7 - 0.6}%`,
  },
  gridCellDay: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '600',
  },
  gridCellDayMuted: {
    color: '#cbd5e1',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 2,
    justifyContent: 'center',
    marginTop: 2,
  },
  dot: {
    borderRadius: 999,
    height: 5,
    width: 5,
  },
  // Wrapper for the inline meeting list shown under the calendar
  // after a day with meetings is tapped.
  dayListWrap: {
    borderTopColor: '#e2e8f0',
    borderTopWidth: 1,
    paddingTop: 4,
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
  },
  tabsRow: {
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    flexDirection: 'row',
  },
  tab: {
    alignItems: 'center',
    borderBottomColor: 'transparent',
    borderBottomWidth: 3,
    flex: 1,
    paddingVertical: 14,
  },
  tabText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
  },
  sectionHeader: {
    alignItems: 'center',
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sectionHeaderText: {
    color: '#0f172a',
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  countBadge: {
    alignItems: 'center',
    borderRadius: 999,
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  countBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 28,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  separator: {
    backgroundColor: '#e2e8f0',
    height: 1,
    marginHorizontal: 16,
  },
  dateTile: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    paddingVertical: 6,
    width: 46,
  },
  dateDay: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
  },
  dateMonth: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
  rowOther: {
    fontSize: 13,
    fontWeight: '600',
  },
  rowTime: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
});
