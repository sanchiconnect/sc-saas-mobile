import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {Icon} from '../../shared/components/Icon';
import {MenuItem} from '../types';

type SectionScreenProps = {
  sectionTitle: string;
  sectionSubtitle: string;
  activeItem?: string;
  items: MenuItem[];
  primaryColor: string;
  onSelectItem: (item: string) => void;
};

export function SectionScreen({
  sectionTitle,
  sectionSubtitle,
  activeItem,
  items,
  primaryColor,
  onSelectItem,
}: SectionScreenProps) {
  const active = items.find(it => it.label === activeItem) || items[0];

  return (
    <View style={styles.wrap}>
      <View style={[styles.heroCard, {backgroundColor: primaryColor}]}>
        <Text style={styles.eyebrow}>Workspace</Text>
        <Text style={styles.title}>{sectionTitle}</Text>
        <Text style={styles.subtitle}>{sectionSubtitle}</Text>
      </View>

      <View style={styles.contentCard}>
        <Text style={styles.contentTitle}>Available Options</Text>

        <View style={styles.chipsWrap}>
          {items.map(item => {
            const isActive = activeItem === item.label;
            return (
              <Pressable
                key={item.key}
                onPress={() => onSelectItem(item.label)}
                style={[
                  styles.chip,
                  isActive
                    ? {
                        backgroundColor: primaryColor,
                        borderColor: primaryColor,
                      }
                    : null,
                ]}>
                {item.icon ? (
                  <Icon
                    name={item.icon}
                    size={16}
                    color={isActive ? '#ffffff' : '#475569'}
                  />
                ) : null}
                <Text
                  style={[
                    styles.chipText,
                    isActive ? styles.chipTextActive : null,
                  ]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.detailCard}>
          <Text style={styles.detailEyebrow}>Current Selection</Text>
          <View style={styles.detailHeader}>
            {active?.icon ? (
              <Icon name={active.icon} size={28} color={primaryColor} />
            ) : null}
            <Text style={styles.detailTitle}>{active?.label}</Text>
          </View>
          <Text style={styles.detailBody}>
            This reusable section is now clickable. We can connect each item
            to its own API data or dedicated screen next.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: 24,
  },
  heroCard: {
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 30,
  },
  eyebrow: {
    color: '#dbe3ff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: '#eef2ff',
    fontSize: 15,
    lineHeight: 22,
  },
  contentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    elevation: 4,
    marginHorizontal: 16,
    marginTop: -18,
    padding: 18,
    shadowColor: '#c9d3ef',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.18,
    shadowRadius: 18,
  },
  contentTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 14,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  chip: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: '#dbe3f4',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  detailCard: {
    backgroundColor: '#f8fbff',
    borderRadius: 18,
    padding: 16,
  },
  detailEyebrow: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  detailHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  detailTitle: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '800',
  },
  detailBody: {
    color: '#475569',
    fontSize: 15,
    lineHeight: 22,
  },
});
