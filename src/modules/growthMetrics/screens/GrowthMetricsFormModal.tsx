import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {Icon} from '../../../core/components/Icon';
import {
  MetricBlock,
  MetricTypeDef,
  growthMetricsService,
} from '../services/growthMetrics.service';

type Props = {
  visible: boolean;
  block: MetricBlock | null;
  currency?: string;
  primaryColor: string;
  token: string;
  onClose: () => void;
  onSuccess: () => void;
};

function parseQuarterToDate(blockDate: string): string {
  const monthMap: Record<string, number> = {
    Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
    Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
  };
  const match = blockDate.match(/^(\d{4})-\d+\s+Q\d+\s+([A-Z][a-z]{2})-/);
  if (match) {
    const baseYear = parseInt(match[1], 10);
    const startMonth = monthMap[match[2]] ?? 1;
    const year = startMonth <= 3 ? baseYear + 1 : baseYear;
    return `${year}-${String(startMonth).padStart(2, '0')}-01`;
  }
  return blockDate;
}

function blockDateLabel(blockDate: string): string {
  const match = blockDate.match(/^(\S+)\s+(Q\d+)\s+(.+)$/);
  if (match) return `${match[2]} ${match[1]} (${match[3].replace('-', ' - ')})`;
  return blockDate;
}

function fieldLabel(t: MetricTypeDef, currency?: string): string {
  if (t.numberFormatType === 'currency') return `${t.title} (in ${currency || '$'})`;
  if (t.numberFormatType === 'percentage') return `${t.title} (in %)`;
  return t.title;
}

export function GrowthMetricsFormModal({
  visible,
  block,
  currency,
  primaryColor,
  token,
  onClose,
  onSuccess,
}: Props) {
  const [metricTypes, setMetricTypes] = useState<MetricTypeDef[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [values, setValues] = useState<Record<number, string>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const allExisting = block ? [...block.list, ...block.programSpecific] : [];
  const isEditing = allExisting.length > 0;

  // Fetch metric type definitions whenever the modal opens
  useEffect(() => {
    if (!visible || !token) return;
    setFieldsLoading(true);
    growthMetricsService
      .getMetricTypes(token)
      .then(types => {
        setMetricTypes(types || []);
      })
      .catch(() => {})
      .finally(() => setFieldsLoading(false));
  }, [visible, token]);

  // Pre-fill values once types are loaded
  useEffect(() => {
    if (!visible || !block || metricTypes.length === 0) return;
    const init: Record<number, string> = {};
    metricTypes.forEach(t => {
      const found = allExisting.find(item => item.metricType.id === t.id);
      init[t.id] = found?.metricValue != null ? String(found.metricValue) : '';
    });
    setValues(init);
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, metricTypes]);

  const setValue = (id: number, val: string) => {
    setValues(prev => ({...prev, [id]: val}));
    if (errors[id]) setErrors(prev => ({...prev, [id]: ''}));
  };

  const toggleCheckbox = (id: number, option: string) => {
    const current = (values[id] || '').split(',').filter(Boolean);
    const next = current.includes(option)
      ? current.filter(v => v !== option)
      : [...current, option];
    setValue(id, next.join(','));
  };

  const validate = (): boolean => {
    const errs: Record<number, string> = {};
    metricTypes.forEach(t => {
      if (t.isMandatory && !values[t.id]) {
        errs[t.id] = `${t.title} is required`;
      }
      if (
        t.fieldType === 'number_input' &&
        values[t.id] &&
        isNaN(Number(values[t.id]))
      ) {
        errs[t.id] = 'Please enter a valid number';
      }
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!block || !validate()) return;
    setSubmitting(true);
    try {
      const date = parseQuarterToDate(block.date);
      const result = metricTypes.map(t => ({
        metricTypeId: t.id,
        date,
        metricValue: values[t.id] || null,
      }));

      if (isEditing) {
        const patchData = allExisting.map(item => ({
          metricUUID: item.uuid,
          metricValue: values[item.metricType.id!] ?? null,
        }));
        const toAdd = result.filter(
          r => !allExisting.find(e => e.metricType.id === r.metricTypeId),
        );
        if (patchData.length) {
          await growthMetricsService.patchMetrics(token, patchData);
        }
        if (toAdd.length) {
          await growthMetricsService.saveMetrics(token, toAdd);
        }
      } else {
        await growthMetricsService.saveMetrics(token, result);
      }

      onSuccess();
    } catch {
      // API errors handled by service layer
    } finally {
      setSubmitting(false);
    }
  };

  if (!block) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          style={styles.sheet}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle} numberOfLines={2}>
              {`${isEditing ? 'Edit' : 'Submit'} metrics - ${blockDateLabel(block.date)}`}
            </Text>
            <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
              <Icon name="close" size={18} color="#475569" />
            </Pressable>
          </View>

          {/* Body */}
          <ScrollView
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {/* Info alert */}
            <View style={styles.alert}>
              <Text style={styles.alertText}>
                Please make sure all data provided is accurate and valid, as
                you will not be able to make edit without requesting the admin.
              </Text>
            </View>

            {fieldsLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={primaryColor} />
                <Text style={styles.loadingText}>Loading fields…</Text>
              </View>
            ) : metricTypes.length === 0 ? (
              <Text style={styles.noFieldsText}>No metric fields available.</Text>
            ) : (
              metricTypes.map(t => {
                const label = fieldLabel(t, currency);
                const hasError = !!errors[t.id];
                const val = values[t.id] || '';

                if (t.fieldType === 'text_input') {
                  return (
                    <View key={t.id} style={styles.fieldGroup}>
                      <Text style={styles.label}>
                        {t.title}
                        {t.isMandatory ? (
                          <Text style={styles.required}> *</Text>
                        ) : null}
                      </Text>
                      <TextInput
                        style={[styles.input, hasError && styles.inputError]}
                        value={val}
                        onChangeText={v => setValue(t.id, v)}
                        placeholder={t.fieldPlaceholder || 'enter metric'}
                        placeholderTextColor="#94a3b8"
                      />
                      {hasError ? (
                        <Text style={styles.errorText}>{errors[t.id]}</Text>
                      ) : null}
                    </View>
                  );
                }

                if (t.fieldType === 'number_input') {
                  return (
                    <View key={t.id} style={styles.fieldGroup}>
                      <Text style={styles.label}>
                        {label}
                        {t.isMandatory ? (
                          <Text style={styles.required}> *</Text>
                        ) : null}
                      </Text>
                      {t.programs?.length ? (
                        <View style={styles.badges}>
                          {t.programs.map(p => (
                            <View key={p.uuid} style={styles.badge}>
                              <Text style={styles.badgeText}>
                                {p.programTitle}
                              </Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                      <TextInput
                        style={[styles.input, hasError && styles.inputError]}
                        value={val}
                        onChangeText={v => setValue(t.id, v)}
                        placeholder={t.fieldPlaceholder || 'enter metric'}
                        placeholderTextColor="#94a3b8"
                        keyboardType="numeric"
                      />
                      {hasError ? (
                        <Text style={styles.errorText}>{errors[t.id]}</Text>
                      ) : null}
                    </View>
                  );
                }

                if (t.fieldType === 'text_area') {
                  return (
                    <View key={t.id} style={styles.fieldGroup}>
                      <Text style={styles.label}>
                        {t.title}
                        {t.isMandatory ? (
                          <Text style={styles.required}> *</Text>
                        ) : null}
                      </Text>
                      <TextInput
                        style={[
                          styles.input,
                          styles.textArea,
                          hasError && styles.inputError,
                        ]}
                        value={val}
                        onChangeText={v => setValue(t.id, v)}
                        placeholder={t.fieldPlaceholder || ''}
                        placeholderTextColor="#94a3b8"
                        multiline
                        numberOfLines={4}
                      />
                      {hasError ? (
                        <Text style={styles.errorText}>{errors[t.id]}</Text>
                      ) : null}
                    </View>
                  );
                }

                if (t.fieldType === 'radio') {
                  const opts = (t.options || '')
                    .split(',')
                    .map(o => o.trim())
                    .filter(Boolean);
                  return (
                    <View key={t.id} style={styles.fieldGroup}>
                      <Text style={styles.label}>
                        {t.title}
                        {t.isMandatory ? (
                          <Text style={styles.required}> *</Text>
                        ) : null}
                      </Text>
                      <View style={styles.optionRow}>
                        {opts.map(opt => {
                          const selected = val === opt;
                          return (
                            <Pressable
                              key={opt}
                              onPress={() => setValue(t.id, opt)}
                              style={[
                                styles.optionBtn,
                                selected && {
                                  backgroundColor: primaryColor,
                                  borderColor: primaryColor,
                                },
                              ]}>
                              <Text
                                style={[
                                  styles.optionBtnText,
                                  selected && {color: '#fff'},
                                ]}>
                                {opt}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  );
                }

                if (t.fieldType === 'check_box') {
                  const opts = (t.options || '')
                    .split(',')
                    .map(o => o.trim())
                    .filter(Boolean);
                  const selectedVals = val.split(',').filter(Boolean);
                  return (
                    <View key={t.id} style={styles.fieldGroup}>
                      <Text style={styles.label}>
                        {t.title}
                        {t.isMandatory ? (
                          <Text style={styles.required}> *</Text>
                        ) : null}
                      </Text>
                      <View style={styles.optionRow}>
                        {opts.map(opt => {
                          const selected = selectedVals.includes(opt);
                          return (
                            <Pressable
                              key={opt}
                              onPress={() => toggleCheckbox(t.id, opt)}
                              style={[
                                styles.optionBtn,
                                selected && {
                                  backgroundColor: primaryColor,
                                  borderColor: primaryColor,
                                },
                              ]}>
                              <Text
                                style={[
                                  styles.optionBtnText,
                                  selected && {color: '#fff'},
                                ]}>
                                {opt}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  );
                }

                return null;
              })
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>CANCEL</Text>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              disabled={submitting || fieldsLoading}
              style={[
                styles.submitBtn,
                {backgroundColor: primaryColor},
                (submitting || fieldsLoading) && {opacity: 0.6},
              ]}>
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>SUBMIT</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Darkened full-screen backdrop
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  // Bottom sheet — fixed height so flex children work properly
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },

  header: {
    alignItems: 'flex-start',
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    color: '#1e293b',
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  closeBtn: {
    alignItems: 'center',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },

  bodyContent: {padding: 20, paddingBottom: 8},

  alert: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 20,
    padding: 14,
  },
  alertText: {color: '#1d4ed8', fontSize: 13, lineHeight: 18},

  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 20,
  },
  loadingText: {color: '#64748b', fontSize: 14},
  noFieldsText: {color: '#94a3b8', fontSize: 14, paddingVertical: 12},

  fieldGroup: {marginBottom: 18},
  label: {color: '#334155', fontSize: 13, fontWeight: '500', marginBottom: 6},
  required: {color: '#ef4444'},
  input: {
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    color: '#1e293b',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 11 : 9,
  },
  inputError: {borderColor: '#ef4444'},
  textArea: {height: 96, textAlignVertical: 'top'},
  errorText: {color: '#ef4444', fontSize: 12, marginTop: 4},

  badges: {flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 6},
  badge: {
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {color: '#64748b', fontSize: 11},

  optionRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4},
  optionBtn: {
    borderColor: '#cbd5e1',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  optionBtnText: {color: '#475569', fontSize: 13, fontWeight: '500'},

  footer: {
    alignItems: 'center',
    borderTopColor: '#e2e8f0',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  cancelBtn: {
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  cancelBtnText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  submitBtn: {
    alignItems: 'center',
    borderRadius: 8,
    minWidth: 90,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
