import React, {useCallback, useContext, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {Icon} from '../../../core/components/Icon';
import {colors} from '../../../core/theme/colors';
import {TenantContext} from '../../../core/tenant/TenantProvider';
import {
  FlatStartupKitData,
  StartupKitService,
  startupKitService,
} from '../services/startupKit.service';
import {StartupKitDetailScreen} from './StartupKitDetailScreen';

type Props = {
  token: string;
  onBack: () => void;
};

export function StartupBoosterKitScreen({token, onBack}: Props) {
  const {theme, globalSetting} = useContext(TenantContext);
  const primaryColor = theme?.primary || colors.primary;
  const imgKitUrl: string | undefined =
    globalSetting?.imgKitUrl ||
    globalSetting?.assetsImgKitUrl ||
    (globalSetting as any)?.s3Url ||
    undefined;

  const title =
    (globalSetting as any)?.startup_kit_title || 'Startup Booster Kit';

  const [detailUuid, setDetailUuid] = useState<string | null>(null);

  const [data, setData] = useState<FlatStartupKitData>({
    categories: [],
    services: [],
  });
  const [displayedServices, setDisplayedServices] = useState<StartupKitService[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await startupKitService.getData(imgKitUrl);
      setData(result);
      setDisplayedServices(result.services);
      setSelectedCategory(null);
    } catch {
      // non-fatal
    } finally {
      setIsLoading(false);
    }
  }, [imgKitUrl]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCategoryPress = (categoryName: string | null) => {
    setSelectedCategory(categoryName);
    if (!categoryName) {
      setDisplayedServices(data.services);
    } else {
      setDisplayedServices(
        data.services.filter(s => s.type === categoryName),
      );
    }
  };

  if (detailUuid) {
    return (
      <StartupKitDetailScreen
        uuid={detailUuid}
        token={token}
        imgKitUrl={imgKitUrl}
        primaryColor={primaryColor}
        onBack={() => setDetailUuid(null)}
      />
    );
  }

  return (
    <View style={styles.page}>
      {/* Top bar */}
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
          {title}
        </Text>
      </View>

      {/* Category filter chips */}
      {data.categories.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesRow}
          style={styles.categoriesBar}>
          {/* ALL chip */}
          <Pressable
            onPress={() => handleCategoryPress(null)}
            style={[
              styles.chip,
              selectedCategory === null && {
                backgroundColor: primaryColor,
                borderColor: primaryColor,
              },
            ]}>
            <Text
              style={[
                styles.chipText,
                selectedCategory === null && styles.chipTextActive,
              ]}>
              ALL
            </Text>
          </Pressable>

          {data.categories.map(cat => {
            const isActive = selectedCategory === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => handleCategoryPress(cat)}
                style={[
                  styles.chip,
                  isActive && {
                    backgroundColor: primaryColor,
                    borderColor: primaryColor,
                  },
                ]}>
                <Text
                  style={[
                    styles.chipText,
                    isActive && styles.chipTextActive,
                  ]}>
                  {cat.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {/* Content */}
      {isLoading ? (
        <ActivityIndicator
          color={primaryColor}
          size="large"
          style={styles.loader}
        />
      ) : displayedServices.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="package-variant-closed" size={48} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>Coming soon</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}>
          {displayedServices.map(service => (
            <View key={service.uuid} style={styles.card}>
              <View style={styles.cardInner}>
                {/* Logo */}
                <View style={styles.logoWrap}>
                  {service.logo ? (
                    <Image
                      source={{uri: service.logo}}
                      style={styles.logo}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.logoPlaceholder}>
                      <Icon name="image-outline" size={28} color="#cbd5e1" />
                    </View>
                  )}
                </View>

                {/* Info */}
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {service.name}
                </Text>
                {service.shortDescription ? (
                  <Text style={styles.cardDescription} numberOfLines={3}>
                    {service.shortDescription}
                  </Text>
                ) : null}

                {/* Explore button */}
                <Pressable
                  onPress={() => setDetailUuid(service.uuid)}
                  style={({pressed}) => [
                    styles.exploreBtn,
                    {borderColor: primaryColor},
                    pressed && {opacity: 0.7},
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Explore ${service.name}`}>
                  <Text style={[styles.exploreBtnText, {color: primaryColor}]}>
                    Explore
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
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

  categoriesBar: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexGrow: 0,
  },
  categoriesRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chip: {
    borderColor: '#cbd5e1',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  chipText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  chipTextActive: {color: '#ffffff'},

  loader: {marginTop: 60},

  empty: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
  },
  emptyTitle: {color: '#94a3b8', fontSize: 15, fontWeight: '600'},

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    padding: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 4,
    width: '47%',
  },
  cardInner: {
    gap: 8,
    padding: 12,
  },
  logoWrap: {
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    height: 90,
    marginBottom: 4,
    overflow: 'hidden',
  },
  logo: {
    height: '100%',
    width: '100%',
  },
  logoPlaceholder: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    flex: 1,
    justifyContent: 'center',
  },
  cardTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  cardDescription: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 17,
  },
  exploreBtn: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
    paddingVertical: 7,
  },
  exploreBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
