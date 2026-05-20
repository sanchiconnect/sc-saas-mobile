import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {AppButton} from '../../../../core/components/AppButton';
import {AppTextField} from '../../../../core/components/AppTextField';
import {authService} from '../../../auth/services/auth.service';

import {
  MultiSelectField,
  MultiSelectOption,
} from './MultiSelectField';

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
  // Cap on investability metrics from globalSettings.investorMaxInvestabilityMetrics.
  maxAbilityMetrics?: number;
  maxIndustries?: number;
};

type Form = {
  ticketSizeMin: string;
  ticketSizeMax: string;
  turnAroundTime: string;
  industries: Array<number | string>;
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
    industries: extractIds(data.sectoralInterestIds || data.sectoralInterests),
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

export function InvestorInvestmentsTab({
  token,
  primaryColor,
  initialData,
  industryOptions,
  mechanismOptions,
  stageOptions,
  preferenceOptions,
  abilityMetricOptions,
  businessModelOptions,
  maxAbilityMetrics = 7,
  maxIndustries = 5,
}: Props) {
  const [form, setForm] = useState<Form>(() => seedForm(initialData));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    tone: 'success' | 'error';
  } | null>(null);

  useEffect(() => {
    setForm(seedForm(initialData));
  }, [initialData]);

  const onSave = async () => {
    setMessage(null);

    const min = Number(form.ticketSizeMin || 0);
    const max = Number(form.ticketSizeMax || 0);
    if (form.ticketSizeMin && form.ticketSizeMax && max < min) {
      setMessage({
        text: 'Maximum ticket size must be greater than minimum.',
        tone: 'error',
      });
      return;
    }

    setSaving(true);
    try {
      await authService.updateInvestorInvestments(token, {
        ticketSizeMin: form.ticketSizeMin ? Number(form.ticketSizeMin) : null,
        ticketSizeMax: form.ticketSizeMax ? Number(form.ticketSizeMax) : null,
        turnAroundTime: form.turnAroundTime
          ? Number(form.turnAroundTime)
          : null,
        sectoralInterestIds: form.industries.map(Number),
        investmentMechanismIds: form.mechanisms.map(Number),
        investmentStageIds: form.stages.map(Number),
        investmentPreferenceIds: form.preferences.map(Number),
        investAbilityMetricsIds: form.abilityMetrics.map(Number),
        businessModelIds: form.businessModels.map(Number),
      });
      setMessage({text: 'Investment details saved.', tone: 'success'});
    } catch (error) {
      setMessage({
        text:
          error instanceof Error
            ? error.message
            : 'Could not save investment details.',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Investment Details</Text>
      <Text style={styles.subtitle}>
        How you invest — ticket sizes, mechanisms, sectors, stages.
      </Text>

      <View style={styles.row}>
        <View style={{flex: 1}}>
          <AppTextField
            label="Ticket Size — Min"
            keyboardType="number-pad"
            value={form.ticketSizeMin}
            onChangeText={t => setForm(p => ({...p, ticketSizeMin: t}))}
          />
        </View>
        <View style={{flex: 1}}>
          <AppTextField
            label="Ticket Size — Max"
            keyboardType="number-pad"
            value={form.ticketSizeMax}
            onChangeText={t => setForm(p => ({...p, ticketSizeMax: t}))}
          />
        </View>
      </View>

      <AppTextField
        label="Turnaround Time (days)"
        keyboardType="number-pad"
        value={form.turnAroundTime}
        onChangeText={t => setForm(p => ({...p, turnAroundTime: t}))}
      />

      {industryOptions.length > 0 ? (
        <MultiSelectField
          label="Sectoral Interests"
          hint={`Select up to ${maxIndustries}`}
          options={industryOptions}
          selected={form.industries}
          primaryColor={primaryColor}
          max={maxIndustries}
          onChange={next => setForm(p => ({...p, industries: next}))}
        />
      ) : null}

      {mechanismOptions.length > 0 ? (
        <MultiSelectField
          label="Investment Mechanisms"
          options={mechanismOptions}
          selected={form.mechanisms}
          primaryColor={primaryColor}
          onChange={next => setForm(p => ({...p, mechanisms: next}))}
        />
      ) : null}

      {stageOptions.length > 0 ? (
        <MultiSelectField
          label="Investment Stages"
          options={stageOptions}
          selected={form.stages}
          primaryColor={primaryColor}
          onChange={next => setForm(p => ({...p, stages: next}))}
        />
      ) : null}

      {preferenceOptions.length > 0 ? (
        <MultiSelectField
          label="Investment Preferences"
          options={preferenceOptions}
          selected={form.preferences}
          primaryColor={primaryColor}
          onChange={next => setForm(p => ({...p, preferences: next}))}
        />
      ) : null}

      {abilityMetricOptions.length > 0 ? (
        <MultiSelectField
          label="Investability Metrics"
          hint={`Select up to ${maxAbilityMetrics}`}
          options={abilityMetricOptions}
          selected={form.abilityMetrics}
          primaryColor={primaryColor}
          max={maxAbilityMetrics}
          onChange={next => setForm(p => ({...p, abilityMetrics: next}))}
        />
      ) : null}

      {businessModelOptions.length > 0 ? (
        <MultiSelectField
          label="Business Models"
          options={businessModelOptions}
          selected={form.businessModels}
          primaryColor={primaryColor}
          onChange={next => setForm(p => ({...p, businessModels: next}))}
        />
      ) : null}

      {message ? (
        <Text
          style={[
            styles.message,
            message.tone === 'success'
              ? styles.messageSuccess
              : styles.messageError,
          ]}>
          {message.text}
        </Text>
      ) : null}

      <AppButton
        label={saving ? 'Saving…' : 'Save'}
        disabled={saving}
        loading={saving}
        onPress={onSave}
        style={{backgroundColor: primaryColor}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    gap: 16,
    marginBottom: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
  },
  messageSuccess: {
    color: '#15803d',
  },
  messageError: {
    color: '#dc2626',
  },
});
