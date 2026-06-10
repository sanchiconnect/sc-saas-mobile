import React, {forwardRef, useContext, useEffect, useImperativeHandle, useMemo, useRef, useState} from 'react';
import {StyleSheet, Switch, Text, TextInput, View} from 'react-native';

import {TenantContext} from '../../../../core/tenant/TenantProvider';
import {useToast} from '../../../../core/toast/ToastProvider';
import {authService} from '../../../auth/services/auth.service';

import {
  MultiSelectField,
  MultiSelectOption,
} from './MultiSelectField';

export type SecondaryTabHandle = {
  triggerSave: () => Promise<void>;
};

type Props = {
  token: string;
  primaryColor: string;
  initialData: Record<string, any> | null;
  industryOptions: MultiSelectOption[];
  technologyOptions: MultiSelectOption[];
  domainAreaOptions: MultiSelectOption[];
  maxIndustries?: number;
  maxTechnologies?: number;
  maxDomainAreas?: number;
  onSaveSuccess?: () => void;
  onValidChange?: (valid: boolean) => void;
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

export const MentorDomainExpertiseTab = forwardRef<SecondaryTabHandle, Props>(
function MentorDomainExpertiseTab({
  token,
  primaryColor,
  initialData,
  industryOptions,
  technologyOptions,
  domainAreaOptions,
  maxIndustries = 5,
  maxTechnologies = 5,
  maxDomainAreas = 5,
  onSaveSuccess,
  onValidChange,
}: Props, ref) {
  const {globalSetting} = useContext(TenantContext);
  const toast = useToast();
  const features = globalSetting?.features || {};
  const subIndustriesEnabled = Boolean(features.enable_sub_industries);
  const newDomainAreaLayout = Boolean(features.mentorship_areas_new_layout);

  const [industries, setIndustries] = useState<Array<number | string>>([]);
  const [industrySubCategories, setIndustrySubCategories] = useState<Array<number | string>>([]);
  const [othersActive, setOthersActive] = useState(false);
  const [othersText, setOthersText] = useState('');
  const [technologies, setTechnologies] = useState<Array<number | string>>([]);
  // domainAreas: flat selections (old layout) or leaf selections (new layout)
  const [domainAreas, setDomainAreas] = useState<Array<number | string>>([]);
  // domainAreasPrimary: parent selections (new layout only)
  const [domainAreasPrimary, setDomainAreasPrimary] = useState<Array<number | string>>([]);

  useEffect(() => {
    setIndustries(
      seedSelected(initialData, 'sectoralInterestIds', 'sectoralInterests'),
    );
    setIndustrySubCategories(
      seedSelected(initialData, 'sectoralInterestSubIds', 'sectoralInterestSub'),
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

  // Show Technologies block only when a domain area with "Technology" in its
  // name is currently selected — mirrors Angular's isTechSelectedInDomain.
  const isTechSelectedInDomain = useMemo(() => {
    if (newDomainAreaLayout) {
      // New layout: check if any selected leaf has "technology" in its name
      for (const opt of domainAreaOptions) {
        if (!domainAreasPrimary.includes(opt.id)) { continue; }
        for (const leaf of opt.domainAreas ?? []) {
          if (
            domainAreas.includes(leaf.id) &&
            leaf.name.toLowerCase().includes('technology')
          ) {
            return true;
          }
        }
      }
      return false;
    }
    // Old layout: check if any selected domain area option has "technology"
    return domainAreaOptions.some(
      opt =>
        domainAreas.includes(opt.id) &&
        opt.name.toLowerCase().includes('technology'),
    );
  }, [domainAreaOptions, domainAreas, domainAreasPrimary, newDomainAreaLayout]);

  // Tab is valid when all required fields are filled — mirrors Angular saveButtonDisabled.
  const isValid = useMemo(() => {
    // At least one domain area must be selected
    const hasDomainArea = newDomainAreaLayout
      ? domainAreasPrimary.length > 0
      : domainAreas.length > 0;
    if (!hasDomainArea) { return false; }

    if (newDomainAreaLayout) {
      // Every selected parent that has sub-domains must have at least one leaf selected
      const parentsMissingLeaf = domainAreaOptions.some(opt => {
        if (!domainAreasPrimary.includes(opt.id)) { return false; }
        if (!opt.domainAreas?.length) { return false; }
        return !opt.domainAreas.some(leaf => domainAreas.includes(leaf.id));
      });
      if (parentsMissingLeaf) { return false; }

      // If technology domain is selected, at least one technology must be chosen
      if (isTechSelectedInDomain && technologies.length === 0) { return false; }
    }

    // At least one industry is required when options are available
    if (industryOptions.length > 0 && industries.length === 0) { return false; }

    return true;
  }, [
    newDomainAreaLayout,
    domainAreasPrimary,
    domainAreas,
    domainAreaOptions,
    isTechSelectedInDomain,
    technologies,
    industryOptions,
    industries,
  ]);

  useEffect(() => {
    onValidChange?.(isValid);
  }, [isValid, onValidChange]);

  // Leaf options visible under the currently selected parent domain areas
  const visibleDomainLeaves = useMemo(() => {
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
    return leaves;
  }, [domainAreaOptions, domainAreasPrimary]);

  // Industry sub-category options visible under currently selected industries
  const visibleIndustrySubs = useMemo(() => {
    if (!subIndustriesEnabled) { return []; }
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
    return subs;
  }, [industryOptions, industries, subIndustriesEnabled]);

  const onSave = async () => {
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
        // Send empty array if "Technology" domain is not selected
        technologies: isTechSelectedInDomain ? technologies.map(Number) : [],
        domainAreas: domainAreas.map(Number),
      };
      if (newDomainAreaLayout) {
        payload.domainAreasPrimary = domainAreasPrimary.map(Number);
      }

      await authService.updateProfile(token, payload, 'mentor');
      toast.success('Domain expertise saved.');
      onSaveSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not save domain expertise.',
      );
    }
  };

  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  useImperativeHandle(ref, () => ({
    triggerSave: () => saveRef.current(),
  }));

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Domain Expertise</Text>
      <Text style={styles.subtitle}>
        The domains you can mentor in. Select your areas of expertise below.
      </Text>

      {/* ── 1. Domain Areas ── */}
      {domainAreaOptions.length > 0 ? (
        newDomainAreaLayout ? (
          <>
            <MultiSelectField
              label="I am interested in providing mentorship to startups in the following domains:"
              required
              hint={`Select maximum ${maxDomainAreas} options`}
              options={domainAreaOptions}
              selected={domainAreasPrimary}
              primaryColor={primaryColor}
              max={maxDomainAreas}
              onChange={next => {
                // Prune leaf picks whose parent was deselected
                const stillVisible = new Set<number>();
                domainAreaOptions
                  .filter(opt => next.includes(opt.id))
                  .forEach(opt =>
                    opt.domainAreas?.forEach(leaf => stillVisible.add(leaf.id)),
                  );
                setDomainAreasPrimary(next);
                const prunedLeaves = domainAreas.filter(id =>
                  stillVisible.has(Number(id)),
                );
                setDomainAreas(prunedLeaves);
                // Clear tech if technology leaf is no longer reachable
                const techLeafStillVisible = [...stillVisible].some(id => {
                  for (const opt of domainAreaOptions) {
                    if (opt.domainAreas?.find(l => l.id === id && l.name.toLowerCase().includes('technology'))) {
                      return true;
                    }
                  }
                  return false;
                });
                if (!techLeafStillVisible) { setTechnologies([]); }
              }}
            />
            {visibleDomainLeaves.length > 0 ? (
              <MultiSelectField
                label="Specialisations"
                hint="Pick the specific areas inside your selected categories."
                options={visibleDomainLeaves}
                selected={domainAreas}
                primaryColor={primaryColor}
                onChange={next => {
                  setDomainAreas(next);
                  // Clear tech if technology leaf was deselected
                  const techLeaf = visibleDomainLeaves.find(l =>
                    l.name.toLowerCase().includes('technology'),
                  );
                  if (techLeaf && !next.includes(techLeaf.id)) {
                    setTechnologies([]);
                  }
                }}
              />
            ) : null}
          </>
        ) : (
          <MultiSelectField
            label="I am interested in providing mentorship to startups in the following domains:"
            required
            hint={`Select maximum ${maxDomainAreas} options`}
            options={domainAreaOptions}
            selected={domainAreas}
            primaryColor={primaryColor}
            max={maxDomainAreas}
            onChange={next => {
              // Clear tech if the "Technology" domain area was deselected
              const techOpt = domainAreaOptions.find(opt =>
                opt.name.toLowerCase().includes('technology'),
              );
              if (techOpt && !next.includes(techOpt.id)) {
                setTechnologies([]);
              }
              setDomainAreas(next);
            }}
          />
        )
      ) : null}

      {/* ── 2. Technologies (only when "Technology" domain area is selected) ── */}
      {isTechSelectedInDomain ? (
        <MultiSelectField
          label="Technologies"
          required
          hint={`Select up to ${maxTechnologies}`}
          options={technologyOptions}
          selected={technologies}
          primaryColor={primaryColor}
          max={maxTechnologies}
          onChange={setTechnologies}
        />
      ) : null}

      {/* ── 3. Industry specialisation (always shown when options available) ── */}
      {industryOptions.length > 0 ? (
        <>
          <MultiSelectField
            label="Industry specialisation"
            required
            hint={`Select maximum ${maxIndustries} options`}
            options={industryOptions}
            selected={industries}
            primaryColor={primaryColor}
            max={maxIndustries}
            onChange={next => {
              const visibleSubs = new Set<number>();
              industryOptions
                .filter(opt => next.includes(opt.id))
                .forEach(opt =>
                  opt.industrySubCategoryDomains?.forEach(sub =>
                    visibleSubs.add(sub.id),
                  ),
                );
              setIndustries(next);
              setIndustrySubCategories(prev =>
                prev.filter(id => visibleSubs.has(Number(id))),
              );
            }}
          />

          {visibleIndustrySubs.length > 0 ? (
            <MultiSelectField
              label="Industry sub-categories"
              hint="Pick the sub-areas inside your chosen industries."
              options={visibleIndustrySubs}
              selected={industrySubCategories}
              primaryColor={primaryColor}
              onChange={setIndustrySubCategories}
            />
          ) : null}

          <View style={styles.otherToggleRow}>
            <Text style={styles.otherToggleLabel}>Add other industries</Text>
            <Switch
              value={othersActive}
              onValueChange={val => {
                setOthersActive(val);
                if (!val) { setOthersText(''); }
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
        </>
      ) : null}

    </View>
  );
});

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
