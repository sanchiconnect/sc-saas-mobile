import React, {useContext, useEffect, useState} from 'react';
import {StyleSheet, Switch, Text, TextInput, View} from 'react-native';

import {AppButton} from '../../../../core/components/AppButton';
import {TenantContext} from '../../../../core/tenant/TenantProvider';
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
  technologyOptions: MultiSelectOption[];
  domainAreaOptions: MultiSelectOption[];
  // Caps come from tenant config (globalSettings.mentorMaxIndustries, etc.).
  maxIndustries?: number;
  maxTechnologies?: number;
  maxDomainAreas?: number;
};

const seedSelected = (
  data: Record<string, any> | null,
  primaryKey: string,
  fallbackKey: string,
): Array<number | string> => {
  const raw =
    (Array.isArray(data?.[primaryKey]) && data?.[primaryKey]) ||
    (Array.isArray(data?.[fallbackKey]) && data?.[fallbackKey]) ||
    [];
  return raw
    .map((item: any) => Number(item?.id ?? item))
    .filter((id: number) => Number.isFinite(id));
};

export function MentorDomainExpertiseTab({
  token,
  primaryColor,
  initialData,
  industryOptions,
  technologyOptions,
  domainAreaOptions,
  maxIndustries = 5,
  maxTechnologies = 5,
  maxDomainAreas = 5,
}: Props) {
  const {globalSetting} = useContext(TenantContext);
  const features = globalSetting?.features || {};
  const subIndustriesEnabled = Boolean(features.enable_sub_industries);
  // Mentor new layout: parent mentorship-areas carry nested children. When on,
  // payload splits leaf vs parent IDs (domainAreas + domainAreasPrimary).
  const newDomainAreaLayout = Boolean(
    features.mentorship_areas_new_layout,
  );

  const [industries, setIndustries] = useState<Array<number | string>>([]);
  const [industrySubCategories, setIndustrySubCategories] = useState<
    Array<number | string>
  >([]);
  const [othersActive, setOthersActive] = useState(false);
  const [othersText, setOthersText] = useState('');
  const [technologies, setTechnologies] = useState<Array<number | string>>([]);
  const [domainAreas, setDomainAreas] = useState<Array<number | string>>([]);
  const [domainAreasPrimary, setDomainAreasPrimary] = useState<
    Array<number | string>
  >([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    tone: 'success' | 'error';
  } | null>(null);

  useEffect(() => {
    setIndustries(
      seedSelected(initialData, 'sectoralInterestIds', 'sectoralInterests'),
    );
    setIndustrySubCategories(
      seedSelected(
        initialData,
        'sectoralInterestSubIds',
        'sectoralInterestSub',
      ),
    );
    const others = Array.isArray(initialData?.sectoralInterestOthers)
      ? initialData.sectoralInterestOthers
      : [];
    setOthersActive(others.length > 0);
    setOthersText(others.join(','));

    setTechnologies(seedSelected(initialData, 'technologies', 'technologyIds'));
    setDomainAreas(seedSelected(initialData, 'domainAreas', 'domainAreaIds'));
    setDomainAreasPrimary(
      seedSelected(initialData, 'domainAreasPrimary', 'domainAreasPrimaryIds'),
    );
  }, [initialData]);

  const onSave = async () => {
    setMessage(null);
    setSaving(true);
    try {
      const otherList = othersActive
        ? othersText
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
        : [];

      const payload: Record<string, any> = {
        sectoralInterestIds: industries.map(Number),
        sectoralInterestSubIds: industrySubCategories.map(Number),
        sectoralInterestOthers: otherList,
        technologies: technologies.map(Number),
        domainAreas: domainAreas.map(Number),
      };
      if (newDomainAreaLayout) {
        // New layout sends parent category IDs separately. Old layout
        // omits this key entirely.
        payload.domainAreasPrimary = domainAreasPrimary.map(Number);
      }

      await authService.updateProfile(token, payload, 'mentor');
      setMessage({text: 'Domain expertise saved.', tone: 'success'});
    } catch (error) {
      setMessage({
        text:
          error instanceof Error
            ? error.message
            : 'Could not save domain expertise.',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Domain Expertise</Text>
      <Text style={styles.subtitle}>
        The industries, technologies and domain areas you can mentor in.
      </Text>

      <MultiSelectField
        label="Industries"
        hint={`Select up to ${maxIndustries}`}
        options={industryOptions}
        selected={industries}
        primaryColor={primaryColor}
        max={maxIndustries}
        onChange={next => {
          // Drop sub-category picks whose parent industry was deselected.
          const visibleSubs = new Set<number>();
          industryOptions
            .filter(opt => next.includes(opt.id))
            .forEach(opt => {
              opt.industrySubCategoryDomains?.forEach(sub =>
                visibleSubs.add(sub.id),
              );
            });
          setIndustries(next);
          setIndustrySubCategories(prev =>
            prev.filter(id => visibleSubs.has(Number(id))),
          );
        }}
      />

      {subIndustriesEnabled
        ? (() => {
            const subs: Array<{id: number; name: string}> = [];
            const seen = new Set<number>();
            industryOptions
              .filter(opt => industries.includes(opt.id))
              .forEach(opt => {
                opt.industrySubCategoryDomains?.forEach(sub => {
                  if (!seen.has(sub.id)) {
                    seen.add(sub.id);
                    subs.push(sub);
                  }
                });
              });
            if (subs.length === 0) return null;
            return (
              <MultiSelectField
                label="Industry sub-categories"
                hint="Pick the sub-areas inside your chosen industries."
                options={subs}
                selected={industrySubCategories}
                primaryColor={primaryColor}
                onChange={setIndustrySubCategories}
              />
            );
          })()
        : null}

      <View style={styles.otherToggleRow}>
        <Text style={styles.otherToggleLabel}>Add other industries</Text>
        <Switch
          value={othersActive}
          onValueChange={val => {
            setOthersActive(val);
            if (!val) setOthersText('');
          }}
          trackColor={{false: '#cbd5e1', true: `${primaryColor}55`}}
          thumbColor={othersActive ? primaryColor : '#f1f5f9'}
        />
      </View>
      {othersActive ? (
        <TextInput
          style={styles.otherInput}
          value={othersText}
          onChangeText={setOthersText}
          placeholder="Separate multiple entries with commas"
          placeholderTextColor="#94a3b8"
          autoCapitalize="words"
        />
      ) : null}

      <MultiSelectField
        label="Technologies"
        hint={`Select up to ${maxTechnologies}`}
        options={technologyOptions}
        selected={technologies}
        primaryColor={primaryColor}
        max={maxTechnologies}
        onChange={setTechnologies}
      />

      {domainAreaOptions.length > 0 ? (
        newDomainAreaLayout ? (
          // New layout: parent categories + nested specialisations.
          <>
            <MultiSelectField
              label="Mentorship Areas"
              hint={`Select up to ${maxDomainAreas}`}
              options={domainAreaOptions}
              selected={domainAreasPrimary}
              primaryColor={primaryColor}
              max={maxDomainAreas}
              onChange={next => {
                // Drop leaf picks whose parent was deselected.
                const visibleLeaves = new Set<number>();
                domainAreaOptions
                  .filter(opt => next.includes(opt.id))
                  .forEach(opt => {
                    opt.domainAreas?.forEach(leaf =>
                      visibleLeaves.add(leaf.id),
                    );
                  });
                setDomainAreasPrimary(next);
                setDomainAreas(prev =>
                  prev.filter(id => visibleLeaves.has(Number(id))),
                );
              }}
            />
            {(() => {
              const leaves: Array<{id: number; name: string}> = [];
              const seen = new Set<number>();
              domainAreaOptions
                .filter(opt => domainAreasPrimary.includes(opt.id))
                .forEach(opt => {
                  opt.domainAreas?.forEach(leaf => {
                    if (!seen.has(leaf.id)) {
                      seen.add(leaf.id);
                      leaves.push(leaf);
                    }
                  });
                });
              if (leaves.length === 0) return null;
              return (
                <MultiSelectField
                  label="Specialisations"
                  hint="Pick the specific areas inside your selected categories."
                  options={leaves}
                  selected={domainAreas}
                  primaryColor={primaryColor}
                  onChange={setDomainAreas}
                />
              );
            })()}
          </>
        ) : (
          <MultiSelectField
            label="Domain Areas"
            hint={`Select up to ${maxDomainAreas}`}
            options={domainAreaOptions}
            selected={domainAreas}
            primaryColor={primaryColor}
            max={maxDomainAreas}
            onChange={setDomainAreas}
          />
        )
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
  otherToggleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  otherToggleLabel: {
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
