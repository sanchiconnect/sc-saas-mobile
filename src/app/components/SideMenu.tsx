import React, {useState} from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {AuthSession} from '../../auth/models/auth.models';
import {Icon} from '../../shared/components/Icon';
import {
  accountSettingItems,
  connectItems,
  programItems,
  ticketItems,
} from '../config/menus';
import {AppMenuSelection, AppSection, MenuItem} from '../types';

type TenantBranding = {
  brandName?: string;
  logo?: string;
  assetsImgKitUrl?: string;
  imgKitUrl?: string;
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
}: SideMenuProps) {
  if (!isVisible) {
    return null;
  }

  const logoBaseUrl =
    globalSetting?.imgKitUrl || globalSetting?.assetsImgKitUrl;
  const logoPath = globalSetting?.logo;
  const logoUri =
    logoBaseUrl && logoPath
      ? `${logoBaseUrl.replace(/\/$/, '')}/${logoPath.replace(/^\//, '')}`
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
                <Image source={{uri: logoUri}} style={styles.logo} />
              ) : (
                <Text style={styles.brandName}>
                  {globalSetting?.brandName || 'THUB'}
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
            <View style={styles.avatarWrap}>
              <Text style={styles.avatarText}>
                {session.user.fullName.slice(0, 2).toUpperCase()}
              </Text>
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
            <Pressable style={styles.quickCard}>
              <Icon name="message-text-outline" size={18} color="#475569" />
              <Text style={styles.quickLabel}>Messages</Text>
            </Pressable>
            <View style={styles.quickDivider} />
            <Pressable style={styles.quickCard}>
              <Icon name="account-group-outline" size={18} color="#475569" />
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

          <ExpandableSection
            title="Connect"
            section="connect"
            icon="account-group"
            items={connectItems}
            onSelectMenu={onSelectMenu}
            onClose={onClose}
            primaryColor={primaryColor}
            selectedMenu={selectedMenu}
          />

          <ExpandableSection
            title="Program"
            section="program"
            icon="briefcase-outline"
            items={programItems}
            onSelectMenu={onSelectMenu}
            onClose={onClose}
            primaryColor={primaryColor}
            selectedMenu={selectedMenu}
          />

          <SingleSection
            title="Tickets"
            section="tickets"
            icon={ticketItems[0].icon || 'ticket-confirmation-outline'}
            item={ticketItems[0]}
            onSelectMenu={onSelectMenu}
            onClose={onClose}
            primaryColor={primaryColor}
            selectedMenu={selectedMenu}
          />

          <SingleSection
            title="Account Settings"
            section="account-settings"
            icon={accountSettingItems[0].icon || 'account-outline'}
            item={accountSettingItems[0]}
            onSelectMenu={onSelectMenu}
            onClose={onClose}
            primaryColor={primaryColor}
            selectedMenu={selectedMenu}
          />

          <Pressable style={styles.logoutButton} onPress={onLogout}>
            <Icon name="logout" size={18} color="#ffffff" />
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </ScrollView>
      </View>
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
    paddingBottom: 32,
    paddingHorizontal: 14,
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
    minHeight: 56,
    justifyContent: 'center',
  },
  logo: {
    height: 48,
    resizeMode: 'contain',
    width: 170,
  },
  brandName: {
    color: '#172554',
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
  avatarWrap: {
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    borderRadius: 16,
    height: 52,
    justifyContent: 'center',
    position: 'relative',
    width: 52,
  },
  avatarText: {
    color: '#1941c6',
    fontSize: 18,
    fontWeight: '800',
  },
  onlineDot: {
    backgroundColor: '#16a34a',
    borderColor: '#ffffff',
    borderRadius: 999,
    borderWidth: 2,
    height: 12,
    position: 'absolute',
    right: -2,
    top: -2,
    width: 12,
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
    overflow: 'hidden',
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
    backgroundColor: '#f1f5ff',
  },
  sectionItemText: {
    color: '#1f2937',
    fontSize: 14,
    fontWeight: '500',
  },
  logoutButton: {
    alignItems: 'center',
    backgroundColor: '#1b2140',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 46,
    paddingHorizontal: 16,
  },
  logoutText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});
