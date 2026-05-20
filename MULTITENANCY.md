# Multi-tenant build guide

This app is a SaaS mobile client that mirrors the architecture of the web frontend.
Each tenant (ISBA HUB, customer X, customer Y, ...) is built as a **separate
installable app** — different app icon, different name in the launcher, different
applicationId in the stores — from a single shared codebase. Tenant-specific
branding (colors, logo, brandName, feature flags) is fetched at runtime from the
backend's `/api/v1/public/global/verify_tenant/{slug}` endpoint, exactly like the
frontend uses `location.hostname`.

## How a tenant is identified at runtime

1. App boots → `TenantProvider` calls
   `GET ${API_BASE_URL}api/v1/public/global/verify_tenant/${TENANT_SLUG}`
2. Response returns the tenant's own `apiUrl`. All subsequent API calls hit that.
3. `TenantProvider` then fetches `${apiUrl}api/v1/public/global/settings`, which
   carries the branding payload (colors, logo, brandName, features).
4. The whole tree below `<TenantProvider>` reads from `TenantContext`.

`API_BASE_URL` and `TENANT_SLUG` are env values, baked into the native build at
compile time. They live in `.env.<tenant>.<environment>` files at the repo root.

## Files that drive the tenant pipeline

| File | Purpose |
|---|---|
| `.env.<tenant>.development` / `.env.<tenant>.production` | Per-tenant env values. Checked in (no secrets — they ship inside the APK). |
| `src/core/config/env.ts` | Typed wrapper around `react-native-config`. Fails loudly if a key is missing. |
| `src/core/tenant/tenant.service.js` | `fetchTenantsSetting` and other public-global endpoints. |
| `src/core/tenant/TenantProvider.tsx` | Context provider. Resolves tenant on mount. |
| `src/core/api/apiClient.ts` | Shared HTTP helpers (`requestJson`, `getAuthHeader`, `resolveBaseUrl`). |
| `src/core/storage/sessionStorage.ts` | Keychain-backed session persistence. |
| `android/app/build.gradle` | `productFlavors` block defines one Android variant per tenant. |
| `android/app/src/<tenant>/res/values/strings.xml` | `app_name` override per tenant. |

## Add a new tenant — Android

Suppose you're onboarding a customer with slug `acme`.

**1. Add env files.** Copy from `isba`:
```sh
cp .env.isba.development .env.acme.development
cp .env.isba.production .env.acme.production
```
Edit the values:
```
API_BASE_URL=https://api.tenants.sanchiconnect.com/   # or whichever the backend uses
TENANT_SLUG=acme
APP_ENV=development
```

**2. Add the productFlavor.** In `android/app/build.gradle`, copy the `isba` block:
```groovy
productFlavors {
    isba { ... existing ... }
    acme {
        dimension "tenant"
        applicationId "com.sanchiconnect.acme"
        versionCode 1
        versionName "1.0"
    }
}
```

**3. Add the per-flavor strings resource.** Create
`android/app/src/acme/res/values/strings.xml`:
```xml
<resources>
    <string name="app_name">Acme HUB</string>
</resources>
```

**4. Add npm scripts.** In `package.json`:
```json
"android:acme":          "ENVFILE=.env.acme.development react-native run-android --mode=acmeDebug   --appId=com.sanchiconnect.acme",
"android:acme:release":  "ENVFILE=.env.acme.production  react-native run-android --mode=acmeRelease --appId=com.sanchiconnect.acme"
```

**5. (Optional) Override the launcher icon** for that tenant by dropping
`ic_launcher.png` / `ic_launcher_round.png` into
`android/app/src/acme/res/mipmap-mdpi`, `-hdpi`, `-xhdpi`, `-xxhdpi`, `-xxxhdpi`.
If not provided, the flavor inherits the default icon from `src/main/res/mipmap-*`.

**6. Build:**
```sh
npm run android:acme
```

This produces an APK with applicationId `com.sanchiconnect.acme`, launcher
name "Acme HUB", and the slug `acme` baked in for the verify_tenant call.

## Add a new tenant — iOS (playbook)

iOS doesn't have product flavors. The equivalent is **build configurations +
schemes** per tenant, each with its own `Info.plist`/bundle ID/icon. The setup is
manual in Xcode (the `.pbxproj` is hostile to script edits):

1. Duplicate the `Release` and `Debug` configurations in the Xcode project for
   each tenant (e.g. `Debug-acme`, `Release-acme`).
2. Add a per-tenant `.xcconfig` (e.g. `ios/configs/acme.xcconfig`) that overrides:
   ```
   PRODUCT_BUNDLE_IDENTIFIER = com.sanchiconnect.acme
   ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon-acme
   PRODUCT_NAME = Acme HUB
   ```
3. Wire the xcconfig to the Acme build configs via Project → Info → Configurations.
4. Add an `AppIcon-acme` icon set inside `ios/<App>/Images.xcassets/`.
5. Create a new **Scheme** named e.g. `mobileapp-acme` that uses those build
   configurations.
6. For `react-native-config`: the env var `ENVFILE` is read by `react-native.config.js`
   at build time, so the same npm script pattern works:
   ```json
   "ios:acme": "ENVFILE=.env.acme.development react-native run-ios --scheme mobileapp-acme"
   ```
7. The `react-native-config` iOS module reads bundled values from a generated
   `GeneratedInfoPlistDotEnv.h` — no additional code change needed once the scheme
   and xcconfig are set up.

(`react-native-config` ships `ios/Pods/Target Support Files/...` machinery that
honours `ENVFILE` automatically once Pods are installed. Run `pod install` after
adding native deps.)

## Per-tenant signing (production only)

Each store-listed app needs its own signing key. Replace the `signingConfigs.debug`
fallback in `android/app/build.gradle` with per-flavor signing configs that read
from `keystore.<tenant>.properties` (gitignored), one per tenant.

## Local dev quick reference

```sh
# Start Metro (any flavor uses it)
npm start

# Build and run the ISBA HUB flavor on the emulator/device
npm run android:isba

# Production build (signed with debug keystore — replace per tenant)
npm run android:isba:release
```

## What a developer sees when running multiple tenant builds

Each flavor has its own `applicationId`, so they install **side by side** on the
same device. After `npm run android:isba` you can run `npm run android:acme` and
you'll see two icons on the home screen — "ISBA HUB" and "Acme HUB" — each with
its own keychain, its own session, its own branding.
