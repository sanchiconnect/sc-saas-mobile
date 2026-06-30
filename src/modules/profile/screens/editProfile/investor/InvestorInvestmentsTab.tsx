import React, {forwardRef, useEffect, useImperativeHandle, useRef, useState} from 'react';
import {StyleSheet, Switch, Text, TextInput, View} from 'react-native';

import {AppTextField} from '../../../../../core/components/AppTextField';
import {useToast} from '../../../../../core/toast/ToastProvider';
import {authService} from '../../../../auth/services/auth.service';

import {
  MultiSelectField,
  MultiSelectOption,
} from '../shared/MultiSelectField';
import {ProfileTabCard} from '../shared/ProfileTabCard';

import type {SecondaryTabHandle} from '../mentor/MentorDomainExpertiseTab';

type Props = {
  token: string;
  primaryColor: string;
  initialData: Record<string, any> | null;
  industryOptions: MultiSelectOption[];
  mechanismOptions: MultiSelectOption[];
  stageOptions: MultiSelectOption[];
  preferenceOptions: MultiSelectOption[];
  abilityMetricOptions: MultiSelectOption[];
  businessModelOptions: MultiSelectOption[];
  maxAbilityMetrics?: number;
  maxIndustries?: number;
  onSaveSuccess?: () => void;
  onValidChange?: (valid: boolean) => void;
};

type Form = {
  ticketSizeMin: string;
  ticketSizeMax: string;
  turnAroundTime: string;
  industries: Array<number | string>;
  industrySubCategories: Array<number | string>;
  otherIndustriesActive: boolean;
  otherIndustriesText: string;
  mechanisms: Array<number | string>;
  stages: Array<number | string>;
  preferences: Array<number | string>;
  abilityMetrics: Array<number | string>;
  businessModels: Array<number | string>;
};

const EMPTY: Form = {
  ticketSizeMin: '',
  ticketSizeMax: '',
  turnAroundTime: '',
  industries: [],
  industrySubCategories: [],
  otherIndustriesActive: false,
  otherIndustriesText: '',
  mechanisms: [],
  stages: [],
  preferences: [],
  abilityMetrics: [],
  businessModels: [],
};

const extractIds = (data: any): Array<number | string> => {
  if (!Array.isArray(data)) return [];
  return data
    .map(item => Number(item?.id ?? item))
    .filter(n => Number.isFinite(n));
};

const seedForm = (data: Record<string, any> | null): Form => {
  if (!data) return EMPTY;
  const investmentDetails = data.investmentDetails || data;
  const others = Array.isArray(data.sectoralInterestOthers)
    ? data.sectoralInterestOthers
    : [];
  return {
    ticketSizeMin:
      investmentDetails.ticketSizeMin != null
        ? String(investmentDetails.ticketSizeMin)
        : '',
    ticketSizeMax:
      investmentDetails.ticketSizeMax != null
        ? String(investmentDetails.ticketSizeMax)
        : '',
    turnAroundTime:
      investmentDetails.turnAroundTime != null
        ? String(investmentDetails.turnAroundTime)
        : '',
    industries: extractIds(
      investmentDetails.sectoralInterestIds ||
      data.sectoralInterestIds ||
      data.sectoralInterests,
    ),
    industrySubCategories: extractIds(
      investmentDetails.sectoralInterestSubIds ||
      data.sectoralInterestSubIds ||
      data.sectoralInterestSub,
    ),
    otherIndustriesActive: others.length > 0,
    otherIndustriesText: others.join(','),
    mechanisms: extractIds(
      investmentDetails.investmentMechanismIds ||
        data.investmentMechanismIds,
    ),
    stages: extractIds(
      investmentDetails.investmentStageIds || data.investmentStageIds,
    ),
    preferences: extractIds(
      investmentDetails.investmentPreferenceIds ||
        data.investmentPreferenceIds,
    ),
    abilityMetrics: extractIds(
      investmentDetails.investAbilityMetricsIds ||
        data.investAbilityMetricsIds,
    ),
    businessModels: extractIds(
      investmentDetails.businessModelIds || data.businessModelIds,
    ),
  };
};

export const InvestorInvestmentsTab = forwardRef<SecondaryTabHandle, Props>(
function InvestorInvestmentsTab({
  token,
  primaryColor,
  initialData,
  industryOptions,
  mechanismOptions,
  stageOptions,
  preferenceOptions,
  abilityMetricOptions,
  businessModelOptions,
  maxAbilityMetrics = 4,
  maxIndustries = 5,
  onSaveSuccess,
  onValidChange,
}: Props, ref) {
  const toast = useToast();
  const [form, setForm] = useState<Form>(() => seedForm(initialData));
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const markTouched = (key: string) =>
    setTouched(prev => ({...prev, [key]: true}));

  const rawErrors: Record<string, string | undefined> = {
    ticketSizeMin: !form.ticketSizeMin.trim()
      ? 'Minimum ticket size is required.'
      : !/^\d+$/.test(form.ticketSizeMin.trim())
      ? 'Enter digits only.'
      : undefined,
    ticketSizeMax: !form.ticketSizeMax.trim()
      ? 'Maximum ticket size is required.'
      : !/^\d+$/.test(form.ticketSizeMax.trim())
      ? 'Enter digits only.'
      : Number(form.ticketSizeMax) < Number(form.ticketSizeMin)
      ? 'Must be greater than the minimum.'
      : undefined,
    turnAroundTime: !form.turnAroundTime.trim()
      ? 'Turnaround time is required.'
      : !/^\d+$/.test(form.turnAroundTime.trim())
      ? 'Enter digits only.'
      : undefined,
    industries: form.industries.length === 0 ? 'required' : undefined,
    mechanisms: form.mechanisms.length === 0 ? 'required' : undefined,
    stages: form.stages.length === 0 ? 'required' : undefined,
    preferences: form.preferences.length === 0 ? 'required' : undefined,
    abilityMetrics: form.abilityMetrics.length === 0 ? 'required' : undefined,
    businessModels: form.businessModels.length === 0 ? 'required' : undefined,
  };
  const errors: Record<string, string | undefined> = {};
  Object.entries(rawErrors).forEach(([k, v]) => {
    if (v && (submitted || touched[k])) errors[k] = v;
  });
  const hasErrors = Object.values(rawErrors).some(Boolean);

  useEffect(() => {
    setForm(seedForm(initialData));
    setTouched({});
    setSubmitted(false);
  }, [initialData]);

  useEffect(() => {
    onValidChange?.(!hasErrors);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasErrors]);

  const onSave = async () => {
    setSubmitted(true);
    if (hasErrors) {
      toast.error('Please complete the highlighted fields.');
      return;
    }

    try {
      const otherList = form.otherIndustriesActive
        ? form.otherIndustriesText
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
        : [];
      await authService.updateInvestorInvestments(token, {
        ticketSizeMin: form.ticketSizeMin ? Number(form.ticketSizeMin) : null,
        ticketSizeMax: form.ticketSizeMax ? Number(form.ticketSizeMax) : null,
        turnAroundTime: form.turnAroundTime
          ? Number(form.turnAroundTime)
          : null,
        sectoralInterestIds: form.industries.map(Number),
        sectoralInterestSubIds: form.industrySubCategories.map(Number),
        sectoralInterestOthers: otherList,
        investmentMechanismIds: form.mechanisms.map(Number),
        investmentStageIds: form.stages.map(Number),
        investmentPreferenceIds: form.preferences.map(Number),
        investAbilityMetricsIds: form.abilityMetrics.map(Number),
        businessModelIds: form.businessModels.map(Number),
      });
      toast.success('Investment details saved.');
      onSaveSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not save investment details.',
      );
    }
  };

  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  useImperativeHandle(ref, () => ({
    triggerSave: () => saveRef.current(),
  }));

  return (
    <ProfileTabCard
      title="Investment Details"
      subtitle="How you invest — ticket sizes, mechanisms, sectors, stages."
    >

      <AppTextField
        label="Turn Around Time (TAT) in days"
        required
        error={errors.turnAroundTime}
        keyboardType="number-pad"
        value={form.turnAroundTime}
        onChangeText={t => setForm(p => ({...p, turnAroundTime: t}))}
        onBlur={() => markTouched('turnAroundTime')}
      />

      <Text style={styles.sectionLabel}>
        Ticket Size<Text style={styles.requiredMark}> *</Text>
      </Text>
      <View style={styles.row}>
        <View style={{flex: 1}}>
          <AppTextField
            label="Min (INR)"
            required
            error={errors.ticketSizeMin}
            keyboardType="number-pad"
            value={form.ticketSizeMin}
            onChangeText={t => setForm(p => ({...p, ticketSizeMin: t}))}
            onBlur={() => markTouched('ticketSizeMin')}
          />
        </View>
        <View style={{flex: 1}}>
          <AppTextField
            label="Max (INR)"
            required
            error={errors.ticketSizeMax}
            keyboardType="number-pad"
            value={form.ticketSizeMax}
            onChangeText={t => setForm(p => ({...p, ticketSizeMax: t}))}
            onBlur={() => markTouched('ticketSizeMax')}
          />
        </View>
      </View>

      {industryOptions.length > 0 ? (
        <MultiSelectField
          label="Sectoral Interest"
          hint={`Select up to ${maxIndustries}`}
          required
          options={industryOptions}
          selected={form.industries}
          primaryColor={primaryColor}
          max={maxIndustries}
          onChange={next => {
            const stillSelectedSubIds = new Set<number>();
            industryOptions
              .filter(opt => next.includes(opt.id))
              .forEach(opt => {
                opt.industrySubCategoryDomains?.forEach(sub =>
                  stillSelectedSubIds.add(sub.id),
                );
              });
            setForm(p => ({
              ...p,
              industries: next,
              industrySubCategories: p.industrySubCategories.filter(id =>
                stillSelectedSubIds.has(Number(id)),
              ),
            }));
          }}
        />
      ) : null}

      {(() => {
        const visibleSubs: Array<{id: number; name: string}> = [];
        const seen = new Set<number>();
        industryOptions
          .filter(opt => form.industries.includes(opt.id))
          .forEach(opt => {
            opt.industrySubCategoryDomains?.forEach(sub => {
              if (!seen.has(sub.id)) {
                seen.add(sub.id);
                visibleSubs.push(sub);
              }
            });
          });
        if (visibleSubs.length === 0) return null;
        return (
          <MultiSelectField
            label="Sub-categories"
            hint="Pick the sub-areas inside your selected industries."
            options={visibleSubs}
            selected={form.industrySubCategories}
            primaryColor={primaryColor}
            onChange={next =>
              setForm(p => ({...p, industrySubCategories: next}))
            }
          />
        );
      })()}

      {/* <View style={styles.otherToggleRow}>
        <Text style={styles.otherLabel}>Add other sectors</Text>
        <Switch
          value={form.otherIndustriesActive}
          onValueChange={val =>
            setForm(p => ({
              ...p,
              otherIndustriesActive: val,
              otherIndustriesText: val ? p.otherIndustriesText : '',
            }))
          }
          trackColor={{false: '#cbd5e1', true: `${primaryColor}55`}}
          thumbColor={form.otherIndustriesActive ? primaryColor : '#f1f5f9'}
        />
      </View> */}
      {form.otherIndustriesActive ? (
        <TextInput
          style={styles.otherInput}
          value={form.otherIndustriesText}
          onChangeText={text =>
            setForm(p => ({...p, otherIndustriesText: text}))
          }
          placeholder="Separate multiple entries with commas"
          placeholderTextColor="#94a3b8"
          autoCapitalize="words"
        />
      ) : null}

      {mechanismOptions.length > 0 ? (
        <MultiSelectField
          label="Using instruments"
          required
          options={mechanismOptions}
          selected={form.mechanisms}
          primaryColor={primaryColor}
          onChange={next => setForm(p => ({...p, mechanisms: next}))}
        />
      ) : null}

      {preferenceOptions.length > 0 ? (
        <MultiSelectField
          label="We prefer to"
          required
          options={preferenceOptions}
          selected={form.preferences}
          primaryColor={primaryColor}
          onChange={next => setForm(p => ({...p, preferences: next}))}
        />
      ) : null}

      {stageOptions.length > 0 ? (
        <MultiSelectField
          label="at ______ Stage"
          required
          options={stageOptions}
          selected={form.stages}
          primaryColor={primaryColor}
          onChange={next => setForm(p => ({...p, stages: next}))}
        />
      ) : null}

      {abilityMetricOptions.length > 0 ? (
        <MultiSelectField
          label={`Investability Metrics (max. ${maxAbilityMetrics})`}
          required
          options={abilityMetricOptions}
          selected={form.abilityMetrics}
          primaryColor={primaryColor}
          max={maxAbilityMetrics}
          onChange={next => setForm(p => ({...p, abilityMetrics: next}))}
        />
      ) : null}

      {businessModelOptions.length > 0 ? (
        <MultiSelectField
          label="We invest in"
          required
          options={businessModelOptions}
          selected={form.businessModels}
          primaryColor={primaryColor}
          onChange={next => setForm(p => ({...p, businessModels: next}))}
        />
      ) : null}

    </ProfileTabCard>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  sectionLabel: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  requiredMark: {
    color: '#dc2626',
    fontWeight: '600',
  },
  otherToggleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  otherLabel: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
  otherInput: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 10,
    borderWidth: 1,
    color: '#0f172a',
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
