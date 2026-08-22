# Promptular Mobile (this repo)

iOS + Android in ONE shared Expo codebase (SDK 57, expo-router, src/ dir).
The product: prompt enhancer + prompt library. Tabs: Enhance | Library |
Account. The backend is the separate `promptular` web repo; this app calls
https://www.promptular.app/api/... in production (ALWAYS www; apex 307s
break POST bodies) and localhost:3000 / 10.0.2.2:3000 in dev.

## Identity

- App: Promptular. Bundle/package: com.decalvenue.promptular. Expo owner:
  decal-venue-inc. Scheme: promptular. iPhone-only (supportsTablet false).
- Dark-only UI. Tokens in src/lib/theme.ts (ink bg, panel cards, violet
  primary, spark = the Enhance action, lumen text). Brand locked Aug 21,
  2026; icon/splash/adaptive-icon are real assets in assets/images (never
  Expo defaults; Android adaptive icon is its own asset, already set).

## Pricing (locked; no subscriptions anywhere)

Free: 25 prompts, 15 one-time trial credits. Pro $9.99 lifetime
non-consumable (com.decalvenue.promptular.pro): unlimited library +
50 bonus credits. Credit packs (consumables, never expire):
com.decalvenue.promptular.credits.{50,100,500,1000} at
$4.99/$8.99/$19.99/$29.99. 1 credit = Light Touch, 2 = Full Rework.
Credits are server-side (ledger); the app NEVER computes balances locally,
it displays what the API returns.

## Key API surface (all built and tested in the web repo)

- POST /api/auth/apple-mobile {identityToken, name?, platform, deviceId?}
  and /api/auth/google {idToken, ...} -> {token, user}. Token in SecureStore.
- POST /api/enhance {prompt, mode, strength} -> {enhanced, why, balance};
  402 = not enough credits, 401 = signed out. GET = history.
- /api/prompts CRUD (+ PUT actions: {action:'used'}, {share:true|false}),
  /api/collections, /api/prompts/export|import (Pro), /api/platforms (live
  launch list), /api/account, /api/account/delete, /api/redeem, /api/banner.

## Standards that bite (from the base template)

- ALWAYS run with `npx expo run:ios` / `run:android`, never `expo start`
  alone (native modules crash Expo Go).
- Android dev API base is 10.0.2.2, not localhost (handled in src/lib/api.ts).
- After assets/app.json changes: `npx expo prebuild --clean --platform ios`
  (or android) DELIBERATELY; prebuild without --platform regenerates both
  and run:android will happily build a stale android/.
- useFrameworks static is set in app.json (required for RevenueCat +
  Google Sign In pods).
- .npmrc has legacy-peer-deps=true and MUST stay committed (EAS runs npm ci).
- No iOS-only APIs in shared screens (Alert.prompt is iOS-only). All
  platform copy/links through Platform.OS. 44px touch targets, 16px+ inputs.
- Day-1 requirements before submission: in-app account deletion (calls
  /api/account/delete then router.replace to sign-in), Restore Purchases,
  review prompts + Leave a Review row, provider-aware signed-in card.

## Still to build (as of scaffold)

Auth screens (Apple + Google, expo-apple-authentication +
@react-native-google-signin/google-signin; GOOGLE_CLIENT_IDS env on web
side not set yet), save-to-library from Enhance, prompt detail + variables
({{name}} fill-in form), Launch flow (copy + deep link via /api/platforms),
collections UI, paywall + RevenueCat (react-native-purchases; RC project
not created yet; webhook already live), share extension (iOS) + share
target (Android), enhance history screen, banner polling, review prompts.

Git: dev = working branch, main = release. Same workflow as all repos.
The full spec lives in the Promptular Claude project instructions; current
state in claude/promptular-progress.md there.
