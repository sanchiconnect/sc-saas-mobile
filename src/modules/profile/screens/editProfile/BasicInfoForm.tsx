import React from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';

import {AppTextField} from '../../../../core/components/AppTextField';
import {Icon} from '../../../../core/components/Icon';
import {colors} from '../../../../core/theme/colors';
import {
  BUSINESS_MODELS,
} from './options';
import {
  AdvisoryMember,
  BasicInfoForm as BasicInfoFormType,
  ELEVATOR_PITCH_LIMIT,
  EMPTY_ADVISORY,
  EMPTY_LEADERSHIP,
  TeamMember,
} from './types';

type Props = {
  primaryColor: string;
  value: BasicInfoFormType;
  onLogoPress?: () => void;
  onOpenCompanySize: () => void;
  onOpenCountry: () => void;
  onOpenState: () => void;
  onOpenCity: () => void;
  onOpenProductStage: () => void;
  onOpenLeadershipRole: (index: number) => void;
  onChange: <K extends keyof BasicInfoFormType>(
    key: K,
    value: BasicInfoFormType[K],
  ) => void;
};

const newId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export function BasicInfoForm({
  primaryColor,
  value,
  onLogoPress,
  onOpenCompanySize,
  onOpenCountry,
  onOpenState,
  onOpenCity,
  onOpenProductStage,
  onOpenLeadershipRole,
  onChange,
}: Props) {
  const updateLeadership = (index: number, patch: Partial<TeamMember>) => {
    const next = value.leadership.map((member, idx) =>
      idx === index ? {...member, ...patch} : member,
    );
    onChange('leadership', next);
  };

  const updateAdvisory = (index: number, patch: Partial<AdvisoryMember>) => {
    const next = value.advisory.map((member, idx) =>
      idx === index ? {...member, ...patch} : member,
    );
    onChange('advisory', next);
  };

  const addLeadership = () =>
    onChange('leadership', [
      ...value.leadership,
      {...EMPTY_LEADERSHIP, id: newId()},
    ]);

  const removeLeadership = (index: number) => {
    if (value.leadership.length <= 1) {
      return;
    }

    onChange(
      'leadership',
      value.leadership.filter((_, idx) => idx !== index),
    );
  };

  const addAdvisory = () =>
    onChange('advisory', [
      ...value.advisory,
      {...EMPTY_ADVISORY, id: newId()},
    ]);

  const removeAdvisory = (index: number) =>
    onChange(
      'advisory',
      value.advisory.filter((_, idx) => idx !== index),
    );

  const toggleBusinessModel = (model: string) => {
    const exists = value.businessModels.includes(model);
    onChange(
      'businessModels',
      exists
        ? value.businessModels.filter(m => m !== model)
        : [...value.businessModels, model],
    );
  };

  const updateSocial = (key: keyof typeof value.social, text: string) =>
    onChange('social', {...value.social, [key]: text});

  const pitchCount = value.elevatorPitch.length;

  return (
    <View>
      {/* Section: Company Information */}
      <SectionCard primaryColor={primaryColor} heading="Company Information">
        <Subheading>About Company</Subheading>

        <View style={styles.logoRow}>
          <Pressable
            onPress={onLogoPress}
            style={[
              styles.logoBox,
              onLogoPress && styles.logoBoxInteractive,
              value.logoUrl && styles.logoBoxFilled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Select company logo">
            {value.logoUrl ? (
              <Image source={{uri: value.logoUrl}} style={styles.logoImage} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Icon name="image-outline" size={30} color="#94a3b8" />
                <Text style={styles.logoPlaceholderText}>Upload</Text>
              </View>
            )}
          </Pressable>
          <View style={styles.logoCopy}>
            <Text style={styles.logoLabel}>
              Company Logo
              <Text style={styles.required}> *</Text>
            </Text>
            <Text style={styles.logoHint}>
              File types: png, jpg, jpeg{'\n'}Max size 512kb
            </Text>
            <Text style={[styles.logoAction, {color: primaryColor}]}>
              Tap image box to choose logo
            </Text>
          </View>
        </View>

        <View style={styles.field}>
          <AppTextField
            label="Company Name"
            required
            placeholder="Enter company name"
            value={value.companyName}
            onChangeText={text => onChange('companyName', text)}
            autoCapitalize="words"
          />
        </View>

        <DropdownField
          label="Company size"
          placeholder="Choose a team size"
          value={value.companySize}
          onPress={onOpenCompanySize}
        />

        <Text style={styles.fieldLabel}>Is your startup incorporated?</Text>
        <View style={styles.yesNoRow}>
          <YesNoButton
            label="Yes"
            active={value.isIncorporated === true}
            primaryColor={primaryColor}
            onPress={() => onChange('isIncorporated', true)}
          />
          <YesNoButton
            label="No"
            active={value.isIncorporated === false}
            primaryColor={primaryColor}
            onPress={() => {
              onChange('isIncorporated', false);
              onChange('incorporationYear', '');
            }}
          />
        </View>

        {value.isIncorporated === true ? (
          <View style={styles.field}>
            <AppTextField
              label="Year of Incorporation"
              required
              placeholder="Enter year"
              value={value.incorporationYear}
              onChangeText={text =>
                onChange(
                  'incorporationYear',
                  text.replace(/[^0-9]/g, '').slice(0, 4),
                )
              }
              keyboardType="number-pad"
            />
          </View>
        ) : null}

        <Subheading style={styles.spacedSubheading}>Headquartered in</Subheading>

        <DropdownField
          label="Country"
          required
          placeholder="Choose a country"
          value={value.country}
          onPress={onOpenCountry}
        />
        <DropdownField
          label="State"
          placeholder="Choose a state"
          value={value.state}
          onPress={onOpenState}
        />
        <DropdownField
          label="City"
          placeholder="Choose a city"
          value={value.city}
          onPress={onOpenCity}
        />

        <Subheading style={styles.spacedSubheading}>
          Elevator pitch <Text style={styles.subheadingHint}>(max 300 chars)</Text>
        </Subheading>
        <View style={styles.field}>
          <AppTextField
            placeholder="Briefly describe what your startup does"
            value={value.elevatorPitch}
            onChangeText={text => {
              if (text.length <= ELEVATOR_PITCH_LIMIT) {
                onChange('elevatorPitch', text);
              } else {
                onChange(
                  'elevatorPitch',
                  text.slice(0, ELEVATOR_PITCH_LIMIT),
                );
              }
            }}
            multiline
            numberOfLines={4}
            containerStyle={styles.multilineContainer}
            inputStyle={styles.multilineInput}
          />
          <Text style={styles.counterText}>
            {pitchCount}/{ELEVATOR_PITCH_LIMIT} characters
          </Text>
        </View>

        <Subheading style={styles.spacedSubheading}>Company Brief</Subheading>
        <View style={styles.field}>
          <AppTextField
            placeholder="Tell investors more about your company"
            value={value.companyBrief}
            onChangeText={text => onChange('companyBrief', text)}
            multiline
            numberOfLines={6}
            containerStyle={styles.multilineContainer}
            inputStyle={styles.multilineInput}
          />
        </View>

        <Subheading style={styles.spacedSubheading}>Product Stage *</Subheading>
        <DropdownField
          placeholder="Choose product stage"
          value={value.productStage}
          onPress={onOpenProductStage}
        />

        <Subheading style={styles.spacedSubheading}>Business Models</Subheading>
        <View style={styles.chipsWrap}>
          {BUSINESS_MODELS.map(model => {
            const isActive = value.businessModels.includes(model);
            return (
              <Pressable
                key={model}
                onPress={() => toggleBusinessModel(model)}
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
                  {model}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </SectionCard>

      {/* Section: Team */}
      <SectionCard primaryColor={primaryColor} heading="Team">
        <Subheading>Leadership Team</Subheading>

        {value.leadership.map((member, index) => (
          <MemberCard
            key={member.id}
            index={index}
            disableRemove={value.leadership.length === 1}
            onRemove={() => removeLeadership(index)}>
            <AppTextField
              label="Name"
              required
              placeholder="Member name"
              value={member.name}
              onChangeText={text => updateLeadership(index, {name: text})}
              autoCapitalize="words"
              containerStyle={styles.field}
            />
            <AppTextField
              label="LinkedIn profile URL"
              placeholder="https://linkedin.com/in/..."
              value={member.linkedinUrl}
              onChangeText={text =>
                updateLeadership(index, {linkedinUrl: text})
              }
              autoCapitalize="none"
              keyboardType="url"
              containerStyle={styles.field}
            />
            <DropdownField
              label="Role"
              placeholder="Select role"
              value={member.role}
              onPress={() => onOpenLeadershipRole(index)}
            />
            <AppTextField
              label="Designation"
              placeholder="e.g. CEO, CFO, CTO, CMO"
              value={member.designation}
              onChangeText={text =>
                updateLeadership(index, {designation: text})
              }
              containerStyle={styles.field}
            />
          </MemberCard>
        ))}

        <AddRowButton
          label="Add leadership member"
          primaryColor={primaryColor}
          onPress={addLeadership}
        />

        <Subheading style={styles.spacedSubheading}>Advisory board</Subheading>

        {value.advisory.length === 0 ? (
          <EmptyHint label="No advisors added yet." />
        ) : (
          value.advisory.map((member, index) => (
            <MemberCard
              key={member.id}
              index={index}
              onRemove={() => removeAdvisory(index)}>
              <AppTextField
                label="Name"
                placeholder="Advisor name"
                value={member.name}
                onChangeText={text => updateAdvisory(index, {name: text})}
                autoCapitalize="words"
                containerStyle={styles.field}
              />
              <AppTextField
                label="LinkedIn profile URL"
                placeholder="https://linkedin.com/in/..."
                value={member.linkedinUrl}
                onChangeText={text =>
                  updateAdvisory(index, {linkedinUrl: text})
                }
                autoCapitalize="none"
                keyboardType="url"
                containerStyle={styles.field}
              />
            </MemberCard>
          ))
        )}

        <AddRowButton
          label="Add advisor"
          primaryColor={primaryColor}
          onPress={addAdvisory}
        />
      </SectionCard>

      {/* Section: Social Links */}
      <SectionCard primaryColor={primaryColor} heading="Social Links">
        <View style={styles.field}>
          <AppTextField
            label="Website"
            placeholder="Enter website URL"
            value={value.social.website}
            onChangeText={text => updateSocial('website', text)}
            autoCapitalize="none"
            keyboardType="url"
          />
        </View>
        <View style={styles.field}>
          <AppTextField
            label="LinkedIn"
            placeholder="LinkedIn URL"
            value={value.social.linkedin}
            onChangeText={text => updateSocial('linkedin', text)}
            autoCapitalize="none"
            keyboardType="url"
          />
        </View>
        <View style={styles.field}>
          <AppTextField
            label="X / Twitter"
            placeholder="X / Twitter URL"
            value={value.social.twitter}
            onChangeText={text => updateSocial('twitter', text)}
            autoCapitalize="none"
            keyboardType="url"
          />
        </View>
        <View style={styles.field}>
          <AppTextField
            label="YouTube"
            placeholder="YouTube URL"
            value={value.social.youtube}
            onChangeText={text => updateSocial('youtube', text)}
            autoCapitalize="none"
            keyboardType="url"
          />
        </View>
        <View style={styles.field}>
          <AppTextField
            label="Facebook"
            placeholder="Facebook URL"
            value={value.social.facebook}
            onChangeText={text => updateSocial('facebook', text)}
            autoCapitalize="none"
            keyboardType="url"
          />
        </View>
        <View style={styles.field}>
          <AppTextField
            label="Instagram"
            placeholder="Instagram URL"
            value={value.social.instagram}
            onChangeText={text => updateSocial('instagram', text)}
            autoCapitalize="none"
            keyboardType="url"
          />
        </View>
      </SectionCard>

    </View>
  );
}

// ---- Sub-components ----

function SectionCard({
  primaryColor,
  heading,
  children,
}: React.PropsWithChildren<{primaryColor: string; heading: string}>) {
  return (
    <View style={styles.card}>
      <View style={[styles.cardHeader, {backgroundColor: primaryColor}]}>
        <Text style={styles.cardHeaderText}>{heading}</Text>
      </View>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

function Subheading({
  children,
  style,
}: React.PropsWithChildren<{style?: any}>) {
  return <Text style={[styles.subheading, style]}>{children}</Text>;
}

function DropdownField({
  label,
  placeholder,
  value,
  onPress,
  required,
}: {
  label?: string;
  placeholder: string;
  value: string;
  onPress: () => void;
  required?: boolean;
}) {
  return (
    <Pressable
      style={styles.dropdownTrigger}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label || placeholder}>
      <View style={styles.dropdownTextWrap}>
        {label ? (
          <Text style={styles.dropdownLabel}>
            {label}
            {required ? <Text style={styles.required}> *</Text> : null}
          </Text>
        ) : null}
        <Text
          style={[
            styles.dropdownValue,
            !value && styles.dropdownPlaceholder,
          ]}>
          {value || placeholder}
        </Text>
      </View>
      <Icon name="chevron-down" size={22} color="#64748b" />
    </Pressable>
  );
}

function YesNoButton({
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
        styles.yesNoButton,
        active && {backgroundColor: primaryColor, borderColor: primaryColor},
      ]}>
      <Text
        style={[
          styles.yesNoText,
          active && styles.yesNoTextActive,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

function MemberCard({
  children,
  index,
  disableRemove,
  onRemove,
}: React.PropsWithChildren<{
  index: number;
  disableRemove?: boolean;
  onRemove: () => void;
}>) {
  return (
    <View style={styles.memberCard}>
      <View style={styles.memberHeader}>
        <Text style={styles.memberHeaderText}>Member {index + 1}</Text>
        <Pressable
          onPress={onRemove}
          disabled={disableRemove}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Remove member ${index + 1}`}>
          <Icon
            name="close-circle-outline"
            size={22}
            color={disableRemove ? '#cbd5e1' : colors.danger}
          />
        </Pressable>
      </View>
      {children}
    </View>
  );
}

function AddRowButton({
  label,
  primaryColor,
  onPress,
}: {
  label: string;
  primaryColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.addRow, {borderColor: primaryColor}]}
      onPress={onPress}>
      <Icon name="plus-circle-outline" size={20} color={primaryColor} />
      <Text style={[styles.addRowText, {color: primaryColor}]}>{label}</Text>
    </Pressable>
  );
}

function EmptyHint({label}: {label: string}) {
  return (
    <View style={styles.emptyHint}>
      <Text style={styles.emptyHintText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    elevation: 2,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  cardHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cardHeaderText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  cardBody: {
    padding: 16,
  },
  subheading: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  spacedSubheading: {
    marginTop: 22,
  },
  subheadingHint: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '500',
  },
  required: {
    color: colors.danger,
  },
  field: {
    marginTop: 12,
  },
  fieldLabel: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 18,
  },
  logoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    marginTop: 12,
  },
  logoBox: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 14,
    borderWidth: 1,
    height: 90,
    justifyContent: 'center',
    width: 90,
  },
  logoBoxInteractive: {
    overflow: 'hidden',
  },
  logoBoxFilled: {
    backgroundColor: '#ffffff',
  },
  logoImage: {
    borderRadius: 12,
    height: '100%',
    resizeMode: 'cover',
    width: '100%',
  },
  logoPlaceholder: {
    alignItems: 'center',
    gap: 4,
  },
  logoPlaceholderText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  logoCopy: {
    flex: 1,
  },
  logoLabel: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
  logoHint: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 4,
  },
  logoAction: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  dropdownTrigger: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dropdownTextWrap: {
    flex: 1,
  },
  dropdownLabel: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  dropdownValue: {
    color: '#0f172a',
    fontSize: 15,
  },
  dropdownPlaceholder: {
    color: '#94a3b8',
  },
  yesNoRow: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 4,
    marginTop: 8,
    padding: 4,
  },
  yesNoButton: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10,
  },
  yesNoText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
  },
  yesNoTextActive: {
    color: '#ffffff',
  },
  multilineContainer: {
    marginTop: 4,
  },
  multilineInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  counterText: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 6,
    textAlign: 'right',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  chip: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  memberCard: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 12,
    padding: 14,
  },
  memberHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  memberHeaderText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
  },
  addRow: {
    alignItems: 'center',
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 14,
    paddingVertical: 12,
  },
  addRowText: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptyHint: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 1,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  emptyHintText: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
  },
});
