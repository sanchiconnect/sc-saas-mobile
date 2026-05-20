# Pipeline — deferred / not-yet-shipped features

Features the mobile app **does not yet have** but the frontend does. Listed
roughly in order of impact. When picking one off this list, see the linked
file paths for the integration points already prepared.

## Dashboard & home

- **Card detail screens.** `RecommendedCard` `onPress` is a stub. Each role
  needs its own profile-detail screen (`StartupDetailScreen`, `InvestorDetailScreen`, …)
  shown when a card is tapped. Wire into [src/modules/home/components/RecommendedCard.tsx](src/modules/home/components/RecommendedCard.tsx).

- **Meetings & calendar widget.** Frontend renders `app-meetings-and-events`
  on every role's dashboard, gated by `features.online_meetings`. Data lives
  in `summary.roleDashboard.upcomingMeetings` / `dashboardMeeting` (already
  fetched in [src/modules/home/services/dashboard.service.ts](src/modules/home/services/dashboard.service.ts)).

- **Community feed stats card.** `app-community-feed-stats` on every dashboard,
  gated by `features.community_feed`. Needs a new endpoint or summary field.

- **Raise-funds / providing-funds toggle.** Startup dashboard has a switch
  (`app-startup-raise-fund-switch` → PATCH `startups/raising-funds`) and
  investor dashboard has the equivalent (`app-investor-providing-funds-switch`
  → PATCH `investors/providing-funds`). Useful first-load tile.

- **Ad viewer.** `app-ad-viewer placement='dashboard'` — tenant-served ad slots.

- **Global elastic search.** Frontend gates a real search component on
  `features.search_type === 'elastic'`. Currently the `searchText` input in
  [src/modules/home/components/DashboardContent.tsx](src/modules/home/components/DashboardContent.tsx)
  is decorative.

- **`dashboard-v2` unified layout.** When tenant has `features.new_dashboard_layout = true`
  the frontend swaps to a unified `DashboardV2Component` with sidebar, pending
  tasks, certificate download, membership banner, etc. Calls `dashboards/user`
  + `dashboards/content`. Major separate layout — only build when needed.

## Sidebar destinations (missing screens)

The sidebar's `filterMenuItems` already supports these gates — what's missing
is the destination screen. Once a screen exists, drop it into the
`sectionConfigs` lookup in [src/modules/home/HomeScreen.tsx](src/modules/home/HomeScreen.tsx)
and the menu entry will work.

- Community Wall (`features.community_feed`)
- Business Challenges (`features.business_challenges`)
- Jobs — post / search / applied (`features.jobs`)
- Learning Center (`features.learning_management`)
- Events / Event Agenda (`features.events`, `features.events_agenda_menu_enabled`)
- Startup Booster Kit (`features.startup_kit`)
- Resources — legal templates / glossary / reports / news / videos / IP search
- My Actions submenu — calendar, connections, mentor hours, milestones,
  growth metrics, IP requests, facility bookings (per-item `featureKey`s)
- Admin Console for Partners (`features.incubator_module_enabled`)
- Multiple-profiles switcher (`features.multiple_profiles`)

## Header

- Top-bar message icon → chat (currently a dead `Pressable` in HomeScreen).
- Top-bar notifications icon → notification stream.
  Both need backing modules (chat, notifications) — not just UI plumbing.

## Edit Profile — custom forms

- **File-upload field type.** `CustomFormTab` currently renders an
  "unsupported" placeholder for file fields. Frontend supports multi-file
  upload via `react-native-image-picker` + `@react-native-documents/picker`
  (already in deps) → multipart POST to
  `/api/v1/forms-management/submission/<uuid>/upload-file`.

- **Conditional field visibility.** `field.visibility` in the form definition
  carries `{show, field, value, condition}`. Need a small DSL evaluator to
  hide/show fields based on another field's value.

- **Sub-category multi-selects.** `sectoralInterestSubIds`,
  `industrySubCategoryDomains` — nested below a parent selection.
  Currently the flat parent multi-selects ship; the nested children defer.

## Edit Profile — secondary tabs that ship as placeholders

These render a "Available on web" placeholder today but should become real
forms eventually. Each has fields documented in `MULTITENANCY.md` or the
explore agent's earlier mapping:

- Mentor → Industry / Technology + Domain Areas (multi-selects exist via
  `MentorDomainExpertiseTab` but advanced subdomain / `domain_areas_primary`
  layout for tenants with `features.mentorship_areas_new_layout = true` is
  deferred).
- Corporate → Engagement form: shipped, but `connectionRequirements` option
  list still comes from `globalSetting.features.connect_with_startups` only.
  Frontend has a richer dropdown (`WhyDoYouWantToConnectWithStartupsOptions`
  + an "Others" free-text fallback).

## Auth / session

- **OTP resend cooldown timer.** Currently the resend link is always clickable.
  Frontend disables it for ~30s after each send. Add a countdown in
  [src/modules/auth/screens/OtpScreen.tsx](src/modules/auth/screens/OtpScreen.tsx).

- **Country code picker.** Both frontend and mobile hardcode `91`. A picker
  populated from `/api/v1/public/global/countries` (already fetched in
  `EditProfileScreen`) would be more honest for global tenants.

- **Proactive token validation on cold start.** Mobile mirrors the frontend's
  trust-until-401 pattern (reactive 401 handler clears the session). If you
  want a faster "session expired" experience, call `getProfile` on app
  launch immediately after `loadSession` and clear on failure.

## iOS

- **iOS schemes per tenant.** The Android `productFlavors` story works for
  Android. For iOS, the equivalent (Xcode schemes + `.xcconfig` per tenant)
  is documented in [MULTITENANCY.md](MULTITENANCY.md#add-a-new-tenant--ios-playbook)
  but not yet wired. Do this when you actually start building for iPhone.

- **Per-tenant release keystores (Android).** Currently the debug keystore
  signs all flavors. Production should use a separate keystore per tenant —
  pattern documented in MULTITENANCY.md ("Per-tenant signing").

## Quality / hardening

- **Auth service split.** [src/modules/auth/services/auth.service.ts](src/modules/auth/services/auth.service.ts)
  is still ~1400 lines holding *every* authenticated endpoint (tickets,
  programs, pitch deck, documents, …). Feature-shard it into
  `tickets.service.ts`, `programs.service.ts`, etc.

- **react-native-config flavors map.** The `envConfigFiles` Gradle config
  was replaced with an `ENVFILE=…` npm-script approach because the flavor
  map didn't take. Worth revisiting — a working `envConfigFiles` lets
  Android Studio's run-config buttons "just work" without env-var prefixes.

- **Error toast service.** Mobile shows inline `message` text under forms.
  Frontend uses a global Swal toast via `ToastAlertService`. A shared
  `Toast.show(message, tone)` helper would unify error UX.
