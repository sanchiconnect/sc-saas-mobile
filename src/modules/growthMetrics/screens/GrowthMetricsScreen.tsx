import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {Icon} from '../../../core/components/Icon';
import {colors} from '../../../core/theme/colors';
import {
  MetricBlock,
  MetricItem,
  ReviewConnection,
  growthMetricsService,
} from '../services/growthMetrics.service';

type Props = {
  token: string;
  primaryColor: string;
  accountType?: string;
  title?: string;
  currency?: string;
  onBack: () => void;
};

function formatValue(item: MetricItem, currency?: string): string {
  if (item.metricType?.fieldType !== 'number_input') {
    return String(item.metricValue ?? '—');
  }
  const val = Number(item.metricValue);
  if (isNaN(val) || item.metricValue === null) return '—';
  const fmt = val.toLocaleString();
  switch (item.metricType?.numberFormatType) {
    case 'currency':
      return `${currency || '$'}${fmt}`;
    case 'percentage':
      return `${fmt}%`;
    default:
      return fmt;
  }
}

export function GrowthMetricsScreen({
  token,
  primaryColor,
  accountType,
  title,
  currency,
  onBack,
}: Props) {
  const isStartup = (accountType || '').toLowerCase() === 'startup';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<MetricBlock[]>([]);
  const [reviews, setReviews] = useState<ReviewConnection[]>([]);
  const [selectedReview, setSelectedReview] = useState<ReviewConnection | null>(
    null,
  );

  const loadRevieweeMetrics = useCallback(
    async (uuid: string) => {
      setLoading(true);
      setError(null);
      try {
        const data = await growthMetricsService.getMetricsOfReviewee(
          token,
          uuid,
        );
        setMetrics(data);
      } catch {
        setError('Failed to load metrics.');
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (isStartup) {
      setLoading(true);
      growthMetricsService
        .getMetrics(token)
        .then(setMetrics)
        .catch(() => setError('Failed to load metrics.'))
        .finally(() => setLoading(false));
    } else {
      growthMetricsService
        .getReviews(token)
        .then(async data => {
          setReviews(data);
          if (data[0]) {
            setSelectedReview(data[0]);
            await loadRevieweeMetrics(data[0].uuid);
          } else {
            setLoading(false);
          }
        })
        .catch(() => {
          setError('Failed to load connections.');
          setLoading(false);
        });
    }
  }, [isStartup, token, loadRevieweeMetrics]);

  const hasMetrics = metrics.some(
    b => b.list.length > 0 || b.programSpecific.length > 0,
  );

  return (
    <View style={styles.page}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable
          onPress={onBack}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({pressed}) => [
            styles.iconBtn,
            pressed && {opacity: 0.5, backgroundColor: colors.border},
          ]}>
          <Icon name="arrow-left" size={24} color="#475569" />
        </Pressable>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {title || 'Growth Metrics'}
        </Text>
      </View>

      {/* Connection picker for non-startup */}
      {!isStartup && reviews.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pickerRow}
          style={styles.pickerBar}>
          {reviews.map(r => {
            const isActive = selectedReview?.uuid === r.uuid;
            return (
              <Pressable
                key={r.uuid}
                onPress={() => {
                  setSelectedReview(r);
                  loadRevieweeMetrics(r.uuid);
                }}
                style={[
                  styles.pickerChip,
                  isActive && {backgroundColor: primaryColor},
                ]}>
                <Text
                  style={[
                    styles.pickerChipText,
                    isActive && {color: '#ffffff'},
                  ]}>
                  {r.companyName || r.name || r.uuid}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Icon name="alert-circle-outline" size={40} color="#f87171" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            onPress={() => {
              if (isStartup) {
                setLoading(true);
                growthMetricsService
                  .getMetrics(token)
                  .then(setMetrics)
                  .catch(() => setError('Failed to load metrics.'))
                  .finally(() => setLoading(false));
              } else if (selectedReview) {
                loadRevieweeMetrics(selectedReview.uuid);
              }
            }}
            style={[styles.retryBtn, {borderColor: primaryColor}]}>
            <Text style={[styles.retryBtnText, {color: primaryColor}]}>
              Retry
            </Text>
          </Pressable>
        </View>
      ) : !hasMetrics ? (
        <View style={styles.centered}>
          <Icon name="chart-line" size={48} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>No metrics found</Text>
          <Text style={styles.emptySubtitle}>
            {isStartup
              ? 'Add your first metrics to start tracking growth.'
              : 'No metric data is available for this connection.'}
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}>
          {metrics.map((block, bi) => {
            const allItems = [...block.list, ...block.programSpecific];
            if (allItems.length === 0) return null;
            return (
              <View key={bi} style={styles.block}>
                {/* Period header */}
                <View style={[styles.blockHeader, {backgroundColor: primaryColor + '18'}]}>
                  <Icon name="calendar-month-outline" size={15} color={primaryColor} />
                  <Text style={[styles.blockDate, {color: primaryColor}]}>
                    {block.date}
                  </Text>
                </View>

                {/* All metrics grid */}
                {block.list.length > 0 ? (
                  <>
                    <View style={styles.sectionLabelRow}>
                      <Text style={styles.sectionLabel}>All metrics</Text>
                    </View>
                    <MetricsGrid
                      items={block.list}
                      primaryColor={primaryColor}
                      currency={currency}
                    />
                  </>
                ) : null}

                {/* Program specifics */}
                {block.programSpecific.length > 0 ? (
                  <>
                    <View style={styles.sectionLabelRow}>
                      <Text style={styles.sectionLabel}>Program Specifics</Text>
                    </View>
                    <MetricsGrid
                      items={block.programSpecific}
                      primaryColor={primaryColor}
                      currency={currency}
                    />
                  </>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

function MetricsGrid({
  items,
  primaryColor,
  currency,
}: {
  items: MetricItem[];
  primaryColor: string;
  currency?: string;
}) {
  return (
    <View style={styles.grid}>
      {items.map((item, i) => (
        <View key={i} style={styles.metricCell}>
          <Text style={styles.metricLabel} numberOfLines={3}>
            {item.metricType?.title}
          </Text>
          <Text style={[styles.metricValue, {color: primaryColor}]}>
            {formatValue(item, currency)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {flex: 1, backgroundColor: '#f1f5f9'},

  topBar: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  iconBtn: {
    alignItems: 'center',
    borderRadius: 10,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  topBarTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
  },

  pickerBar: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexGrow: 0,
  },
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pickerChip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    flexShrink: 0,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pickerChipText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },

  centered: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 32,
  },
  errorText: {color: '#ef4444', fontSize: 14, textAlign: 'center'},
  emptyTitle: {
    color: '#475569',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  retryBtn: {
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  retryBtnText: {fontSize: 14, fontWeight: '600'},

  content: {gap: 16, padding: 16},

  block: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    elevation: 2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  blockHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  blockDate: {fontSize: 14, fontWeight: '700'},

  sectionLabelRow: {
    backgroundColor: '#f8fafc',
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    borderTopColor: '#e2e8f0',
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  sectionLabel: {color: '#64748b', fontSize: 12, fontWeight: '600'},

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  metricCell: {
    alignItems: 'center',
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    borderRightColor: '#e2e8f0',
    borderRightWidth: 1,
    justifyContent: 'center',
    padding: 14,
    width: '33.33%',
  },
  metricLabel: {
    color: '#64748b',
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 6,
    textAlign: 'center',
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
});
