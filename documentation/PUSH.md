# Push Notifications & Diagnostics

Hazard push over native FCM. Server triggers and payload contract live in
BE `documentation/PIPELINE.md`; this file covers the mobile side.

## Native setup

- `expo-notifications` plugin in `app.json`, `android.googleServicesFile`
  pointing at root `google-services.json` (git-crypted, Firebase project
  `roadassistapp-c2e37`). The key must be declared — default discovery does
  not wire Firebase, and the app fails with `FirebaseApp is not initialized`.
- Rebuild native (`prebuild --clean` + `run:android`) after any change here;
  verify `android/app/google-services.json` exists in the generated tree.

## Token lifecycle

`services/push.ts`, native FCM tokens via `getDevicePushTokenAsync` (never
Expo push tokens — the BE sends through the Admin SDK directly).
`App.tsx:PushSync` registers on login (`POST /push/register`);
`AuthContext.signOut` unregisters best-effort. Registration never depends on
notification permission — denied permission degrades to foreground-only
updates. Tokens are deduped per uid in `AsyncStorage`.

## Handling

`subscribeHazardPush` serves foreground receipts and tray taps, deduped per
`flagId` for 120 s, recording the last receipt for diagnostics.

- Route screen: pins refresh plus a silent no-fit route refetch, so the
  hazard count (derived from route warnings) updates on its own. Skipped
  while navigation is open.
- Navigation: fetch the full flag (`POST /flags/get`, expired/rejected
  return `404` → dropped), silently refresh the route so the count updates,
  speak "spotted" plus the detail line, and show `HazardAlertModal` with
  **View** (focus camera + open the detail sheet), **Reroute** (confirm-flow
  reroute), **Dismiss** (per-flag suppression). Suppressed while the turn
  list, report sheet, or detail sheet is open; the pending alert flushes
  when they close. Own reports and already-voted flags update pins but never
  pop the modal.
- Every nav hazard alert also fires a local heads-up notification (type +
  distance) so the shade buzzes with the app open.

## Hazard card and type system

`components/hazardStyle.ts` maps each type to an icon + color (accident red,
flood blue, obstruction amber), shared by the nav card, the alert modal, and
the detail sheet. The nav card sits above the distance/ETA bar, shows the
nearest upcoming warning (or the focused one while cycling, tap cycles too)
with a live GPS countdown, and hides when empty. Flag `distanceMeters` is
along-route progress (computed server-side in `lineStringHitsCircles`).

## Event sounds and ducking

`services/sound.ts` on `expo-audio`: `hazard` / `reroute` / `arrived` WAVs
in `assets/sound/` (`silence.wav` feeds the duck hold), duck-others audio
mode so chimes cut through music. Voice holds ducking through a looped
silent track started per utterance and released on done/stop/error plus a
length-based force release — a stuck duck is impossible by construction.
Mute governs speech only; event sounds always fire. One event, one sound:
auto-reroute plays `reroute` with a combined voice line, never the ping.

## Background navigation

`services/bgNav.ts`: `roadassist-bg-nav` task writes fixes to storage while
backgrounded (foreground-service notification, localized title/body plus
total trip distance); `useNavTracking` feeds strictly-newer fixes through
the same accept path on return. Started on nav mount, stopped on
exit/arrival. Needs Android background permission (requested at Start,
degradable) and the location plugin's background + foreground-service flags.

## Live shade notification

`modules/nav-notification/` (local Expo module, `file:` dependency so it
survives `prebuild --clean`): one `update(title, body, progress)` posting an
ongoing notification on the `hazard` channel with a trip progress bar
mirroring the nav card, plus `clear()`. `services/navShade.ts` wraps it with
a silent Expo-Go-safe fallback. `NavigationScreen` pushes next-turn,
ETA/remaining, and trip fraction on turn change or every ~20 s (3% progress
steps); cleared on unmount. Expo's static location-service row stays
alongside (OS requirement). No new permissions.

## Permissions and diagnostics

`services/permissions.ts` reads/requests notification and background
location state, falling back to system Settings when the OS stops
re-prompting. The More tab hosts a permissions card (live pills, focus
refresh) and a Diagnostics screen with Push / Location / Audio / Network
tabs — each runnable alone, multi-selectable, or all at once. The Push tab
names the exact failing call (token exception, registration error), which is
the first thing to check when pushes go quiet.
