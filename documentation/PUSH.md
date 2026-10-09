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
`AuthContext.signOut` unregisters best-effort. Registration is
permission-independent: a denied notification permission degrades to
foreground-only updates, never to an unregistered token. Tokens are deduped
per uid in `AsyncStorage`.

## Handling

`subscribeHazardPush` serves foreground receipts and tray taps, deduped per
`flagId` for 120 s, recording the last receipt for diagnostics.

- Route screen: pins refresh plus a silent no-fit route refetch, so the
  hazard count (derived from route warnings) updates on its own. Skipped
  while navigation is open.
- Navigation: hazard pins come from the payload, not a refetch. A **suggested** alert (`"1"`) carrying coordinates builds a `Flag` straight from the push data and seeds it into the pin layer — no `POST /flags/get`, so the pin lands on the push frame. **Confirmed / locked** alerts (`"2"` / `"3"`) still fetch once, because those auto-reroute and need fresh status. A push with no coordinates falls back to `POST /flags/get`. Then the route silently refetches so the hazard count updates, the app speaks "spotted" plus the detail line, and shows `HazardAlertModal` with **View** (focus camera + open the detail sheet), **Reroute** (confirm-flow reroute), **Dismiss** (per-flag suppression). Suppressed while the turn list, report sheet, or detail sheet is open; the pending alert flushes when they close. Own reports and already-voted flags update pins but never pop the modal. Trade-off: payload status is enqueue-time, not delivery-time. `deliverHazardPush` re-reads the flag server-side and skips non-pushable states, so the window is small — and it applies only to suggested alerts.
- Every nav hazard alert also fires a local heads-up notification (type +
  distance) so the shade buzzes with the app open.

## Dispatch pushes

`subscribeDispatchPush` matches on `ticketId` (deduped per ticket for 120 s).
The Assist screen reloads (tickets + feed) on every receipt and refetches the
active ticket when the payload carries a status; a `WALK_IN` payload
additionally focuses the Records tab. The payload shape (`ticketId`,
`ticketType`, `status`, `declineReason`) is parsed in
`services/pushPayload.ts` — the server sends all four on status pushes, so the
decline reason renders in the Records row even before the refetch lands.
Sweep-cancelled walk-ins now push too (`CANCELLED` body), so an expired row
announces itself instead of silently vanishing. Operator-audience pushes
(quote approvals, rider cancels with shop context, late pickups, destination
edits/declines on assigned tows) fan out
through the same `ticketId`-keyed drain — the operator's Records reload on
receipt with no client change, since the payload shape is unchanged
(`ticketId`, `ticketType`, `status`) and only the server copy varies.
Destination-decline notices go rider-side through the same path.
Withdrawn-tow pushes (`tower-candidates` audience, no `status` in payload)
parse cleanly and reload the board like any other receipt.
Manual rider cancels push the rider a confirmation alongside the operator
notice above.

Tap-from-killed-state is drained explicitly: `drainDispatchLaunch` /
`drainHazardLaunch` read `getLastNotificationResponseAsync` once per tap
(session-deduped, so remounts never replay) and feed the same handlers as the
live subscriptions. Assist, Route, Hazards, and Navigation all drain on
mount.

## Hazard pin refresh model

Three independent mechanisms drive one `NavFlags` component
(`screens/navigation/NavFlags.tsx`):

| Mechanism | Trigger | Gate |
|---|---|---|
| `refreshKey` | confirm / deny / report / remove | throttled: 150 m moved **or** 60 s elapsed |
| `forceKey` | hazard push only | bypasses the throttle entirely |
| `seedFlags` | hazard push payload | merged over fetched results, push wins on id collision |

The throttle gate exists to suppress polling, not authoritative push events —
that is why push uses its own counter instead of loosening the shared one.
`150 m` is a driving number (the old `500 m` suited deliberate map panning);
traffic impact is small because `flagsNear` sits behind a 5 s client cache and
a 10 s server cache.

Seeds are capped at 12, expire after 5 min, and are dropped on removed-push
and on `POST /flags/unflag`. A `/flags/near` prefetch at the seed position
fires on nav start, warming both cache tiers before the first `NavFlags`
fetch. Note push coverage is route-crossing by design (BE decides targets
from `active_routes`), so the 3 km proximity poll still covers near-but-
off-route hazards — neither side is redundant.

## Route freshness and silent re-touch

A displayed-but-not-navigating route is a snapshot: `active_routes` TTL is
30 min, so push coverage lapses past it with no server signal. The route
card shows `Live alerts · <age>` while fresh and `Alerts paused — tap to
refresh` past 25 min (`routeFresh.ts`), and tapping re-fires the quiet
refetch (which re-arms the TTL as a side effect). While the Route tab stays
focused **and the app is foregrounded**, the same quiet refetch fires on its
own every 20 min for up to an hour per solved route — never in background,
so parked phones can't become phantom trips that keep matching flags. Past
the cap the chip falls back to paused and one tap resumes a fresh window.

## Hazard card and type system

`components/flags/hazardStyle.ts` maps each type to an icon + color (accident red,
flood blue, obstruction amber), shared by the nav card, the alert modal, and
the detail sheet. The nav card sits above the distance/ETA bar, shows the
nearest upcoming warning (or the focused one while cycling, tap cycles too)
with a live GPS countdown, and hides when empty. Flag `distanceMeters` is
along-route progress (computed server-side in `lineStringHitsCircles`).

## Event sounds and ducking

`services/sound.ts` on `expo-audio`: `hazard` / `reroute` / `arrived` WAVs
in `assets/sound/` (`silence.wav` feeds the duck hold), duck-others audio
mode so chimes cut through music. Players are warmed at app start
(`PushSync`) **and on navigation entry** — `unloadEventSounds` destroys them
on nav exit, so without the nav warm the first hazard of every trip would
play cold (creation + immediate play on an undecoded buffer silently no-ops).
Warm seeks each player to force the decode; `playEventSound` then reuses the
ready player. Voice holds ducking through a looped
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
