import React, {useContext, useState} from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';

import {AppTextField} from '../../../../core/components/AppTextField';
import {Icon} from '../../../../core/components/Icon';
import {
  facebookUrl,
  instagramUrl,
  linkedinUrl,
  twitterUrl,
  url as urlValidator,
  youtubeUrl,
} from '../../../../core/form/validators';
import {colors} from '../../../../core/theme/colors';
import {TenantContext} from '../../../../core/tenant/TenantProvider';
import {
  BUSINESS_MODELS,
  FOUNDER_ROLES,
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
  // Local "touched" set tracks which social URL fields the user has blurred
  // at least once. Error UI only renders once the field is touched (matches
  // the auth-flow pattern from useFormValidation, but kept local here since
  // this component's data flow stays controlled by the parent).
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const markTouched = (key: string) =>
    setTouched(prev => ({...prev, [key]: true}));
  // Per-field validators — generic `url` for website, platform-specific
  // patterns for social profiles (mirrors frontend's shared/constants/regex.ts).
  const VALIDATORS: Record<string, (val: string) => string | undefined> = {
    website: urlValidator,
    linkedin: linkedinUrl,
    twitter: twitterUrl,
    facebook: facebookUrl,
    instagram: instagramUrl,
    youtube: youtubeUrl,
  };
  const urlError = (key: string, val: string): string | undefined => {
    if (!touched[key]) return undefined;
    const validate = VALIDATORS[key] || urlValidator;
    return validate(val);
  };

  // Tenant-level feature flags decide whether regulatory fields appear.
  // Matches the frontend's `brandDetails.features.company_identification_*`
  // gates in startup-information.component.html.
  const {globalSetting} = useContext(TenantContext);
  const features = globalSetting?.features || {};
  const users = globalSetting?.users || {};
  const cinEnabled = Boolean(features.company_identification_cin);
  const gstEnabled = Boolean(features.company_identification_gst);
  const dpiitEnabled = Boolean(features.company_identification_dpiit);
  // Map server's snake_case role value to its display label using tenant
  // settings (web reads the same `memberRoles`). Falls back to the static
  // FOUNDER_ROLES if the tenant didn't ship the key.
  const roleLabelLookup = (value: string): string => {
    const tenantRoles = globalSetting?.memberRoles || [];
    const fromTenant = tenantRoles.find(r => r.value === value)?.name;
    if (fromTenant) return fromTenant;
    return FOUNDER_ROLES.find(r => r.value === value)?.label || value;
  };

  // "What are you looking for from the platform?" — same option list and
  // visibility rules as the frontend startup-information component. Each
  // option is gated by either a feature flag or a stakeholder being enabled.
  const servicesLookingForOptions = [
    {label: 'Fund Raising', value: 'fundraising', show: true},
    {label: 'Hiring', value: 'tech_hiring', show: Boolean(features.jobs)},
    {
      label: 'Market Access',
      value: 'customer_access',
      show: users.corporates !== false,
    },
    {
      label: 'Mentorship',
      value: 'mentorship',
      show: users.mentors !== false,
    },
    {
      label: 'Business Services',
      value: 'business_services',
      show: users.service_providers !== false,
    },
  ].filter(opt => opt.show);

  const toggleServiceLookingFor = (val: string) => {
    const next = value.servicesLookingFor.includes(val)
      ? value.servicesLookingFor.filter(s => s !== val)
      : [...value.servicesLookingFor, val];
    onChange('servicesLookingFor', next);
  };

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
          required
          placeholder="Choose a team size"
          value={value.companySize}
          onPress={onOpenCompanySize}
        />

        <Text style={styles.fieldLabel}>
          Is your startup incorporated?
          <Text style={styles.required}> *</Text>
        </Text>
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

        {value.isIncorporated === true && cinEnabled ? (
          <View style={styles.field}>
            <AppTextField
              label="CIN / Registration Number"
              placeholder="Corporate Identification Number"
              value={value.cinNumber}
              onChangeText={text => onChange('cinNumber', text.toUpperCase())}
              autoCapitalize="characters"
            />
          </View>
        ) : null}

        {gstEnabled ? (
          <>
            <Text style={styles.fieldLabel}>Do you have a GST number?</Text>
            <View style={styles.yesNoRow}>
              <YesNoButton
                label="Yes"
                active={value.gstinVisible === true}
                primaryColor={primaryColor}
                onPress={() => onChange('gstinVisible', true)}
              />
              <YesNoButton
                label="No"
                active={value.gstinVisible === false}
                primaryColor={primaryColor}
                onPress={() => {
                  onChange('gstinVisible', false);
                  onChange('gstNumber', '');
                }}
              />
            </View>
            {value.gstinVisible ? (
              <View style={styles.field}>
                <AppTextField
                  label="GST Number"
                  placeholder="Enter GST number"
                  value={value.gstNumber}
                  onChangeText={text =>
                    onChange('gstNumber', text.toUpperCase())
                  }
                  autoCapitalize="characters"
                />
              </View>
            ) : null}
          </>
        ) : null}

        {dpiitEnabled ? (
          <>
            <Text style={styles.fieldLabel}>
              Are you registered with DPIIT?
            </Text>
            <View style={styles.yesNoRow}>
              <YesNoButton
                label="Yes"
                active={value.dpiitVisible === true}
                primaryColor={primaryColor}
                onPress={() => onChange('dpiitVisible', true)}
              />
              <YesNoButton
                label="No"
                active={value.dpiitVisible === false}
                primaryColor={primaryColor}
                onPress={() => {
                  onChange('dpiitVisible', false);
                  onChange('dpiitNumber', '');
                }}
              />
            </View>
            {value.dpiitVisible ? (
              <View style={styles.field}>
                <AppTextField
                  label="DPIIT Number"
                  placeholder="Enter DPIIT number"
                  value={value.dpiitNumber}
                  onChangeText={text => onChange('dpiitNumber', text)}
                />
              </View>
            ) : null}
          </>
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

        <Subheading style={styles.spacedSubheading}>
          Product Stage<Text style={styles.required}> *</Text>
        </Subheading>
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

        {servicesLookingForOptions.length > 0 ? (
          <>
            <Subheading style={styles.spacedSubheading}>
              What are you looking for from the platform?
            </Subheading>
            <View style={styles.servicesGrid}>
              {servicesLookingForOptions.map(option => {
                const isSelected = value.servicesLookingFor.includes(
                  option.value,
                );
                return (
                  <Pressable
                    key={option.value}
                    style={styles.serviceOption}
                    onPress={() => toggleServiceLookingFor(option.value)}>
                    <View
                      style={[
                        styles.checkbox,
                        isSelected && {
                          backgroundColor: primaryColor,
                          borderColor: primaryColor,
                        },
                      ]}>
                      {isSelected ? (
                        <Icon name="check" size={14} color="#ffffff" />
                      ) : null}
                    </View>
                    <Text style={styles.serviceLabel}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}
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
              value={roleLabelLookup(member.role)}
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
            placeholder="https://example.com"
            value={value.social.website}
            onChangeText={text => updateSocial('website', text)}
            onBlur={() => markTouched('website')}
            error={urlError('website', value.social.website)}
            autoCapitalize="none"
            keyboardType="url"
          />
        </View>
        <View style={styles.field}>
          <AppTextField
            label="LinkedIn"
            placeholder="https://linkedin.com/..."
            value={value.social.linkedin}
            onChangeText={text => updateSocial('linkedin', text)}
            onBlur={() => markTouched('linkedin')}
            error={urlError('linkedin', value.social.linkedin)}
            autoCapitalize="none"
            keyboardType="url"
          />
        </View>
        <View style={styles.field}>
          <AppTextField
            label="X / Twitter"
            placeholder="https://x.com/..."
            value={value.social.twitter}
            onChangeText={text => updateSocial('twitter', text)}
            onBlur={() => markTouched('twitter')}
            error={urlError('twitter', value.social.twitter)}
            autoCapitalize="none"
            keyboardType="url"
          />
        </View>
        <View style={styles.field}>
          <AppTextField
            label="YouTube"
            placeholder="https://youtube.com/..."
            value={value.social.youtube}
            onChangeText={text => updateSocial('youtube', text)}
            onBlur={() => markTouched('youtube')}
            error={urlError('youtube', value.social.youtube)}
            autoCapitalize="none"
            keyboardType="url"
          />
        </View>
        <View style={styles.field}>
          <AppTextField
            label="Facebook"
            placeholder="https://facebook.com/..."
            value={value.social.facebook}
            onChangeText={text => updateSocial('facebook', text)}
            onBlur={() => markTouched('facebook')}
            error={urlError('facebook', value.social.facebook)}
            autoCapitalize="none"
            keyboardType="url"
          />
        </View>
        <View style={styles.field}>
          <AppTextField
            label="Instagram"
            placeholder="https://instagram.com/..."
            value={value.social.instagram}
            onChangeText={text => updateSocial('instagram', text)}
            onBlur={() => markTouched('instagram')}
            error={urlError('instagram', value.social.instagram)}
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
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    rowGap: 12,
  },
  serviceOption: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingRight: 12,
    width: '50%',
  },
  checkbox: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 6,
    borderWidth: 1,
    height: 22,
    justifyContent: 'center',
    marginRight: 10,
    width: 22,
  },
  serviceLabel: {
    color: '#0f172a',
    flex: 1,
    fontSize: 15,
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
