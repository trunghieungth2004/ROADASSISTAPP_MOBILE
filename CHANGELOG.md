# Changelog

All notable changes to RoadAssist Mobile are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and releases use [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0] - 2026-11-14

### Added

- Dashboard with a rider/provider switch for trips, spending, jobs and payouts.
- Rider Booking flow: shop search, available slots, deposit checkout and my bookings.
- Refunds tab in Payments, with refund status, reason, transfer reference and a
  link to the related payment.
- SOS cancel sheet with cancel-whole-request and find-another-shop actions.
- Live TOW tower position and tower-origin route updates while a job is active.
- Provider location updates continue during active TOW and mobile-shop jobs.
- TOW payment choice after delivery: cash or SePay, including switching a
  pending cash payment to SePay.

### Changed

- Cases are combined across rider and provider roles; the dashboard switch only
  filters dashboard data.
- A delivered TOW bill starts unpaid instead of forcing cash on the tower.
- Refund details now use payment wording and open the payment sheet.
- Profile service chips include TOW and mobile-shop provider roles.
- More dashboard entry and the mobile dashboard card were simplified.

### Fixed

- TOW cancellation now keeps prior-tower travel payable and shows the correct
  distance.
- Refunds are requested for unfixable SePay and confirmed payments, including
  SOS call-out-only closes.
- Unfixable tickets refresh immediately and no longer leave stale actions.
- Cached ticket feeds are invalidated after actions.
- SOS billing and status handling for in-progress and completed work.
- Map route focus and route-key updates during tower movement.

## [0.3.1] - 2026-11-13

### Added

- Cases center for ratings, reports, disputes and appeals, with a shared
  detail sheet showing the outcome, account impact and appeal state.
- Trust and Standing score bars on the profile.

### Changed

- Bill actions now follow the bill viewer: admin and payee views are read-only.
- Overturned reports no longer show an account warning.
- The update dialog shows the full release changelog instead of truncating it.
- Provider details no longer show a Warranty claims shortcut; warranty remains
  available from More and Settings.

### Fixed

- Profile standing, restriction and conduct fields now refresh correctly after
  admin changes.
- Case rows now show their outcome and use localized labels.

## [0.3.0] - 2026-11-06

### Added

- Booking, support, refund and warranty APIs and screens.
- Warranty coverage and claim tabs for riders and providers, with claim photos,
  shop links and accept/decline/rework actions.
- Vehicle service history with linked shop details and per-service warranty
  claim buttons.
- Searchable provider service picker with multi-select, fixed/quote pricing,
  warranty, category and vehicle-class metadata.
- TOW handover photos and quick-fix/release flows.
- Saved-place, current-location and map-pick choices for TOW drop-off.
- Separate service/work card on ticket details.

### Changed

- Payment details now open as a sheet for all ticket types, with a fare preview
  for active TOWs.
- Ticket photos use horizontal role-specific lanes for rider, shop, tow and
  mobile-shop photos.
- Provider warranty claims are reachable from More, provider details and
  settings.
- Return-TOW active cards use the normal TOW layout.
- Dropped the separate Work order action; quotes and requotes carry the work.

### Fixed

- Warranty stamping now runs when a linked walk-in is auto-resolved by a
  return TOW.
- New tickets retain vehicle id, plate and height snapshots.
- TOW handling and cancellation recomputes use the assigned provider card.
- Fare-cap deductions are no longer shown as negative cap charges.
- Sparse GPS tracks fall back to the quoted loaded distance.
- Warranty claim photos use the correct Storage path and photo-picker style.
- TOW route lines follow the tower position on both rider and tower views.

## [0.2.2] - 2026-11-02

### Added

- Itemized shop quotes and invoices, with provider service-catalog chips and
  line totals.
- Provider-set TOW base/per-km and mobile-shop call-out/travel pricing within
  platform bounds.
- Quote amendment history while a quote is still awaiting approval.
- Itemized mobile-shop SOS fix fees, using the same line-item editor.
- Rider approval for revised invoices after quote approval.
- Precise tracked deadhead distance from the provider location trail.
- SOS mobile-fix approval: the shop quotes `3→9`, the rider gets 50:50
  Approve/Decline, decline excludes the shop and keeps prior call-out/travel
  payable through `mobileFeeHistory`.
- Explicit WALK_IN/MECHANIC quote decline restores the pre-quote state (`9→2`
  for a walk-in, `9→3` for a mechanic) so the shop can re-quote.
- TOW loaded marker and genuine-breakdown re-match: pays actual deadhead plus
  loaded distance, records `towFeeHistory`, and caps the replacement fare at
  the original ceiling.
- Cash / SePay choice for every quote approval, with the SePay QR rendered in
  an in-app WebView instead of leaving the app.
- Pending SePay charges stay reusable until paid or cancelled; reopening the
  QR refreshes the bridge token without creating a duplicate payment.
- Tower-owned TOW arrival and delivery, with rider receipt confirmation and
  distinct return-tow labels.
- Return-tow destinations carry a reverse-geocoded street label.
- Tower delivery requires the loaded marker; ticket modals show the live status pill.
- Unfixable WALK_IN/MECHANIC tickets can request a return tow.

### Changed

- Cash quote approval starts work immediately and confirms cash at Mark ready;
  SePay must be paid before approval.
- Return-tow offers are blocked while a WALK_IN CASH charge is unconfirmed,
  and journey-bill payments no longer leak across linked ticket items.
- Work done is presented as the secondary Work order action; rider receipt is
  labelled Confirm.
- The ticket detail body scrolls with pinned actions; the assist top panel
  stays fixed and only its ticket lists scroll.
- “Can’t fix” is a primary action and disappears once a quote is sent.
- Destination shops filter by the ticket’s vehicle class, not the rider’s
  currently active vehicle.
- Admin-configurable provider price bounds.

### Fixed

- SOS quote now appears on the purple Quoted stage; a ticket reset to Pending
  shows only the current Pending dot.
- Mobile shops see the rider's request photos on a pending SOS, and older
  unfixable tickets can request a return tow without a stored offer.
- Quote and mobile-fix decisions send provider FCMs, including a targeted
  push to the declined mobile shop after its assignment is cleared.
- A declined mobile fix is labelled as a rider quote decline, not a provider
  cancellation or a re-match to another tower.
- Chat records quote sent/updated/approved/declined and mobile-fix quote
  events.
- Cancelling a TOW bills only traveled deadhead; a tower that never moved
  bills 0.
- SOS journeys include their continuation TOW in the same bill.
- Invoice line items stay visible on the ticket and bill.
- SOS and TOW billing include prior mobile-shop and tower partials.

## [0.2.1] - 2026-10-30

### Fixed

- The hazard-placement hint no longer blocks map taps or makes the Route
  screen appear frozen.
- Route-context hints stay inline so the map remains interactive while the
  rider places a report.

## [0.2.0] - 2026-10-30

### Added

- Mobile-shop SOS call-outs with a shop-entered fix fee, a 1 km call-out
  waiver, evidence photos, and continuation to another nearby shop.
- Network tow handoff: a mobile shop without an available tow vehicle can
  request a network tow, and the rider confirms the drop-off.
- Versioned ticket chat: each tower assignment gets a fresh room, while
  earlier conversations stay available read-only to their participants.
- In-app update checks from the latest GitHub release.
- A retryable in-app fallback when a map fails to load.
- Cancellation reason pickers for riders, shops, and towers.
- Provider-to-vehicle linking, including a warning before removing a vehicle
  that is linked to provider licences.
- SOS call-out lines on bills.
- Photo thumbnails and compressed photo uploads, with a “send without photos”
  recovery path when an upload fails.

### Changed

- SOS, TOW, and MECHANIC now require an active vehicle. WALK_IN remains exempt.
- One live ticket per vehicle. The forced “file anyway” bypass is removed.
- Shop `accepting` is the operational gate; opening hours are advisory.
- TOW rows use the tow-truck icon while the filter classification stays
  role-based.
- Destination ETA moved to a header pill, and status history has its own
  compact Status card.
- `Work done` and `Mark ready` now have a clearer visual hierarchy.
- Service licences are rider-only; the volunteer flow has been retired.
- TOW cancellation now re-matches automatically instead of offering a
  redundant “Request again” action.

### Removed

- Volunteer mode and volunteer location sharing.
- Legacy alley-segment routing.

### Fixed

- Correct status stages for WALK_IN and MECHANIC jobs.
- Destination decline state now comes from the actual destination decline.
- Archived chats reject writes and remain read-only.
- Old chat history and cancellation reasons are hidden from the next provider.

### Security

- Added write rate limits, stricter CORS handling, and media path validation.
