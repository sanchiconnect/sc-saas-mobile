import React, {useState} from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {Icon} from '../../../core/components/Icon';
import {radii, spacing, typography, withAlpha} from '../../../core/theme/colors';
import {DashboardStat} from '../types';
import {RecommendedSection} from './RecommendedSection';

// Search-scope chips, in display order. `userKey` matches the tenant.users.*
// flag — chip is hidden if the tenant has disabled that role. Users can
// search any stakeholder type, including their own (a startup may want to
// connect with other startups).
type SearchScope = {
  key: string;
  label: string;
  userKey?: string;
};

const SEARCH_SCOPES: SearchScope[] = [
  {key: 'all', label: 'All'},
  {key: 'startups', label: 'Startups', userKey: 'startups'},
  {key: 'investors', label: 'Investors', userKey: 'investors'},
  {key: 'corporates', label: 'Corporates', userKey: 'corporates'},
  {key: 'mentors', label: 'Mentors', userKey: 'mentors'},
  {key: 'service_providers', label: 'Service Providers', userKey: 'service_providers'},
  {key: 'partners', label: 'Partners', userKey: 'partners'},
  {key: 'individuals', label: 'Individuals', userKey: 'individuals'},
];

type TenantUsersFlags = Record<string, any> | null | undefined;

type DashboardContentProps = {
  primaryColor: string;
  userFirstName: string;
  searchText: string;
  onSearchChange: (value: string) => void;
  stats: DashboardStat[];
  profileCompletion: number;
  onEditProfile?: () => void;
  onStatPress?: (statKey: string) => void;
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
  onStatPress,
  accountType,
  roleDashboard,
  tenantUsers,
  logoBaseUrl,
  canToggleStatus,
}: DashboardContentProps) {
  const progress = Math.max(0, Math.min(profileCompletion, 100));
  // Pre-compute the tick positions for the progress ring. Each tick is a
  // tiny rectangle oriented tangent to the ring — packed densely so
  // adjacent ticks overlap and form a smooth continuous band. Using
  // rectangles instead of circular dots eliminates the "beaded" outer
  // outline that read as zigzag. 90 segments at radius 34 = ~2.37px
  // spacing, with each tick 4px wide (tangential overlap of ~1.6px).
  const RING_SIZE = 80;
  const RING_RADIUS = 34;
  const RING_SEGMENTS = 90;
  const RING_TICK_W = 4; // tangential length
  const RING_TICK_H = 7; // radial thickness (the stroke width)
  const ringCenter = RING_SIZE / 2;
  const filledTicks = Math.round((progress / 100) * RING_SEGMENTS);
  const ringTicks = Array.from({length: RING_SEGMENTS}, (_, i) => {
    // Math: 0° = 3 o'clock; we want 0% to start at 12 o'clock and sweep
    // clockwise — so subtract 90° from the angle.
    const angleDeg = (i / RING_SEGMENTS) * 360 - 90;
    const angleRad = (angleDeg * Math.PI) / 180;
    return {
      left: ringCenter + RING_RADIUS * Math.cos(angleRad) - RING_TICK_W / 2,
      top: ringCenter + RING_RADIUS * Math.sin(angleRad) - RING_TICK_H / 2,
      // Rotate each tick so its long side is tangent to the ring. +90°
      // makes a horizontally-oriented rectangle align with the local
      // tangent at that angle.
      rotation: angleDeg + 90,
      filled: i < filledTicks,
    };
  });

  // Search-scope state. Visible options filtered by tenant flags only —
  // every user can search any stakeholder type the tenant has enabled.
  const [scope, setScope] = useState<string>('all');
  const [scopePickerOpen, setScopePickerOpen] = useState(false);
  const visibleScopes = SEARCH_SCOPES.filter(s => {
    // Default to showing — only hide when the tenant has *explicitly*
    // disabled the role (users.<role> === false). undefined / not-loaded
    // means show, so the dropdown is populated as soon as the tenant
    // config arrives, not after a full reload.
    if (s.userKey && tenantUsers && tenantUsers[s.userKey] === false) {
      return false;
    }
    return true;
  });
  const activeScope =
    visibleScopes.find(s => s.key === scope) || visibleScopes[0];

  return (
    <>
      <View style={[styles.heroPanel, {backgroundColor: primaryColor}]}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroCopy}>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.heroName}>{userFirstName}</Text>
          </View>

          <View style={styles.heroAside}>
            <View style={styles.progressRingOuter}>
              {/* Smooth progress ring — 90 thin rectangles, each rotated
                  tangent to the perimeter and densely packed so adjacent
                  ticks slightly overlap. Reads as a continuous band
                  instead of the prior beaded dot pattern, while still
                  rendering cleanly at any percentage (no rotation hacks
                  on the colored arc itself). */}
              {ringTicks.map((tick, i) => (
                <View
                  key={i}
                  style={[
                    styles.progressTick,
                    {
                      left: tick.left,
                      top: tick.top,
                      transform: [{rotate: `${tick.rotation}deg`}],
                    },
                    tick.filled && styles.progressTickFilled,
                  ]}
                />
              ))}
              <View style={styles.progressRingInner}>
                <Text
                  style={[styles.progressValue, {color: primaryColor}]}
                  numberOfLines={1}>
                  {progress}%
                </Text>
              </View>
            </View>

            <Pressable
              style={styles.editProfileButton}
              onPress={onEditProfile}
              accessibilityRole="button"
              accessibilityLabel="Edit profile">
              <Icon name="pencil-outline" size={14} color="#ffffff" />
              <Text style={styles.editProfileText}>Edit profile</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.searchRow}>
          <Icon name="magnify" size={20} color="#64748b" />
          <TextInput
            placeholder="Enter a keyword"
            placeholderTextColor="#94a3b8"
            style={styles.searchInput}
            value={searchText}
            onChangeText={onSearchChange}
          />
          {visibleScopes.length > 1 ? (
            <Pressable
              style={styles.scopeTrigger}
              onPress={() => setScopePickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`Search scope: ${activeScope?.label || 'All'}`}>
              <Text style={styles.scopeTriggerText} numberOfLines={1}>
                {activeScope?.label || 'All'}
              </Text>
              <Icon name="chevron-down" size={18} color="#475569" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Scope picker bottom sheet */}
      <Modal
        visible={scopePickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setScopePickerOpen(false)}>
        <Pressable
          style={styles.scopeBackdrop}
          onPress={() => setScopePickerOpen(false)}>
          <Pressable style={styles.scopeSheet} onPress={() => {}}>
            <Text style={styles.scopeSheetTitle}>Search in</Text>
            {visibleScopes.map(s => {
              const isActive = scope === s.key;
              return (
                <Pressable
                  key={s.key}
                  style={[
                    styles.scopeOption,
                    isActive && {
                      backgroundColor: withAlpha(primaryColor, 0.08),
                    },
                  ]}
                  onPress={() => {
                    setScope(s.key);
                    setScopePickerOpen(false);
                  }}>
                  <Text
                    style={[
                      styles.scopeOptionText,
                      isActive && {
                        color: primaryColor,
                        fontWeight: '700',
                      },
                    ]}>
                    {s.label}
                  </Text>
                  {isActive ? (
                    <Icon name="check" size={18} color={primaryColor} />
                  ) : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      <View style={styles.statsGrid}>
        {stats.map(item => (
          <Pressable
            key={item.key}
            style={styles.statCard}
            onPress={() => onStatPress?.(item.key)}
            accessibilityRole="button"
            accessibilityLabel={item.title}>
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
          </Pressable>
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
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl + spacing.lg,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  heroCopy: {
    flex: 1,
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
  },
  heroAside: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  // Smooth progress ring — 90 thin rectangles, each rotated tangent to
  // the ring perimeter so adjacent ticks overlap slightly and form a
  // continuous band. Filled ticks are solid white; unfilled use the
  // translucent-white track tint over the dark hero background.
  progressRingOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
    height: 80,
    position: 'relative',
  },
  progressTick: {
    position: 'absolute',
    width: 4,
    height: 7,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  progressTickFilled: {
    backgroundColor: '#ffffff',
  },
  progressRingInner: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: '#ffffff',
  },
  progressValue: {
    fontSize: typography.body,
    fontWeight: '800',
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  editProfileText: {
    color: '#ffffff',
    fontSize: typography.small,
    fontWeight: '700',
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
  // Inline scope dropdown trigger — sits at the right end of the search
  // input, divided from the text by a thin vertical border. Mirrors the
  // frontend's "All ▾" pattern.
  scopeTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingLeft: spacing.md,
    marginLeft: spacing.sm,
    borderLeftWidth: 1,
    borderLeftColor: '#e2e8f0',
    maxWidth: 120,
  },
  scopeTriggerText: {
    color: '#0f172a',
    fontSize: typography.body,
    fontWeight: '600',
  },
  // Bottom-sheet modal for picking the search scope.
  scopeBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  scopeSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
    gap: 2,
  },
  scopeSheetTitle: {
    color: '#64748b',
    fontSize: typography.small,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  scopeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
  },
  scopeOptionText: {
    color: '#0f172a',
    fontSize: typography.bodyLg,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: -spacing.xxxl,
    paddingHorizontal: spacing.lg,
  },
  statCard: {
    backgroundColor: '#ffffff',
    borderRadius: radii.lg,
    elevation: 2,
    // Strict 2-column. flexGrow stays 0 so a stranded 5th tile sits in the
    // left column at the same width — no awkward full-width stretch.
    width: '48%',
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
