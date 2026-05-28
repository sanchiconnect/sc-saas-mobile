import React, {useCallback, useContext, useEffect, useState} from 'react';
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
import {TenantContext} from '../../core/tenant/TenantProvider';
import {Icon} from '../../core/components/Icon';
import {DashboardContent} from './components/DashboardContent';
import {SectionScreen} from './components/SectionScreen';
import {SideMenu} from './components/SideMenu';
import {authService} from '../auth/services/auth.service';
import {AccountSettingsScreen} from '../profile/screens/AccountSettingsScreen';
import {ProfileScreen} from '../profile/screens/ProfileScreen';
import {ProgramsScreen} from '../programs/screens/ProgramsScreen';
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
import {ConversationDetailScreen} from '../chat/screens/ConversationDetailScreen';
import {ConversationListScreen} from '../chat/screens/ConversationListScreen';
import type {Conversation} from '../chat/types';
import {ConnectionsScreen} from '../connections/screens/ConnectionsScreen';
import {EditProfileScreen} from '../profile/screens/EditProfileScreen';
import {TicketsScreen} from '../tickets/screens/TicketsScreen';
import {dashboardService} from './services/dashboard.service';
import {AppMenuSelection, AppSection, DashboardSummary, MenuItem} from './types';

type HomeScreenProps = {
  session: AuthSession;
  onLogout: () => void;
  showWelcomePopup: boolean;
  onCloseWelcomePopup: () => void;
  // Initial section to open on mount. Used after signup to drop the user
  // straight into Edit Profile, mirroring the frontend's role-specific redirect.
  initialSection?: AppSection;
  // Called whenever the current view shouldn't show the global feedback FAB
  // (chat thread, primarily). App.tsx mirrors this into the FAB render gate.
  onSuppressFeedbackFab?: (suppress: boolean) => void;
};

export function HomeScreen({
  session,
  onLogout,
  showWelcomePopup,
  onCloseWelcomePopup,
  initialSection,
  onSuppressFeedbackFab,
}: HomeScreenProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState<AppMenuSelection>({
    section: initialSection || 'dashboard',
  });
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Active chat conversation — null shows the list, populated drives the
  // detail screen. Cleared when the user leaves the chat section.
  const [activeConversation, setActiveConversation] =
    useState<Conversation | null>(null);
  // Drawer badge counts. Fetched on mount and whenever the drawer opens so
  // the numbers reflect the latest state without polling.
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [pendingConnectionsCount, setPendingConnectionsCount] = useState(0);

  // Tell App.tsx to hide the floating feedback FAB while the user is inside
  // a chat thread — otherwise it overlaps the send button.
  useEffect(() => {
    const suppress =
      selectedMenu.section === 'chat' && activeConversation !== null;
    onSuppressFeedbackFab?.(suppress);
  }, [selectedMenu.section, activeConversation, onSuppressFeedbackFab]);

  // Drawer badge counts. The /notifications/count endpoint already ships
  // unreadMessageCount + pendingConnectionCount + sentConnectionCount in a
  // single payload (same one the dashboard uses), so we hit it directly
  // instead of summing per-conversation data.
  const refreshDrawerCounts = useCallback(async () => {
    try {
      const res = await authService.getNotificationsCount(session.token);
      const c: any = res?.data || res || {};
      setUnreadMessagesCount(Number(c.unreadMessageCount) || 0);
      // Only count incoming requests — outgoing/sent aren't actionable from
      // the drawer; the user just sees the number of requests waiting on
      // their response.
      setPendingConnectionsCount(Number(c.pendingConnectionCount) || 0);
    } catch {
      // Non-fatal — drawer renders without badges if the call fails.
    }
  }, [session.token]);

  useEffect(() => {
    refreshDrawerCounts();
  }, [refreshDrawerCounts]);

  useEffect(() => {
    if (isMenuOpen) refreshDrawerCounts();
  }, [isMenuOpen, refreshDrawerCounts]);

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
        if (cancelled) return;
        setSummary(next);
        // Mirror frontend startup-dashboard guard:
        //   if (!brandDetails.features['show_dashboard']) redirect to Edit Profile.
        // Same idea on mobile — push the user into Edit Profile until the
        // tenant enables the dashboard. Honored only on first mount so the
        // user can still navigate to Dashboard manually via the side menu.
        const showDashboard = globalSetting?.features?.show_dashboard;
        if (
          showDashboard === false &&
          selectedMenu.section === 'dashboard'
        ) {
          setSelectedMenu({section: 'edit-profile'});
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          accountType={summary?.accountType}
          unreadMessagesCount={unreadMessagesCount}
          pendingConnectionsCount={pendingConnectionsCount}
        />

        <EditProfileScreen
          token={session.token}
          onBack={() => setSelectedMenu({section: 'dashboard'})}
          onPreview={() => setSelectedMenu({section: 'profile'})}
          // Refresh the dashboard summary (profile-completion ring + stats)
          // immediately after each save, so the ring shows the new % without
          // the user having to navigate away and back.
          onProfileUpdated={() => {
            loadSummary(session.token).catch(() => {});
          }}
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
          accountType={summary?.accountType}
          unreadMessagesCount={unreadMessagesCount}
          pendingConnectionsCount={pendingConnectionsCount}
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
          accountType={summary?.accountType}
          unreadMessagesCount={unreadMessagesCount}
          pendingConnectionsCount={pendingConnectionsCount}
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
          accountType={summary?.accountType}
          unreadMessagesCount={unreadMessagesCount}
          pendingConnectionsCount={pendingConnectionsCount}
        />

        <TicketsScreen
          token={session.token}
          onBack={() => setSelectedMenu({section: 'dashboard'})}
          primaryColor={primaryColor}
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
          accountType={summary?.accountType}
          unreadMessagesCount={unreadMessagesCount}
          pendingConnectionsCount={pendingConnectionsCount}
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

  if (selectedMenu.section === 'chat') {
    // Detail mode = a conversation is open. The list and detail screens share
    // a single section; back from detail returns to the list.
    if (activeConversation) {
      return (
        <View style={styles.page}>
          <ConversationDetailScreen
            token={session.token}
            conversation={activeConversation}
            currentUserUuid={summary?.userUuid || session.user.uuid || session.user.id}
            currentUserName={session.user.fullName}
            onBack={() => setActiveConversation(null)}
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
          onSelectMenu={section => {
            setActiveConversation(null);
            setSelectedMenu(section);
          }}
          primaryColor={primaryColor}
          selectedMenu={selectedMenu}
          session={session}
          accountType={summary?.accountType}
          unreadMessagesCount={unreadMessagesCount}
          pendingConnectionsCount={pendingConnectionsCount}
        />
        <View style={styles.topBar}>
          <Pressable
            style={styles.iconButton}
            onPress={() => setIsMenuOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Open menu">
            <Icon name="menu" size={24} color="#475569" />
          </Pressable>
          <Text style={styles.topBarTitle}>Messages</Text>
        </View>
        <ConversationListScreen
          token={session.token}
          currentUserUuid={summary?.userUuid || session.user.uuid || session.user.id}
          currentUserName={session.user.fullName}
          onOpenConversation={setActiveConversation}
        />
      </View>
    );
  }

  if (selectedMenu.section === 'connections') {
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
          accountType={summary?.accountType}
          unreadMessagesCount={unreadMessagesCount}
          pendingConnectionsCount={pendingConnectionsCount}
        />
        <View style={styles.topBar}>
          <Pressable
            style={styles.iconButton}
            onPress={() => setIsMenuOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Open menu">
            <Icon name="menu" size={24} color="#475569" />
          </Pressable>
          <Text style={styles.topBarTitle}>Connections</Text>
        </View>
        <ConnectionsScreen
          token={session.token}
          currentUserUuid={summary?.userUuid || session.user.uuid || session.user.id}
          currentUserAccountType={summary?.accountType}
          onOpenChat={conversation => {
            setActiveConversation(conversation);
            setSelectedMenu({section: 'chat'});
          }}
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
            accessibilityRole="button"
            accessibilityLabel="Team">
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
        // Pull-to-refresh only makes sense on the Dashboard (it reloads
        // summary + recommended widgets). On sidebar section pages there's
        // nothing to refresh, and the gesture was firing unexpectedly when
        // users scrolled vertically. Refresh is therefore scoped to the
        // dashboard branch.
        refreshControl={
          selectedMenu.section === 'dashboard' ? (
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[primaryColor]}
            />
          ) : undefined
        }
        showsVerticalScrollIndicator={false}>
        {selectedMenu.section === 'dashboard' ? (
          <>
            {/* Limited-access banner mirrors frontend's app-limited-access-message-box.
                Rendered when the tenant has limited_access enabled and the
                user's approval flagged them. */}
            {summary?.isRejected &&
            globalSetting?.features?.limited_access &&
            summary?.approvalStatus === 'limited_access' ? (
              <View style={styles.limitedAccessBanner}>
                <Icon
                  name="alert-circle-outline"
                  size={20}
                  color="#b45309"
                />
                <Text style={styles.limitedAccessText}>
                  Your account has limited access. Complete your profile and
                  contact support to unlock the full platform.
                </Text>
              </View>
            ) : null}
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
              accountType={summary?.accountType}
              roleDashboard={summary?.roleDashboard}
              tenantUsers={globalSetting?.users}
              logoBaseUrl={logoBaseUrl ?? undefined}
              canToggleStatus={summary?.canToggleStatus}
            />
          </>
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
  topBarTitle: {
    color: '#0f172a',
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 4,
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
  limitedAccessBanner: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#fef3c7',
    borderColor: '#fcd34d',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 12,
    alignItems: 'flex-start',
  },
  limitedAccessText: {
    flex: 1,
    color: '#92400e',
    fontSize: 13,
    lineHeight: 18,
  },
});
