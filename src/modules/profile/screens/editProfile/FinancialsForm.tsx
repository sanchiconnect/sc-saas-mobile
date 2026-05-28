import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import {AppButton} from '../../../../core/components/AppButton';
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

export type CommitmentItem = {
  id?: number | string;
  uuid?: string;
  investorName?: string;
  amount?: string | number;
  amountRaised?: string | number;
  preMoneyValuation?: string | number;
  hideInvestorName?: boolean;
};

export type CommitmentPayload = {
  uuid?: string;
  investorName: string;
  amountRaised: string;
  preMoneyValuation: string;
  hideInvestorName: boolean;
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
  onSaveCommitment?: (payload: CommitmentPayload) => Promise<void> | void;
  onDeleteCommitment?: (uuid: string) => Promise<void> | void;
};

type CommitmentDraft = {
  // Stable key for the row — server uuid if persisted, else a local temp id.
  rowKey: string;
  uuid: string;
  investorName: string;
  amountRaised: string;
  preMoneyValuation: string;
  hideInvestorName: boolean;
  saving?: boolean;
  deleting?: boolean;
  error?: string | null;
};

const tempRowKey = () =>
  `new_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

const toDraft = (item: CommitmentItem): CommitmentDraft => {
  const uuid = String(item?.uuid || item?.id || '');
  return {
    rowKey: uuid || tempRowKey(),
    uuid,
    investorName: String(item?.investorName || ''),
    amountRaised: String(item?.amountRaised ?? item?.amount ?? ''),
    preMoneyValuation: String(item?.preMoneyValuation ?? ''),
    hideInvestorName: Boolean(item?.hideInvestorName),
  };
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
  onSaveCommitment,
  onDeleteCommitment,
}: Props) {
  // Local draft state for the commitments section. Seeded from the
  // server-provided list, plus any rows the user has added via "+ ADD NEW"
  // that haven't been persisted yet. Re-seeded whenever the server list
  // changes (e.g. after a successful save refresh) — locally-added drafts
  // without a uuid are preserved across re-seeds so the user doesn't lose
  // their typing.
  const [commitmentDrafts, setCommitmentDrafts] = useState<CommitmentDraft[]>(
    () => ongoingCommitments.map(toDraft),
  );
  const [hasOngoingCommitments, setHasOngoingCommitments] = useState<boolean>(
    () => ongoingCommitments.length > 0,
  );

  useEffect(() => {
    setCommitmentDrafts(prev => {
      const localOnly = prev.filter(d => !d.uuid);
      return [...ongoingCommitments.map(toDraft), ...localOnly];
    });
    if (ongoingCommitments.length > 0) {
      setHasOngoingCommitments(true);
    }
  }, [ongoingCommitments]);

  const updateDraft = (rowKey: string, patch: Partial<CommitmentDraft>) => {
    setCommitmentDrafts(prev =>
      prev.map(d => (d.rowKey === rowKey ? {...d, ...patch} : d)),
    );
  };

  const addNewCommitment = () => {
    setHasOngoingCommitments(true);
    setCommitmentDrafts(prev => [
      ...prev,
      {
        rowKey: tempRowKey(),
        uuid: '',
        investorName: '',
        amountRaised: '',
        preMoneyValuation: '',
        hideInvestorName: false,
      },
    ]);
  };

  const saveCommitment = async (draft: CommitmentDraft) => {
    if (!onSaveCommitment) return;
    const investorName = draft.investorName.trim();
    const amountRaised = draft.amountRaised.trim();
    const preMoneyValuation = draft.preMoneyValuation.trim();
    if (!investorName || !amountRaised || !preMoneyValuation) {
      updateDraft(draft.rowKey, {
        error: 'Investor name, amount raised and pre money valuation are required.',
      });
      return;
    }
    updateDraft(draft.rowKey, {saving: true, error: null});
    try {
      await onSaveCommitment({
        uuid: draft.uuid || undefined,
        investorName,
        amountRaised,
        preMoneyValuation,
        hideInvestorName: draft.hideInvestorName,
      });
      updateDraft(draft.rowKey, {saving: false, error: null});
    } catch (e) {
      updateDraft(draft.rowKey, {
        saving: false,
        error: e instanceof Error ? e.message : 'Could not save commitment.',
      });
    }
  };

  const deleteCommitment = async (draft: CommitmentDraft) => {
    // Drafts that never saved — drop them locally without an API call.
    if (!draft.uuid) {
      setCommitmentDrafts(prev => prev.filter(d => d.rowKey !== draft.rowKey));
      return;
    }
    if (!onDeleteCommitment) return;
    updateDraft(draft.rowKey, {deleting: true, error: null});
    try {
      await onDeleteCommitment(draft.uuid);
      setCommitmentDrafts(prev => prev.filter(d => d.rowKey !== draft.rowKey));
    } catch (e) {
      updateDraft(draft.rowKey, {
        deleting: false,
        error: e instanceof Error ? e.message : 'Could not delete commitment.',
      });
    }
  };

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
          <Pressable
            style={styles.sectionToggleRow}
            onPress={() => {
              const next = !hasOngoingCommitments;
              setHasOngoingCommitments(next);
              // Turning the section off clears any unsaved local drafts.
              // Persisted commitments stay on the server until deleted.
              if (!next) {
                setCommitmentDrafts(prev => prev.filter(d => d.uuid));
              }
            }}>
            <View
              style={[
                styles.sectionCheckbox,
                hasOngoingCommitments && {
                  backgroundColor: primaryColor,
                  borderColor: primaryColor,
                },
              ]}>
              {hasOngoingCommitments ? (
                <Icon name="check" size={14} color="#ffffff" />
              ) : null}
            </View>
            <Text style={styles.sectionToggleLabel}>
              Do you have any ongoing commitments for upcoming funding round?
            </Text>
          </Pressable>

          {hasOngoingCommitments ? (
            <View style={styles.commitmentsList}>
              {commitmentDrafts.length === 0 ? (
                <Text style={styles.emptyText}>
                  No ongoing commitments yet. Tap “+ ADD NEW” to add one.
                </Text>
              ) : null}

              {commitmentDrafts.map(draft => (
                <View key={draft.rowKey} style={styles.commitmentCard}>
                  <AppTextField
                    label="Name of the investor"
                    required
                    placeholder="Investor name"
                    value={draft.investorName}
                    onChangeText={text =>
                      updateDraft(draft.rowKey, {investorName: text, error: null})
                    }
                    containerStyle={styles.field}
                  />
                  <AppTextField
                    label={`Amount raised (in ${currency})`}
                    required
                    placeholder="Amount"
                    keyboardType="decimal-pad"
                    value={draft.amountRaised}
                    onChangeText={text =>
                      updateDraft(draft.rowKey, {
                        amountRaised: sanitizeNumericInput(text),
                        error: null,
                      })
                    }
                    containerStyle={styles.field}
                  />
                  <AppTextField
                    label={`Pre money valuation (in ${currency})`}
                    required
                    placeholder="Pre money valuation"
                    keyboardType="decimal-pad"
                    value={draft.preMoneyValuation}
                    onChangeText={text =>
                      updateDraft(draft.rowKey, {
                        preMoneyValuation: sanitizeNumericInput(text),
                        error: null,
                      })
                    }
                    containerStyle={styles.field}
                  />

                  <View style={styles.anonymousRow}>
                    <Switch
                      value={draft.hideInvestorName}
                      onValueChange={next =>
                        updateDraft(draft.rowKey, {hideInvestorName: next})
                      }
                      trackColor={{false: '#cbd5e1', true: `${primaryColor}55`}}
                      thumbColor={
                        draft.hideInvestorName ? primaryColor : '#f1f5f9'
                      }
                    />
                    <Text style={styles.anonymousLabel}>Anonymous</Text>
                    <Icon
                      name="information-outline"
                      size={16}
                      color={primaryColor}
                    />
                  </View>

                  {draft.error ? (
                    <Text style={styles.commitmentError}>{draft.error}</Text>
                  ) : null}

                  <View style={styles.commitmentActions}>
                    <View style={styles.commitmentAction}>
                      <AppButton
                        label={draft.saving ? 'Saving…' : 'SAVE'}
                        loading={draft.saving}
                        disabled={draft.saving || draft.deleting}
                        onPress={() => saveCommitment(draft)}
                        style={{backgroundColor: primaryColor}}
                      />
                    </View>
                    <View style={styles.commitmentAction}>
                      <AppButton
                        label={draft.deleting ? 'Deleting…' : 'DELETE'}
                        variant="secondary"
                        loading={draft.deleting}
                        disabled={draft.saving || draft.deleting}
                        onPress={() => deleteCommitment(draft)}
                      />
                    </View>
                  </View>
                </View>
              ))}

              <Pressable
                style={styles.addNewButton}
                onPress={addNewCommitment}>
                <Text style={styles.addNewLabel}>+ ADD NEW</Text>
              </Pressable>
            </View>
          ) : null}
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
  sectionToggleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  sectionCheckbox: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 4,
    borderWidth: 1,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  sectionToggleLabel: {
    color: '#0f172a',
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  commitmentsList: {
    gap: 12,
    marginTop: 12,
  },
  commitmentCard: {
    backgroundColor: '#f8fafc',
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  anonymousRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
    marginTop: 4,
  },
  anonymousLabel: {
    color: '#0f172a',
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  commitmentError: {
    color: colors.danger,
    fontSize: 13,
    marginTop: 6,
  },
  commitmentActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  commitmentAction: {
    flex: 1,
  },
  addNewButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  addNewLabel: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
