# Auth API Documentation

This document describes the current auth API flow used by the mobile app.

Use this file as the source of truth when:
- updating backend APIs
- changing database fields
- mapping frontend keys to backend payloads
- checking which values are currently static fallback values

## Base URL Flow

Before any auth API is called, the app resolves the tenant-specific API base URL.

### 1. Verify Tenant

Method: `GET`

Endpoint:
```text
https://api.tenants.sanchidev.in/api/v1/public/global/verify_tenant/thub.sanchidev.i
```

Used for:
- fetching tenant-specific `apiUrl`

Important response key:
```json
{
  "data": {
    "apiUrl": "https://api.sanchiconnect.sanchidev.in/"
  }
}
```

### 2. Fetch Tenant Settings

Method: `GET`

Endpoint:
```text
${baseUrl}api/v1/public/global/settings
```

Used for:
- branding colors
- tenant theme config

## Login API Flow

Current frontend flow:
1. user enters email
2. app calls login-init API
3. user enters OTP
4. app verifies OTP
5. app fetches user profile
6. dashboard is shown

### 1. Start Login

Method: `POST`

Endpoint:
```text
${baseUrl}api/v1/public/auth/mobile/login
```

Current request body used in app:
```json
{
  "countryCode": 91,
  "email": "thub-dev-invester@yopmail.com"
}
```

Purpose:
- initiates login flow
- backend sends OTP or prepares OTP verification flow

### 2. Verify Login OTP

Method: `POST`

Endpoint:
```text
${baseUrl}api/v1/public/auth/mobile/login/verify
```

Request body:
```json
{
  "countryCode": 91,
  "code": "840b37847dbecfa4be4cf70cfade8d1d",
  "email": "thub-dev-invester@yopmail.com"
}
```

Purpose:
- verifies OTP
- returns auth token/access token

Important token keys checked by app:
- `data.token`
- `data.accessToken`
- `token`
- `accessToken`

### 3. Fetch Logged-In User Profile

Method: `GET`

Endpoint:
```text
${baseUrl}api/v1/users/profile
```

Headers:
```json
{
  "Authorization": "Bearer <token>"
}
```

Purpose:
- fetches user profile after OTP verification
- dashboard uses this profile data

Important profile keys checked by app:
- `data.user`
- `data`
- `user`

User fields currently mapped by app:
- `id` or `_id`
- `email` or `emailAddress`
- `fullName` or `name` or `displayName`

## Signup API Flow

Current frontend flow:
1. user selects role
2. user enters signup form details
3. app verifies email
4. app verifies mobile number
5. app sends OTP
6. user enters OTP
7. app verifies OTP using login verify API
8. app registers the user
9. app fetches profile
10. dashboard is shown

### 1. Verify Email

Method: `GET`

Endpoint:
```text
${baseUrl}api/v1/public/auth/verify/email/{email}?userType=startup&investorType=
```

Example:
```text
${baseUrl}api/v1/public/auth/verify/email/vishali@yop.com?userType=startup&investorType=
```

Purpose:
- checks whether email is valid/allowed
- app also reads `emailVerificationId` from this response when available

Important response keys checked by app:
- `data.emailVerificationId`
- `data.verificationId`
- `data.id`
- `emailVerificationId`
- `verificationId`
- `id`

### 2. Verify Mobile Number

Method: `GET`

Endpoint:
```text
${baseUrl}api/v1/public/auth/verify/mobile/{mobileNumber}?userType=startup&investorType=
```

Example:
```text
${baseUrl}api/v1/public/auth/verify/mobile/987654345678?userType=startup&investorType=
```

Purpose:
- checks whether mobile number is valid/allowed

### 3. Send Signup OTP

Method: `POST`

Endpoint:
```text
${baseUrl}api/v1/public/otp_verifications/send
```

Request body:
```json
{
  "type": "email",
  "countryCode": 91,
  "mobileNumber": 987654345678,
  "emailAddress": "vishali@yop.com"
}
```

Purpose:
- sends OTP for signup verification

### 4. Verify OTP

Method: `POST`

Endpoint:
```text
${baseUrl}api/v1/public/auth/mobile/login/verify
```

Request body:
```json
{
  "countryCode": 91,
  "code": "dc1322dd294effcdac9942803027b362",
  "email": "thub-dev-startup@yopmail.com"
}
```

Purpose:
- verifies OTP
- returns auth token/access token

### 5. Register User

Method: `POST`

Endpoint:
```text
${baseUrl}api/v1/public/auth/register/
```

Headers:
```json
{
  "Authorization": "Bearer <token>"
}
```

Current request body shape used in app:
```json
{
  "name": "THUB-Investor",
  "emailAddress": "thub-dev-invester@yopmail.com",
  "countryCode": 91,
  "mobileNumber": 987654356,
  "userType": "investor",
  "investorType": "organization",
  "companyName": "THUB-Investor",
  "organizationName": "KAhiheu_Demo",
  "howDidYouFindUs": "",
  "emailVerificationId": "63468821-0f04-4315-9f45-7c0650269ac5",
  "designation": "",
  "website": "",
  "servicesLookingFor": [
    "fundraising",
    "tech_hiring",
    "customer_access",
    "mentorship",
    "business_services"
  ],
  "referralCode": null,
  "applyingForSpecificEvent": false,
  "programs": [],
  "programCodes": []
}
```

### Register Payload Mapping

Current frontend field mapping:

| API key | Current source in app |
|---|---|
| `name` | `fullName` or `companyName` or static fallback |
| `emailAddress` | signup form `email` |
| `countryCode` | static `91` unless changed |
| `mobileNumber` | signup form `mobile` |
| `userType` | normalized from selected role |
| `investorType` | `"organization"` only when role is `investor`, otherwise empty string |
| `companyName` | signup form `companyName` or static fallback |
| `organizationName` | signup form `companyName` or static fallback |
| `howDidYouFindUs` | static empty string |
| `emailVerificationId` | from verify email response |
| `designation` | static empty string |
| `website` | static empty string |
| `servicesLookingFor` | static array |
| `referralCode` | static `null` |
| `applyingForSpecificEvent` | static `false` |
| `programs` | static empty array |
| `programCodes` | static empty array |

## Static Fallback Values Used Right Now

These fields are currently hardcoded in the frontend when form data is not available:

```json
{
  "countryCode": 91,
  "investorType": "organization",
  "howDidYouFindUs": "",
  "designation": "",
  "website": "",
  "servicesLookingFor": [
    "fundraising",
    "tech_hiring",
    "customer_access",
    "mentorship",
    "business_services"
  ],
  "referralCode": null,
  "applyingForSpecificEvent": false,
  "programs": [],
  "programCodes": []
}
```

Fallback strings also used when needed:
- `name`: `'THUB User'`
- `companyName`: `'THUB Organization'`
- `organizationName`: `'THUB Organization'`

## Role Mapping Used By Frontend

Current role normalization:

| UI role | API `userType` |
|---|---|
| `Startup` | `startup` |
| `Investor` | `investor` |
| `Corporate` | `corporate` |
| `Mentor` | `mentor` |
| `Service Provider` | `service_provider` |
| `Partner` | `partner` |
| `Individual` | `individual` |

## Error Handling Rules In Frontend

The frontend currently treats these as failure signals:
- `success === false`
- `status === false`
- `code >= 400`
- message containing `already`
- message containing `exists`
- message containing `invalid`
- message containing `not found`
- message containing `not registered`

## Files That Implement This Flow

- [App.tsx](/c:/Office%20work/sc-saas-frontend-mobileapp/mobileapp/App.tsx)
- [auth.service.ts](/c:/Office%20work/sc-saas-frontend-mobileapp/mobileapp/src/auth/services/auth.service.ts)
- [AuthNavigator.tsx](/c:/Office%20work/sc-saas-frontend-mobileapp/mobileapp/src/auth/AuthNavigator.tsx)
- [auth.models.ts](/c:/Office%20work/sc-saas-frontend-mobileapp/mobileapp/src/auth/models/auth.models.ts)
- [fetchSetting.js](/c:/Office%20work/sc-saas-frontend-mobileapp/mobileapp/src/api/fetchSetting.js)

## Notes For Future Backend Or Database Changes

If backend keys change in future, check these first:
- token key names returned from OTP verify
- profile response structure
- email verification id key name
- whether `auth/mobile/login` expects more fields
- which register fields can become dynamic instead of static

If you want, the next step I can do is create a second document with:
- sample success responses
- sample failure responses
- a backend DB field checklist matched one-by-one to each API payload key
