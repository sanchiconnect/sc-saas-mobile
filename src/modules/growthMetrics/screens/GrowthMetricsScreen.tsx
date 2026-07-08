import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {Icon} from '../../../core/components/Icon';
import {colors} from '../../../core/theme/colors';
import {
  MetricBlock,
  MetricChart,
  MetricItem,
  ReviewConnection,
  growthMetricsService,
} from '../services/growthMetrics.service';
import {GrowthMetricsFormModal} from './GrowthMetricsFormModal';

type Props = {
  token: string;
  primaryColor: string;
  accountType?: string;
  title?: string;
  currency?: string;
  onBack: () => void;
};

type TabId = 'table' | 'chart';

function formatBlockDate(raw: string): string {
  const match = raw.match(/^(\S+)\s+(Q\d+)\s+(.+)$/);
  if (match) {
    const [, year, quarter, months] = match;
    return `${quarter} ${year} (${months.replace('-', ' - ')})`;
  }
  return raw;
}

function formatValue(item: MetricItem, currency?: string): string {
  if (item.metricType?.fieldType !== 'number_input') {
    return String(item.metricValue ?? '—');
  }
  const val = Number(item.metricValue);
  if (isNaN(val) || item.metricValue === null) return '—';
  const fmt = val.toLocaleString();
  switch (item.metricType?.numberFormatType) {
    case 'currency':
      return `${currency || '$'} ${fmt}`;
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
  const [activeTab, setActiveTab] = useState<TabId>('table');
  const [formBlock, setFormBlock] = useState<MetricBlock | null>(null);
  const [charts, setCharts] = useState<MetricChart[]>([]);
  const [chartsLoading, setChartsLoading] = useState(false);
  const [requestEditBlock, setRequestEditBlock] = useState<MetricBlock | null>(null);
  const [requestEditMsg, setRequestEditMsg] = useState('');
  const [requestEditSending, setRequestEditSending] = useState(false);

  const reloadStartupMetrics = useCallback(() => {
    setLoading(true);
    setCharts([]); // reset so chart tab re-fetches fresh data
    growthMetricsService
      .getMetrics(token)
      .then(setMetrics)
      .catch(() => setError('Failed to load metrics.'))
      .finally(() => setLoading(false));
  }, [token]);

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

  // Lazy-load chart data when Chart View tab is opened
  useEffect(() => {
    if (activeTab !== 'chart') return;
    if (charts.length > 0 || chartsLoading) return;
    setChartsLoading(true);
    const fetchCharts = isStartup
      ? growthMetricsService.getCharts(token)
      : selectedReview
      ? growthMetricsService.getRevieweeCharts(token, selectedReview.uuid)
      : Promise.resolve([]);
    fetchCharts
      .then(data => setCharts(data.filter(c => c.data.length > 0)))
      .catch(() => {})
      .finally(() => setChartsLoading(false));
  }, [activeTab, isStartup, token, selectedReview, charts.length, chartsLoading]);

  const handleRequestEdit = (block: MetricBlock) => {
    setRequestEditMsg('');
    setRequestEditBlock(block);
  };

  const submitRequestEdit = async () => {
    if (!requestEditBlock) return;
    setRequestEditSending(true);
    try {
      const allItems = [
        ...requestEditBlock.list,
        ...requestEditBlock.programSpecific,
      ];
      await growthMetricsService.requestUpdate(token, {
        message: requestEditMsg,
        metricsUUID: allItems.map(item => item.uuid),
      });
      setMetrics(prev =>
        prev.map(b =>
          b === requestEditBlock
            ? {
                ...b,
                list: b.list.map((item, i) =>
                  i === 0 ? {...item, requestEdit: true} : item,
                ),
              }
            : b,
        ),
      );
      setRequestEditBlock(null);
    } catch {
      // silent
    } finally {
      setRequestEditSending(false);
    }
  };

  const hasAnyData = metrics.some(
    b => b.list.length > 0 || b.programSpecific.length > 0,
  );

  const retryLoad = () => {
    setError(null);
    if (isStartup) {
      reloadStartupMetrics();
    } else if (selectedReview) {
      loadRevieweeMetrics(selectedReview.uuid);
    }
  };

  return (
    <View style={styles.page}>
      {/* Title bar */}
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

      {/* Table / Chart tabs */}
      <View style={styles.tabBar}>
        {(['table', 'chart'] as TabId[]).map(tab => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[
              styles.tabBtn,
              activeTab === tab && {
                backgroundColor: primaryColor,
                borderColor: primaryColor,
              },
            ]}>
            <Text
              style={[
                styles.tabBtnText,
                activeTab === tab && styles.tabBtnTextActive,
              ]}>
              {tab === 'table' ? 'Table View' : 'Chart View'}
            </Text>
          </Pressable>
        ))}
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
            onPress={retryLoad}
            style={[styles.retryBtn, {borderColor: primaryColor}]}>
            <Text style={[styles.retryBtnText, {color: primaryColor}]}>
              Retry
            </Text>
          </Pressable>
        </View>
      ) : metrics.length === 0 ? (
        <View style={styles.centered}>
          <Icon name="chart-line" size={48} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>No metrics found</Text>
          <Text style={styles.emptySubtitle}>
            {isStartup
              ? 'No metric data available yet.'
              : 'No metric data is available for this connection.'}
          </Text>
        </View>
      ) : activeTab === 'chart' ? (
        chartsLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={primaryColor} />
          </View>
        ) : charts.length === 0 ? (
          <View style={styles.centered}>
            <Icon name="chart-bar" size={48} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No chart data</Text>
            <Text style={styles.emptySubtitle}>
              Submit metrics to see charts.
            </Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}>
            {charts.map(chart => (
              <ChartCard
                key={chart.id}
                chart={chart}
                primaryColor={primaryColor}
                currency={currency}
              />
            ))}
          </ScrollView>
        )
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}>
          {metrics.map((block, bi) => {
            const hasData =
              block.list.length > 0 || block.programSpecific.length > 0;
            const label = formatBlockDate(block.date);

            if (!hasData) {
              if (!isStartup) return null;
              return (
                <View key={bi} style={styles.emptyBlock}>
                  <View style={styles.emptyBlockLeft}>
                    <Text style={styles.emptyBlockDate}>{label}</Text>
                    <Icon
                      name="alert-circle-outline"
                      size={20}
                      color="#ef4444"
                    />
                  </View>
                  <Pressable
                    style={styles.addBtn}
                    onPress={() => setFormBlock(block)}>
                    <Text style={styles.addBtnText}>+ Add</Text>
                  </Pressable>
                </View>
              );
            }

            const canEdit = block.list[0]?.canEdit;
            const requestEdit = block.list[0]?.requestEdit;

            return (
              <View key={bi} style={styles.block}>
                <View style={styles.blockHeader}>
                  <Text style={styles.blockDate} numberOfLines={1}>
                    {label}
                  </Text>
                  <Icon
                    name="check-circle"
                    size={18}
                    color="#22c55e"
                    style={styles.checkIcon}
                  />
                  {isStartup ? (
                    <Pressable
                      onPress={() => {
                        if (canEdit) {
                          setFormBlock(block);
                        } else if (!requestEdit) {
                          handleRequestEdit(block);
                        }
                      }}
                      style={[
                        styles.editBtn,
                        canEdit
                          ? {backgroundColor: '#22c55e'}
                          : requestEdit
                          ? {backgroundColor: '#6b7280'}
                          : {backgroundColor: primaryColor},
                      ]}>
                      <Text style={styles.editBtnText}>
                        {canEdit
                          ? 'Edit Data'
                          : requestEdit
                          ? 'Request Sent'
                          : 'Request Edit'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>

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

          {isStartup && hasAnyData ? (
            <Text style={styles.footnote}>
              Data since your startup profile got approved on the platform
            </Text>
          ) : null}
        </ScrollView>
      )}

      {/* Add / Edit form modal */}
      <GrowthMetricsFormModal
        visible={formBlock !== null}
        block={formBlock}
        currency={currency}
        primaryColor={primaryColor}
        token={token}
        onClose={() => setFormBlock(null)}
        onSuccess={() => {
          setFormBlock(null);
          reloadStartupMetrics();
        }}
      />

      {/* Request Edit dialog */}
      <Modal
        transparent
        animationType="fade"
        visible={requestEditBlock !== null}
        statusBarTranslucent
        onRequestClose={() => !requestEditSending && setRequestEditBlock(null)}>
        <View style={styles.reqEditOverlay}>
          <View style={styles.reqEditDialog}>
            <Text style={styles.reqEditTitle}>Request edit</Text>
            <TextInput
              style={styles.reqEditInput}
              placeholder="Enter reason to edit..."
              placeholderTextColor="#94a3b8"
              multiline
              textAlignVertical="top"
              value={requestEditMsg}
              onChangeText={setRequestEditMsg}
              editable={!requestEditSending}
            />
            <View style={styles.reqEditFooter}>
              <Pressable
                style={[styles.reqEditBtn, {backgroundColor: primaryColor}]}
                onPress={submitRequestEdit}
                disabled={requestEditSending}>
                {requestEditSending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.reqEditBtnText}>Send Request</Text>
                )}
              </Pressable>
              <Pressable
                style={[styles.reqEditBtn, styles.reqEditCancelBtn]}
                onPress={() => setRequestEditBlock(null)}
                disabled={requestEditSending}>
                <Text style={[styles.reqEditBtnText, {color: '#374151'}]}>
                  Cancel
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
            {item.metricType?.numberFormatType === 'currency'
              ? ` (in ${currency || '$'})`
              : item.metricType?.numberFormatType === 'percentage'
              ? ' (in %)'
              : ''}
          </Text>
          <Text style={[styles.metricValue, {color: primaryColor}]}>
            {formatValue(item, currency)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const CHART_H = 168;
const Y_AXIS_W = 52;

// Compute "nice" round Y-axis ticks from a raw maximum value.
// Targets ~5 intervals so labels stay readable on mobile.
function calcTicks(maxVal: number): {niceTop: number; ticks: number[]} {
  if (maxVal <= 0) return {niceTop: 5, ticks: [5, 4, 3, 2, 1, 0]};
  const rawStep = maxVal / 5;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const niceStep = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  const step = niceStep * mag;
  const niceTop = Math.ceil(maxVal / step) * step;
  const count = Math.round(niceTop / step);
  return {
    niceTop,
    ticks: Array.from({length: count + 1}, (_, i) => niceTop - i * step),
  };
}

function fmtYVal(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(Math.round(v));
}

function chartTypeIcon(t: string): string {
  if (t === 'bar') return 'chart-bar';
  if (t === 'radar') return 'radar';
  return 'chart-line';
}

const BAR_COLOR = 'rgba(147, 197, 253, 0.85)';
const BAR_SELECTED_COLOR = 'rgba(59, 130, 246, 0.8)';
const TOOLTIP_W = 152;

function ChartCard({
  chart,
}: {
  chart: MetricChart;
  primaryColor?: string;
  currency?: string;
}) {
  const vals = chart.data.map(d => Number(d.metricValue) || 0);
  const maxVal = Math.max(...vals, 1);
  const {niceTop, ticks} = calcTicks(maxVal);
  const n = ticks.length;

  const [selectedBar, setSelectedBar] = useState<number | null>(null);
  const [plotWidth, setPlotWidth] = useState(0);

  // One Animated.Value per bar — recreate when bar count changes
  const animsRef = useRef<Animated.Value[]>([]);
  if (animsRef.current.length !== vals.length) {
    animsRef.current = vals.map(() => new Animated.Value(0));
  }
  const anims = animsRef.current;

  // Animate bars growing upward on mount; re-mounts on each tab switch
  useEffect(() => {
    anims.forEach(a => a.setValue(0));
    Animated.stagger(
      55,
      anims.map(a =>
        Animated.timing(a, {
          toValue: 1,
          duration: 480,
          useNativeDriver: false,
        }),
      ),
    ).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compute tooltip horizontal position, clamped inside the card
  const tooltipLeft = (idx: number): number => {
    if (plotWidth === 0 || vals.length === 0) return Y_AXIS_W;
    const slotW = plotWidth / vals.length;
    const center = Y_AXIS_W + (idx + 0.5) * slotW;
    return Math.max(4, Math.min(center - TOOLTIP_W / 2, Y_AXIS_W + plotWidth - TOOLTIP_W - 4));
  };

  // Tooltip vertical position: above bar top, clamped to ≥ 4px from top
  const tooltipTop = (idx: number): number => {
    const barH = Math.max(Math.round((vals[idx] / niceTop) * (CHART_H - 2)), vals[idx] > 0 ? 3 : 0);
    return Math.max(4, CHART_H - barH - 58);
  };

  return (
    <View style={styles.chartCard}>
      {/* Gray header */}
      <View style={[styles.chartHeader, {backgroundColor: '#919294'}]}>
        <Text style={styles.chartTitle}>{chart.title}</Text>
        <View style={styles.chartTypeTag}>
          <Icon name={chartTypeIcon(chart.chartType)} size={13} color="#fff" />
          <Text style={styles.chartTypeText}>{chart.chartType}</Text>
        </View>
      </View>

      <View style={styles.chartBody}>
        {chart.data.length === 0 ? (
          <View style={{alignItems: 'center', paddingVertical: 20}}>
            <Text style={{color: '#94a3b8', fontSize: 13}}>No data available</Text>
          </View>
        ) : (
          /* Relative container so tooltip can be absolutely positioned */
          <Pressable onPress={() => setSelectedBar(null)}>
            <View style={{flexDirection: 'row'}}>
              {/* Y-axis — space-between aligns labels with grid lines */}
              <View style={{
                alignItems: 'flex-end',
                height: CHART_H,
                justifyContent: 'space-between',
                paddingRight: 5,
                width: Y_AXIS_W,
              }}>
                {ticks.map((tick, i) => (
                  <Text key={i} style={styles.yAxisLabel}>
                    {fmtYVal(tick)}
                  </Text>
                ))}
              </View>

              {/* Plot area */}
              <View
                style={{flex: 1, height: CHART_H}}
                onLayout={e => setPlotWidth(e.nativeEvent.layout.width)}>
                {/* Horizontal grid lines */}
                {ticks.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.gridLine,
                      {
                        backgroundColor: i === n - 1 ? '#94a3b8' : '#e2e8f0',
                        height: i === n - 1 ? 2 : 1,
                        top: Math.round((i / (n - 1)) * (CHART_H - 1)),
                      },
                    ]}
                  />
                ))}

                {/* Animated bars growing upward from baseline */}
                <View style={{
                  alignItems: 'flex-end',
                  bottom: 2,
                  flexDirection: 'row',
                  left: 0,
                  position: 'absolute',
                  right: 0,
                  top: 0,
                }}>
                  {vals.map((v, i) => {
                    const targetH = Math.max(
                      Math.round((v / niceTop) * (CHART_H - 2)),
                      v > 0 ? 3 : 0,
                    );
                    return (
                      <Pressable
                        key={i}
                        style={{alignItems: 'center', flex: 1, justifyContent: 'flex-end', height: '100%'}}
                        onPress={() => setSelectedBar(selectedBar === i ? null : i)}>
                        <Animated.View
                          style={{
                            backgroundColor: selectedBar === i ? BAR_SELECTED_COLOR : BAR_COLOR,
                            borderTopLeftRadius: 3,
                            borderTopRightRadius: 3,
                            height: anims[i].interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, targetH],
                            }),
                            width: '72%',
                          }}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* X-axis labels */}
            <View style={{flexDirection: 'row', marginTop: 6, paddingLeft: Y_AXIS_W}}>
              {chart.data.map((point, i) => (
                <Text key={i} style={[styles.xAxisLabel, {flex: 1}]} numberOfLines={2}>
                  {point.formattedDate}
                </Text>
              ))}
            </View>

            {/* Floating tooltip — shown when a bar is tapped */}
            {selectedBar !== null && (
              <View style={[
                styles.chartTooltip,
                {left: tooltipLeft(selectedBar), top: tooltipTop(selectedBar)},
              ]}>
                <Text style={styles.chartTooltipDate}>
                  {chart.data[selectedBar]?.formattedDate}
                </Text>
                <View style={styles.chartTooltipRow}>
                  <View style={[styles.chartTooltipDot, {backgroundColor: BAR_SELECTED_COLOR}]} />
                  <Text style={styles.chartTooltipVal} numberOfLines={1}>
                    {chart.title}: {Number(vals[selectedBar]).toLocaleString()}
                  </Text>
                </View>
              </View>
            )}
          </Pressable>
        )}
      </View>
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

  tabBar: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tabBtn: {
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  tabBtnText: {color: '#475569', fontSize: 13, fontWeight: '600'},
  tabBtnTextActive: {color: '#ffffff'},

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
  pickerChipText: {color: colors.textMuted, fontSize: 13, fontWeight: '700'},

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

  emptyBlock: {
    alignItems: 'center',
    borderColor: '#94a3b8',
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  emptyBlockLeft: {alignItems: 'center', flexDirection: 'row', gap: 8},
  emptyBlockDate: {color: '#334155', fontSize: 15, fontWeight: '700'},
  addBtn: {
    backgroundColor: '#22c55e',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

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
    backgroundColor: '#919294',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  blockDate: {color: '#ffffff', flex: 1, fontSize: 15, fontWeight: '700'},
  checkIcon: {marginHorizontal: 6},
  editBtn: {
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  editBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },

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

  grid: {flexDirection: 'row', flexWrap: 'wrap'},
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
  metricValue: {fontSize: 15, fontWeight: '800', textAlign: 'center'},

  footnote: {
    color: '#94a3b8',
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
  },

  // Chart card
  chartCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    elevation: 2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  chartHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chartTitle: {color: '#ffffff', fontSize: 15, fontWeight: '700', flex: 1},
  chartTypeTag: {alignItems: 'center', flexDirection: 'row', gap: 4},
  chartTypeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  chartBody: {padding: 14, paddingBottom: 12},
  gridLine: {position: 'absolute', left: 0, right: 0},
  yAxisLabel: {color: '#94a3b8', fontSize: 9, lineHeight: 13},
  xAxisLabel: {color: '#64748b', fontSize: 9, textAlign: 'center'},
  chartTooltip: {
    backgroundColor: 'rgba(30, 41, 59, 0.92)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    position: 'absolute',
    width: TOOLTIP_W,
    zIndex: 10,
  },
  chartTooltipDate: {color: '#f1f5f9', fontSize: 11, fontWeight: '700', marginBottom: 3},
  chartTooltipRow: {alignItems: 'center', flexDirection: 'row', gap: 5},
  chartTooltipDot: {borderRadius: 2, height: 10, width: 10},
  chartTooltipVal: {color: '#e2e8f0', flex: 1, fontSize: 11},

  // Request Edit dialog
  reqEditOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  reqEditDialog: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
  },
  reqEditTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  reqEditInput: {
    borderColor: '#93c5fd',
    borderRadius: 8,
    borderWidth: 1.5,
    color: '#111827',
    fontSize: 14,
    height: 100,
    marginBottom: 20,
    padding: 12,
  },
  reqEditFooter: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  reqEditBtn: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    paddingVertical: 12,
  },
  reqEditCancelBtn: {backgroundColor: '#9ca3af'},
  reqEditBtnText: {color: '#fff', fontSize: 14, fontWeight: '700'},
});
