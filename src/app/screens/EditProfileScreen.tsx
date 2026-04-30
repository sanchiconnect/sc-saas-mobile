import React, {useContext, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {AppButton} from '../../shared/components/AppButton';
import {Icon} from '../../shared/components/Icon';
import {colors} from '../../shared/theme/colors';
import {TenantContext} from '../../context/TenantProvider';
import {authService} from '../../auth/services/auth.service';
import {BasicInfoForm} from './editProfile/BasicInfoForm';
import {
  buildBasicInfoPayload,
  extractProfile,
} from './editProfile/extractProfile';
import {
  BasicInfoForm as BasicInfoFormType,
  EMPTY_BASIC_INFO,
} from './editProfile/types';
import type {EditProfileTab} from '../types';

type EditProfileScreenProps = {
  token: string;
  onBack: () => void;
};

const TABS: EditProfileTab[] = [
  {key: 'basic', label: 'Basic Information', status: 'incomplete'},
  {key: 'industry', label: 'Industry / Technology', status: 'incomplete'},
  {key: 'financials', label: 'Financials', status: 'incomplete'},
  {key: 'pitch', label: 'Pitch Deck', status: 'incomplete'},
];

export function EditProfileScreen({token, onBack}: EditProfileScreenProps) {
  const {theme, globalSetting} = useContext(TenantContext);
  const primaryColor = theme?.primary || colors.primary;
  const logoBaseUrl =
    globalSetting?.imgKitUrl || globalSetting?.assetsImgKitUrl;

  const [activeTab, setActiveTab] = useState(TABS[0].key);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<{
    text: string;
    tone: 'success' | 'error';
  } | null>(null);
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [basicInfo, setBasicInfo] =
    useState<BasicInfoFormType>(EMPTY_BASIC_INFO);

  const loadProfile = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const raw = await authService.getProfile(token);
      const extracted = extractProfile(raw, logoBaseUrl);
      setBasicInfo(extracted.basicInfo);
      setProfileCompletion(extracted.profileCompletion);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Could not load your profile.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    authService
      .getProfile(token)
      .then(raw => {
        if (cancelled) return;
        const extracted = extractProfile(raw, logoBaseUrl);
        setBasicInfo(extracted.basicInfo);
        setProfileCompletion(extracted.profileCompletion);
      })
      .catch(error => {
        if (cancelled) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : 'Could not load your profile.',
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, logoBaseUrl]);

  const tabs = useMemo<EditProfileTab[]>(() => {
    const isBasicComplete =
      Boolean(basicInfo.companyName) &&
      Boolean(basicInfo.companySize) &&
      Boolean(basicInfo.country) &&
      Boolean(basicInfo.productStage) &&
      basicInfo.isIncorporated !== null;
    return TABS.map(tab =>
      tab.key === 'basic'
        ? {...tab, status: isBasicComplete ? 'complete' : 'incomplete'}
        : tab,
    );
  }, [basicInfo]);

  const updateBasic = <K extends keyof BasicInfoFormType>(
    key: K,
    value: BasicInfoFormType[K],
  ) => {
    setBasicInfo(current => ({...current, [key]: value}));
    setSaveMessage(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      await authService.updateProfile(
        token,
        buildBasicInfoPayload(basicInfo),
      );
      setSaveMessage({text: 'Saved successfully.', tone: 'success'});
    } catch (error) {
      setSaveMessage({
        text:
          error instanceof Error
            ? error.message
            : 'Could not save your changes.',
        tone: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleNext = () => {
    const currentIndex = tabs.findIndex(tab => tab.key === activeTab);
    const next = tabs[currentIndex + 1];
    if (next) setActiveTab(next.key);
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={primaryColor} />
        <Text style={styles.loadingText}>Loading your profile…</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.centered}>
        <Icon name="alert-circle-outline" size={36} color={colors.danger} />
        <Text style={styles.errorTitle}>Couldn't load profile</Text>
        <Text style={styles.errorBody}>{loadError}</Text>
        <View style={styles.errorActions}>
          <AppButton label="Try again" onPress={loadProfile} />
          <AppButton label="Back" variant="secondary" onPress={onBack} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={onBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back">
          <Icon name="arrow-left" size={22} color="#0f172a" />
        </Pressable>
        <Text style={styles.title}>Edit Startup Details</Text>
      </View>

      {/* <View style={styles.completionRow}>
        <Text style={styles.completionLabel}>Profile completion</Text>
        <Text style={[styles.completionValue, {color: primaryColor}]}>
          {profileCompletion}%
        </Text>
      </View> */}
      {/* <View style={styles.completionTrack}>
        <View
          style={[
            styles.completionFill,
            {
              backgroundColor: primaryColor,
              width: `${Math.min(100, Math.max(0, profileCompletion))}%`,
            },
          ]}
        />
      </View> */}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}>
        {tabs.map(tab => {
          const isActive = tab.key === activeTab;
          const isComplete = tab.status === 'complete';
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[
                styles.tab,
                isActive && {borderBottomColor: primaryColor},
              ]}>
              <Text
                style={[
                  styles.tabText,
                  isActive && {color: primaryColor, fontWeight: '700'},
                ]}>
                {tab.label}
              </Text>
              <Icon
                name={isComplete ? 'check-circle' : 'alert-circle-outline'}
                size={16}
                color={isComplete ? colors.success : colors.danger}
              />
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        {activeTab === 'basic' ? (
          <BasicInfoForm
            primaryColor={primaryColor}
            value={basicInfo}
            onChange={updateBasic}
          />
        ) : (
          <View style={styles.placeholder}>
            <Icon name="hammer-wrench" size={32} color="#94a3b8" />
            <Text style={styles.placeholderTitle}>Coming soon</Text>
            <Text style={styles.placeholderBody}>
              This section is part of the upcoming release.
            </Text>
          </View>
        )}

        {saveMessage ? (
          <Text
            style={[
              styles.saveMessage,
              saveMessage.tone === 'success'
                ? styles.saveMessageSuccess
                : styles.saveMessageError,
            ]}>
            {saveMessage.text}
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerSlot}>
          <AppButton
            label={isSaving ? 'Saving…' : 'SAVE'}
            disabled={isSaving || activeTab !== 'basic'}
            loading={isSaving}
            onPress={handleSave}
          />
        </View>
        <View style={styles.footerSlot}>
          <AppButton
            label="NEXT STEP"
            variant="secondary"
            onPress={handleNext}
            disabled={
              tabs.findIndex(tab => tab.key === activeTab) === tabs.length - 1
            }
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  centered: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#64748b',
    fontSize: 15,
    marginTop: 12,
  },
  errorTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
  },
  errorBody: {
    color: '#475569',
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  errorActions: {
    gap: 10,
    marginTop: 18,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  backButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  title: {
    color: '#0f172a',
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
  },
  completionRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  completionLabel: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
  },
  completionValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  completionTrack: {
    backgroundColor: '#e2e8f0',
    borderRadius: 999,
    height: 6,
    marginHorizontal: 16,
    marginTop: 8,
    overflow: 'hidden',
  },
  completionFill: {
    borderRadius: 999,
    height: '100%',
  },
  tabsRow: {
    backgroundColor: '#ffffff',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  tab: {
    alignItems: 'center',
    borderBottomColor: 'transparent',
    borderBottomWidth: 2,
    flexDirection: 'row',
    gap: 6,
    paddingBottom: 10,
    paddingHorizontal: 4,
  },
  tabText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  placeholder: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  placeholderTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
  },
  placeholderBody: {
    color: '#64748b',
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  saveMessage: {
    fontSize: 13,
    marginTop: 14,
    textAlign: 'center',
  },
  saveMessageSuccess: {
    color: colors.success,
  },
  saveMessageError: {
    color: colors.danger,
  },
  footer: {
    backgroundColor: '#ffffff',
    borderTopColor: '#e2e8f0',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  footerSlot: {
    flex: 1,
  },
});
