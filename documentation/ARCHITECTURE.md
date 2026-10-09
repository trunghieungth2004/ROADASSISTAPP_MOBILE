# RoadAssist Mobile — Architecture

Expo (SDK 57) + React Native, New Architecture. Maps via
`@maplibre/maplibre-react-native` v11 (vendored MapTiler styles:
`streets-v4` light, `streets-dark-v4` dark — same planet tileset, key
injected at runtime by `buildMapStyle`, so no secret ships in the JSON).
All five map views (`Route`/`Assist`/`Hazards`/`Nav`/`MapPickOverlay`)
pick the style from `useColorScheme()` via `bundledMapStyle(scheme)` and
re-resolve it on scheme change, so toggling the app theme (which pushes
through `Appearance.setColorScheme`) swaps the basemap live with the
camera untouched. Swaps are masked by `MapStyleVeil`
(`src/components/map/`): a theme-background veil raised by `useStyleVeil`
on every post-load scheme change and faded out on
`onDidFinishLoadingStyle` (2 s fallback clear), so the eye sees a short
fade instead of the old basemap lingering; styles are memoized per scheme
in `style.ts`, so toggles swap stable references without re-parsing. Both styles carry a `Ferry labels` layer, which is the
`beforeId` anchor for route lines. Overlay colors are theme-driven
(`theme.primary` adapts per scheme); the dark landmass is navy, so the
grey unselected-route line and white highlight casing stay legible.
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

The selected route carries a mid-route pill: a native-anchored `Marker`
capsule (`RouteMidPill`, same capsule language as `ShopPill` — `theme.primary`
background, white bold label, no hardcoded colors so both schemes follow the
app main color) showing `2.4 km · 38 min` for the selected result only. It
anchors at `selectedMid` (index midpoint from `midOf`, already computed for
the reshape handle) with a bottom anchor and upward offset so it floats above
the line, eats no taps (`pointerEvents="none"`), and hides while dragging.
The top pill bar keeps numbers for switching
alternatives, and renders a single informational pill when only one option
exists.

Marker drag is manual, not `PointAnnotation` (the native default pin cannot
be hidden): tap arms the nearest marker within `ARM_RADIUS`, a full-screen
`PanResponder` overlay moves it via camera-extent projection from
`onRegionIsChanging` bounds, release re-routes (handle drag appends a stop,
capped at `MAX_STOPS`). Sub-8px releases disarm without committing.
`requestRoute` is sequence-guarded; camera `fitBounds` runs only on explicit
search actions (Find/pick/swap), never on drag reroutes.

Pick-on-map uses the same fullscreen `MapPickOverlay` as every other search
surface: the search closes, the overlay opens with the field's current point
(or GPS when unset), and confirm feeds `{label, lat, lng, source: "map"}`
through the identical `onPickPlace` handler as a list result, so origin, dest,
and stops all resolve the same way.

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

Tow jobs navigate with the ticket attached (`NavSession.ticketId`): the
navigator subscribes to dispatch pushes for that ticket and refetches it —
destination change patches the session and quietly re-routes (`retargetTo`,
same guards as refreshes), a cleared destination holds guidance with a
banner, and a cancel auto-exits to Assist Records with a notice. Non-ticket
navigations skip all of it. The navigator also shares the tower's live
position every 60 s while a tow job is attached (foreground only), so
tracking survives the Assist tab losing focus for the whole drive; shop and
route navigations stay silent.
`src/services/maneuvers.ts` (pure): prefers backend `steps` when present,
else synthesizes turn/slight/sharp/U-turn maneuvers from geometry with
wiggle suppression. Banner + `expo-speech` prompts at ~200 m / ~50 m;
voice resolved once per session by language/region preference (`en-US`,
`vi-VN`, Enhanced quality tiebreak), rate 0.95 for `vi`, mute toggle,
speech cancelled on exit. Hazards and narrow sections within 300 m
along-route trigger banner + voice. Turn-list sheet shows all maneuvers
with live "in X m". Screen stays awake via `expo-keep-awake`.

Hazard pins come from `/flags/near` on a 150 m / 60 s throttle; a hazard
push can force an immediate refresh or seed a pin straight from the payload
with no fetch at all. Full model in `PUSH.md` ("Hazard pin refresh model").

## Assist screen (`src/screens/AssistScreen.tsx`, `src/screens/assist/`)

One map, one top-anchored card, three mutually exclusive sections switched by a
segmented control (`AssistSectionTabs`, tab semantics): `Request` (icon-only
type buttons — the `MECHANIC` button expands shop browse inline: map-icon
pins + name search; `SOS`/`TOW` open a ticket dialog with note field,
drop-off picker for tow, and Send; nothing preselected) and `Records`
(unified in/out list, see below). The type row ends in a compact vehicle
button (glyph only) opening the shared picker: neutral border when set,
danger dot when the fleet exists but nothing is active, dashed border + plus
when there is no vehicle at all (`vehicleButtonState`, mirrored on Route's
compact button). The dialog replaces the old inline note + request button:
one extra tap that ends pocket-dial dispatches.
Car riders see no `MECHANIC` button — `MECHANIC` / `WALK_IN` are bike-only
server-side, so it would be a dead end. Sections live in
`src/screens/assist/` (`RequestSection`, `TicketSheet`, `ShopsSection`,
`RecordsSection`, `StatusStepper`, `RatingSheet`); the screen keeps map, FABs,
active-job overlay, snack, and dialogs. The TOW type button uses the `tow-truck` glyph
(MaterialCommunityIcons — `local-shipping` read as delivery).

Status is a vertical stepper (`StatusStepper`): SOS/TOW show
Pending → Matched → Arrived → Resolved, walk-in shows
Pending → Accepted → In progress → Ready → Resolved, declined/expired collapse
to a flat line with the reason. Active-job actions come from the shared
`riderActionsFor` map in `src/api/dispatch.ts`. Cancelling asks for
confirmation (terminal server-side); rating submits straight through (the
server upserts). A 404 on rate means the row vanished under the BE expiry
sweep, so the sheet closes with a notice instead of an error.

Sections are Request, Tow, and Records in one segmented control: Request files
SOS/repair jobs and browses shops, Tow files tow tickets (destination via the
shared place search, shop or free point) and boards nearby tow jobs for
active towers and car-capable volunteers on duty (both may legally accept a
TOW — the board matches the BE accept rules; board accepts resolve the
caller's own ACTIVE tower as `shopId`, volunteers send none and take the
volunteer path; record accepts follow the same resolution, and shop-only
viewers get a plain "tow operators only" message instead of an accept),
Records merges everything. An accepted tow pins a live job view: map layers
(tower pin, pickup pin, drop-off pin, connecting line, camera fit on open)
plus a buttonless mini card (title, counterparty, live ETA) that opens the
record modal, where every action lives — riders mark arrival/resolution
there, towers resume navigation there. A quiet 15 s feed poll keeps the
tracking fresh while the job is live and focused. The tow board reuses the pending
radar filtered to `TOW` (the BE already gates it to active tow providers).
Tapping a board row opens the same record sheet as a ticket (rider name,
pickup and destination blocks, timeline, Accept in the footer — Decline is
record-only since the server honors it solely on addressed walk-ins).
Pending TOW modals carry a whole-way route preview (tower → pickup → shop in
one `findRoute` call with the pickup as a stop, summary plus a fullscreen map
with an Accept pinned in its footer); accepting from either place files the
job and starts a navigation session through the pickup stop, so the tower
lands in the navigator on the job.
`assets/map/` sorted by feature (`hazards/`, `navigation/`, `shops/`,
`route/`) and generates from `tools/genIcons.py` at full 1x/2x/3x —
regenerate rather than hand-editing; re-runs are no-op diffs. Every listed
shop carries a `MarkerView` capsule above its pin (`ShopPill`, minutes-only
`~N min` from haversine math, never a per-shop route call — the same RN
capsule language as the route pills, primary variant when selected, tap
opens the sheet). Native-anchored views: no sprite registration, no fit
math, no per-value assets. The selected pin uses the same pill. The sheet
shows a class pill beside the title (icons, defaults to both when
undeclared) plus an open/closed status pill in the header, a stats row
(jobs done left, stars always filled by average right), a tappable latest-two
reviews preview opening a scrollable all-reviews dialog (quarter-screen
minimum height, same `RatingRow` rows), rating
line (count always shown), an icon row (walk /
navigate / report, words kept as accessibility labels), and **I'm here** as
the primary action — visible only within 200 m GPS (`IM_HERE_RADIUS_M`,
`null` otherwise). Distance, minutes, and the closed warning live on the map
pill, never repeated in the sheet.
`I'm here` posts a `WALK_IN` ticket and jumps to Records. Navigating to a shop
stamps the nav session with that shop (`checkIn`), so the navigator shows its
own arrival **I'm here** card (200 m-gated on live position) that files the
same ticket through the shared `checkInAtShop` helper and lands back on
Records — no re-picking after the ride. Walk-preview and shop navigation both
pass through a closing-soon gate first: when the fresh route's ETA outruns
the shop's `closesInMinutes`, a dialog names both numbers and only proceeds
on **Go anyway**. Saved places live
under More (list/add/delete): adding picks a point on a fullscreen map, labels
it, and stores it server-side, so tow-to-home and route destinations resolve
in two taps through the saved-first merge. Shop search runs
through the shared place-search infra (`usePlaceSearch` + `PlaceSearchScreen`,
fullscreen): the inline field is a button opening the overlay in browse or
tow-destination mode (titled "Drop-off point", never shop copy), with registered shops merged as the first group
(unbounded server range; the 10 km ceiling applies only to the old inline
caller, now retired) and repair-gated MapTiler results after. Either source
failing never blanks the other; name-folded + 150 m dedupe, cap 5, distance
sort. Every search surface carries the same pick-on-map escape hatch: the
action row's map button closes the search and opens a fullscreen
`MapPickOverlay` (centre pin, GPS jump, confirm reverse-geocodes), and the
result is fed back through the identical pick handler as a list result —
Assist browse/tow, Onboarding shop/tow, the provider form (shop and tow), and
Route origin/dest/stop. Browse shop picks open the sheet and map picks raise a selected card
(navigate/register); tow picks set the destination (`destinationShopId` for
registered shops, free-form point otherwise, saved places preserved). The
the radius cycler lives inside the nearby overlay, never on the tab: the search
action row's third button ("Nearby shops") opens a fullscreen
`ShopRadiusOverlay` (registered shops around GPS, same pins and `~N min`
pills as the old tab map, the retired walk-icon pill cycling the mode's radii
(walk 500 m / 1 km / 2 km, tow 2 / 5 / 10 / 20 km up to the roof), and tapping
a pin or pill docks a detail card in the overlay — name, open pill, class,
stars, jobs (loading row while ratings fetch), the full walk/route/report
icon row, reviews preview with its modal, and in tow mode a **Use this shop**
button that sets the destination. Switching pins swaps the card in place, so
comparing shops never leaves the map. The old tab-level cycler and background shop pins
are gone; the background map is display-only again (GPS dot, tow destination,
selected-shop context). Tow name-search runs at a 20 km radius (the BE
defaults provider search to 2 km, which is why tow drop-offs felt locked);
the overlay passes its own radius explicitly.
The onboarding shop form carries the same
vehicle-class chips, so fresh shops declare at signup.
Adding a shop address (place pick or map pick) also runs a one-shot
`POST /providers/near` at 300 m and, when registered shops come back (this
record excluded), prints their names under the field — a duplicate warning
only; the server `409` stays the real guard.

## Records: compact rows, detail sheet, ticket history

Records merges both sides of every ticket into a single newest-first list fed
by `POST /dispatch/feed`, which stamps each row server-side
(`direction: "in" | "out"` plus `otherParty` names — shop, volunteer handle,
or rider display name; shop parties additionally carry `label`, `openNow`,
`ratingAvg`, and `ratingCount` when the provider record holds them, resolved
through `assignedShopId`, then the addressed `providerId`, then
`destinationShopId`, so pending and declined tickets already name their shop).
Rows are two lines: type + status pill (per-status
color via `statusPillColor`), counterparty + relative date. The filter row
carries All/In/Out plus role-aware kind toggles (shop/tow icons, always-on
rider icon) pinned right: rows resolve to a business kind through assignment,
then ticket type, with kind-less rows on the rider toggle; each row leads
with its role glyph (storefront, tow-truck, person) ahead of the direction
arrow, drawn from the same mapping as the filters. Chips render
only for businesses the user actually operates (rider chip always). No inline
actions, and opening a row no longer touches map selection — the sheet is
the only detail UI. Tapping a row opens `RecordDetailSheet` (bottom sheet,
same language as shop details): type-only title with the status as a header
pill, then the counterparty hero (direction chip, name, role caption —
repair shop / tow operator / volunteer / rider — relative age), a bordered
place container (labeled Pickup on TOW, Start point on walk-in, with a
reverse-geocoded label over the coordinates), the shop card when the party is
a shop (name title, address, stars, phone with the open-status pill —
tapping it opens the full shop modal, which owns the route action), a
drop-off section whenever a destination exists (full shop card from
`destinationParty` for registered shops, compact labeled point otherwise),
a rider-location block (name, coords plus distance,
stars, tappable phone) on inbound rows, icon fact rows (note, decline, VND
amounts with separators), a vertical dot-and-connector timeline built from
`statusHistory` (`StatusStepper` only for legacy rows without history), tow ETA
rows ("driver arrives in ~N min", only while future), a linked-ticket row
jumping to the auto-spawned shop ticket on resolved tows, and
the rating thread with reply (ratee-only: the reply affordance hides on your
own ratings; every row is a shared `RatingRow` — initial avatar, author
name, stars, comment, indented reply with replier name — under a Your rating
title). Committing actions (Rate/Edit rating, Resolve at ready, Accept, Cancel,
Decline-send, work-save, Send-quote, Approve, Decline drop-off) live in
`Overlay`'s pinned footer; forms (cancel
confirm, decline reasons, work editor, reply) stay in the body on demand.
On pending unclaimed TOWs the Accept action renders faded for viewers who
can neither attach a tower nor take the volunteer path (shop-only viewers),
with a hint line in the body explaining the flow (tower claims first — shops
can't accept tow jobs); attempting it anyway errors plainly instead of
claiming the record vanished.
Declining closes the sheet on success (errors keep it open for retry).
A drop-off block sits under the ticket coords whenever a destination exists:
registered shops show their name (storefront glyph), free points their label or
`Drop-off point` (flag glyph), both with coords. **Decline drop-off** appears in
the footer only for the destination shop's own operator on a non-pending,
non-terminal ticket — same gate as the server (`canDeclineDestination`), so a
foreign destination is read-only. It posts
`POST /dispatch/destination/decline`, which clears the destination and freezes
the traveled leg server-side; the reload drops the block on success.
Quotes are one-shot: sent amounts render locked in the work form (the server
`400`s re-quotes and re-finals), and the shop block carries a route button
(resolves snapshot → known-shop coords into navigation) beside a shared row
with the phone on the left and the open status on the right.
The sheet stays open and live across accept, work-save, and status moves:
every reload re-syncs the open ticket from the feed. Map dots are display
only — tapping them never opens anything; the sheet is the sole ticket UI.
Operator lifecycle runs inside the sheet: Accept (pending) → Start work
(`6`, from arrived or matched walk-ins without a sent quote) → work editor
→ Mark ready (`7`), with Decline + reason as the pending off-ramp. Work
states, the work editor, and quotes are shop-ticket only — volunteer-held
and tower-held tickets never see those controls (the server 403s them
regardless; the client gates on the ticket touching one of your own SHOPs,
so dual-role accounts see the workbench only on their shop jobs).
Sending a quote (amount required) flips the ticket to `9` (Quoted, violet)
for rider approval — Approve moves `9→6`, Decline reuses the cancel pair,
and starting work is blocked while a quote pends, so no job starts
unapproved. Either side's phone number rides the feed on live tickets
(`2`/`3`/`4`/`6`/`7`/`9`, never pending or dead) and renders as a tappable
`tel:` row in the matching block; absent when unregistered.

## Hazard report form (`FlagSheet`)

Compact type selector beside a multiline note field (50:50 row), radius
chips below at 48 px minimum targets in a wrapping row — glove/rain usable.
No new dependencies, no new copy.

## Services & roles

Licenses vs records: `users.services` holds only `RIDER`/`VOLUNTEER`
(`PUT /users/onboard` self-serves those two; anything else is a `400`).
`SHOP`/`TOW` are provider records, never licenses, so the More badge row
derives them from `myProviders` (`operatedKinds`, `DENIED` excluded) beside
the license chips. Un-checking Volunteer revokes via
`PUT /users/services` (self may only drop its own `VOLUNTEER`; the rider
license is irrevocable and admins keep the full grant/revoke path).
A `DENIED` record of either kind reads as missing, so re-applying stays
possible from the Services screen.

## Client caching

Three tiers, sized to the data:

- `api/client.ts` — in-flight dedup on `method + path + body + token`.
  Concurrent identical requests share one promise; different body or token
  never merges. Nothing stale is ever served.
- `services/cache.ts` — TTL memory cache with token-scoped keys:
  `flagsNear` 5 s, `nearTickets` 10 s, `myFlags` / `myTickets` /
  `nearProviders` 15 s, `savedPlaces` / `savedRoutes` / `myProviders` 30 s.
  Every write callsite invalidates its own lists; `AuthContext.signOut` and
  the Firebase null-session path clear the whole cache. Loosening a TTL
  raises request volume roughly linearly with speed — re-measure after.
- Persisted geocode cache (`api/places.ts`) — reverse-geocode labels only.
  MapTiler is metered and a lat/lng label never changes, so this is the one
  cache that earns persistence: memory + AsyncStorage, 300 entries, survives
  restart. Never applied to auth'd user data.

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
