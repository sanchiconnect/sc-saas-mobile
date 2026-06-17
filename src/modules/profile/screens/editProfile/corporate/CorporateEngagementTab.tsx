import React, {forwardRef, useContext, useEffect, useImperativeHandle, useMemo, useRef, useState} from 'react';
import {Pressable, StyleSheet, Text, TextInput, View} from 'react-native';

import {AppTextField} from '../../../../../core/components/AppTextField';
import {Icon} from '../../../../../core/components/Icon';
import {colors} from '../../../../../core/theme/colors';
import {TenantContext} from '../../../../../core/tenant/TenantProvider';
import {useToast} from '../../../../../core/toast/ToastProvider';
import {authService} from '../../../../auth/services/auth.service';
import {ProfileTabCard} from '../shared/ProfileTabCard';

import type {SecondaryTabHandle} from '../mentor/MentorDomainExpertiseTab';
export type {SecondaryTabHandle};

// Matches the web's sentinel value for the "Others" checkbox option.
// Filtered out before the API payload is built; the typed text is sent instead.
const OTHERS_SENTINEL = 'others_input_box_id';

type Props = {
  token: string;
  primaryColor: string;
  initialData: Record<string, any> | null;
  onSaveSuccess?: () => void;
  onValidChange?: (valid: boolean) => void;
};

type FormState = {
  hasInternalInnovationProgram: boolean;
  programName: string;
  totalSupported: string;
  connectionRequirements: Array<number | string>;
};

const seedForm = (data: Record<string, any> | null): FormState => ({
  hasInternalInnovationProgram: Boolean(data?.hasInternalInnovationProgram),
  programName: String(data?.programName || ''),
  totalSupported: data?.totalSupported != null ? String(data.totalSupported) : '',
  // connectionRequirements is a comma-separated string from the API.
  // Options come from WhyDoYouWantToConnectWithStartupsOptions in tenant settings.
  connectionRequirements: typeof data?.connectionRequirements === 'string'
    ? data.connectionRequirements.split(',').map((v: string) => v.trim()).filter(Boolean)
    : Array.isArray(data?.connectionRequirements)
      ? data.connectionRequirements
      : [],
});

const othersSelected = (reqs: Array<number | string>) =>
  reqs.includes(OTHERS_SENTINEL);

const checkValid = (form: FormState, otherReason: string): boolean => {
  const hasOthers = othersSelected(form.connectionRequirements);
  const knownCount = form.connectionRequirements.filter(
    v => v !== OTHERS_SENTINEL,
  ).length;
  const hasReason =
    knownCount > 0 || (hasOthers && otherReason.trim().length > 0);
  if (!hasReason) return false;
  if (form.hasInternalInnovationProgram) {
    if (!form.programName.trim()) return false;
    if (!form.totalSupported.trim()) return false;
  }
  return true;
};

export const CorporateEngagementTab = forwardRef<SecondaryTabHandle, Props>(
function CorporateEngagementTab(
  {token, primaryColor, initialData, onSaveSuccess, onValidChange}: Props,
  ref,
) {
  const toast = useToast();
  const {globalSetting} = useContext(TenantContext);
  const [form, setForm] = useState<FormState>(() => seedForm(initialData));
  const [otherReason, setOtherReason] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const reasonOptions = useMemo(() => {
    const source = Array.isArray(globalSetting?.WhyDoYouWantToConnectWithStartupsOptions)
      ? globalSetting!.WhyDoYouWantToConnectWithStartupsOptions!
      : [];
    return source.map((item: {name: string; value: string}) => ({
      id: item.value,
      name: item.name,
    }));
  }, [globalSetting]);

  // Known options from tenant settings + hardcoded "Others" at the end,
  // matching the web's reasonsToConnect array.
  const allOptions: Array<{id: string | number; name: string}> = [
    ...reasonOptions,
    {id: OTHERS_SENTINEL, name: 'Others'},
  ];

  useEffect(() => {
    if (reasonOptions.length === 0) {
      setForm(seedForm(initialData));
      return;
    }
    const seeded = seedForm(initialData);
    // Match stored values against option `value` field (opt.id), exactly as the web does:
    // reasonsToConnect.find(reason => reason.value === e)
    const knownIds = new Set(reasonOptions.map((opt: {id: string | number}) => String(opt.id)));
    const raw = seeded.connectionRequirements.map(String);
    const knownReqs = raw.filter(v => knownIds.has(v));
    const otherValues = raw.filter(v => !knownIds.has(v));
    setForm({
      ...seeded,
      connectionRequirements: [
        ...knownReqs,
        ...(otherValues.length > 0 ? [OTHERS_SENTINEL] : []),
      ],
    });
    setOtherReason(otherValues.join(', '));
  }, [initialData, reasonOptions]);

  useEffect(() => {
    onValidChange?.(checkValid(form, otherReason));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, otherReason]);

  const toggleReason = (id: string | number) => {
    const selected = form.connectionRequirements;
    const next = selected.includes(id)
      ? selected.filter(v => v !== id)
      : [...selected, id];
    setForm(p => ({...p, connectionRequirements: next}));
  };

  const onSave = async () => {
    setSubmitted(true);
    if (!checkValid(form, otherReason)) {
      toast.error('Please fill all required fields.');
      return;
    }
    try {
      const hasOthers = othersSelected(form.connectionRequirements);
      // Mirror the web's onSubmit: filter out the sentinel, map to value strings,
      // then append the free-text otherReason if "Others" was ticked.
      const allRequirements = [
        ...form.connectionRequirements
          .filter(v => v !== OTHERS_SENTINEL)
          .map(String),
        ...(hasOthers && otherReason.trim() ? [otherReason.trim()] : []),
      ];
      await authService.updateCorporateEngagement(token, {
        hasInternalInnovationProgram: form.hasInternalInnovationProgram,
        programName: form.hasInternalInnovationProgram ? form.programName.trim() : '',
        totalSupported: form.hasInternalInnovationProgram
          ? Number(form.totalSupported || 0)
          : 0,
        connectWithStartups: true,
        connectionRequirements: allRequirements.join(','),
      });
      toast.success('Engagement details saved.');
      onSaveSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not save engagement details.',
      );
    }
  };

  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  useImperativeHandle(ref, () => ({
    triggerSave: () => saveRef.current(),
  }));

  const hasOthers = othersSelected(form.connectionRequirements);
  const reasonsEmpty =
    form.connectionRequirements.filter(v => v !== OTHERS_SENTINEL).length === 0 &&
    !(hasOthers && otherReason.trim().length > 0);

  return (
    <ProfileTabCard
      title="Engagement"
      subtitle="How your organisation engages with startups on the platform."
    >
      {/* ── Internal innovation program ─────────────────────── */}
      <View>
        <Text style={styles.fieldLabel}>
          Do you have an internal innovation program?
        </Text>
        <View style={styles.btnGroup}>
          <Pressable
            style={[
              styles.btnGroupItem,
              styles.btnGroupLeft,
              form.hasInternalInnovationProgram
                ? styles.btnGroupActive
                : styles.btnGroupInactive,
            ]}
            onPress={() =>
              setForm(p => ({...p, hasInternalInnovationProgram: true}))
            }>
            <Text
              style={[
                styles.btnGroupLabel,
                form.hasInternalInnovationProgram && styles.btnGroupLabelActive,
              ]}>
              Yes
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.btnGroupItem,
              styles.btnGroupRight,
              !form.hasInternalInnovationProgram
                ? styles.btnGroupActive
                : styles.btnGroupInactive,
            ]}
            onPress={() =>
              setForm(p => ({...p, hasInternalInnovationProgram: false}))
            }>
            <Text
              style={[
                styles.btnGroupLabel,
                !form.hasInternalInnovationProgram && styles.btnGroupLabelActive,
              ]}>
              No
            </Text>
          </Pressable>
        </View>
      </View>

      {form.hasInternalInnovationProgram ? (
        <>
          <AppTextField
            label="Name of program"
            required
            value={form.programName}
            onChangeText={t => setForm(p => ({...p, programName: t}))}
            error={
              submitted && !form.programName.trim()
                ? 'Name of program is required'
                : undefined
            }
          />
          <AppTextField
            label="How many startups have received your support till now"
            required
            keyboardType="number-pad"
            value={form.totalSupported}
            onChangeText={t => setForm(p => ({...p, totalSupported: t}))}
            error={
              submitted && !form.totalSupported.trim()
                ? 'This field is required'
                : undefined
            }
          />
        </>
      ) : null}

      {/* ── Why connect — 3-column checkbox grid ────────────── */}
      <View>
        <Text style={styles.fieldLabel}>
          Why do you want to connect with startups?
          {'  '}<Text style={styles.requiredStar}>*</Text>
        </Text>
        <Text style={styles.hint}>Select all that apply</Text>

        <View style={styles.checkGrid}>
          {allOptions.map(option => {
            const isSelected = form.connectionRequirements.includes(option.id);
            return (
              <Pressable
                key={String(option.id)}
                style={styles.checkCell}
                onPress={() => toggleReason(option.id)}>
                <View
                  style={[
                    styles.checkbox,
                    isSelected && {
                      backgroundColor: primaryColor,
                      borderColor: primaryColor,
                    },
                  ]}>
                  {isSelected ? (
                    <Icon name="check" size={12} color="#ffffff" />
                  ) : null}
                </View>
                <Text style={styles.checkLabel}>{option.name}</Text>
              </Pressable>
            );
          })}
        </View>

        {hasOthers ? (
          <TextInput
            style={[
              styles.otherInput,
              submitted && !otherReason.trim() && {borderColor: colors.danger},
            ]}
            value={otherReason}
            onChangeText={setOtherReason}
            placeholder="Please specify"
            placeholderTextColor="#94a3b8"
          />
        ) : null}

        {submitted && reasonsEmpty ? (
          <Text style={styles.errorText}>
            Please select at least one reason
          </Text>
        ) : null}
      </View>
    </ProfileTabCard>
  );
});

const styles = StyleSheet.create({
  fieldLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10,
  },
  requiredStar: {
    color: '#ef4444',
    fontWeight: '700',
    fontSize: 15,
  },
  hint: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 12,
    marginTop: -6,
  },
  // ── Yes / No button group ────────────────────────────────
  btnGroup: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  btnGroupItem: {
    paddingHorizontal: 28,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGroupLeft: {
    borderRightWidth: 1,
    borderRightColor: '#cbd5e1',
  },
  btnGroupRight: {},
  btnGroupActive: {
    backgroundColor: '#0f172a',
  },
  btnGroupInactive: {
    backgroundColor: '#ffffff',
  },
  btnGroupLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  btnGroupLabelActive: {
    color: '#ffffff',
  },
  // ── 3-column checkbox grid ───────────────────────────────
  checkGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 14,
  },
  checkCell: {
    width: '33.33%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingRight: 8,
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  checkLabel: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    lineHeight: 18,
  },
  // ── Others free-text input ───────────────────────────────
  otherInput: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    marginTop: 6,
  },
});
