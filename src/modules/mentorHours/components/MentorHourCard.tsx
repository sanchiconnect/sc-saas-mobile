import React from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';

import {Icon} from '../../../core/components/Icon';
import {ENTRY_MODE_LABELS} from '../services/mentorHours.service';
import type {MentorHourEntry} from '../services/mentorHours.service';
import {StarRatingDisplay} from './StarRatingDisplay';

type Props = {
  entry: MentorHourEntry;
  isStartupAccount: boolean;
  primaryColor: string;
  onApprove: () => void;
  onReject: () => void;
  onRate: () => void;
};

const humanize = (s: string): string =>
  s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const formatDate = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {day: 'numeric', month: 'short', year: 'numeric'});
};

const formatAmPm = (time?: string): string => {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const period = h < 12 ? 'AM' : 'PM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
};

export function MentorHourCard({
  entry,
  isStartupAccount,
  primaryColor,
  onApprove,
  onReject,
  onRate,
}: Props) {
  const name = isStartupAccount
    ? entry.mentor?.name || 'Mentor'
    : entry.startup?.companyName || 'Startup';
  const avatarUrl = isStartupAccount ? entry.mentor?.avatar : entry.startup?.companyLogo;
  const subtitle = !isStartupAccount ? entry.startup?.user?.[0]?.name : undefined;

  const hasIRated = isStartupAccount ? entry.ratedByStartup : entry.ratedByMentor;
  const hasOtherRated = isStartupAccount ? entry.ratedByMentor : entry.ratedByStartup;
  const myRatingGiven = isStartupAccount ? entry.mentorRatings : entry.startupRatings;
  const ratingReceivedByMe = isStartupAccount ? entry.startupRatings : entry.mentorRatings;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.nameCol}>
          {avatarUrl ? (
            <Image source={{uri: avatarUrl}} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Icon name="account" size={20} color="#94a3b8" />
            </View>
          )}
          <View style={styles.nameTextWrap}>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
        </View>

        <View style={styles.dateCol}>
          <Text style={styles.dateText}>{formatDate(entry.date)}</Text>
          <Text style={styles.timeText}>
            {formatAmPm(entry.timeFrom)} - {formatAmPm(entry.timeTo)}
          </Text>
          <View style={styles.badgeRow}>
            {entry.mode ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{ENTRY_MODE_LABELS[entry.mode]}</Text>
              </View>
            ) : null}
            {entry.type ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{humanize(entry.type)}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.durationCol}>
          <Text style={styles.durationText}>{entry.totalDuration ?? 0} mins</Text>
        </View>
      </View>

      <View style={styles.actionsRow}>
        {entry.approvalPending ? (
          isStartupAccount ? (
            <View style={styles.actionButtonsRow}>
              <Pressable
                style={[styles.actionBtn, {backgroundColor: primaryColor}]}
                onPress={onApprove}>
                <Text style={styles.actionBtnText}>APPROVE</Text>
              </Pressable>
              <Pressable style={[styles.actionBtn, styles.rejectBtn]} onPress={onReject}>
                <Text style={styles.actionBtnText}>REJECT</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.mutedText}>Approval Pending</Text>
          )
        ) : entry.approvalStatus === 'rejected' ? (
          <Text style={styles.mutedText}>Rejected by startup</Text>
        ) : hasIRated ? (
          <View>
            <Text style={styles.ratingLabel}>Your rating</Text>
            <StarRatingDisplay rating={myRatingGiven ?? 0} />
            {hasOtherRated ? (
              <>
                <Text style={[styles.ratingLabel, styles.ratingLabelSpaced]}>Ratings for you</Text>
                <StarRatingDisplay rating={ratingReceivedByMe ?? 0} />
              </>
            ) : null}
          </View>
        ) : (
          <Pressable style={[styles.actionBtn, {backgroundColor: primaryColor}]} onPress={onRate}>
            <Text style={styles.actionBtnText}>RATE</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    marginBottom: 12,
    padding: 14,
  },
  row: {flexDirection: 'row', flexWrap: 'wrap', gap: 12},
  nameCol: {alignItems: 'center', flexDirection: 'row', flex: 1.4, gap: 10, minWidth: 150},
  avatar: {borderRadius: 20, height: 40, width: 40},
  avatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
  },
  nameTextWrap: {flex: 1},
  name: {color: '#0f172a', fontSize: 14, fontWeight: '700'},
  subtitle: {color: '#64748b', fontSize: 12, marginTop: 2},
  dateCol: {flex: 1.2, minWidth: 140},
  dateText: {color: '#0f172a', fontSize: 13, fontWeight: '700'},
  timeText: {color: '#334155', fontSize: 12, marginTop: 2},
  badgeRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8},
  badge: {
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {color: '#64748b', fontSize: 11, fontWeight: '600'},
  durationCol: {minWidth: 70},
  durationText: {color: '#0f172a', fontSize: 13, fontWeight: '700'},
  actionsRow: {
    borderTopColor: '#f1f5f9',
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 12,
  },
  actionButtonsRow: {flexDirection: 'row', gap: 10},
  actionBtn: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  rejectBtn: {backgroundColor: '#0f172a'},
  actionBtnText: {color: '#ffffff', fontSize: 12, fontWeight: '800', letterSpacing: 0.4},
  mutedText: {color: '#64748b', fontSize: 13},
  ratingLabel: {color: '#64748b', fontSize: 11, fontWeight: '700', marginBottom: 4},
  ratingLabelSpaced: {marginTop: 10},
});
