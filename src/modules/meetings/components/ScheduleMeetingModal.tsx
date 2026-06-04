import React, {useContext, useEffect, useMemo, useState} from 'react';
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
import {CalendarPicker} from '../../../core/components/CalendarPicker';
import {meetingsService} from '../../connections/services/meetings.service';
import type {
  AvailabilitySummary,
  CalendarSlot,
  PublicProfile,
  Reviewer,
} from '../../connections/services/meetings.service';

type PresetUser = {
  uuid: string;
  name: string;
};

type Props = {
  visible: boolean;
  token: string;
  currentUserName?: string;
  // If provided, the modal skips the reviewer dropdown and locks the
  // meeting to this user (matches the web's `modalData.otherUser` path
  // when arriving from a chat thread or Connections row).
  presetUser?: PresetUser | null;
  onClose: () => void;
  // Fired after a successful POST so the caller can refresh its list.
  onCreated?: () => void;
};

// Mirror the web's constants (src/CONSTS + shared/constants/enum).
const AVAILABILITY = {
  TEMPORARY_UNAVAILABLE: 'temporary_unavailable',
  ANYTIME: 'anytime',
  SPECIFIC_DAYS: 'specific_days',
};
const LOC_VIRTUAL = 'virtual';
const LOC_INPERSON = 'inperson';
const TOOL_INBUILT = 'inbuilt';

const DURATIONS = ['15', '30', '45', '60'];

const todayIso = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const formatDate = (iso: string): string => {
  if (!iso) return 'Select Date';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

const TIME_24_RE = /^(\d{1,2}):(\d{2})(?::\d{2})?$/;

const to24Hour = (raw: string): string => {
  if (!raw) return '';
  const m = raw.match(TIME_24_RE);
  if (!m) return raw;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
};

const to12Hour = (raw: string): string => {
  if (!raw) return '';
  const m = raw.match(TIME_24_RE);
  if (!m) return raw;
  const h24 = Number(m[1]);
  const period = h24 >= 12 ? 'pm' : 'am';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, '0')}:${m[2]} ${period}`;
};

const addMinutes24h = (hhmm: string, mins: number): string => {
  const m = hhmm.match(TIME_24_RE);
  if (!m) return hhmm;
  const total = Number(m[1]) * 60 + Number(m[2]) + mins;
  const hh = ((Math.floor(total / 60) % 24) + 24) % 24;
  const mm = ((total % 60) + 60) % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

// Local slot generator — fallback when the calendar-availability endpoint
// returns nothing parseable (some tenants return only the availability
// shape, expecting clients to generate slots like the web's
// `generateTimeSlotsWithAMPM`). Default working window mirrors what the
// web uses (`SCHEDULE_DAY_START_MIN=9` / `END_MIN=21`). `minStartMinutes`
// lets the caller hide slots that have already passed for today's
// date — pass 0 (or omit) for future dates.
const DAY_START_MIN = 9 * 60; // 09:00
const DAY_END_MIN = 21 * 60; // 21:00

const generateLocalSlots = (
  durationMins: number,
  minStartMinutes = 0,
): {timeFrom: string; timeTo: string; available: boolean}[] => {
  const step = durationMins > 0 ? durationMins : 30;
  const firstStart = Math.max(DAY_START_MIN, minStartMinutes);
  const out: {timeFrom: string; timeTo: string; available: boolean}[] = [];
  for (
    let start = firstStart;
    start + step <= DAY_END_MIN;
    start += step
  ) {
    const fh = Math.floor(start / 60);
    const fm = start % 60;
    const eh = Math.floor((start + step) / 60);
    const em = (start + step) % 60;
    out.push({
      timeFrom: `${String(fh).padStart(2, '0')}:${String(fm).padStart(2, '0')}`,
      timeTo: `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`,
      available: true,
    });
  }
  return out;
};

// Parse "HH:MM" / "HH:MM:SS" to minutes-of-day. Returns -1 for
// unparseable input so callers can decide whether to keep or drop.
const hhmmToMinutes = (raw: string): number => {
  const m = raw.match(TIME_24_RE);
  if (!m) return -1;
  return Number(m[1]) * 60 + Number(m[2]);
};

// Round a minutes-of-day value up to the next multiple of `step`. Used
// to snap "now" to the next valid slot boundary so picker entries land
// on clean :00 / :15 / :30 / :45 marks rather than the literal current
// minute.
const ceilToStep = (mins: number, step: number): number => {
  if (step <= 0) return mins;
  const rem = mins % step;
  return rem === 0 ? mins : mins + (step - rem);
};

const URL_RE =
  /^(https?:\/\/)([\w.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?(\?[^\s]*)?$/i;

export function ScheduleMeetingModal({
  visible,
  token,
  currentUserName,
  presetUser,
  onClose,
  onCreated,
}: Props) {
  const {theme} = useContext(TenantContext);
  const primaryColor = theme?.primary || '#0b0aa3';
  const insets = useSafeAreaInsets();
  const toast = useToast();

  // Reviewer dropdown — only fetched / shown when no preset user.
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [reviewerPickerOpen, setReviewerPickerOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<PresetUser | null>(
    presetUser || null,
  );

  // Availability — drives the temporary_unavailable short-circuit AND
  // the date / time pickers.
  const [availability, setAvailability] = useState<AvailabilitySummary | null>(
    null,
  );
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);

  // Form state
  const [meetingTitle, setMeetingTitle] = useState('');
  const [agenda, setAgenda] = useState('');
  const [duration, setDuration] = useState('30');
  const [date, setDate] = useState(todayIso());
  const [timeFrom, setTimeFrom] = useState('');
  const [mode, setMode] = useState<'virtual' | 'inperson'>('virtual');
  const [venue, setVenue] = useState('');
  const [toolType, setToolType] = useState<'inbuilt' | 'external'>('inbuilt');
  const [externalUrl, setExternalUrl] = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Time slots for the selected date.
  const [slots, setSlots] = useState<CalendarSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  // Reset when the modal opens — preset user + defaults.
  useEffect(() => {
    if (!visible) return;
    setSelectedUser(presetUser || null);
    setMeetingTitle(
      presetUser && currentUserName
        ? `${currentUserName} <> ${presetUser.name}`
        : '',
    );
    setAgenda('');
    setDuration('30');
    setDate(todayIso());
    setTimeFrom('');
    setMode('virtual');
    setToolType('inbuilt');
    setVenue('');
    setExternalUrl('');
    setSlots([]);
    setAvailability(null);
  }, [visible, presetUser, currentUserName]);

  // Fetch reviewers list when no preset user (matches web's
  // `getReviewers()`).
  useEffect(() => {
    if (!visible || presetUser) return;
    meetingsService
      .listReviewers(token)
      .then(setReviewers)
      .catch(() => setReviewers([]));
  }, [visible, presetUser, token]);

  // Fetch availability AND public profile whenever the target user
  // changes. Web fires both calls back-to-back from `getCompanyDetails()`.
  useEffect(() => {
    if (!visible || !selectedUser?.uuid) {
      setAvailability(null);
      return;
    }
    let cancelled = false;
    setIsLoadingAvailability(true);
    Promise.all([
      meetingsService
        .getUserPublicProfile(token, selectedUser.uuid)
        .catch(() => ({} as PublicProfile)),
      meetingsService
        .getUserAvailability(token, selectedUser.uuid)
        .catch(() => ({} as AvailabilitySummary)),
    ])
      .then(([profile, summary]) => {
        if (cancelled) return;
        setAvailability(summary || {});
        // Recompute meeting title from the recipient's company name when
        // available — matches web's `userProfileData.org_name ||
        // modalData.otherUser.name + ' <> ' + this.companyName`.
        const otherLabel =
          profile?.org_name ||
          profile?.organizationName ||
          profile?.companyName ||
          selectedUser.name;
        const myLabel = currentUserName?.trim() || 'You';
        setMeetingTitle(`${otherLabel} <> ${myLabel}`);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingAvailability(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, selectedUser?.uuid, selectedUser?.name, currentUserName, token]);

  // Refetch date-specific slots whenever target user / date changes.
  useEffect(() => {
    if (
      !visible ||
      !selectedUser?.uuid ||
      !date ||
      availability?.availabilityHours === AVAILABILITY.TEMPORARY_UNAVAILABLE
    ) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    setIsLoadingSlots(true);
    // When the picked date is TODAY, hide slots whose start time has
    // already passed — snapping "now" up to the next clean step
    // boundary so the first surfaced slot is always a valid future
    // start time. For future dates `minStart` stays 0 and every slot
    // in the working window is offered.
    const durationMins = Number(duration) || 30;
    const minStart =
      date === todayIso()
        ? (() => {
            const now = new Date();
            return ceilToStep(
              now.getHours() * 60 + now.getMinutes(),
              durationMins,
            );
          })()
        : 0;

    meetingsService
      .getCalendarAvailability(token, selectedUser.uuid, date)
      .then(s => {
        if (cancelled) return;
        // Drop server-returned slots whose start has already passed
        // today. For future dates `minStart === 0` keeps everything.
        const futureServerSlots = s.filter(
          x => hhmmToMinutes(to24Hour(x.timeFrom)) >= minStart,
        );
        // Fall back to locally-generated slots when the server's
        // date-specific response is empty / unparseable (same approach
        // the web's generateTimeSlotsWithAMPM uses).
        const finalSlots =
          futureServerSlots.length > 0
            ? futureServerSlots
            : generateLocalSlots(durationMins, minStart);
        setSlots(finalSlots);
        // Clear stale time when slot set changes.
        setTimeFrom(prev =>
          finalSlots.some(x => to24Hour(x.timeFrom) === prev) ? prev : '',
        );
      })
      .catch(() => {
        if (!cancelled) {
          // Network / parse failure — still surface local future slots
          // so the user can submit rather than getting stuck.
          setSlots(generateLocalSlots(durationMins, minStart));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, selectedUser?.uuid, date, availability?.availabilityHours, token]);

  const isUnavailable =
    availability?.availabilityHours === AVAILABILITY.TEMPORARY_UNAVAILABLE;

  const canSubmit =
    !!selectedUser?.uuid &&
    !!meetingTitle.trim() &&
    !!agenda.trim() &&
    !!date &&
    !!timeFrom &&
    !isUnavailable &&
    !isSubmitting &&
    (mode !== 'inperson' || venue.trim().length > 0) &&
    (mode !== 'virtual' || toolType !== 'external' ||
      URL_RE.test(externalUrl.trim()));

  const handleSubmit = async () => {
    if (!canSubmit || !selectedUser?.uuid) return;
    setIsSubmitting(true);
    try {
      // Compute timeTo from server-provided slot.timeTo when available,
      // else from timeFrom + duration. Always normalised to military.
      const tf = to24Hour(timeFrom);
      const matched = slots.find(s => to24Hour(s.timeFrom) === tf);
      const tt = to24Hour(
        matched?.timeTo || addMinutes24h(tf, Number(duration) || 30),
      );
      const offset = String(new Date().getTimezoneOffset());
      let timeZone = 'UTC';
      try {
        timeZone =
          Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      } catch {
        // older RN engines
      }
      const effectiveToolType =
        mode === 'virtual' ? toolType : TOOL_INBUILT;
      await meetingsService.createMeeting(token, {
        date,
        timeFrom: tf,
        timeTo: tt,
        meetingTitle: meetingTitle.trim(),
        // Agenda — backend's field is `meetingDescription`; the web
        // ships it under that exact name and so do we.
        meetingDescription: agenda.trim(),
        otherUserUUID: selectedUser.uuid,
        duration,
        // Web sends these four explicitly even when null, so the API
        // never has to fall back on defaults. Matching the payload
        // verbatim avoids tenants that strictly validate body shape.
        meetingToolType: effectiveToolType,
        useExternalTool: effectiveToolType === 'external',
        meetingExternalUrl:
          effectiveToolType === 'external' ? externalUrl.trim() : null,
        meetingLocationType: mode === 'inperson' ? LOC_INPERSON : LOC_VIRTUAL,
        meetingInPersonLocation: mode === 'inperson' ? venue.trim() : null,
        meetingTimeType: 'schedule_later',
        offset,
        timeZone,
      });
      toast.success('Meeting scheduled.');
      onCreated?.();
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not schedule meeting.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const reviewerChoices = useMemo(
    () =>
      reviewers
        .map(r => ({
          uuid: r.otherUser?.uuid || '',
          name: r.otherUser?.name || '',
          accountType: r.otherUser?.accountType || '',
        }))
        .filter(r => r.uuid && r.name),
    [reviewers],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      transparent={false}>
      <View style={[styles.container, {paddingTop: insets.top}]}>
        {/* Header */}
        <View style={[styles.header, {backgroundColor: primaryColor}]}>
          <Text style={styles.headerTitle}>Schedule Meeting</Text>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close">
            <Icon name="close" size={24} color="#ffffff" />
          </Pressable>
        </View>

        {isLoadingAvailability ? (
          <View style={styles.centered}>
            <ActivityIndicator color={primaryColor} size="large" />
          </View>
        ) : isUnavailable ? (
          <View style={styles.centered}>
            <Icon
              name="calendar-remove-outline"
              size={40}
              color={primaryColor}
            />
            <Text style={styles.unavailableText}>
              The other party has temporarily turned off meetings in their
              account.
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {/* Reviewer picker — only when no preset user. */}
            {!presetUser ? (
              <View style={styles.field}>
                <Text style={styles.label}>
                  Who would you prefer to schedule a meeting with?{' '}
                  <Text style={styles.required}>*</Text>
                </Text>
                <Pressable
                  onPress={() => setReviewerPickerOpen(true)}
                  style={styles.dropdown}>
                  <Text
                    style={[
                      styles.dropdownValue,
                      !selectedUser && styles.dropdownPlaceholder,
                    ]}>
                    {selectedUser?.name || 'Select a name'}
                  </Text>
                  <Icon name="chevron-down" size={20} color="#64748b" />
                </Pressable>
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.label}>
                Meeting Title <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                value={meetingTitle}
                onChangeText={setMeetingTitle}
                placeholder="e.g. Founder intro call"
                placeholderTextColor="#94a3b8"
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>
                Agenda <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                value={agenda}
                onChangeText={setAgenda}
                placeholder="What would you like to discuss?"
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={4}
                style={[styles.input, styles.textarea]}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>
                Duration (mins) <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.chipRow}>
                {DURATIONS.map(d => {
                  const active = duration === d;
                  return (
                    <Pressable
                      key={d}
                      onPress={() => setDuration(d)}
                      style={[
                        styles.chip,
                        active && {
                          backgroundColor: '#0f172a',
                          borderColor: '#0f172a',
                        },
                      ]}>
                      <Text
                        style={[
                          styles.chipText,
                          active && {color: '#ffffff'},
                        ]}>
                        {d}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>
                  Date <Text style={styles.required}>*</Text>
                </Text>
                <Pressable
                  onPress={() => setDatePickerOpen(true)}
                  style={styles.dropdown}>
                  <Text style={styles.dropdownValue}>{formatDate(date)}</Text>
                  <Icon name="calendar" size={18} color="#64748b" />
                </Pressable>
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>
                  Start Time <Text style={styles.required}>*</Text>
                </Text>
                <Pressable
                  onPress={() => setTimePickerOpen(true)}
                  style={styles.dropdown}>
                  <Text
                    style={[
                      styles.dropdownValue,
                      !timeFrom && styles.dropdownPlaceholder,
                    ]}>
                    {timeFrom
                      ? to12Hour(timeFrom)
                      : isLoadingSlots
                        ? 'Loading…'
                        : 'Select Time'}
                  </Text>
                  <Icon name="chevron-down" size={20} color="#64748b" />
                </Pressable>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>
                Mode of Meeting <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.chipRow}>
                <Pressable
                  onPress={() => setMode('virtual')}
                  style={[
                    styles.chip,
                    mode === 'virtual' && {
                      backgroundColor: '#0f172a',
                      borderColor: '#0f172a',
                    },
                  ]}>
                  <Text
                    style={[
                      styles.chipText,
                      mode === 'virtual' && {color: '#ffffff'},
                    ]}>
                    Online
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setMode('inperson')}
                  style={[
                    styles.chip,
                    mode === 'inperson' && {
                      backgroundColor: '#0f172a',
                      borderColor: '#0f172a',
                    },
                  ]}>
                  <Text
                    style={[
                      styles.chipText,
                      mode === 'inperson' && {color: '#ffffff'},
                    ]}>
                    In-Person
                  </Text>
                </Pressable>
              </View>
            </View>

            {mode === 'inperson' ? (
              <View style={styles.field}>
                <Text style={styles.label}>
                  Venue <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  value={venue}
                  onChangeText={setVenue}
                  placeholder="e.g. CCD, Sector 2, Noida"
                  placeholderTextColor="#94a3b8"
                  style={styles.input}
                />
              </View>
            ) : (
              <>
                <View style={styles.field}>
                  <Pressable
                    onPress={() => setToolType('inbuilt')}
                    style={styles.radioRow}>
                    <View
                      style={[
                        styles.radioOuter,
                        {borderColor: primaryColor},
                      ]}>
                      {toolType === 'inbuilt' ? (
                        <View
                          style={[
                            styles.radioInner,
                            {backgroundColor: primaryColor},
                          ]}
                        />
                      ) : null}
                    </View>
                    <Text style={styles.radioLabel}>In-built Meeting Tool</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setToolType('external')}
                    style={styles.radioRow}>
                    <View
                      style={[
                        styles.radioOuter,
                        {borderColor: primaryColor},
                      ]}>
                      {toolType === 'external' ? (
                        <View
                          style={[
                            styles.radioInner,
                            {backgroundColor: primaryColor},
                          ]}
                        />
                      ) : null}
                    </View>
                    <Text style={styles.radioLabel}>External Meeting URL</Text>
                  </Pressable>
                </View>
                {toolType === 'external' ? (
                  <View style={styles.field}>
                    <TextInput
                      value={externalUrl}
                      onChangeText={setExternalUrl}
                      placeholder="https://meet.google.com/…"
                      placeholderTextColor="#94a3b8"
                      autoCapitalize="none"
                      keyboardType="url"
                      style={styles.input}
                    />
                    {externalUrl && !URL_RE.test(externalUrl.trim()) ? (
                      <Text style={styles.fieldError}>
                        Please enter a valid https:// URL
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </>
            )}
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
          {!isUnavailable ? (
            <Pressable
              onPress={handleSubmit}
              disabled={!canSubmit}
              style={[
                styles.footerBtn,
                {backgroundColor: primaryColor},
                !canSubmit && {opacity: 0.5},
              ]}>
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.footerBtnText}>Submit</Text>
              )}
            </Pressable>
          ) : null}
        </View>

        {/* Reviewer picker modal */}
        <Modal
          visible={reviewerPickerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setReviewerPickerOpen(false)}>
          <Pressable
            style={styles.pickerScrim}
            onPress={() => setReviewerPickerOpen(false)}>
            <Pressable style={styles.pickerCard} onPress={() => undefined}>
              <Text style={styles.pickerTitle}>Choose a connection</Text>
              <ScrollView style={{maxHeight: 360}}>
                {reviewerChoices.length === 0 ? (
                  <Text style={styles.pickerEmpty}>
                    No connections available.
                  </Text>
                ) : (
                  reviewerChoices.map(r => (
                    <Pressable
                      key={r.uuid}
                      onPress={() => {
                        setSelectedUser({uuid: r.uuid, name: r.name});
                        setMeetingTitle(
                          currentUserName
                            ? `${currentUserName} <> ${r.name}`
                            : r.name,
                        );
                        setReviewerPickerOpen(false);
                      }}
                      style={styles.pickerOption}>
                      <Text style={styles.pickerOptionLabel}>{r.name}</Text>
                      {r.accountType ? (
                        <Text style={styles.pickerOptionMeta}>
                          {r.accountType}
                        </Text>
                      ) : null}
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Date picker — CalendarPicker pulls its own primaryColor
            from TenantContext, so we don't pass it. */}
        <CalendarPicker
          visible={datePickerOpen}
          value={date}
          minDate={todayIso()}
          onClose={() => setDatePickerOpen(false)}
          onSelect={iso => {
            setDate(iso);
            setDatePickerOpen(false);
          }}
        />

        {/* Time slot picker */}
        <Modal
          visible={timePickerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setTimePickerOpen(false)}>
          <Pressable
            style={styles.pickerScrim}
            onPress={() => setTimePickerOpen(false)}>
            <Pressable style={styles.pickerCard} onPress={() => undefined}>
              <Text style={styles.pickerTitle}>Select start time</Text>
              <ScrollView style={{maxHeight: 360}}>
                {isLoadingSlots ? (
                  <Text style={styles.pickerEmpty}>Loading slots…</Text>
                ) : slots.length === 0 ? (
                  <Text style={styles.pickerEmpty}>
                    No slots available on this date.
                  </Text>
                ) : (
                  slots.map(s => {
                    const raw = to24Hour(s.timeFrom);
                    return (
                      <Pressable
                        key={raw}
                        disabled={s.available === false}
                        onPress={() => {
                          setTimeFrom(raw);
                          setTimePickerOpen(false);
                        }}
                        style={[
                          styles.pickerOption,
                          s.available === false && {opacity: 0.4},
                        ]}>
                        <Text style={styles.pickerOptionLabel}>
                          {to12Hour(raw)}
                          {s.available === false ? ' · booked' : ''}
                        </Text>
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
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
    gap: 12,
    justifyContent: 'center',
    padding: 32,
  },
  unavailableText: {
    color: '#475569',
    fontSize: 14,
    textAlign: 'center',
  },
  body: {
    gap: 16,
    padding: 16,
  },
  field: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  fieldHalf: {
    flex: 1,
    gap: 6,
  },
  label: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  required: {
    color: '#ef4444',
  },
  input: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 10,
    borderWidth: 1,
    color: '#0f172a',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  textarea: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  dropdown: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dropdownValue: {
    color: '#0f172a',
    flex: 1,
    fontSize: 14,
  },
  dropdownPlaceholder: {
    color: '#94a3b8',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  radioRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 6,
  },
  radioOuter: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 2,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  radioInner: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  radioLabel: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '600',
  },
  fieldError: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
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
    paddingVertical: 12,
  },
  pickerOptionLabel: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
  },
  pickerOptionMeta: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  pickerEmpty: {
    color: '#94a3b8',
    fontSize: 13,
    paddingVertical: 12,
    textAlign: 'center',
  },
});
