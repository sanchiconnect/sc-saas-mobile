// Mobile-side mirror of the web app's IBrandDetails / IFeatures interfaces.
// Keep field names exactly in sync with the backend so the settings API
// response can be spread directly into these shapes.

export enum MenuTypes {
  TOP = 'top',
  SIDE = 'side',
}

export enum SideBarColors {
  LIGHT = 'light',
  DARK = 'dark',
}

export interface IFeatureUsers {
  startups: boolean;
  investors: boolean;
  mentors: boolean;
  corporates: boolean;
  service_providers: boolean;
  government: boolean;
  partners: boolean;
  program_offices: boolean;
  program_offices_registration: boolean;
  individuals: boolean;
  individual_registration?: boolean;
  service_providers_registration?: boolean;
  startups_registration?: boolean;
  investors_registration?: boolean;
  corporates_registration?: boolean;
  partner_registration?: boolean;
  job_seekers_registration?: boolean;
}

export interface IFeatures {
  // Core toggles
  chat: boolean;
  connections: boolean;
  calendar: boolean;
  online_meetings: boolean;
  community_feed: boolean;
  jobs: boolean;
  business_challenges: boolean;
  custom_forms: boolean;
  mentor_hours: boolean;
  startup_kit: boolean;
  glossary: boolean;
  resources_downloads: boolean;
  syndicate: boolean;
  financials_form: boolean;
  startup_onboarding_modal: boolean;
  looking_for_section: boolean;
  profile_comparison: boolean;
  startup_supporting_documents: boolean;
  certificates: boolean;
  startup_id_cards?: boolean;
  growth_metrics: boolean;
  events: boolean;
  deeptech_news: boolean;
  webinar_videos: boolean;
  milestone_management: boolean;
  ticket_management: boolean;
  reports_downloads: boolean;
  ip_management: boolean;
  facility_management: boolean;
  learning_management: boolean;
  incubator_module_enabled?: boolean;
  membership_enabled: boolean;
  membership_moderation_enabled: boolean;

  // Legal / public URLs
  terms_url?: string;
  privacy_url?: string;

  // Corporate connect
  connect_with_startups?: Array<{id?: any; value?: any; name?: string; label?: string}>;

  // WhatsApp / notifications
  wa_enable?: boolean;

  // Registration
  registration_invite_only: boolean;
  registration_turnoff_programs: boolean;
  registration_enterprise_sales_popup: boolean;
  external_sign_in_enabled?: boolean;
  external_sign_in_name?: string;

  // Profile / content flags
  show_dashboard: boolean;
  show_ecosystem: boolean;
  video_pitch_mandatory: boolean;
  profiles_locked: boolean;
  new_search_layout: boolean;
  multiple_profiles: boolean;
  logout_on_rejection: boolean;
  can_deactivate_profile: boolean;
  can_delete_profile: boolean;
  disable_startup_profile_update: boolean;
  startup_show_programs: boolean;
  post_revenue_fields: boolean;
  primary_industry: boolean;
  enable_sub_industries: boolean;
  industries_technologies_section: boolean;
  intellectual_property_section: boolean;
  investment_banking_section: boolean;
  company_identification_cin: boolean;
  company_identification_gst: boolean;
  company_identification_dpiit: boolean;
  startup_founders_advisory: boolean;
  mentor_domain_expertise_tab: boolean;
  mentorship_areas_new_layout: boolean;
  limited_access: boolean;
  individual_investor: boolean;
  program_management_with_profile_form?: boolean;
  corporates_enagement_form: boolean;
  programs_public_view?: boolean;
  vs_programs_public_view?: boolean;
  direct_accept_connection_enabled: boolean;
  filing_email_address_enabled: boolean;
  new_dashboard_layout?: boolean;

  // OTP
  email_otp_verification: boolean;
  mobile_otp_verification: boolean;
  whatsapp_otp_verification: boolean;

  // Chat
  chat_type: 'inhouse' | 'comet_chat';

  // Search
  elastic_search: boolean;
  search_type: 'elastic' | 'normal';

  // Meetings
  meeting_moderation_enabled: boolean;
  meeting_time_slot_difference_in_mins: number;

  // Connections
  ask_startup_to_mentor_connection_question: boolean;
  startup_to_mentor_connection_questions: string;

  // Financials
  currency: string;
  payment_currency: string;

  // Media
  video_types: 'both' | 'upload_video' | 'power_pitch';

  // UI theming
  menu_type: MenuTypes;
  sidebar_color: SideBarColors;
  main_website_url: string;
  new_dashboard_header_color?: string;
  new_dashboard_community_post_view?: 'inline' | 'default';

  // Title overrides
  individuals_title: string;
  mentor_hours_title: string;
  mentors_title: string;
  community_feed_title: string;
  milestone_management_title: string;
  growth_metrics_title: string;
  business_challenges_title: string;
  events_title: string;
  call_for_applications_menu_title: string;
  startup_kit_title: string;
  resources_downloads_title: string;
  glossary_title: string;
  ticket_management_title: string;
  reports_downloads_title: string;
  deeptech_news_title: string;
  webinar_videos_title: string;
  program_offices_title: string;
  partners_title: string;
  service_providers_title: string;
  reset_application_title: string;

  // Growth metrics
  growth_metrics_duration: string;
  growth_metrics_financial_year_start_month: number;

  // Membership
  membership_label_text: string;
  membership_visibility_type: 'anyone' | 'approved' | 'manual';

  // Challenges
  challenges_collections_filters_enabled: boolean;
  business_challenge_collections_enabled: boolean;

  // Corporate
  corporate_profile_registration_confirmation_enabled: boolean;
  corporate_backdoor_login_enabled: boolean;

  // Misc
  facility_enable_checkin_checkout?: boolean;
  facility_module_type: 'internal' | 'external';
  events_agenda_menu_enabled: boolean;
  programs_menu_enabled: boolean;
  events_exhibitors_menu_enabled: boolean;
  application_management_check_status_section?: boolean;
  application_management_round_status_updates?: boolean;
  programs_payment_enabled?: boolean;
  call_for_applications_payment_enabled?: boolean;
  call_for_applications_document_enabled?: boolean;
}

export interface IMaintenance {
  id: number;
  title: string;
  message: string;
  date: string;
  startTime: string;
  endTime: string;
  active: boolean;
  maintenance_on: boolean;
  actual_start_time: any;
  actual_end_time: any;
  notes: string;
  maintenance_on_message: string;
  maintenance_on_title: string;
}

export interface IStartupOnboardingModal {
  titleText?: string;
  descriptionText?: string;
  sideImage?: string;
}

export interface IGlobalSetting {
  // Branding
  brandName?: string;
  logo?: string;
  startupOnboardingModal?: IStartupOnboardingModal;

  // CDN / storage
  assetsImgKitUrl?: string;
  s3Bucket?: string;
  imgKitUrl?: string;
  s3Url?: string;

  // Feature flags (fully typed)
  users?: Partial<IFeatureUsers>;
  features?: Partial<IFeatures>;

  // Maintenance window
  maintenance_mode?: IMaintenance | null;

  // Tenant status (from verify_tenant)
  active?: boolean;
  subscription_active?: boolean;
  subscription_active_message?: string;
  customDomain?: string | null;

  // Config limits
  startupMaxIndustries?: string | number;
  startupMaxTechnologies?: string | number;
  investorMaxIndustries?: string | number;
  investorMaxInvestabilityMetrics?: string | number;
  mentorMaxDomainAreas?: string | number;
  mentorMaxIndustries?: string | number;
  mentorMaxTechnologies?: string | number;

  // Tenant-configurable enums
  CorporateSizes?: Array<{name: string; value: string}>;
  StartupCompanySize?: Array<{name: string; value: string}>;
  memberRoles?: Array<{name: string; value: string}>;
  WhyDoYouWantToConnectWithStartupsOptions?: Array<{name: string; value: string}>;
}
