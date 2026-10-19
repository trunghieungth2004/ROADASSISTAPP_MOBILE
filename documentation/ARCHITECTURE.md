# RoadAssist Mobile — Architecture

Expo (SDK 57) + React Native, New Architecture. Maps via
`@maplibre/maplibre-react-native` v11 (vendored MapTiler styles:
`streets-v4` light, `streets-dark-v4` dark — same planet tileset, key
injected at runtime by `buildMapStyle` into the `__MAPTILER_KEY__` template).
All five map views (`Route`/`Assist`/`Hazards`/`Nav`/`MapPickOverlay`)
pick the style from `useColorScheme()` via `requireMapStyle(scheme)` and
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

`src/config/secrets.ts` (git-crypt encrypted at rest, public in the shipped
JS bundle by Expo `EXPO_PUBLIC_*` design) reads five values. Firebase
`apiKey` / `authDomain` / `projectId`, `apiBaseUrl`, and `maptilerKey` carry
committed fallbacks so local and CI builds work without env; `requireMapStyle()`
throws `Missing EXPO_PUBLIC_MAPTILER_KEY` only when the resolved key is empty
instead of silently loading demo tiles. Map
geocode degrades to `formatPoint` coordinates when the key is missing.
Local development against the functions emulator uses an untracked `.env`
(gitignored, never commit it):

```
EXPO_PUBLIC_API_URL=http://127.0.0.1:5001/roadassistapp-c2e37/asia-southeast1/api
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_MAPTILER_KEY=your-maptiler-key
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

Same-place trips never reach the network: when origin and destination are
within 15 m and no stops are set, `requestRoute` shows `route.samePlace` and
returns early (Start re-routes from live GPS and relies on the BE guard).
Degenerate server geometry is inert client-side: `findRoute` drops options
whose `LineString` has fewer than two coordinates, and every map view
(`RouteMapView`, `NavMapView`, `AssistMapView`, `TowRoutePreview`) skips
line sources for such geometry instead of mounting them — MapLibre throws
on one-point lines.

Routing never blocks on a missing vehicle: `RouteCard` shows a centred
inline `route.vehicleHint` row whenever no vehicle is active (tap opens the
vehicle picker). The BE stays permissive — with no width/type in the request
it runs scooter costing and skips the narrow-alley width probe — so the hint
is the only signal that width checks are off.

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
drop-off picker for tow, and Send; nothing preselected). Filing while holding
a live ticket of the same type answers `409` with the live ticket's id — the
dialog names it once and offers Change drop-off (when the live ticket is a
destination-less tow, opening the retarget picker on it) or File anyway
(resubmits forced); cross-type filings skip the dialog entirely) and `Records`
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
viewers see no Accept at all — just the flow hint (tower claims first) —
since they can never take a tow),
Records merges everything. An accepted tow pins a live job view: map layers
(green tower-dot pin, pickup pin, drop-off pin, leg-aware straight connector —
tower→pickup while matched, tower→shop once arrived — camera fit on open)
plus a buttonless mini card (title, counterparty, live ETA) that opens the
record modal, where every action lives — riders mark arrival/resolution
there, towers resume navigation there. Countdowns show live distance first
(tower→pickup) and refresh from the tower's fix every few minutes while
matched, via `POST /dispatch/eta/refresh`. While any job card shows, the top
panel collapses to an expand bar (auto-collapsed on pin, manually
re-expandable, reset on unpin) so the map breathes; the mini card stays as
the job handle. The pin has two sources: an explicit
working pin (set when you accept a job, always wins) and a rider fallback —
the newest own out-direction tow at matched/arrived pins itself, so riders
get the live view without ever accepting. A pending tow pins from the
get-go: with a destination it shows an info card (drop-off name, default
border, no tracking), without one it pins alert-only (amber border, no
layers, no poll) as the visible "pick a drop-off" nudge. The live card carries
the same amber signal: a matched/arrived tow that has lost its drop-off (the
BE's 3-field clear after a destination decline) shows an amber border, amber
truck icon, and an extra amber line under the normal job info — the rider
reads "pick one," the tower reads "waiting for the rider to update the
drop-off." The info line stays in both cases, since tower distance and ETA
are still worth reading. The card title is the job name alone (the truck
icon already says tow), and the info line is status-aware: matched reads
tower distance plus pickup ETA, arrived reads rider distance to the drop-off
plus drop-off ETA. The tower dot is the heartbeat fix for the rider's view
and the viewer's own GPS for the tower's — "where the truck is" to the best
data each side has. The polyline fits the camera once per geometry key,
never on poll ticks.
The test for "has a drop-off" walks the name ladder (`destinationParty.name`
→ snapshot `name`/`label` → point `label`) rather than reusing `towDestOf`,
which needs coordinates and would false-positive on a shop the feed returns
without them. A quiet 15 s feed poll keeps the
tracking fresh while the job is live and focused. The live card draws the
routed polyline once per geometry change (accept, retarget, decline-clear —
never the 15 s poll, which only moves the tower dot): whole-way
tower → pickup → shop, direct tower → shop after arrival since the pickup is
behind. The straight connector stays as the fallback while the route loads
or when routing fails, and hides once the polyline lands so the two never
stack. The tow board reuses the pending
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
The onboarding shop step carries the same
vehicle-class chips, so fresh shops declare at signup.
Adding a shop address (place pick or map pick) also runs a one-shot
`POST /providers/near` at 300 m and, when registered shops come back (this
record excluded), prints their names under the field — a duplicate warning
only; the server `409` stays the real guard.

## Records: compact rows, detail sheet, ticket history

Records merges both sides of every ticket into a single newest-first list fed
by `POST /dispatch/feed`, which stamps each row server-side
(`direction: "in" | "out"` plus `otherParty` names — shop, tower, volunteer handle,
or rider display name; shop parties additionally carry `label`, `openNow`,
`ratingAvg`, and `ratingCount` when the provider record holds them, resolved
through `assignedShopId`, then the addressed `providerId` — the tow drop-off
shop is never the counterparty, so a pending tow reads Unassigned with its
drop-off arriving only via `destinationParty`, and pending and declined
walk-ins already name their shop).
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
place container (labeled Pickup on tow, SOS and mechanic tickets, Start point
on walk-in, with a reverse-geocoded label over the coordinates), the shop card when the party is
a shop (name title, address, stars, phone with the open-status pill —
tapping it opens the full shop modal, which owns the route action), a
drop-off section whenever a destination exists (full shop card from
`destinationParty` for registered shops, compact labeled point otherwise),
an empty drop-off block on destination-less tows (rider wording plus the
change action for the rider, neutral assigned-yet wording for inbound
viewers), a people card on both sides (rider-location block with name,
coords plus distance, stars, tappable phone on inbound rows; mirrored helper
card with role, stars and tappable phone on outbound rows), icon fact rows (note, decline, VND
amounts with separators), a vertical dot-and-connector timeline built from
`statusHistory` (`StatusStepper` only for legacy rows without history), tow ETA
pill and drop-off line for both viewers on live tows (the same arrival fields
read as tower-distance by the rider and as own-arrival by the tower), the
live route summary on matched and arrived tows alongside the pending preview,
tow fare rows in the money block (board preview estimate, "up to" ceiling
while live, final on resolve, recorded partial on cancel — all read from the
stored ticket quote, never recomputed for display), a linked-ticket row
jumping to the auto-spawned shop ticket on resolved tows, and
the rating thread with reply (ratee-only: the reply affordance hides on your
own ratings; every row is a shared `RatingRow` — initial avatar, author
name, stars, comment, indented reply with replier name — under a Your rating
title). Committing actions (Rate/Edit rating, Resolve at ready, Accept, Cancel,
Decline-send, work-save, Send-quote, Approve, Decline drop-off) live in
`Overlay`'s pinned footer; forms (cancel
confirm, decline reasons, work editor, reply) stay in the body on demand.
The walk-in Decline renders only on walk-in tickets — tow rows never offer
it, so a destination shop sees exactly one decline affordance (Decline
drop-off).
On pending unclaimed TOWs the Accept action is hidden from viewers who
can neither attach a tower nor take the volunteer path (shop-only viewers),
with a hint line in the body explaining the flow (tower claims first — shops
can't accept tow jobs) standing in for the missing button. Towers whose own
vehicle isn't accepting (off duty or mid-job) get the same hidden treatment
with an off-duty hint instead — the server would refuse the accept anyway.
Declining closes the sheet on success (errors keep it open for retry) —
walk-in declines and destination declines alike.
A drop-off block sits under the ticket coords whenever a destination exists:
registered shops show their name (storefront glyph), free points their label or
`Drop-off point` (flag glyph), both with coords. One drop-off rendering:
the counterparty card never doubles as the drop-off — the server no longer
resolves the drop-off shop into `otherParty`, so a pending tow reads
Unassigned in the hero with a single bordered drop-off block at every stage.
**Decline drop-off** appears in
the footer only for the destination shop's own operator on a non-terminal
ticket — pending included, so the shop can bow out as soon as it is told —
same gate as the server (`canDeclineDestination`), so a
foreign destination is read-only. A tow with no destination (after a decline
or a retarget to a cleared point) shows an explicit empty drop-off block, and
the rider gets a **Change drop-off** action (`canEditDestination`: own tow,
pending/matched/arrived) that reuses the creation picker and posts
`POST /dispatch/destination` — the open sheet refreshes from the reloaded
feed, so the new block appears in place. The tow picker passes `ticketId`
into provider near/search, so shops that already declined arrive with
`declined: true` and render marked (greyed but still tappable); map-point
picks and full refiles stay unblocked by design, and the server refuses a
re-pick regardless. Rider cancel is guarded against
double-submit and closes the sheet on success, so a dead ticket can never be
cancelled twice into an "already closed" error. It posts
`POST /dispatch/destination/decline`, which clears the destination without
touching the ticket status (the tower keeps the job and waits for the rider's
new drop-off; no travel leg is written when no tower is engaged) and the
reload drops the block on success; the rider is told to pick another
drop-off, and retargeting restamps the tower's ETAs from the live fix.
Sent amounts are one-shot (the server `400`s re-quotes and re-finals), and
the shop block carries a route button
(resolves snapshot → known-shop coords into navigation) beside a shared row
with the phone on the left and the open status on the right.
The sheet stays open and live across accept, work-save, and status moves:
every reload re-syncs the open ticket from the feed. Map dots are display
only — tapping them never opens anything; the sheet is the sole ticket UI.
Operator lifecycle runs inside the sheet: Accept (pending) → Send quote
(`WorkSheet`, amount required) → rider Approve (`6`) → Work done
(`WorkSheet`, work type + invoice, no amounts) → Mark ready (`7`), with
Decline + reason as the pending off-ramp; volunteers (SOS) keep the direct
Start work at arrival. Work states, the work sheet, and quotes are
shop-ticket only — volunteer-held and tower-held tickets never see those
controls (the server 403s them regardless; the client gates on the ticket
touching one of your own SHOPs, so dual-role accounts see the workbench only
on their shop jobs).
The workbench is one binding quote. The send-quote action opens its own
sheet and posts `POST /dispatch/quote` (`quotedAmount` required, optional
work-type) — ticket `9` (Quoted) with the amount on the record; the sheet
also opens from `IN_SHOP` and legacy estimate states, and an existing quote
hides the action (amounts are one-shot). Rider Approve
(`POST /dispatch/quote/approve`) moves `9`→`6` and requires a funded payment
on the ticket; Decline reuses the cancel pair. Work done opens the same
sheet in details mode and posts `POST /dispatch/work` (`workType` +
`invoiceRef` only — amounts are refused), then Mark ready (`7`) closes the
workbench. Tows never show a shop quote: the drop-off shop's optional
estimate is advisory (`estimateAmount`, no status move), and the repair
price lands on the walk-in ticket spawned at drop-off. An unfixable close
(`POST /dispatch/unfixable`, Matched/Arrived/In progress/Quoted/In shop/
Final quoted) voids pending charges and refunds held ones; payment CTAs
disappear once a ticket is unfixable or terminal.
Either side's phone number rides the feed on live tickets
(`2`/`3`/`4`/`6`/`7`/`9`, never pending or dead) and renders as a tappable
`tel:` row in the matching block; absent when unregistered.

## Hazard report form (`FlagSheet`)

Photo zone first, centred: up to three 48 px preview tiles (✕ badge to
remove) beside a dashed add tile; tapping the tile swaps in the "Take
photo" / "Add photo" chips in place, so the camera/library choice never
stacks a second modal. The old pin-preview + coordinate header is gone —
the report point stays pinned on the map behind the dialog. Type and Radius
split the control row 50/50 — "Type" and "Radius (m)" label lines over the
three icon-only 44 px buttons (names kept as accessibility labels) and the
five chips, each group centred in its half, chips capped at 40 px so they
never outgrow the type buttons. The note field follows. The dialog stays
non-scrolling with the submit in the footer.

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

`OnboardingScreen` is a step wizard, not an inline form dump: the roles step
picks licenses (Rider locked, Volunteer a toggle; a registered SHOP/TOW reads
"Registered" and locked), then Continue walks only the newly picked SHOP and
TOW setup steps in sequence — each with a back button, progress dots, and its
own inline validation — before the single `onFinish(services, shop, tow)`
contract fires. Skip stays on the roles step. Both call sites (Tabs' sign-up
gate, Settings' services sheet) get the same wizard, and services already
held without a provider record route straight into their setup step.

## Permissions & photo sources

The first-run gate (`PermissionGateScreen`) runs after sign-up, before the
tabs: one shared `PermissionRow` renders it and More → Permissions, so the
two surfaces can't drift in copy or affordances. Notifications and (on
Android) background location are required to finish; Camera and Photo library
are optional and skippable, and the battery row stays a manual settings step.
A row whose `canAskAgain` is false offers app settings instead of a dead
request. Existing accounts never see the gate again (`roadassist.permGate` in
AsyncStorage); the More screen carries the same rows for later.

Every photo attach point uses the same pair — `takePhoto()` (camera) and
`pickPhotos()` (library) — ticket dialog, dispute and unfixable evidence show
the two chips directly, while the hazard report reveals them from its add
tile. Both request their permission in context and throw the shared
`photo-permission` error on denial, which each sheet maps to "enable it in
More › Permissions". `app.json` carries the `expo-image-picker` plugin copy
(camera/photo usage strings, microphone permission off so no `RECORD_AUDIO`
is merged in; Android `CAMERA` arrives from the library manifest).

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

It presents as a bottom sheet (`variant="sheet"`), matching saved places.
Both saved managers are browsable lists that sit under a Fab or a header
button, not decisions — a sheet keeps the list near the thumb and gives the
content the full width, where a centred dialog floats it mid-screen with a
cancel row it doesn't need.

## In-app updates (`services/appUpdate.ts`, Android only)

No backend: the app compares its native version against the public
`releases/latest` tag and downloads `roadassist-<tag>.apk` straight from
GitHub. Cold start offers once (skippable per tag, auto-check toggleable in
About, manual check alongside); the dialog shows notes with Download /
Skip / Not now, progress inline, then the system installer via content URI.
iOS renders nothing — sideload doesn't exist there.

## More → Settings / About

Mihon-shaped: `MoreScreen` is a hub, not a settings dump. It keeps identity
(avatar, name, licence/role/provider badges, points/reports stats), then a
Duty card with one switch row per held role (volunteer / tow / shop) right
under the profile header, then two rows that push `Settings` and `About`,
then sign out. No accordions — every destination is a pushed screen (four
stack registrations beside `Diagnostics`: Settings, About, Permissions,
Providers).

`SettingsScreen` is a hub of rows: services onboarding, appearance,
language, then pushed `Permissions` (notifications / camera / photo library /
background location / battery, moved wholesale) and `Providers` (Vehicle-pattern header with
per-missing-kind register buttons on top, per-row switches + edit below,
create/edit dialogs moved with it). Volunteer radius/capability chips stay
in Settings as switch-less options, shown while volunteer mode is on.
`AboutScreen` holds everything that *identifies the app*: name, version +
build number, backend URL, check-for-updates + auto toggle (Android),
diagnostics link, GitHub source link.

Why split rather than one screen: the hub stays scannable on a phone, and
"which server am I on" is a question you only ask while debugging. The
volunteer location heartbeat lives on More (where its switch lives),
gated on that screen's focus; tower beats stay on Assist.

## Duty rows (More, under the profile card)

One row per held role, Mihon-style: title, consequence summary, switch.
Volunteer keeps its existing card (mode + radius + capability). Tow duty
drives every held tower's `accepting` at once and pings location on the way
up so the tower is visible immediately, not at the next 5-minute beat. Shop
duty reads Open/Closed and drives `accepting` — the server enforces it
inbound (walk-in filing rejected, shop pushes skipped), so off means off.
The tow subtitle reports effective visibility from beat freshness ("waiting
for location" on a cold start), because the switch alone can't promise what
the radius can't see. Per-provider switches stay as the source of truth for
multi-provider edge cases; the volunteer row's outer is a pressable so the
switch is tappable, matching the appearance row. Registration and edit forms
carry no fees and no duty switch — pricing lives in server-side platform
config and duty lives in these rows; the server still accepts the legacy fee
columns so older builds keep saving.

## Saved places live in place search

`SavedPlacesSheet` is reached from a bookmark button in the `PlaceSearchScreen`
header (next to close, since the action row is full) rather than from More.
Saved places are route-planning data consumed at pick time, so the entry
point belongs where they are used; it works in every mode the picker runs
in. Add/delete call `search.refreshSaved()` so the results behind the dialog
stay true.

Assist centers on the rider the same way route does: a mount-time
`centerOnLocal` with the shared retry helper, so a slow first fix no longer
leaves the map stranded at the default center. The drop-off picker passes
`kind: "SHOP"` to provider search and filters client-side too, so tower
listings can't be picked as destinations.

Both saved lists size to their content — no `minHeight` floor. `Overlay`
already handles the two cases correctly: the body is `flexShrink: 1` inside
a container capped at `maxHeight` (85% dialog / 70% sheet), so a short list
produces a short dialog and a long one scrolls. A floor would buy a taller
empty state at the cost of dead space on every non-empty one.

## Quotes, payments & disputes

### Two-stage estimate → final

The record sheet money block renders every stage: `estimateAmount` (stage-1
estimate) and `shopQuotedAmount` (legacy one-shot quote) as the estimate,
`finalAmount` (binding) with fault photos, plus the tow fare rows
(board-preview estimate, live "up to" ceiling, resolved final, recorded
cancel partial — all read from the stored ticket, never recomputed). The
workbench flow: send-quote posts the estimate (`13` Estimated, amber card
with Approve/Decline for the rider — approve `14`, decline returns to
pending and records the shop in `declinedShopIds`); saving a fresh final
posts `11` Final quoted — Approve starts work `6` (server-side gated on a
funded payment), Decline reuses the cancel pair. Sent amounts lock in the
work form and are never resent. An on-site `UNFIXABLE` verdict (reason +
evidence photos) closes the ticket at `15` with no `final` — the sheet shows
the unfixable banner and the payment state (refunded/held), never a price.

Tow estimates run the same handshake without the status machine. The
drop-off shop (the ticket's `destinationShopId` owned by the viewer) sees a
"Send estimate" chip on inbound live tows (`1`/`2`/`3`); tapping it opens an
inline amount + note form and the footer submit appears once the amount is
non-empty. The submit posts `POST /dispatch/estimate` — the ticket keeps its
status, the estimate carries a 24-hour TTL, and the rider's card grows an
awaiting/approved/expired state line. The rider's Approve (`estimateApprovedAt`
only, advisory; never gates any claim) and Decline (estimate cleared, the
shop appended to `declinedShopIds`, destination reopened with
`needsNewDestination` when that shop held it) ride the estimate card. One
live-or-approved estimate at a time; destination edits and declines drop the
estimate, and an expired one frees a resend.

### Destination-required tow

The BE rejects destination-less `TOW` filings (`400 "Tow tickets need a
destination"`), so the tow flow must always collect a drop-off before Send:
registered shop (`destinationShopId`), free point, or saved place through
the shared picker. The live-ticket `409` dialog's Change-drop-off branch now
serves the `needsNewDestination` rematch (destination declined, tower waiting)
rather than destination-less filing — the client treats an amber
`needsNewDestination` card as "pick one," never as a file-time state.

### Requeue with fresh GPS

When a drop-off is declined the engaged tower keeps the job and waits; the
rider's retarget (`POST /dispatch/destination`) restamps ETAs from the
tower's live fix. A tower that bows out mid-tow instead requeues the ticket
back to pending with the tow broadcast re-opened (`towerSearch: "ACTIVE"`,
"Finding another tower" push) and a deadhead partial frozen on record — the
tower cancel rides the sheet's cancel action (`allowTowerCancel` on engaged
tows) and the server detects the tower actor on an engaged tow. Client side:
the tower's 60 s location share already runs while a tow job is attached
(Assist foreground; navigator session while navigating), so a waiting tower
keeps its fix warm for the rematch — no extra ping needed. The BE writes
`pickupHistory` on filing and cancels; the sheet does not render it as a
timeline.

### Waiting-timer UI

While a tower is on site and work has not started, the record sheet shows
the waiting block: elapsed minutes and the accrued fee from
`POST /dispatch/waiting` (mapped to `{waitingMinutes, waitingFee}`),
refreshed every 15 s while a live tow is on Assist. The server bills each
started minute at the platform 15-minute rate, after a 10-minute grace and
up to a 60-minute cap, only while the tower's fix sits within 200 m of the
pin; the sheet falls back to the stored `towFare.waitingFee` when the
summary is absent. Volunteer rescues never show the block.

### Declined marking in search

The tow picker passes `ticketId` (plus the optional `minRating`/`sortBy`
ranking) into provider near/search, and rows arrive with `declined: true`
for shops that already declined — rendered marked but still tappable; map
picks and full refiles stay unblocked, and the server refuses declined
re-picks for the life of the ticket.

### Dispute popup

`DisputeSheet` (`src/screens/assist/DisputeSheet.tsx`, `Overlay` dialog):
reason chips (`RIDER_DISPUTE_REASONS`: `LATE`, `OVERCHARGE`, `NO_SHOW`,
`RUDE`, `WRONG_ROUTE`, `OTHER`), free-text note (≤500), one evidence photo
(camera or library chip) with thumbnail + remove. Submit requires a reason;
filing posts `POST /disputes` with the alias `reason` and a Storage-path
`photoUrl` — the server maps both to canonical kind/type/reasonCode and
`photoUrls` — and the sheet only files and reports status, no polling or
triage. Auto-filed records come from the server: mid-tow tower cancels and
destination declines.

### Dispute entry points

One manual button per reason, gated in `recordActions.ts`. The shared footer
chip renders only when no specialized dispute surface is active: live
tickets past pending (`canDispute`), or resolved tickets still worth
contesting — money on file (`towFare.estimate`/`shopQuotedAmount`/
`finalAmount`) and within the 7-day window after the resolved status stamp
(`canDisputeResolved`; permissive when the history or timestamp is missing,
so legacy rows never silently lose their button). The tower-cancel banner
(`cancelledBy` set on a non-terminal rider-side ticket; the server clears it
on the next claim, dropping the banner), the shop-decline banner, and the
final-quote card each carry their own chip, and the footer steps aside while
they show. Every chip files through the `DisputeSheet` above.

### Cash confirm vs SePay

Two settlement UIs on the same money block. The operator confirms cash
received roadside (`POST /payments/confirm-cash`, `PENDING` → `CONFIRMED`).
The rider's pay action creates the charge (`POST /payments/create`
`{ticketId, method: "SEPAY"}`) and the sheet renders the hosted checkout
link (`ticket.qrUrl` → `payment.checkoutUrl` → `ticket.checkoutUrl`), opened
in the system browser via `Linking.openURL`; funds land `HELD` (reserved —
the sheet shows "Held"). The payment state re-reads on the next record
reload — no payment push events exist server-side. Labels come from
`paymentMethodLabel`/`paymentStatusLabel` (`Pending` / `Held` / `Confirmed` /
`Refunded` / `Partial`); copy says "on record" for cash and "Held" for SePay
until settled.

## Build / verify

```
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/expo run:android   # native rebuild + install (dev-client)
```

Waydroid (`192.168.240.112:5555`) has no real GPS or compass: navigation
follow, heading rotation, and TTS voices require a physical device.
`adb reverse` tunnels do not survive adb disconnects/reboots.
