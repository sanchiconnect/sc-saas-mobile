import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {Icon} from '../../../core/components/Icon';
import {useToast} from '../../../core/toast/ToastProvider';
import {radii, shadows, spacing, typography} from '../../../core/theme/colors';
import {resourcesService} from '../services/resources.service';
import type {
  ReportDownload,
  ResourceNews,
  ResourceVideo,
} from '../types';
import {ResourceCard} from './ResourceCard';

type Props = {
  token: string;
  // Tenant imgKit base for resolving relative report thumbnail paths.
  logoBaseUrl?: string;
  primaryColor: string;
};

type TabKey = 'news' | 'reports' | 'videos';

const TABS: {key: TabKey; label: string}[] = [
  {key: 'news', label: 'News'},
  {key: 'reports', label: 'Reports & Downloads'},
  {key: 'videos', label: 'Videos'},
];

// "Latest …" subheading shown above each tab's list.
const SUBHEADING: Record<TabKey, string> = {
  news: 'Latest News',
  reports: 'Latest Reports',
  videos: 'Latest Videos',
};

// Collapse an article body into a one-line snippet for the card.
const snippet = (text?: string): string | undefined =>
  text ? text.replace(/\s+/g, ' ').trim() : undefined;

// Resolve a relative S3 path into an absolute URL using the tenant base.
// Absolute URLs (news images already are) pass through untouched.
const resolveImage = (
  raw?: string | null,
  baseUrl?: string,
): string | null => {
  if (!raw) return null;
  if (/^https?:\/\//.test(raw)) return raw;
  if (!baseUrl) return null;
  return `${baseUrl.replace(/\/$/, '')}/${raw.replace(/^\//, '')}`;
};

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// "Jun 9, 2026, 4:08:25 AM" — manual format so we don't depend on Hermes Intl.
const formatDate = (iso?: string): string | undefined => {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  const date = `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  const h24 = d.getHours();
  const ampm = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 || 12;
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${date}, ${h12}:${mm}:${ss} ${ampm}`;
};

// The asset a report points at: an external URL or an uploaded file.
const reportLink = (r: ReportDownload): string | undefined =>
  r.uploadType === 'external_url' && r.externalUrl
    ? r.externalUrl
    : r.file?.objectUrl || r.externalUrl || undefined;

export function ResourcesSection({token, logoBaseUrl, primaryColor}: Props) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>('news');
  const [news, setNews] = useState<ResourceNews[]>([]);
  const [reports, setReports] = useState<ReportDownload[]>([]);
  const [videos, setVideos] = useState<ResourceVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    resourcesService
      .getDashboardContent(token)
      .then(res => {
        if (cancelled) return;
        setNews(res.data?.news?.results ?? []);
        setReports(res.data?.reportDownloads ?? []);
        setVideos(res.data?.videos ?? []);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load resources.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const openUrl = useCallback(
    (url?: string | null) => {
      if (!url) {
        toast.info('This item has no link to open.');
        return;
      }
      Linking.openURL(url).catch(() => toast.error('Couldn’t open the link.'));
    },
    [toast],
  );

  // TODO(preferences): wire to the real "update news preferences" endpoint
  // (category / keyword selection) once it's available.
  const onUpdatePreferences = useCallback(() => {
    toast.info('Preference settings are coming soon.');
  }, [toast]);

  const renderActiveList = () => {
    if (loading) {
      return (
        <View style={styles.stateBox}>
          <ActivityIndicator color={primaryColor} />
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.stateBox}>
          <Icon name="alert-circle-outline" size={28} color="#94a3b8" />
          <Text style={styles.stateText}>{error}</Text>
        </View>
      );
    }

    if (activeTab === 'news') {
      if (!news.length) return renderEmpty('No news right now.');
      return news.map(item => (
        <ResourceCard
          key={item.id}
          imageUrl={resolveImage(item.image, logoBaseUrl)}
          title={item.title}
          subtitle={snippet(item.body)}
          source={item.source_title}
          date={formatDate(item.dateTimePub)}
          tags={item.category?.name ? [item.category.name] : undefined}
          onPress={() => openUrl(item.url)}
        />
      ));
    }

    if (activeTab === 'reports') {
      if (!reports.length) return renderEmpty('No reports available.');
      return reports.map(item => (
        <ResourceCard
          key={item.id}
          imageUrl={resolveImage(item.thumbNailImage, logoBaseUrl)}
          title={item.title}
          subtitle={item.description}
          source={item.courtesy}
          date={formatDate(item.createdAt)}
          tags={item.industries}
          onPress={() => openUrl(reportLink(item))}
        />
      ));
    }

    // videos
    if (!videos.length) return renderEmpty('No videos available.');
    return videos.map(item => (
      <ResourceCard
        key={item.id}
        imageUrl={resolveImage(item.thumbNailImage, logoBaseUrl)}
        title={item.title ?? 'Untitled video'}
        date={formatDate(item.createdAt)}
        isVideo
        onPress={() => openUrl(item.videoUrl || item.url)}
      />
    ));
  };

  const renderEmpty = (message: string) => (
    <View style={styles.stateBox}>
      <Icon name="inbox-outline" size={28} color="#94a3b8" />
      <Text style={styles.stateText}>{message}</Text>
    </View>
  );

  return (
    <View style={styles.section}>
      {/* Title + tab strip. Tabs scroll horizontally so the long
          "Reports & Downloads" label never clips on narrow screens. */}
      <Text style={styles.heading}>Resources</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsStrip}
        contentContainerStyle={styles.tabsRow}>
        {TABS.map(tab => {
          const isActive = tab.key === activeTab;
          return (
            <Pressable
              key={tab.key}
              style={[
                styles.tab,
                isActive && {borderBottomColor: primaryColor},
              ]}
              onPress={() => setActiveTab(tab.key)}
              accessibilityRole="button"
              accessibilityLabel={tab.label}>
              <Text
                style={[
                  styles.tabText,
                  isActive && [styles.tabTextActive, {color: primaryColor}],
                ]}
                numberOfLines={1}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* "Latest …" subheading + Update Preferences button */}
      <View style={styles.subHeaderRow}>
        <Text style={styles.subHeading}>{SUBHEADING[activeTab]}</Text>
        <Pressable
          style={({pressed}) => [
            styles.prefsButton,
            {backgroundColor: primaryColor},
            pressed && styles.pressed,
          ]}
          onPress={onUpdatePreferences}
          accessibilityRole="button"
          accessibilityLabel="Update preferences">
          <Text style={styles.prefsButtonText}>Update Preferences</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        nestedScrollEnabled
        showsVerticalScrollIndicator>
        {renderActiveList()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: radii.xl,
    borderWidth: 1,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  heading: {
    color: '#0f172a',
    fontSize: typography.title,
    fontWeight: '800',
  },
  prefsButton: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  prefsButtonText: {
    color: '#ffffff',
    fontSize: typography.small,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
  tabsStrip: {
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    flexGrow: 0,
    marginTop: spacing.md,
  },
  tabsRow: {
    flexDirection: 'row',
  },
  tab: {
    borderBottomColor: 'transparent',
    borderBottomWidth: 2,
    marginRight: spacing.lg,
    paddingBottom: spacing.sm,
  },
  subHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  subHeading: {
    color: '#0f172a',
    fontSize: typography.subhead,
    fontWeight: '800',
  },
  tabText: {
    color: '#64748b',
    fontSize: typography.body,
    fontWeight: '600',
  },
  tabTextActive: {
    fontWeight: '700',
  },
  list: {
    // Bounded height so the cards scroll *within* the Resources card instead
    // of stretching the whole dashboard. ~3 cards visible at a time.
    marginTop: spacing.lg,
    maxHeight: 360,
  },
  listContent: {
    paddingBottom: spacing.xs,
  },
  stateBox: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
  },
  stateText: {
    color: '#94a3b8',
    fontSize: typography.small,
    textAlign: 'center',
  },
});
