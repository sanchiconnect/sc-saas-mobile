import React, {useState} from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {AuthSession} from '../../auth/models/auth.models';
import {Icon} from '../../../core/components/Icon';
import {
  accountSettingItems,
  actionItems,
  communityItems,
  connectItems,
  filterMenuItems,
  programItems,
  startupBoosterKitItems,
  ticketItems,
} from '../config/menus';
import {AppMenuSelection, AppSection, MenuItem} from '../types';

type TenantBranding = {
  brandName?: string;
  logo?: string;
  assetsImgKitUrl?: string;
  imgKitUrl?: string;
  features?: Record<string, any> | null;
  users?: Record<string, any> | null;
} | null | undefined;

type SideMenuProps = {
  isVisible: boolean;
  onClose: () => void;
  onLogout: () => void;
  onSelectMenu: (selection: AppMenuSelection) => void;
  session: AuthSession;
  globalSetting?: TenantBranding;
  primaryColor: string;
  selectedMenu: AppMenuSelection;
  // The current user's account type — drives per-role menu filtering and the
  // exclusion of self ("Investors" is hidden for investor users, etc.).
  accountType?: string | null;
  // Live badge counts on the Messages / Connections quick cards. Parent
  // (HomeScreen) keeps these in sync via the existing chat + connections
  // services so we don't double-fetch from inside the drawer.
  unreadMessagesCount?: number;
  pendingConnectionsCount?: number;
  // Resolved avatar URL for the signed-in user (full URL, ready for
  // <Image source={{uri}} />). Falls back to two-letter initials when empty.
  avatarUrl?: string;
};

type ExpandableSectionProps = {
  title: string;
  section: AppSection;
  icon: string;
  items: MenuItem[];
  isOpenByDefault?: boolean;
  onSelectMenu: (selection: AppMenuSelection) => void;
  primaryColor: string;
  selectedMenu: AppMenuSelection;
  onClose: () => void;
};

type SingleSectionProps = {
  title: string;
  section: AppSection;
  icon: string;
  item: MenuItem;
  onSelectMenu: (selection: AppMenuSelection) => void;
  primaryColor: string;
  selectedMenu: AppMenuSelection;
  onClose: () => void;
};

function ExpandableSection({
  title,
  section,
  icon,
  items,
  isOpenByDefault = false,
  onSelectMenu,
  primaryColor,
  selectedMenu,
  onClose,
}: ExpandableSectionProps) {
  const [isOpen, setIsOpen] = useState(isOpenByDefault);
  const isSectionActive = selectedMenu.section === section;

  return (
    <View style={styles.sectionWrap}>
      <Pressable
        onPress={() => setIsOpen(current => !current)}
        style={[
          styles.sectionHeader,
          isSectionActive
            ? {backgroundColor: primaryColor, borderColor: primaryColor}
            : styles.sectionHeaderInactive,
        ]}>
        <Icon
          name={icon}
          size={20}
          color={isSectionActive ? '#ffffff' : '#64748b'}
        />
        <Text
          style={[
            styles.sectionTitle,
            isSectionActive ? null : styles.sectionTitleInactive,
          ]}>
          {title}
        </Text>
        <Icon
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={22}
          color={isSectionActive ? '#ffffff' : '#64748b'}
        />
      </Pressable>

      {isOpen ? (
        <View style={[styles.sectionBody, {borderColor: primaryColor}]}>
          {items.map(item => {
            const isActive =
              selectedMenu.section === section &&
              selectedMenu.item === item.label;
            return (
              <Pressable
                key={item.key}
                onPress={() => {
                  onSelectMenu({section, item: item.label});
                  onClose();
                }}
                style={[
                  styles.sectionItem,
                  isActive ? styles.sectionItemActive : null,
                ]}>
                {item.icon ? (
                  <Icon
                    name={item.icon}
                    size={18}
                    color={isActive ? primaryColor : '#64748b'}
                  />
                ) : null}
                <Text
                  style={[
                    styles.sectionItemText,
                    isActive ? {color: primaryColor} : null,
                  ]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function SingleSection({
  title,
  section,
  icon,
  item,
  onSelectMenu,
  primaryColor,
  selectedMenu,
  onClose,
}: SingleSectionProps) {
  const isActive =
    selectedMenu.section === section && selectedMenu.item === item.label;

  return (
    <Pressable
      onPress={() => {
        onSelectMenu({section, item: item.label});
        onClose();
      }}
      style={[
        styles.singleSectionButton,
        isActive
          ? {backgroundColor: primaryColor, borderColor: primaryColor}
          : styles.singleSectionInactive,
      ]}>
      <Icon name={icon} size={20} color={isActive ? '#ffffff' : '#64748b'} />
      <Text
        style={[
          styles.singleSectionText,
          isActive ? styles.singleSectionTextActive : null,
        ]}>
        {title}
      </Text>
    </Pressable>
  );
}

export function SideMenu({
  isVisible,
  onClose,
  onLogout,
  onSelectMenu,
  session,
  globalSetting,
  primaryColor,
  selectedMenu,
  accountType,
  unreadMessagesCount,
  pendingConnectionsCount,
  avatarUrl,
}: SideMenuProps) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  if (!isVisible) {
    return null;
  }

  // Apply tenant + role-aware filtering. Empty results → entire section is
  // hidden so the user doesn't see an empty drawer category.
  const filterCtx = {
    features: globalSetting?.features,
    users: globalSetting?.users,
    accountType,
  };
  const visibleConnectItems = filterMenuItems(connectItems, filterCtx);
  const visibleActionItems = filterMenuItems(actionItems, filterCtx);
  const visibleProgramItems = filterMenuItems(programItems, filterCtx);
  const visibleTicketItems = filterMenuItems(ticketItems, filterCtx);
  const visibleAccountSettingItems = filterMenuItems(
    accountSettingItems,
    filterCtx,
  );

  const logoBaseUrl =
    globalSetting?.imgKitUrl || globalSetting?.assetsImgKitUrl;
  const logoPath = globalSetting?.logo;
  const logoUri = logoPath
    ? /^https?:\/\//i.test(logoPath)
      ? logoPath
      : logoBaseUrl
        ? `${logoBaseUrl.replace(/\/$/, '')}/${logoPath.replace(/^\//, '')}`
        : null
    : null;

  const isDashboardActive = selectedMenu.section === 'dashboard';

  return (
    <View style={styles.overlayWrap}>
      <Pressable style={styles.overlay} onPress={onClose} />

      <View style={styles.drawer}>
        <ScrollView
          contentContainerStyle={styles.drawerContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <View style={styles.logoWrap}>
              {logoUri ? (
                <Image
                  source={{uri: logoUri}}
                  style={styles.logo}
                  resizeMode="contain"
                />
              ) : (
                <Text style={styles.brandName}>
                  {globalSetting?.brandName || ''}
                </Text>
              )}
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close menu">
              <Icon name="close" size={24} color="#64748b" />
            </Pressable>
          </View>

          <View style={styles.divider} />

          <Pressable
            onPress={() => {
              onSelectMenu({section: 'profile'});
              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel="Open my profile"
            style={styles.profileRow}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatarWrap}>
                {avatarUrl ? (
                  <Image
                    source={{uri: avatarUrl}}
                    style={styles.avatarImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.avatarText}>
                    {session.user.fullName.slice(0, 2).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={styles.onlineDot} />
            </View>

            <View style={styles.profileCopy}>
              <Text style={styles.profileName}>
                {session.user.fullName}
              </Text>
              <Text style={styles.profileLabel}>My Profile</Text>
            </View>

            <Pressable style={styles.profileAction} hitSlop={6}>
              <Icon name="bell-outline" size={20} color="#334155" />
            </Pressable>
          </Pressable>

          <View style={styles.quickRow}>
            <Pressable
              style={styles.quickCard}
              onPress={() => {
                onSelectMenu({section: 'chat'});
                onClose();
              }}>
              <View style={styles.quickIconWrap}>
                <Icon name="message-text-outline" size={18} color="#475569" />
                {(unreadMessagesCount ?? 0) > 0 ? (
                  <View style={styles.quickBadge}>
                    <Text style={styles.quickBadgeText}>
                      {(unreadMessagesCount ?? 0) > 99
                        ? '99+'
                        : unreadMessagesCount}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.quickLabel}>Messages</Text>
            </Pressable>
            <View style={styles.quickDivider} />
            <Pressable
              style={styles.quickCard}
              onPress={() => {
                onSelectMenu({section: 'connections'});
                onClose();
              }}>
              <View style={styles.quickIconWrap}>
                <Icon name="account-group-outline" size={18} color="#475569" />
                {(pendingConnectionsCount ?? 0) > 0 ? (
                  <View style={styles.quickBadge}>
                    <Text style={styles.quickBadgeText}>
                      {(pendingConnectionsCount ?? 0) > 99
                        ? '99+'
                        : pendingConnectionsCount}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.quickLabel}>Connections</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => {
              onSelectMenu({section: 'dashboard'});
              onClose();
            }}
            style={[
              styles.menuButton,
              isDashboardActive
                ? {backgroundColor: primaryColor, borderColor: primaryColor}
                : styles.menuButtonInactive,
            ]}>
            <Icon
              name="view-dashboard-outline"
              size={20}
              color={isDashboardActive ? '#ffffff' : '#475569'}
            />
            <Text
              style={[
                styles.menuButtonText,
                isDashboardActive ? null : styles.menuButtonTextInactive,
              ]}>
              Dashboard
            </Text>
          </Pressable>

          {/* Community Wall — rendered unconditionally for now (dummy
              feature). Mirrors the Tickets row's always-visible pattern so it
              shows regardless of the tenant's `community_feed` flag; gate it
              with filterMenuItems(communityItems, filterCtx) once the feed
              is backed by a real feature toggle. */}
          <SingleSection
            title="Community Wall"
            section="community"
            icon={communityItems[0].icon || 'account-group-outline'}
            item={communityItems[0]}
            onSelectMenu={onSelectMenu}
            onClose={onClose}
            primaryColor={primaryColor}
            selectedMenu={selectedMenu}
          />

          {visibleConnectItems.length > 0 ? (
            <ExpandableSection
              title="Connect"
              section="connect"
              icon="account-group"
              items={visibleConnectItems}
              onSelectMenu={onSelectMenu}
              onClose={onClose}
              primaryColor={primaryColor}
              selectedMenu={selectedMenu}
            />
          ) : null}

          {/* My Actions — quick-jump shortcuts to Meetings and the
              Connections list. Items are rendered as their own menu
              section so the side bar matches the web layout (collapsible
              group with sub-items). "My Connections" deep-links to the
              existing top-level Connections screen so the user lands on
              the live list, not a placeholder. */}
          {visibleActionItems.length > 0 ? (
            <ExpandableSection
              title="My Actions"
              section="actions"
              icon="tools"
              items={visibleActionItems}
              onSelectMenu={selection => {
                if (selection.item === 'My Connections') {
                  onSelectMenu({section: 'connections'});
                  return;
                }
                if (selection.item === 'My Meetings') {
                  onSelectMenu({section: 'meetings'});
                  return;
                }
                if (selection.item === 'Milestones') {
                  onSelectMenu({section: 'milestones'});
                  return;
                }
                if (selection.item === 'Growth Metrics') {
                  onSelectMenu({section: 'growth-metrics'});
                  return;
                }
                if (selection.item === 'Mentor Hours') {
                  onSelectMenu({section: 'mentor-hours'});
                  return;
                }
                onSelectMenu(selection);
              }}
              onClose={onClose}
              primaryColor={primaryColor}
              selectedMenu={selectedMenu}
            />
          ) : null}

          {visibleProgramItems.length > 0 ? (
            <ExpandableSection
              title="Program"
              section="program"
              icon="briefcase-outline"
              items={visibleProgramItems}
              onSelectMenu={onSelectMenu}
              onClose={onClose}
              primaryColor={primaryColor}
              selectedMenu={selectedMenu}
            />
          ) : null}

          {/* Startup Booster Kit — shown for startup accounts regardless of
              the startup_kit feature flag (backend enforces access). Mirrors
              the Tickets always-visible pattern. */}
          {(accountType || '').toLowerCase() === 'startup' ? (
            <SingleSection
              title="Startup Booster Kit"
              section="startup-booster-kit"
              icon="currency-usd"
              item={startupBoosterKitItems[0]}
              onSelectMenu={() => {
                onSelectMenu({section: 'startup-booster-kit'});
              }}
              onClose={onClose}
              primaryColor={primaryColor}
              selectedMenu={selectedMenu}
            />
          ) : null}

          {visibleTicketItems.length > 0 ? (
            <SingleSection
              title="Tickets"
              section="tickets"
              icon={visibleTicketItems[0].icon || 'ticket-confirmation-outline'}
              item={visibleTicketItems[0]}
              onSelectMenu={onSelectMenu}
              onClose={onClose}
              primaryColor={primaryColor}
              selectedMenu={selectedMenu}
            />
          ) : null}

          {visibleAccountSettingItems.length > 0 ? (
            <SingleSection
              title="Account Settings"
              section="account-settings"
              icon={visibleAccountSettingItems[0].icon || 'account-outline'}
              item={visibleAccountSettingItems[0]}
              onSelectMenu={onSelectMenu}
              onClose={onClose}
              primaryColor={primaryColor}
              selectedMenu={selectedMenu}
            />
          ) : null}
        </ScrollView>

        <View style={styles.logoutWrap}>
          <Pressable
            style={styles.logoutButton}
            onPress={() => setShowLogoutConfirm(true)}>
            <Icon name="logout" size={18} color="#ffffff" />
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </View>
      </View>

      <Modal
        transparent
        visible={showLogoutConfirm}
        animationType="fade"
        onRequestClose={() => setShowLogoutConfirm(false)}>
        <View style={styles.logoutModalOverlay}>
          <Pressable
            style={styles.logoutModalBackdrop}
            onPress={() => setShowLogoutConfirm(false)}
          />
          <View style={styles.logoutModalCard}>
            <View style={[styles.logoutModalIconWrap, {borderColor: primaryColor}]}>
              <Text style={[styles.logoutModalIcon, {color: primaryColor}]}>!</Text>
            </View>
            <Text style={styles.logoutModalTitle}>Logout</Text>
            <Text style={styles.logoutModalSubtitle}>
              Are you sure you want to proceed?
            </Text>
            <View style={styles.logoutModalButtons}>
              <Pressable
                style={[styles.logoutModalBtn, {backgroundColor: primaryColor}]}
                onPress={() => {
                  setShowLogoutConfirm(false);
                  onLogout();
                }}>
                <Text style={styles.logoutModalBtnLabel}>Yes</Text>
              </Pressable>
              <Pressable
                style={[styles.logoutModalBtn, styles.logoutModalCancelBtn]}
                onPress={() => setShowLogoutConfirm(false)}>
                <Text style={styles.logoutModalBtnLabel}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayWrap: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    zIndex: 30,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  drawer: {
    backgroundColor: '#ffffff',
    height: '100%',
    maxWidth: 360,
    paddingTop: 18,
    width: '84%',
    zIndex: 40,
  },
  drawerContent: {
    paddingBottom: 16,
    paddingHorizontal: 14,
  },
  logoutWrap: {
    backgroundColor: '#ffffff',
    borderTopColor: '#e6e8f0',
    borderTopWidth: 1,
    paddingBottom: 20,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  logoWrap: {
    alignItems: 'flex-start',
    flex: 1,
    minHeight: 64,
    justifyContent: 'center',
  },
  logo: {
    height: 56,
    width: 160,
  },
  brandName: {
    color: '#0f172a',
    fontSize: 24,
    fontWeight: '800',
  },
  divider: {
    backgroundColor: '#e6e8f0',
    height: 1,
    marginVertical: 14,
  },
  profileRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  avatarContainer: {
    height: 56,
    position: 'relative',
    width: 56,
  },
  avatarWrap: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    height: 56,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 56,
  },
  avatarText: {
    color: '#475569',
    fontSize: 20,
    fontWeight: '800',
  },
  avatarImage: {
    width: 56,
    height: 56,
  },
  onlineDot: {
    backgroundColor: '#16a34a',
    borderColor: '#ffffff',
    borderRadius: 999,
    borderWidth: 2,
    top: -2,
    height: 13,
    position: 'absolute',
    right: -2,
    width: 13,
  },
  profileCopy: {
    flex: 1,
  },
  profileName: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
  },
  profileLabel: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 2,
  },
  profileAction: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  quickRow: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 22,
    // No `overflow: hidden` here — it clipped the absolute-positioned
    // count badges that float above each icon. The borderRadius still
    // rounds the row corners; the inner divider stays a 1px line and the
    // cards have their own bounds, so nothing actually spills out.
  },
  quickDivider: {
    backgroundColor: '#e2e8f0',
    width: 1,
  },
  quickCard: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 14,
  },
  quickLabel: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
  },
  // Icon + red count chip stacked together so the badge floats top-right
  // of the icon like a typical notification dot. Explicit size on the wrap
  // gives the absolute-positioned badge a bigger box to live in — without
  // it, the badge has to extend with negative right/top values and Android's
  // Pressable ripple clipping would hide it.
  quickIconWrap: {
    alignItems: 'flex-start',
    height: 26,
    justifyContent: 'center',
    paddingTop: 4,
    position: 'relative',
    width: 30,
  },
  quickBadge: {
    alignItems: 'center',
    backgroundColor: '#ef4444',
    borderColor: '#ffffff',
    borderRadius: 9,
    borderWidth: 1.5,
    height: 18,
    justifyContent: 'center',
    minWidth: 18,
    paddingHorizontal: 4,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  quickBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  menuButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    minHeight: 50,
    paddingHorizontal: 16,
  },
  menuButtonInactive: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  menuButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  menuButtonTextInactive: {
    color: '#0f172a',
  },
  sectionWrap: {
    marginBottom: 12,
  },
  singleSectionButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    minHeight: 50,
    paddingHorizontal: 16,
  },
  singleSectionInactive: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  singleSectionText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '600',
  },
  singleSectionTextActive: {
    color: '#ffffff',
  },
  sectionHeader: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: '#ffffff',
    marginBottom: 2,
    minHeight: 50,
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 12,
  },
  sectionHeaderInactive: {
    borderColor: '#e2e8f0',
  },
  sectionTitleInactive: {
    color: '#0f172a',
  },
  sectionTitle: {
    color: '#ffffff',
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  sectionBody: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    borderWidth: 1,
    borderTopWidth: 0,
    overflow: 'hidden',
  },
  sectionItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  sectionItemActive: {
    backgroundColor: '#f1f5f9',
  },
  sectionItemText: {
    color: '#1f2937',
    fontSize: 14,
    fontWeight: '500',
  },
  logoutButton: {
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 16,
  },
  logoutText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  logoutModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  logoutModalBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  logoutModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    gap: 10,
  },
  logoutModalIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  logoutModalIcon: {
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 40,
  },
  logoutModalTitle: {
    color: '#0f172a',
    fontSize: 19,
    fontWeight: '700',
  },
  logoutModalSubtitle: {
    color: '#475569',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  logoutModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  logoutModalBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 12,
  },
  logoutModalCancelBtn: {
    backgroundColor: '#6b7280',
  },
  logoutModalBtnLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
