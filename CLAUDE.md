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

## Current state (Aug 23, 2026): feature set nearly complete

Tabs: Enhance | Library | Collections | Account. BUILT AND VERIFIED in
simulator: Apple + Google Sign In (Apple only verifiable on real device;
simulator throws -7003, known and expected), enhance with strength picker,
save-to-library, enhance history modal (clock icon, persistent In Library
state via enhance_history.prompt_id), library with New-prompt creation +
search + favorites (violet heart, own 44px column) + three-chip bar (All
Prompts | Favorites | Collections), Collections tab + /collection/[id] +
move-to-collection picker, prompt detail (share link button, edit, delete,
{{variables}} fill form, Launch with live prefill via /api/platforms,
Enhance-this-prompt with Replace/Keep + version history), custom platform
management (add/edit/remove, spark-yellow dot, hold to edit, Pro-gated),
templates browser (/templates modal fed live from GET /api/templates),
in-app Help (/help modal fed live from GET /api/help), full Account tab
(credit pack grid + Pro card wired to REAL RevenueCat purchases via
src/lib/purchases.ts, iOS key appl_HzxWGqMNgFLhCQhmtGUqbhWidwp, Restore,
Redeem code, Leave a Review deep link id6804114635, red Delete Account
flow), review prompts (expo-store-review at 3rd/15th/40th enhance).

Also shipped: share extension (expo-share-intent + +native-intent.tsx
redirect, dismissible discoverability hint on Enhance), broadcast banner
polling + status-bar mask, ErrorNotice (friendly errors, Report this
issue, in-app contact form), keyboard-avoiding bottom sheets everywhere,
Account version line, legacy-CSV import aliases in the CSV parser
(content/category/favorite Yes-No; in repo, ships with 1.0.1).

## SUBMITTED (Aug 23, 2026)

Version 1.0 build 2 + all 5 IAPs submitted to App Review, Manual release.
Real-device TestFlight verified: Apple Sign In, production API
(www.promptular.app flipped live), sandbox credit + Pro purchases with
webhook auto-crediting, Restore, share extension. EAS project under
decal-venue-inc; shared dist cert; app group group.com.decalvenue.promptular.

## Still to build

Android: everything Play-side, plus the goog_ key in purchases.ts.
Post-approval: press Release on launch day; launch checklist lives in
claude/promptular-progress.md in the Claude project.

Git: dev = working branch, main = release. Same workflow as all repos.
The full spec lives in the Promptular Claude project instructions; current
state in claude/promptular-progress.md there.
