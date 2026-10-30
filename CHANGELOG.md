# Changelog

All notable changes to RoadAssist Mobile are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and releases use [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
