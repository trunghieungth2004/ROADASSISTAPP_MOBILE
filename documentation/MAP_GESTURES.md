# Route map gestures & camera — known issues and findings

History of the pinch/pan snap-back investigation (mlrn 10.1.3, Android,
new architecture, MapTiler `streets-v4`). Nothing below is a code comment;
this file is the record.

## Symptom cluster (all reported on-device at various times)

- Pinch-zoom feeling inverted (in goes out and vice versa).
- Pinch working, then snapping back toward route overview on release.
- Panning away from the route, then the view snapping back.
- Fine on empty map; broken with route content (early reports).

## Confirmed causes (with evidence)

### 1. Two-finger-tap zoom-out (native, stock behavior)

MapLibre Android's `MapGestureDetector$TapGestureListener` maps a
multi-finger tap to `zoomOutAnimated` (verified in the
`android-sdk-opengl` AAR strings). Quick/short pinches — fingers spread
little, lift together — classify as taps, so the map zooms back out on
release. Google Maps does the same. No app code involved; mlrn v10 exposes
no toggle for it (only the master `zoomEnabled` switch). Mitigation in
code: none needed; slow, wide, deliberate pinches never trigger it.

### 2. Camera reset on state change (upstream bug)

Upstream `maplibre/maplibre-react-native#950`, v10 Android new-arch,
milestoned fixed only in **v11**: any parent state update can re-assert
the initial camera. Our route screen updated state on every region event
(`mapZoom` for pill placement), so gestures re-rendered the tree and the
camera snapped back. Verified by elimination: a diagnostic build with
**zero gesture-driven renders** pans/zooms cleanly on the same device.

Current permanent structure (do not regress):

- No `setState` in `onRegionIsChanging` / `onRegionDidChange` paths.
  Camera tracking for drag math lives in `camRef` (ref-only).
- Route pill uses a fixed zoom-13 lift (`PILL_LIFT_PX` at constant zoom),
  so it drifts slightly when zoomed far in/out. Accept until v11.
- Camera moves only via explicit ref calls: one-shot `fitBounds` on
  Find / search-pick reroute / swap / open-saved / alt-tap, the pre-route
  pick jump, and drag math. No render-phase or effect-driven camera code.
- `<Camera>` props are module constants (never inline literals — an
  inline `centerCoordinate` array re-commands the camera every render).
- Tap-to-arm marker drag is guarded against multitouch (pinch can never
  arm mid-gesture); sub-8px releases disarm without committing.

### 3. Glyph range timeout (transient, non-fatal)

`Failed to load glyph range 7680-7935` for the style font stack.
7680–7935 is U+1E00–U+1EFF (Vietnamese diacritics): Vietnamese street
labels. The MapTiler glyph endpoint serves the range in ~0.4 s from a
healthy network — the timeout is device-side (slow/flaky link, tile-burst
contention). MapLibre retries; labels pop in late. No code action. If
labels never appear, check device connectivity to `api.maptiler.com`
and key quota, not rendering.

## Dead theories (investigated, eliminated)

- Render-phase `fitBounds` effect: removed; explicit callsites only.
- `fitBounds` animation fighting gestures: all auto-fits are instant
  (`duration: 0`).
- `scrollEnabled`/`zoomEnabled` toggling mid-gesture: removed, stock
  `true`/untouched.
- Duplicate declarations, bare effects, remount paths: audited clean,
  twice, plus a `__DEV__` trace build that showed zero phantom camera
  commands during a witnessed snap.
- Waydroid mouse path (wheel-axis mapping, accidental marker grabs):
  real on emulator, but the phone reproduced the snap independently.

## Device/emulator caveats

- Waydroid + mouse has no true pinch; wheel-zoom direction follows host
  scroll settings, and mouse drags easily grab markers. Test gestures on
  a physical phone; use double-tap (always zooms in) on desktop.
- Waydroid has no GPS/compass: navigation follow, heading rotation, and
  TTS voices require a physical device.

## Real fix (deferred)

Migrate `@maplibre/maplibre-react-native` v10 → v11 (new-arch-native
Camera rewrite; #950 is milestoned there). Breaking surface includes at
least `MapView` → `Map` rename and Camera prop renames — scope as its
own migration. Until then, keep gesture paths render-free.
