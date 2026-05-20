import React from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';

import {Icon} from '../../../core/components/Icon';

// A recommended/recently-added card on the dashboard. Backed by the raw
// items the role-specific `*/dashboard` endpoint returns. Fields vary by
// role (companyName / organizationName / name; companyLogo / avatar; …) so
// the component takes the raw payload and a `kind` tag and figures out
// what to render.

export type RecommendedKind =
  | 'startup'
  | 'investor'
  | 'mentor'
  | 'corporate';

type Props = {
  kind: RecommendedKind;
  item: Record<string, any>;
  // Used to resolve relative logo paths (`settings/foo.png`) into absolute URLs.
  logoBaseUrl?: string;
  onPress?: () => void;
};

const FALLBACK_ICON: Record<RecommendedKind, string> = {
  startup: 'rocket-launch',
  investor: 'cash-multiple',
  mentor: 'account-tie',
  corporate: 'office-building',
};

const resolveName = (item: Record<string, any>): string =>
  String(
    item?.companyName ||
      item?.organizationName ||
      item?.name ||
      item?.fullName ||
      '',
  );

const resolveHeadline = (item: Record<string, any>): string =>
  String(
    item?.shortDescription ||
      item?.briefDescription ||
      item?.elevatorPitch ||
      item?.aboutUs ||
      item?.tagline ||
      '',
  ).slice(0, 110);

const resolveCity = (item: Record<string, any>): string => {
  const city =
    item?.registeredCity?.name ||
    item?.city?.name ||
    item?.city ||
    item?.registeredCity ||
    '';
  return typeof city === 'string' ? city : '';
};

const resolveIndustries = (item: Record<string, any>): string[] => {
  const list =
    item?.sectoralInterests ||
    item?.startupIndustries ||
    item?.industries ||
    [];
  if (!Array.isArray(list)) return [];
  return list
    .map((x: any) => String(x?.name || x?.label || ''))
    .filter(Boolean)
    .slice(0, 2);
};

const resolveLogo = (
  item: Record<string, any>,
  baseUrl?: string,
): string | null => {
  const raw =
    item?.companyLogo ||
    item?.organizationLogo ||
    item?.logo ||
    item?.avatar ||
    item?.profilePicture ||
    '';
  if (!raw) return null;
  // Already absolute.
  if (/^https?:\/\//.test(String(raw))) return String(raw);
  if (!baseUrl) return null;
  const trimmedBase = baseUrl.replace(/\/$/, '');
  const trimmedPath = String(raw).replace(/^\//, '');
  return `${trimmedBase}/${trimmedPath}`;
};

export function RecommendedCard({kind, item, logoBaseUrl, onPress}: Props) {
  const name = resolveName(item) || 'Untitled';
  const headline = resolveHeadline(item);
  const city = resolveCity(item);
  const industries = resolveIndustries(item);
  const logo = resolveLogo(item, logoBaseUrl);

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.logoWrap}>
        {logo ? (
          <Image source={{uri: logo}} style={styles.logo} />
        ) : (
          <Icon name={FALLBACK_ICON[kind]} size={28} color="#94a3b8" />
        )}
      </View>

      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>

      {headline ? (
        <Text style={styles.headline} numberOfLines={2}>
          {headline}
        </Text>
      ) : null}

      {city ? (
        <View style={styles.metaRow}>
          <Icon name="map-marker-outline" size={12} color="#64748b" />
          <Text style={styles.metaText} numberOfLines={1}>
            {city}
          </Text>
        </View>
      ) : null}

      {industries.length > 0 ? (
        <View style={styles.tagRow}>
          {industries.map(tag => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText} numberOfLines={1}>
                {tag}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 200,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginRight: 12,
    gap: 8,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 2},
    elevation: 1,
  },
  logoWrap: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: {
    width: 48,
    height: 48,
    resizeMode: 'cover',
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  headline: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: '#64748b',
    flex: 1,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#eef2ff',
  },
  tagText: {
    fontSize: 10,
    color: '#3730a3',
    fontWeight: '600',
  },
});
