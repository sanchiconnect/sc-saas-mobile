import React from 'react';
import {Pressable, StyleSheet, Text, TextInput, View} from 'react-native';

import {Icon} from '../../shared/components/Icon';
import {editorTools} from '../config/menus';
import {DashboardStat} from '../types';

type DashboardContentProps = {
  primaryColor: string;
  userFirstName: string;
  searchText: string;
  onSearchChange: (value: string) => void;
  stats: DashboardStat[];
  profileCompletion: number;
  onEditProfile?: () => void;
};

function getGreeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export function DashboardContent({
  primaryColor,
  userFirstName,
  searchText,
  onSearchChange,
  stats,
  profileCompletion,
  onEditProfile,
}: DashboardContentProps) {
  return (
    <>
      <View style={[styles.heroPanel, {backgroundColor: primaryColor}]}>
        <View style={styles.heroContent}>
          <View style={styles.heroCopy}>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.heroName}>{userFirstName}</Text>

            <View style={styles.searchCard}>
              <View style={styles.searchRow}>
                <Icon name="magnify" size={20} color="#0a0a0a" />
                <TextInput
                  placeholder="Enter a keyword"
                  placeholderTextColor="#a8b0cf"
                  style={styles.searchInput}
                  value={searchText}
                  onChangeText={onSearchChange}
                />
              </View>

              <View style={styles.filterRow}>
                <Text style={styles.filterText}>All</Text>
                <Icon name="chevron-down" size={20} color="#9da4bb" />
              </View>
            </View>
          </View>

          <View style={styles.heroAside}>
            <View style={styles.progressRingOuter}>
              <View
                style={[
                  styles.progressRingInner,
                  {backgroundColor: primaryColor},
                ]}>
                <Text style={styles.progressValue}>{profileCompletion}%</Text>
              </View>
            </View>

            <Pressable
              style={styles.editProfileButton}
              onPress={onEditProfile}
              accessibilityRole="button"
              accessibilityLabel="Edit profile">
              <Text style={styles.editProfileText}>Edit profile</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.statsGrid}>
        {stats.map(item => (
          <View key={item.key} style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text
                style={[
                  styles.statValue,
                  item.accent ? {color: primaryColor} : null,
                ]}>
                {item.value}
              </Text>
              <View
                style={[
                  styles.statIconBubble,
                  item.accent
                    ? {backgroundColor: `${primaryColor}1a`}
                    : null,
                ]}>
                <Icon
                  name={item.icon}
                  size={20}
                  color={item.accent ? primaryColor : '#94a3b8'}
                />
              </View>
            </View>
            <Text style={styles.statTitle}>{item.title}</Text>
          </View>
        ))}
      </View>

      <View style={styles.editorCard}>
        <View style={styles.editorToolbar}>
          {editorTools.map(tool => (
            <Pressable key={tool.key} style={styles.toolButton}>
              <Icon name={tool.icon!} size={20} color="#9aa2bd" />
            </Pressable>
          ))}
        </View>

        <View style={styles.editorDivider} />

        <View style={styles.editorBody}>
          <Text style={styles.editorPlaceholder}>
            What's in your mind today?
          </Text>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  heroPanel: {
    minHeight: 255,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  heroContent: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
  },
  heroCopy: {
    flex: 1,
  },
  greeting: {
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 4,
  },
  heroName: {
    color: '#ffffff',
    fontSize: 23,
    fontWeight: '800',
    marginBottom: 18,
  },
  searchCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  searchRow: {
    alignItems: 'center',
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 10,
  },
  searchInput: {
    color: '#1f2a44',
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  filterRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  filterText: {
    color: '#1f2a44',
    fontSize: 14,
    fontWeight: '500',
  },
  heroAside: {
    alignItems: 'center',
    width: 132,
  },
  progressRingOuter: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 999,
    height: 110,
    justifyContent: 'center',
    marginBottom: 16,
    width: 110,
  },
  progressRingInner: {
    alignItems: 'center',
    borderColor: '#ffffff',
    borderRadius: 999,
    borderWidth: 3,
    height: 84,
    justifyContent: 'center',
    width: 84,
  },
  progressValue: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  editProfileButton: {
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  editProfileText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: -28,
    paddingHorizontal: 16,
  },
  statCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    elevation: 4,
    flexBasis: '48%',
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: '#aac0f4',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },
  statHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  statValue: {
    color: '#020202',
    fontSize: 18,
    fontWeight: '800',
  },
  statIconBubble: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  statTitle: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  editorCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    elevation: 4,
    marginHorizontal: 16,
    marginTop: 22,
    minHeight: 220,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#c9d3ef',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },
  editorToolbar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingBottom: 10,
  },
  toolButton: {
    alignItems: 'center',
    borderRadius: 8,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  editorDivider: {
    backgroundColor: '#e6ebf7',
    height: 1,
    marginBottom: 16,
  },
  editorBody: {
    flex: 1,
    minHeight: 150,
    paddingHorizontal: 6,
  },
  editorPlaceholder: {
    color: '#aab2cd',
    fontSize: 15,
    lineHeight: 22,
  },
});
