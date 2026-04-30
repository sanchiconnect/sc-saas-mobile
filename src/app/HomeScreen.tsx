import React, {useContext, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {AuthSession} from '../auth/models/auth.models';
import {TenantContext} from '../context/TenantProvider';
import {Icon} from '../shared/components/Icon';
import {DashboardContent} from './components/DashboardContent';
import {SectionScreen} from './components/SectionScreen';
import {SideMenu} from './components/SideMenu';
import {connectItems, programItems} from './config/menus';
import {EditProfileScreen} from './screens/EditProfileScreen';
import {dashboardService} from './services/dashboard.service';
import {AppMenuSelection, DashboardSummary} from './types';

type HomeScreenProps = {
  session: AuthSession;
  onLogout: () => void;
};

export function HomeScreen({session, onLogout}: HomeScreenProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState<AppMenuSelection>({
    section: 'dashboard',
  });
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const {globalSetting, theme} = useContext(TenantContext);

  const loadSummary = async () => {
    const next = await dashboardService.fetchSummary();
    setSummary(next);
  };

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    dashboardService
      .fetchSummary()
      .then(next => {
        if (!cancelled) setSummary(next);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadSummary();
    } finally {
      setIsRefreshing(false);
    }
  };

  const logoBaseUrl =
    globalSetting?.imgKitUrl || globalSetting?.assetsImgKitUrl;
  const logoPath = globalSetting?.logo;
  const logoUri =
    logoBaseUrl && logoPath
      ? `${logoBaseUrl.replace(/\/$/, '')}/${logoPath.replace(/^\//, '')}`
      : null;
  const userFirstName = session.user.fullName.split(' ')[0] || 'User';
  const primaryColor = theme?.primary || '#0b0aa3';

  if (isLoading) {
    return (
      <View style={styles.loadingPage}>
        <ActivityIndicator size="large" color={primaryColor} />
        <Text style={styles.loadingTitle}>Loading dashboard...</Text>
        <Text style={styles.loadingSubtitle}>
          Fetching your latest workspace data.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <SideMenu
        globalSetting={globalSetting}
        isVisible={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onLogout={onLogout}
        onSelectMenu={setSelectedMenu}
        primaryColor={primaryColor}
        selectedMenu={selectedMenu}
        session={session}
      />

      <View style={styles.topBar}>
        <Pressable
          style={styles.iconButton}
          onPress={() => setIsMenuOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Open menu">
          <Icon name="menu" size={24} color="#475569" />
        </Pressable>

        {logoUri ? (
          <Image source={{uri: logoUri}} style={styles.logo} />
        ) : (
          <Text style={styles.brandText}>
            {globalSetting?.brandName || 'Logo'}
          </Text>
        )}

        <View style={styles.topActions}>
          <Pressable
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Messages">
            <Icon name="message-text-outline" size={22} color="#475569" />
          </Pressable>
          <Pressable
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Team">
            <Icon name="account-group-outline" size={22} color="#475569" />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[primaryColor]}
          />
        }
        showsVerticalScrollIndicator={false}>
        {selectedMenu.section === 'dashboard' ? (
          <DashboardContent
            onSearchChange={setSearchText}
            onEditProfile={() =>
              setSelectedMenu({section: 'edit-profile'})
            }
            primaryColor={primaryColor}
            profileCompletion={summary?.profileCompletion ?? 0}
            searchText={searchText}
            stats={summary?.stats ?? []}
            userFirstName={userFirstName}
          />
        ) : null}

        {selectedMenu.section === 'edit-profile' ? (
          <EditProfileScreen
            token={session.token}
            onBack={() => setSelectedMenu({section: 'dashboard'})}
          />
        ) : null}

        {selectedMenu.section === 'connect' ? (
          <SectionScreen
            activeItem={selectedMenu.item}
            items={connectItems}
            onSelectItem={item =>
              setSelectedMenu({section: 'connect', item})
            }
            primaryColor={primaryColor}
            sectionSubtitle="Build professional relationships across the ecosystem and switch between connection groups from one reusable view."
            sectionTitle="Connect"
          />
        ) : null}

        {selectedMenu.section === 'program' ? (
          <SectionScreen
            activeItem={selectedMenu.item}
            items={programItems}
            onSelectItem={item =>
              setSelectedMenu({section: 'program', item})
            }
            primaryColor={primaryColor}
            sectionSubtitle="Track applications, certificates, and program activity from a dedicated reusable program component."
            sectionTitle="Program"
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#eef3ff',
  },
  content: {
    paddingBottom: 40,
  },
  topBar: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: 10,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  topActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  logo: {
    height: 32,
    resizeMode: 'contain',
    width: 110,
  },
  brandText: {
    color: '#1f2a44',
    fontSize: 18,
    fontWeight: '700',
  },
  loadingPage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#eef3ff',
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
  },
  loadingSubtitle: {
    color: '#64748b',
    marginTop: 6,
  },
});
