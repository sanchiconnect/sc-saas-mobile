import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {AppTextField} from '../../../../core/components/AppTextField';
import {Icon} from '../../../../core/components/Icon';
import {colors} from '../../../../core/theme/colors';
import {
  INVESTMENT_BANKER_OPTIONS,
  REVENUE_STAGES,
  TIME_TO_COMMERCIALIZE_OPTIONS,
} from './options';
import {FinancialsForm as FinancialsFormType} from './types';

type SelectOption = {
  id: number | string;
  name: string;
};

type CommitmentItem = {
  id?: number | string;
  investorName?: string;
  amount?: string | number;
};

type Props = {
  primaryColor: string;
  value: FinancialsFormType;
  currency?: string;
  showInvestmentBankingSection?: boolean;
  fundingStages?: SelectOption[];
  investmentMechanisms?: SelectOption[];
  ongoingCommitments?: CommitmentItem[];
  onChange: <K extends keyof FinancialsFormType>(
    key: K,
    value: FinancialsFormType[K],
  ) => void;
};

const sanitizeNumericInput = (text: string) =>
  text.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');

export function FinancialsForm({
  primaryColor,
  value,
  currency = 'INR',
  showInvestmentBankingSection = false,
  fundingStages = [],
  investmentMechanisms = [],
  ongoingCommitments = [],
  onChange,
}: Props) {
  const toggleMechanism = (mechanismId: string) => {
    const exists = value.investmentMechanisms.includes(mechanismId);
    onChange(
      'investmentMechanisms',
      exists
        ? value.investmentMechanisms.filter(item => item !== mechanismId)
        : [...value.investmentMechanisms, mechanismId],
    );
  };

  const selectedFundingStageName =
    fundingStages.find(stage => String(stage.id) === value.fundingStage)?.name ||
    value.fundingStage;

  return (
    <View>
      <SectionCard primaryColor={primaryColor} heading="Current Stage">
        <Text style={styles.fieldLabel}>
          Funding stage <Text style={styles.required}>*</Text>
        </Text>
        <View style={styles.optionGrid}>
          {fundingStages.map(stage => {
            const selected = value.fundingStage === String(stage.id);
            return (
              <OptionChip
                key={String(stage.id)}
                label={stage.name}
                selected={selected}
                primaryColor={primaryColor}
                onPress={() => onChange('fundingStage', String(stage.id))}
              />
            );
          })}
        </View>
      </SectionCard>

      <SectionCard primaryColor={primaryColor} heading="Target Fundraise">
        <Text style={styles.fieldLabel}>Are you raising funds?</Text>
        <View style={styles.yesNoRow}>
          <YesNoButton
            label="Yes"
            active={value.isRaisingFunds}
            primaryColor={primaryColor}
            onPress={() => onChange('isRaisingFunds', true)}
          />
          <YesNoButton
            label="No"
            active={!value.isRaisingFunds}
            primaryColor={primaryColor}
            onPress={() => onChange('isRaisingFunds', false)}
          />
        </View>

        {value.isRaisingFunds ? (
          <View style={styles.stackMd}>
            <AppTextField
              label={`How much are you looking to raise (in ${currency})`}
              required
              placeholder={`Target fundraise (in ${currency})`}
              value={value.targetFundraise}
              onChangeText={text =>
                onChange('targetFundraise', sanitizeNumericInput(text))
              }
              keyboardType="decimal-pad"
              containerStyle={styles.field}
            />

            <AppTextField
              label={`Tentative Valuation (in ${currency})`}
              required
              placeholder={`Tentative valuation (in ${currency})`}
              value={value.tentativeValuation}
              onChangeText={text =>
                onChange('tentativeValuation', sanitizeNumericInput(text))
              }
              keyboardType="decimal-pad"
              containerStyle={styles.field}
            />

            <Text style={styles.fieldLabel}>Funding against</Text>
            <View style={styles.optionGrid}>
              {investmentMechanisms.map(mechanism => (
                <OptionChip
                  key={String(mechanism.id)}
                  label={mechanism.name}
                  selected={value.investmentMechanisms.includes(
                    String(mechanism.id),
                  )}
                  primaryColor={primaryColor}
                  onPress={() => toggleMechanism(String(mechanism.id))}
                />
              ))}
            </View>
          </View>
        ) : null}
      </SectionCard>

      {selectedFundingStageName &&
      selectedFundingStageName.toLowerCase() !== 'bootstrapped' ? (
        <SectionCard primaryColor={primaryColor} heading="Past Funding Details">
          <AppTextField
            label={`Total funding raised (in ${currency})`}
            placeholder="Enter amount"
            value={value.totalFundRaised}
            onChangeText={text =>
              onChange('totalFundRaised', sanitizeNumericInput(text))
            }
            keyboardType="decimal-pad"
            containerStyle={styles.field}
          />

          <AppTextField
            label="Name of investors in previous round"
            placeholder="Enter details of your past funding"
            value={value.pastFunding}
            onChangeText={text => onChange('pastFunding', text)}
            multiline
            numberOfLines={4}
            containerStyle={styles.field}
            inputStyle={styles.multilineInput}
          />
        </SectionCard>
      ) : null}

      {value.isRaisingFunds ? (
        <SectionCard primaryColor={primaryColor} heading="Ongoing Commitments">
          {ongoingCommitments.length > 0 ? (
            ongoingCommitments.map((commitment, index) => (
              <View key={String(commitment.id || index)} style={styles.commitmentRow}>
                <Icon
                  name="checkbox-marked-circle-outline"
                  size={18}
                  color={primaryColor}
                />
                <View style={styles.commitmentCopy}>
                  <Text style={styles.commitmentTitle}>
                    {commitment.investorName || 'Commitment'}
                  </Text>
                  <Text style={styles.commitmentSubtitle}>
                    {commitment.amount ? `${currency} ${commitment.amount}` : 'Amount not added'}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>
              No ongoing commitments found for the upcoming funding round.
            </Text>
          )}
        </SectionCard>
      ) : null}

      <SectionCard primaryColor={primaryColor} heading="Revenue Stage">
        <Text style={styles.fieldLabel}>
          Current revenue stage <Text style={styles.required}>*</Text>
        </Text>
        <View style={styles.optionGrid}>
          {REVENUE_STAGES.map(stage => (
            <OptionChip
              key={stage.value}
              label={stage.label}
              selected={value.revenueStage === stage.value}
              primaryColor={primaryColor}
              onPress={() => onChange('revenueStage', stage.value)}
            />
          ))}
        </View>

        {value.revenueStage === 'post_revenue' ? (
          <View style={styles.stackMd}>
            <AppTextField
              label="Gross Revenues (Annual)"
              placeholder={`in ${currency}, as on 31st March`}
              value={value.grossRevenues}
              onChangeText={text =>
                onChange('grossRevenues', sanitizeNumericInput(text))
              }
              keyboardType="decimal-pad"
              containerStyle={styles.field}
            />
            <AppTextField
              label="Current Year Revenues - Q1, April - June"
              placeholder="Enter amount"
              value={value.grossRevenuesQ1}
              onChangeText={text =>
                onChange('grossRevenuesQ1', sanitizeNumericInput(text))
              }
              keyboardType="decimal-pad"
              containerStyle={styles.field}
            />
            <AppTextField
              label="Current Year Revenues - Q2, July - Sept"
              placeholder="Enter amount"
              value={value.grossRevenuesQ2}
              onChangeText={text =>
                onChange('grossRevenuesQ2', sanitizeNumericInput(text))
              }
              keyboardType="decimal-pad"
              containerStyle={styles.field}
            />
            <AppTextField
              label="Current Year Revenues - Q3, Oct - Dec"
              placeholder="Enter amount"
              value={value.grossRevenuesQ3}
              onChangeText={text =>
                onChange('grossRevenuesQ3', sanitizeNumericInput(text))
              }
              keyboardType="decimal-pad"
              containerStyle={styles.field}
            />
          </View>
        ) : null}

        {value.revenueStage === 'pre_revenue' ? (
          <View style={styles.stackMd}>
            <Text style={styles.fieldLabel}>Time to commercialise?</Text>
            <View style={styles.optionGrid}>
              {TIME_TO_COMMERCIALIZE_OPTIONS.map(option => (
                <OptionChip
                  key={option}
                  label={option}
                  selected={value.timeToCommercialize === option}
                  primaryColor={primaryColor}
                  onPress={() => onChange('timeToCommercialize', option)}
                />
              ))}
            </View>
          </View>
        ) : null}
      </SectionCard>

      {showInvestmentBankingSection ? (
        <SectionCard primaryColor={primaryColor} heading="Miscellaneous">
          <Text style={styles.fieldLabel}>
            Are you open to explore investment banking partner route also?
          </Text>
          <View style={styles.optionGrid}>
            {INVESTMENT_BANKER_OPTIONS.map(option => (
              <OptionChip
                key={option.value}
                label={option.label}
                selected={value.investmentBankerOpportunity === option.value}
                primaryColor={primaryColor}
                onPress={() =>
                  onChange('investmentBankerOpportunity', option.value)
                }
              />
            ))}
          </View>
        </SectionCard>
      ) : null}
    </View>
  );
}

function SectionCard({
  primaryColor,
  heading,
  children,
}: React.PropsWithChildren<{primaryColor: string; heading: string}>) {
  return (
    <View style={styles.card}>
      <View style={[styles.cardHeader, {backgroundColor: primaryColor}]}>
        <Text style={styles.cardHeaderText}>{heading}</Text>
      </View>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

function YesNoButton({
  label,
  active,
  primaryColor,
  onPress,
}: {
  label: string;
  active: boolean;
  primaryColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.toggleButton,
        active && {
          backgroundColor: primaryColor,
          borderColor: primaryColor,
        },
      ]}>
      <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function OptionChip({
  label,
  selected,
  primaryColor,
  onPress,
}: {
  label: string;
  selected: boolean;
  primaryColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.optionChip,
        selected && {
          borderColor: primaryColor,
          backgroundColor: `${primaryColor}12`,
        },
      ]}
      onPress={onPress}>
      <View
        style={[
          styles.optionIcon,
          selected && {
            borderColor: primaryColor,
            backgroundColor: primaryColor,
          },
        ]}>
        {selected ? <Icon name="check" size={12} color="#ffffff" /> : null}
      </View>
      <Text style={styles.optionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cardHeaderText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
  },
  cardBody: {
    padding: 16,
  },
  field: {
    marginBottom: 14,
  },
  fieldLabel: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  required: {
    color: '#dc2626',
  },
  yesNoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  toggleButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 80,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  toggleText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
  },
  toggleTextActive: {
    color: '#ffffff',
  },
  stackMd: {
    marginTop: 16,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionChip: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#dbe2ea',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 50,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: '100%',
  },
  optionIcon: {
    alignItems: 'center',
    borderColor: '#cbd5e1',
    borderRadius: 999,
    borderWidth: 1,
    height: 20,
    justifyContent: 'center',
    marginRight: 10,
    width: 20,
  },
  optionLabel: {
    color: '#0f172a',
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  multilineInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  commitmentRow: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 10,
    padding: 12,
  },
  commitmentCopy: {
    flex: 1,
    marginLeft: 10,
  },
  commitmentTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
  commitmentSubtitle: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 2,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
    lineHeight: 20,
  },
});
