# RoadAssist Mobile

React Native / Expo app (SDK 57) — alley-safe routing, hazard reporting with
confirm/deny consensus, turn-by-turn navigation with voice, and FCM hazard
alerts. 1:1 of the web FE where it matters, native where it counts (maps,
GPS, push, audio).

## Quick Start

```bash
npm install
npx expo run:android --device
```

`.env` (gitignored) provides `EXPO_PUBLIC_API_URL`. Pointing at a local BE
needs `adb reverse tcp:5001 tcp:5001`. Builds are dev-client based; Expo Go
cannot run this app (native modules: MapLibre, notifications, audio, tasks).

## Project Map

- `src/screens/RouteScreen.tsx` — planner: search, stops, route options,
  flags, saved routes; hosts navigation as a modal.
- `src/screens/NavigationScreen.tsx` + `src/screens/navigation/` —
  follow-mode nav: tracking hook, voice, turn list, flags, hazard focus.
- `src/screens/{Home,Hazards,Assist,Vehicle,More}Screen.tsx` — tabs;
  More holds permissions, diagnostics, and sign-out.
- `src/services/` — `push` (FCM), `sound` (earcons + voice ducking),
  `bgNav` (background task), `permissions`, `diagnostics`, `navigation`,
  `maneuvers`.
- `src/api/` — typed clients per BE resource (`routes`, `flags`, `push`…).
- `src/components/` — sheets, cards, map layers, `AppText` (Roboto bundle).
- `assets/map/`, `assets/sound/` — bundled markers and event audio.
- `documentation/` — `ARCHITECTURE.md`, `MAP_GESTURES.md`, `PUSH.md`.

## Verification

```bash
./node_modules/.bin/tsc --noEmit
```

`tsc` clean is the gate after every change. Device verification (builds,
permissions, GPS, voice, push) happens on a physical Android device —
emulators without Play Services cannot test FCM. No comments in `src`.

## Backend

`../ROADASSISTAPP_BE` — Cloud Functions API, Valhalla routing, Cloud Tasks
push fan-out. Its `documentation/PUSH.md` is the contract this app's
`documentation/PUSH.md` implements against.
