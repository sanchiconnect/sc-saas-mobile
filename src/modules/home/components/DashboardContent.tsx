import React from 'react';
import {Pressable, StyleSheet, Text, TextInput, View} from 'react-native';

import {Icon} from '../../../core/components/Icon';
import {radii, spacing, typography, withAlpha} from '../../../core/theme/colors';
import {DashboardStat} from '../types';
import {RecommendedSection} from './RecommendedSection';

type TenantUsersFlags = Record<string, any> | null | undefined;

type DashboardContentProps = {
  primaryColor: string;
  userFirstName: string;
  searchText: string;
  onSearchChange: (value: string) => void;
  stats: DashboardStat[];
  profileCompletion: number;
  onEditProfile?: () => void;
  // Phase J — recommended widgets. Driven by the role-specific `*/dashboard`
  // payload + tenant flags. When fields are missing the sections silently
  // collapse, so we can pass everything through without runtime branches.
  accountType?: string;
  roleDashboard?: Record<string, any> | null;
  tenantUsers?: TenantUsersFlags;
  logoBaseUrl?: string;
  canToggleStatus?: boolean;
};

function getGreeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export function DashboardContent({
  primaryColor,
  userFirstName,
  searchText,
  onSearchChange,
  stats,
  profileCompletion,
  onEditProfile,
  accountType,
  roleDashboard,
  tenantUsers,
  logoBaseUrl,
  canToggleStatus,
}: DashboardContentProps) {
  const progress = Math.max(0, Math.min(profileCompletion, 100));
  // Progress-bar fill on the white track. Computed once per render.
  const progressFillWidth = `${progress}%` as const;

  return (
    <>
      <View style={[styles.heroPanel, {backgroundColor: primaryColor}]}>
        <Text style={styles.greeting}>{getGreeting()},</Text>
        <Text style={styles.heroName}>{userFirstName}</Text>

        <View style={styles.profileRow}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {width: progressFillWidth, backgroundColor: '#ffffff'},
              ]}
            />
          </View>
          <Pressable
            onPress={onEditProfile}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Edit profile">
            <Text style={styles.profileMeta}>
              {progress}% complete{'  '}·{'  '}
              <Text style={styles.editProfileLink}>Edit profile</Text>
            </Text>
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <Icon name="magnify" size={20} color="#64748b" />
          <TextInput
            placeholder="Search startups, investors, programs…"
            placeholderTextColor="#94a3b8"
            style={styles.searchInput}
            value={searchText}
            onChangeText={onSearchChange}
          />
        </View>
      </View>

      <View style={styles.statsGrid}>
        {stats.map(item => (
          <View key={item.key} style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text
                style={[
                  styles.statValue,
                  item.accent ? {color: primaryColor} : null,
                ]}>
                {item.value}
              </Text>
              <View
                style={[
                  styles.statIconBubble,
                  item.accent
                    ? {backgroundColor: withAlpha(primaryColor, 0.1)}
                    : null,
                ]}>
                <Icon
                  name={item.icon}
                  size={20}
                  color={item.accent ? primaryColor : '#94a3b8'}
                />
              </View>
            </View>
            <Text style={styles.statTitle}>{item.title}</Text>
          </View>
        ))}
      </View>

      <RecommendedSections
        accountType={accountType}
        roleDashboard={roleDashboard}
        tenantUsers={tenantUsers}
        logoBaseUrl={logoBaseUrl}
        canToggleStatus={canToggleStatus}
      />
    </>
  );
}

// Renders role-appropriate "Recommended …" carousels using the raw
// role-specific dashboard payload. Mirrors the frontend's pattern:
//   - startup → Recommended Investors, Recommended Mentors, Recently Added X
//   - investor → Recommended Startups, Co-investing, Recently Added Startups
//   - corporate → Recommended/Recently Added Startups
//   - mentor → Recommended Startups
// Each section is gated by tenant `users.<role>` so the carousel disappears
// when that role isn't available on this tenant.
function RecommendedSections({
  accountType,
  roleDashboard,
  tenantUsers,
  logoBaseUrl,
  canToggleStatus,
}: {
  accountType?: string;
  roleDashboard?: Record<string, any> | null;
  tenantUsers?: TenantUsersFlags;
  logoBaseUrl?: string;
  canToggleStatus?: boolean;
}) {
  const role = (accountType || '').toLowerCase();
  const dash = roleDashboard || {};
  const flag = (key: string) => Boolean(tenantUsers?.[key]);
  // Frontend gates the "Recommended …" carousels on profileCompleteness.canToggleStatus
  // (the user has to be active/approved to see suggestions). Trending/Recent
  // lists are not gated.
  const showRecommended = canToggleStatus !== false;

  if (role === 'startup') {
    return (
      <>
        {showRecommended && flag('investors') ? (
          <RecommendedSection
            title="Recommended Investors"
            kind="investor"
            items={
              dash.recommendedInvestors ||
              dash.recommended_investors ||
              []
            }
            logoBaseUrl={logoBaseUrl}
          />
        ) : null}
        {showRecommended && flag('mentors') ? (
          <RecommendedSection
            title="Recommended Mentors"
            kind="mentor"
            items={
              dash.recommendedMentors || dash.recommended_mentors || []
            }
            logoBaseUrl={logoBaseUrl}
          />
        ) : null}
        {flag('investors') ? (
          <RecommendedSection
            title="Trending Investors"
            kind="investor"
            items={dash.trendingInvestors || []}
            logoBaseUrl={logoBaseUrl}
          />
        ) : null}
        {flag('investors') ? (
          <RecommendedSection
            title="Recently Added Investors"
            kind="investor"
            items={dash.recentlyAddedInvestors || []}
            logoBaseUrl={logoBaseUrl}
          />
        ) : null}
        {flag('corporates') ? (
          <RecommendedSection
            title="Recently Added Corporates"
            kind="corporate"
            items={dash.recentlyAddedCorporates || []}
            logoBaseUrl={logoBaseUrl}
          />
        ) : null}
        {flag('mentors') ? (
          <RecommendedSection
            title="Recently Added Mentors"
            kind="mentor"
            items={dash.recentlyAddedMentors || []}
            logoBaseUrl={logoBaseUrl}
          />
        ) : null}
      </>
    );
  }

  if (role === 'investor') {
    return (
      <>
        {showRecommended && flag('startups') ? (
          <RecommendedSection
            title="Recommended Startups"
            kind="startup"
            items={
              dash.recommendedStartups || dash.recommended_startups || []
            }
            logoBaseUrl={logoBaseUrl}
          />
        ) : null}
        {flag('startups') ? (
          <RecommendedSection
            title="Trending Startups"
            kind="startup"
            items={dash.trendingStartups || []}
            logoBaseUrl={logoBaseUrl}
          />
        ) : null}
        {flag('startups') ? (
          <RecommendedSection
            title="Co-Investing Opportunities"
            kind="startup"
            items={dash.coInvestingStartups || []}
            logoBaseUrl={logoBaseUrl}
          />
        ) : null}
        {flag('startups') ? (
          <RecommendedSection
            title="Recently Added Startups"
            kind="startup"
            items={dash.recentlyAddedStartup || dash.recentlyAddedStartups || []}
            logoBaseUrl={logoBaseUrl}
          />
        ) : null}
      </>
    );
  }

  if (role === 'corporate' || role === 'mentor') {
    return (
      <>
        {showRecommended && flag('startups') ? (
          <RecommendedSection
            title="Recommended Startups"
            kind="startup"
            items={
              dash.recommendedStartups || dash.recommended_startups || []
            }
            logoBaseUrl={logoBaseUrl}
          />
        ) : null}
        {flag('startups') ? (
          <RecommendedSection
            title="Trending Startups"
            kind="startup"
            items={dash.trendingStartups || []}
            logoBaseUrl={logoBaseUrl}
          />
        ) : null}
        {flag('startups') ? (
          <RecommendedSection
            title="Recently Added Startups"
            kind="startup"
            items={dash.recentlyAddedStartup || dash.recentlyAddedStartups || []}
            logoBaseUrl={logoBaseUrl}
          />
        ) : null}
      </>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  heroPanel: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl + spacing.md,
  },
  greeting: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: typography.body,
  },
  heroName: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '800',
    marginTop: 2,
    marginBottom: spacing.lg,
  },
  // Slim profile-completion row. A 6px bar on a translucent track plus a
  // single line of meta text with the Edit-profile link inline.
  profileRow: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  progressTrack: {
    height: 6,
    width: '100%',
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.pill,
  },
  profileMeta: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: typography.small,
    fontWeight: '500',
  },
  editProfileLink: {
    color: '#ffffff',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  // Full-width single-row search bar — no nested "All" filter row.
  searchRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: radii.lg,
    flexDirection: 'row',
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
  },
  searchInput: {
    color: '#0f172a',
    flex: 1,
    fontSize: typography.bodyLg,
    padding: 0,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: -spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  statCard: {
    backgroundColor: '#ffffff',
    borderRadius: radii.lg,
    elevation: 2,
    flexBasis: '48%',
    flexGrow: 1,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md + 2,
    shadowColor: '#0f172a',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  statHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  statValue: {
    color: '#0f172a',
    fontSize: typography.title,
    fontWeight: '800',
  },
  statIconBubble: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: radii.md,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  statTitle: {
    color: '#475569',
    fontSize: typography.small,
    fontWeight: '500',
    lineHeight: 18,
  },
});
