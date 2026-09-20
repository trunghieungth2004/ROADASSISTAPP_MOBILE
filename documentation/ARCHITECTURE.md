# RoadAssist Mobile — Architecture

Expo (SDK 57) + React Native, New Architecture. Maps via
`@maplibre/maplibre-react-native` v10 (MapTiler `streets-v4` style),
backend over HTTPS (`src/api/*`), Firebase Auth, i18n `en`/`vi`
(`src/i18n`), Roboto bundled via `expo-font` + `@expo-google-fonts/roboto`
(applied globally through `src/components/AppText.tsx`).

## Environment / API endpoint

`src/config/secrets.ts` reads `EXPO_PUBLIC_API_URL` with a cloud fallback.
Local development against the functions emulator uses an untracked `.env`
(gitignored, never commit it):

```
EXPO_PUBLIC_API_URL=http://127.0.0.1:5001/roadassistapp-c2e37/asia-southeast1/api
```

`127.0.0.1` inside Android means the device itself, so expose the host
emulator with `adb reverse tcp:5001 tcp:5001` (the emulator only binds
loopback). Metro reads `.env` at startup: restart Metro and reload the app
after changing it. No native rebuild is needed for JS-only changes.
Production: `EXPO_PUBLIC_API_URL=https://api-pgjgmzblba-as.a.run.app`
(no `/api` suffix — paths are joined as `${API_URL}/routes`).

## Route screen (`src/screens/RouteScreen.tsx`)

Single `MapView`, layer order is load-bearing (later mounts paint on top):

1. `z-anchor` (invisible `LineLayer`, always mounted first)
2. route `LineLayer`s, each with `belowLayerID="z-anchor-line"` so lines
   can never cover markers regardless of mount order
3. A/B dots, stop dots, route pills, reshape handle (all overlap-allowed)

Route pills are one centered `SymbolLayer` each (capsule `iconImage` +
`textField`), `iconSize: 1` with `iconTextFit: "both"` so the capsule
stretches around labels like `2.4 km · 38 min` (no order number on-map;
the top pill bar keeps numbers for switching alternatives). Pill geometry
is offset north of route-mid by zoom-derived latitude delta
(`PILL_LIFT_PX`); icon/text share one anchor with zero offsets.

Marker drag is manual, not `PointAnnotation` (the native default pin cannot
be hidden): tap arms the nearest marker within `ARM_RADIUS`, a full-screen
`PanResponder` overlay moves it via camera-extent projection from
`onRegionIsChanging` bounds, release re-routes (handle drag appends a stop,
capped at `MAX_STOPS`). Sub-8px releases disarm without committing.
`requestRoute` is sequence-guarded; camera `fitBounds` runs only on explicit
search actions (Find/pick/swap), never on drag reroutes.

Pick-on-map arms `pickingFor` on the main map (FE parity): the bottom card
hides, a cancel chip sits top-left under the pill bar, taps
reverse-geocode into the origin/dest/stop setters.

## Place search (`src/screens/PlaceSearchScreen.tsx`)

Fullscreen opaque child screen (tabs + stack header hidden via
`navigation.setOptions` while open). Three merged sources, min 3 chars,
300 ms debounce, seq-guarded (`usePlaceSearch`):

1. Saved — backend `/places/saved` (per user)
2. Directory — backend `/places/search` (shops/landmarks)
3. Map results — MapTiler forward geocode, named (`limit 5`) plus
   `types:["poi"]` (`limit 8`), `country:vn`, HCMC bbox, then the same
   category/tag rerank as the web FE

Taps and Use-my-location reverse-geocode via MapTiler with a coordinate
fallback. Picking a result with no routes yet flies the camera to it
(`setCamera`, z15). Window resize handles the keyboard; no manual
keyboard-height compensation anywhere.

## Navigation (`src/screens/NavigationScreen.tsx`, `src/services/`)

Entry: result → **Start** re-routes silently from live GPS, then opens the
fullscreen navigator. No mlrn native location is used (it crashes on New
Architecture): no `<UserLocation>`, no Camera `follow*` props. The
`expo-location` watch drives `cameraRef.setCamera({center, zoom 17,
bearing, pitch 50})`; the puck is a GL arrow (`nav-arrow.png`,
`iconRotate`, map-aligned). Bearing prefers fresh compass heading
(`watchHeadingAsync`), falls back to GPS course. Manual gestures pause
follow (`isUserInteraction` guarded by `animatingRef`); recenter resumes it.

`src/services/navigation.ts` (pure): segment projection → remaining/ETA,
arrival < 30 m, off-route > 50 m × 3 fixes → auto-reroute (seq-guarded).
`src/services/maneuvers.ts` (pure): prefers backend `steps` when present,
else synthesizes turn/slight/sharp/U-turn maneuvers from geometry with
wiggle suppression. Banner + `expo-speech` prompts at ~200 m / ~50 m;
voice resolved once per session by language/region preference (`en-US`,
`vi-VN`, Enhanced quality tiebreak), rate 0.95 for `vi`, mute toggle,
speech cancelled on exit. Hazards and narrow sections within 300 m
along-route trigger banner + voice. Turn-list sheet shows all maneuvers
with live "in X m". Screen stays awake via `expo-keep-awake`.

## Saved routes + feedback

Bookmark Fab opens `SavedRoutesSheet` (list/open inline-rename/delete);
opening loads saved geometry directly with instant fit, no re-find. Save
goes through a name dialog (120 chars). Confirmations and save failures
use the shared `Snack` (4 s auto-hide); contextual errors stay inline in
the card.

## Build / verify

```
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/expo run:android   # native rebuild + install (dev-client)
```

Waydroid (`192.168.240.112:5555`) has no real GPS or compass: navigation
follow, heading rotation, and TTS voices require a physical device.
`adb reverse` tunnels do not survive adb disconnects/reboots.
