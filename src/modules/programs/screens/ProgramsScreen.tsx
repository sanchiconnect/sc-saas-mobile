import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {authService} from '../../auth/services/auth.service';
import {AppButton} from '../../../core/components/AppButton';
import {Icon} from '../../../core/components/Icon';
import {colors} from '../../../core/theme/colors';

type ProgramsScreenProps = {
  token: string;
  primaryColor: string;
  logoBaseUrl?: string | null;
  defaultMode?: 'all-programs' | 'my-applications';
  onModeChange?: (mode: 'all-programs' | 'my-applications') => void;
  onBack?: () => void;
};

type ProgramItem = {
  id: number | string;
  uuid?: string;
  programTitle: string;
  programCode?: string;
  shortDescription?: string;
  description?: string;
  programLogo?: string | null;
  headerImage?: string | null;
  footerImage?: string | null;
  applicationClosedDate?: string | null;
  applicationsClosed?: boolean;
  programClosed?: boolean;
  registrationLink?: string | null;
  programContentSections?: Array<{
    id?: number | string;
    title?: string;
    content?: string;
  }>;
  programFAQs?: Array<{
    id?: number | string;
    question?: string;
    answer?: string;
  }>;
  sourceType: 'program' | 'venture-studio' | 'application';
};

type ViewType = 'grid' | 'list';
type SectionFilter = 'active' | 'past';
type ScreenMode = 'all-programs' | 'my-applications';

const stripHtml = (value?: string | null) =>
  (value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const resolveAssetUri = (
  assetPath: string | null | undefined,
  logoBaseUrl?: string | null,
) => {
  if (!assetPath) {
    return null;
  }

  if (/^https?:\/\//i.test(assetPath)) {
    return assetPath;
  }

  if (!logoBaseUrl) {
    return null;
  }

  return `${logoBaseUrl.replace(/\/$/, '')}/${assetPath.replace(/^\//, '')}`;
};

const getInitials = (title: string) =>
  title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map(word => word[0]?.toUpperCase() || '')
    .join('');

const isPastProgram = (program: ProgramItem) => {
  if (program.applicationsClosed || program.programClosed) {
    return true;
  }

  if (!program.applicationClosedDate) {
    return false;
  }

  const deadline = new Date(program.applicationClosedDate);
  if (Number.isNaN(deadline.getTime())) {
    return false;
  }

  return deadline.getTime() < Date.now();
};

const formatDeadline = (value?: string | null) => {
  if (!value) {
    return 'No deadline';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'No deadline';
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const normalizePrograms = (
  raw: any[],
  sourceType: ProgramItem['sourceType'],
): ProgramItem[] =>
  raw.map(item => ({
    id: item?.id ?? item?.uuid ?? Math.random().toString(36),
    uuid: item?.uuid,
    programTitle: String(item?.programTitle || 'Untitled Program'),
    programCode: item?.programCode || undefined,
    shortDescription: item?.shortDescription || '',
    description: item?.description || '',
    programLogo: item?.programLogo || null,
    headerImage: item?.headerImage || null,
    footerImage: item?.footerImage || null,
    applicationClosedDate: item?.applicationClosedDate || null,
    applicationsClosed: Boolean(item?.applicationsClosed),
    programClosed: Boolean(item?.programClosed),
    registrationLink: item?.registrationLink || null,
    programContentSections: Array.isArray(item?.programContentSections)
      ? item.programContentSections
      : [],
    programFAQs: Array.isArray(item?.programFAQs) ? item.programFAQs : [],
    sourceType,
  }));

export function ProgramsScreen({
  token,
  primaryColor,
  logoBaseUrl,
  defaultMode = 'all-programs',
  onModeChange,
  onBack,
}: ProgramsScreenProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [screenMode, setScreenMode] = useState<ScreenMode>(defaultMode);
  const [searchText, setSearchText] = useState('');
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>('active');
  const [viewType, setViewType] = useState<ViewType>('grid');
  const [selectedProgram, setSelectedProgram] = useState<ProgramItem | null>(null);
  const [programs, setPrograms] = useState<ProgramItem[]>([]);
  const [applicationPrograms, setApplicationPrograms] = useState<ProgramItem[]>([]);

  useEffect(() => {
    setScreenMode(defaultMode);
  }, [defaultMode]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    Promise.all([
      authService.getPrograms(token),
      authService.getVentureStudioPrograms(token),
      authService.getApplicationPrograms(token),
    ])
      .then(([programsResponse, ventureStudioResponse, applicationResponse]) => {
        if (cancelled) {
          return;
        }

        const regularPrograms = normalizePrograms(
          Array.isArray(programsResponse?.data) ? programsResponse.data : [],
          'program',
        );
        const ventureStudioPrograms = normalizePrograms(
          Array.isArray(ventureStudioResponse?.data)
            ? ventureStudioResponse.data
            : [],
          'venture-studio',
        );
        const appliedPrograms = normalizePrograms(
          Array.isArray(applicationResponse?.data) ? applicationResponse.data : [],
          'application',
        );

        setPrograms([...regularPrograms, ...ventureStudioPrograms, ...appliedPrograms]);
        setApplicationPrograms(appliedPrograms);
      })
      .catch(error => {
        if (!cancelled) {
          setPrograms([]);
          setApplicationPrograms([]);
          Alert.alert(
            'Programs unavailable',
            error instanceof Error
              ? error.message
              : 'Could not load programs right now.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const sourcePrograms =
    screenMode === 'my-applications' ? applicationPrograms : programs;

  const visiblePrograms = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return sourcePrograms.filter(program => {
      if (!query) {
        return true;
      }

      const haystack = [
        program.programTitle,
        program.shortDescription,
        stripHtml(program.description),
        program.programCode,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [searchText, sourcePrograms]);

  const activePrograms = visiblePrograms.filter(program => !isPastProgram(program));
  const pastPrograms = visiblePrograms.filter(program => isPastProgram(program));

  const handleSelectMode = (mode: ScreenMode) => {
    setScreenMode(mode);
    onModeChange?.(mode);
    setSelectedProgram(null);
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={primaryColor} />
        <Text style={styles.loadingText}>Loading programs...</Text>
      </View>
    );
  }

  if (selectedProgram) {
    const headerUri = resolveAssetUri(selectedProgram.headerImage, logoBaseUrl);
    const footerUri = resolveAssetUri(selectedProgram.footerImage, logoBaseUrl);
    const logoUri = resolveAssetUri(selectedProgram.programLogo, logoBaseUrl);
    const bodyDescription =
      stripHtml(selectedProgram.description) ||
      stripHtml(selectedProgram.shortDescription);

    return (
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.detailContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.toolbar}>
          <Pressable
            onPress={() => setSelectedProgram(null)}
            style={styles.backRow}
            accessibilityRole="button"
            accessibilityLabel="Back to programs">
            <Icon name="chevron-left" size={22} color="#0f172a" />
            <Text style={styles.toolbarTitle}>Programs</Text>
          </Pressable>
        </View>

        {headerUri ? (
          <Image source={{uri: headerUri}} style={styles.detailHeroImage} />
        ) : null}

        <View style={styles.detailCard}>
          <View style={styles.detailHeaderRow}>
            <View style={styles.detailIdentity}>
              {logoUri ? (
                <Image source={{uri: logoUri}} style={styles.detailLogo} />
              ) : (
                <View style={[styles.detailInitials, {backgroundColor: primaryColor}]}>
                  <Text style={styles.detailInitialsText}>
                    {getInitials(selectedProgram.programTitle)}
                  </Text>
                </View>
              )}
              <View style={styles.detailCopy}>
                <Text style={styles.detailTitle}>{selectedProgram.programTitle}</Text>
                <Text style={styles.detailMeta}>
                  Deadline: {formatDeadline(selectedProgram.applicationClosedDate)}
                </Text>
              </View>
            </View>
            <AppButton
              label="Apply"
              fullWidth={false}
              style={styles.detailApplyButton}
              onPress={() =>
                Alert.alert(
                  'Apply action',
                  selectedProgram.registrationLink
                    ? 'Registration link is available for this program.'
                    : 'Application flow will be connected next.',
                )
              }
            />
          </View>

          {bodyDescription ? (
            <DetailSection title="Program Description" body={bodyDescription} />
          ) : null}

          {selectedProgram.programContentSections?.map(section =>
            stripHtml(section.content) ? (
              <DetailSection
                key={String(section.id || section.title)}
                title={section.title || 'Program Section'}
                body={stripHtml(section.content)}
              />
            ) : null,
          )}

          {selectedProgram.programFAQs?.length ? (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>FAQs</Text>
              {selectedProgram.programFAQs.map(item => (
                <View key={String(item.id || item.question)} style={styles.faqCard}>
                  <Text style={styles.faqQuestion}>{stripHtml(item.question)}</Text>
                  <Text style={styles.faqAnswer}>{stripHtml(item.answer)}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {footerUri ? (
          <Image source={{uri: footerUri}} style={styles.detailFooterImage} />
        ) : null}
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <View style={styles.toolbar}>
        <View style={styles.toolbarHeader}>
          <View style={styles.toolbarTitleRow}>
            {onBack ? (
              <Pressable
                onPress={onBack}
                style={styles.backButton}
                accessibilityRole="button"
                accessibilityLabel="Back">
                <Icon name="chevron-left" size={24} color="#0f172a" />
              </Pressable>
            ) : null}
            <Text style={styles.toolbarTitle}>Programs</Text>
          </View>
          <AppButton
            label={screenMode === 'my-applications' ? 'All Programs' : 'My Applications'}
            fullWidth={false}
            style={styles.compactButton}
            labelStyle={styles.compactButtonLabel}
            onPress={() =>
              handleSelectMode(
                screenMode === 'my-applications' ? 'all-programs' : 'my-applications',
              )
            }
          />
        </View>

        <View style={styles.filtersCard}>
          <View style={styles.searchWrap}>
            <Icon name="magnify" size={18} color="#64748b" />
            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search for a program"
              placeholderTextColor="#94a3b8"
              style={styles.searchInput}
            />
            {searchText ? (
              <Pressable onPress={() => setSearchText('')}>
                <Icon name="close" size={18} color="#64748b" />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.filterRow}>
            <View style={styles.segmented}>
              <SegmentButton
                label="Active"
                active={sectionFilter === 'active'}
                primaryColor={primaryColor}
                onPress={() => setSectionFilter('active')}
              />
              <SegmentButton
                label="Past"
                active={sectionFilter === 'past'}
                primaryColor={primaryColor}
                onPress={() => setSectionFilter('past')}
              />
            </View>

            <View style={styles.viewToggle}>
              <IconToggle
                icon="view-grid-outline"
                active={viewType === 'grid'}
                primaryColor={primaryColor}
                onPress={() => setViewType('grid')}
              />
              <IconToggle
                icon="format-list-bulleted"
                active={viewType === 'list'}
                primaryColor={primaryColor}
                onPress={() => setViewType('list')}
              />
            </View>
          </View>
        </View>
      </View>

      {sectionFilter === 'active' ? (
        <ProgramSection
          title={
            screenMode === 'my-applications' ? 'Active Applications' : 'Active Programs'
          }
          emptyLabel={
            visiblePrograms.length
              ? 'No active programs found'
              : 'No programs found'
          }
          programs={activePrograms}
          viewType={viewType}
          primaryColor={primaryColor}
          logoBaseUrl={logoBaseUrl}
          onSelectProgram={setSelectedProgram}
        />
      ) : (
        <ProgramSection
          title={screenMode === 'my-applications' ? 'Past Applications' : 'Past Programs'}
          emptyLabel={
            visiblePrograms.length ? 'No past programs found' : 'No programs found'
          }
          programs={pastPrograms}
          viewType={viewType}
          primaryColor={primaryColor}
          logoBaseUrl={logoBaseUrl}
          onSelectProgram={setSelectedProgram}
        />
      )}
    </ScrollView>
  );
}

function ProgramSection({
  title,
  emptyLabel,
  programs,
  viewType,
  primaryColor,
  logoBaseUrl,
  onSelectProgram,
}: {
  title: string;
  emptyLabel: string;
  programs: ProgramItem[];
  viewType: ViewType;
  primaryColor: string;
  logoBaseUrl?: string | null;
  onSelectProgram: (program: ProgramItem) => void;
}) {
  return (
    <View style={styles.sectionWrap}>
      {programs.length ? (
        <View style={styles.sectionHeadingRow}>
          <View style={[styles.sectionDot, {backgroundColor: primaryColor}]} />
          <Text style={styles.sectionHeading}>{title}</Text>
        </View>
      ) : null}

      {programs.length ? (
        <View style={viewType === 'grid' ? styles.gridList : styles.stackList}>
          {programs.map(program => (
            <ProgramCard
              key={`${program.sourceType}-${program.id}`}
              program={program}
              viewType={viewType}
              primaryColor={primaryColor}
              logoBaseUrl={logoBaseUrl}
              onPress={() => onSelectProgram(program)}
            />
          ))}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Icon name="alert-circle-outline" size={42} color="#94a3b8" />
          <Text style={styles.emptyText}>{emptyLabel}</Text>
        </View>
      )}
    </View>
  );
}

function ProgramCard({
  program,
  viewType,
  primaryColor,
  logoBaseUrl,
  onPress,
}: {
  program: ProgramItem;
  viewType: ViewType;
  primaryColor: string;
  logoBaseUrl?: string | null;
  onPress: () => void;
}) {
  const logoUri = resolveAssetUri(program.programLogo, logoBaseUrl);
  const summary =
    stripHtml(program.shortDescription) || stripHtml(program.description) || 'No description';
  const isChallenge = summary.toLowerCase().includes('challenge') ||
    program.programTitle.toLowerCase().includes('challenge');

  return (
    <View style={[styles.programCard, viewType === 'grid' ? styles.gridCard : styles.listCard]}>
      {isChallenge ? (
        <View style={[styles.challengeRibbon, {backgroundColor: primaryColor}]}>
          <Text style={styles.challengeRibbonText}>Challenge</Text>
        </View>
      ) : null}

      <View style={styles.programCardBody}>
        {logoUri ? (
          <Image source={{uri: logoUri}} style={styles.cardLogo} />
        ) : (
          <View style={[styles.initialsCard, {backgroundColor: primaryColor}]}>
            <Text style={styles.initialsText}>{getInitials(program.programTitle)}</Text>
          </View>
        )}

        <Text style={styles.programTitle} numberOfLines={2}>
          {program.programTitle}
        </Text>
        <Text style={styles.programSummary} numberOfLines={viewType === 'grid' ? 3 : 2}>
          {summary}
        </Text>

        <Pressable
          style={styles.programAction}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`View ${program.programTitle}`}>
          <Text style={styles.programActionText}>View Details & Apply</Text>
        </Pressable>

        <Text style={styles.deadlineText}>
          Deadline: {formatDeadline(program.applicationClosedDate)}
        </Text>
      </View>
    </View>
  );
}

function DetailSection({title, body}: {title: string; body: string}) {
  return (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{body}</Text>
    </View>
  );
}

function SegmentButton({
  label,
  active,
  primaryColor,
  onPress,
}: {
  label: string;
  active: boolean;
  primaryColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.segmentButton,
        active && {backgroundColor: primaryColor, borderColor: primaryColor},
      ]}>
      <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function IconToggle({
  icon,
  active,
  primaryColor,
  onPress,
}: {
  icon: string;
  active: boolean;
  primaryColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.iconToggle,
        active && {backgroundColor: `${primaryColor}12`, borderColor: primaryColor},
      ]}>
      <Icon name={icon} size={18} color={active ? primaryColor : '#64748b'} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#eef3ff',
  },
  content: {
    paddingBottom: 32,
  },
  centered: {
    alignItems: 'center',
    backgroundColor: '#eef3ff',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#64748b',
    fontSize: 15,
    marginTop: 12,
  },
  toolbar: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  toolbarHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  toolbarTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
    gap: 4,
  },
  backButton: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    marginLeft: -8,
    width: 36,
  },
  toolbarTitle: {
    color: '#0f172a',
    fontSize: 24,
    fontWeight: '800',
  },
  compactButton: {
    borderRadius: 12,
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  compactButtonLabel: {
    fontSize: 13,
    letterSpacing: 0.2,
  },
  filtersCard: {
    gap: 12,
  },
  searchWrap: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: '#dbe2ea',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
  },
  searchInput: {
    color: '#0f172a',
    flex: 1,
    fontSize: 14,
    paddingVertical: 12,
  },
  filterRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  segmented: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentButton: {
    backgroundColor: '#ffffff',
    borderColor: '#dbe2ea',
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 72,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  segmentLabel: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  segmentLabelActive: {
    color: '#ffffff',
  },
  viewToggle: {
    flexDirection: 'row',
    gap: 8,
  },
  iconToggle: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#dbe2ea',
    borderRadius: 10,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  sectionWrap: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionHeadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 14,
  },
  sectionDot: {
    borderRadius: 999,
    height: 24,
    marginRight: 10,
    width: 4,
  },
  sectionHeading: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '800',
  },
  gridList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
  },
  stackList: {
    gap: 12,
  },
  programCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  gridCard: {
    minHeight: 250,
    width: '48.2%',
  },
  listCard: {
    width: '100%',
  },
  challengeRibbon: {
    left: -28,
    paddingHorizontal: 34,
    paddingVertical: 6,
    position: 'absolute',
    top: 10,
    transform: [{rotate: '-45deg'}],
    zIndex: 1,
  },
  challengeRibbonText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  programCardBody: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
  },
  cardLogo: {
    borderRadius: 14,
    height: 56,
    marginBottom: 14,
    width: 56,
  },
  initialsCard: {
    alignItems: 'center',
    borderColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 2,
    height: 56,
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#0f172a',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.15,
    shadowRadius: 10,
    width: 56,
  },
  initialsText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
  },
  programTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  programSummary: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
    textAlign: 'center',
  },
  programAction: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  programActionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  deadlineText: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 15,
    marginTop: 12,
    textAlign: 'center',
  },
  detailContent: {
    paddingBottom: 32,
  },
  detailHeroImage: {
    borderRadius: 20,
    height: 180,
    marginHorizontal: 16,
    marginTop: 16,
    width: undefined,
  },
  detailCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 18,
  },
  detailHeaderRow: {
    gap: 14,
  },
  detailIdentity: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  detailLogo: {
    borderRadius: 18,
    height: 72,
    width: 72,
  },
  detailInitials: {
    alignItems: 'center',
    borderRadius: 18,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  detailInitialsText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
  },
  detailCopy: {
    flex: 1,
    marginLeft: 14,
  },
  detailTitle: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '800',
  },
  detailMeta: {
    color: '#475569',
    fontSize: 14,
    marginTop: 6,
  },
  detailApplyButton: {
    alignSelf: 'flex-start',
    minWidth: 120,
  },
  sectionBlock: {
    marginTop: 20,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
  },
  sectionBody: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 22,
  },
  faqCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    marginBottom: 10,
    padding: 14,
  },
  faqQuestion: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 6,
  },
  faqAnswer: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 20,
  },
  detailFooterImage: {
    borderRadius: 20,
    height: 160,
    marginHorizontal: 16,
    marginTop: 16,
    width: undefined,
  },
});
