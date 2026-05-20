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
import {AccountSettingsScreen} from './screens/AccountSettingsScreen';
import {ProfileScreen} from './screens/ProfileScreen';
import {ProgramsScreen} from './screens/ProgramsScreen';
import {
  accountSettingItems,
  actionItems,
  businessChallengeItems,
  communityItems,
  connectItems,
  eventItems,
  programItems,
  resourceItems,
  startupBoosterKitItems,
  ticketItems,
} from './config/menus';
import {ConnectionsScreen} from './screens/ConnectionsScreen';
import {EditProfileScreen} from './screens/EditProfileScreen';
import {StartupsScreen} from './screens/StartupsScreen';
import {TicketsScreen} from './screens/TicketsScreen';
import {dashboardService} from './services/dashboard.service';
import {AppMenuSelection, AppSection, DashboardSummary, MenuItem} from './types';

type HomeScreenProps = {
  session: AuthSession;
  onLogout: () => void;
  showWelcomePopup: boolean;
  onCloseWelcomePopup: () => void;
};

export function HomeScreen({
  session,
  onLogout,
  showWelcomePopup,
  onCloseWelcomePopup,
}: HomeScreenProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState<AppMenuSelection>({
    section: 'dashboard',
  });
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const {globalSetting, theme} = useContext(TenantContext);

  const loadSummary = async (token: string) => {
    const next = await dashboardService.fetchSummary(token);
    setSummary(next);
    return next;
  };

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    loadSummary(session.token)
      .then(next => {
        if (!cancelled) setSummary(next);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session.token]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadSummary(session.token);
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

  const sectionConfigs: Partial<
    Record<
      AppSection,
      {
        title: string;
        subtitle: string;
        items: MenuItem[];
      }
    >
  > = {
    connect: {
      title: 'Connect',
      subtitle:
        'Build professional relationships across the ecosystem and switch between connection groups from one reusable view.',
      items: connectItems,
    },
    program: {
      title: 'Programs',
      subtitle:
        'Track applications, certificates, and program activity from a dedicated reusable program component.',
      items: programItems,
    },
    community: {
      title: 'Community Wall',
      subtitle:
        'Follow community conversations, highlights, and updates from one central collaboration space.',
      items: communityItems,
    },
    'business-challenges': {
      title: 'Business Challenges',
      subtitle:
        'Browse challenge opportunities, manage responses, and keep your innovation pipeline active.',
      items: businessChallengeItems,
    },
    actions: {
      title: 'My Actions',
      subtitle:
        'Track your pending tasks, follow-ups, and important action items in one place.',
      items: actionItems,
    },
    events: {
      title: 'Events',
      subtitle:
        'See upcoming events, registrations, and participation details from this reusable events view.',
      items: eventItems,
    },
    'startup-booster-kit': {
      title: 'Startup Booster Kit',
      subtitle:
        'Access startup support tools, curated kits, and practical growth resources from one screen.',
      items: startupBoosterKitItems,
    },
    resources: {
      title: 'Resources',
      subtitle:
        'Open resource collections, guides, and support material from a single resource hub.',
      items: resourceItems,
    },
    tickets: {
      title: 'Tickets',
      subtitle:
        'Review support tickets, issue history, and request status from this shared ticket area.',
      items: ticketItems,
    },
    'account-settings': {
      title: 'Account Settings',
      subtitle:
        'Manage personal account preferences, profile settings, and account-level controls here.',
      items: accountSettingItems,
    },
  };

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

  if (selectedMenu.section === 'edit-profile') {
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

        <EditProfileScreen
          token={session.token}
          onBack={() => setSelectedMenu({section: 'dashboard'})}
          onPreview={() => setSelectedMenu({section: 'profile'})}
        />
      </View>
    );
  }

  if (selectedMenu.section === 'profile') {
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

        <ProfileScreen
          token={session.token}
          primaryColor={primaryColor}
          logoBaseUrl={logoBaseUrl}
          onBack={() => setSelectedMenu({section: 'dashboard'})}
          onEditProfile={() => setSelectedMenu({section: 'edit-profile'})}
        />
      </View>
    );
  }

  if (selectedMenu.section === 'program') {
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

        <ProgramsScreen
          token={session.token}
          primaryColor={primaryColor}
          logoBaseUrl={logoBaseUrl}
          defaultMode={
            selectedMenu.item === 'My Applications'
              ? 'my-applications'
              : 'all-programs'
          }
          onModeChange={mode =>
            setSelectedMenu({
              section: 'program',
              item: mode === 'my-applications' ? 'My Applications' : 'All Programs',
            })
          }
          onBack={() => setSelectedMenu({section: 'dashboard'})}
        />
      </View>
    );
  }

  if (selectedMenu.section === 'tickets') {
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

        <TicketsScreen
          token={session.token}
          onBack={() => setSelectedMenu({section: 'dashboard'})}
          primaryColor={primaryColor}
        />
      </View>
    );
  }

  console.log(
    '[HomeScreen] selectedMenu =',
    JSON.stringify(selectedMenu),
  );

  if (selectedMenu.section === 'my-connections') {
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

        <ConnectionsScreen
          token={session.token}
          primaryColor={primaryColor}
          logoBaseUrl={logoBaseUrl}
          onBack={() => setSelectedMenu({section: 'dashboard'})}
        />
      </View>
    );
  }

  if (
    selectedMenu.section === 'connect' &&
    (!selectedMenu.item || selectedMenu.item === 'Startups')
  ) {
    console.log('[HomeScreen] -> rendering StartupsScreen branch');
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

        <StartupsScreen
          token={session.token}
          userId={session.user.id}
          primaryColor={primaryColor}
          logoBaseUrl={logoBaseUrl}
          onBack={() => setSelectedMenu({section: 'dashboard'})}
        />
      </View>
    );
  }

  if (selectedMenu.section === 'account-settings') {
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

        <AccountSettingsScreen
          token={session.token}
          session={session}
          onBack={() => setSelectedMenu({section: 'dashboard'})}
          onLogout={onLogout}
        />
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
            onPress={() => setSelectedMenu({section: 'my-connections'})}
            accessibilityRole="button"
            accessibilityLabel="My connections">
            <Icon name="account-group-outline" size={22} color="#475569" />
          </Pressable>
        </View>
      </View>

      {showWelcomePopup && (
        <View style={styles.popupOverlay}>
          <View style={[styles.popupCard, {borderColor: primaryColor}]}> 
            {logoUri ? (
              <Image source={{uri: logoUri}} style={styles.popupLogo} />
            ) : (
              <Text style={[styles.popupTitle, {color: primaryColor}]}>Welcome</Text>
            )}
            <Text style={styles.popupHeading}>Welcome to {globalSetting?.brandName || 'the platform'}</Text>
            <Text style={styles.popupCopy}>
              Complete your profile and explore the dashboard to get started.
            </Text>
            <Pressable
              style={[styles.popupAction, {backgroundColor: primaryColor}]}
              onPress={onCloseWelcomePopup}
              accessibilityRole="button"
              accessibilityLabel="Continue">
              <Text style={styles.popupActionText}>Continue</Text>
            </Pressable>
          </View>
        </View>
      )}

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
        {selectedMenu.section !== 'dashboard' &&
        sectionConfigs[selectedMenu.section] ? (
          <SectionScreen
            activeItem={selectedMenu.item}
            items={sectionConfigs[selectedMenu.section]!.items}
            onSelectItem={item =>
              setSelectedMenu({section: selectedMenu.section, item})
            }
            primaryColor={primaryColor}
            sectionSubtitle={sectionConfigs[selectedMenu.section]!.subtitle}
            sectionTitle={sectionConfigs[selectedMenu.section]!.title}
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
  popupOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    bottom: 0,
    left: 0,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 10,
  },
  popupCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    shadowColor: '#0f172a',
    shadowOffset: {width: 0, height: 12},
    shadowOpacity: 0.12,
    shadowRadius: 24,
    width: '90%',
  },
  popupLogo: {
    height: 46,
    marginBottom: 18,
    resizeMode: 'contain',
    width: 120,
  },
  popupTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
  },
  popupHeading: {
    color: '#1f2a44',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  popupCopy: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  popupAction: {
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 14,
  },
  popupActionText: {
    color: '#ffffff',
    fontSize: 15,
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
