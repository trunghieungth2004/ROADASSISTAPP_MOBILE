# Release pipeline

Two builds for two jobs: iterate locally, distribute only CI artifacts.

## Local builds (iteration)

`yarn android` runs the same gates CI runs (`typecheck` + `test`), then
`expo run:android` prebuilds and installs a **debug** build to the attached
device or Waydroid. Use these for development, logcat, and behavior checks.
Debug and release builds differ (bundling, Hermes, R8), so judge
release-sensitive behavior — startup, jank, anything perf-shaped — on a CI
artifact, never on a debug build.

## CI (`.github/workflows/ci.yml`)

Every push and PR to `main`: frozen install, `yarn typecheck`, `yarn test`.
No secrets involved, so it runs green on forks too. `main` should stay green;
turn on "require CI pass" branch protection when ready.

## Release builds (`.github/workflows/release.yml`)

On `v*` tags (or manual dispatch): gates, git-crypt unlock, Firebase config
check, version stamping, signed release APK, curated release notes, and a
GitHub Release. Branching stays trunk-based: short branches → PR → squash onto
`main`, release = tag. No `develop` branch.

Manual dispatch builds and uploads an artifact but does not publish a release;
only a tag push publishes.

### Changelog and release notes

`CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/):
newest version first, grouped into Added / Changed / Removed / Fixed /
Security, written for users rather than copied from `git log`.

Before tagging:

1. Move the `Unreleased` entries into a `## [x.y.z] - YYYY-MM-DD` section.
2. Check the notes extract cleanly:

```bash
yarn release:notes v0.2.0 --check
```

The release workflow runs the same script, writes `release-notes.md`, and
publishes that section as the release body. `generate_release_notes: true`
appends GitHub's automatic full-changelog link. Do not rely on GitHub's
automatic notes alone: this project pushes commits directly to `main`, so
GitHub has no merged-PR titles or labels to categorise.

### GitHub "Latest" semantics

The in-app updater calls:

```text
GET https://api.github.com/repos/trunghieungth2004/ROADASSISTAPP_MOBILE/releases/latest
```

GitHub defines that endpoint as the most recent **non-draft, non-prerelease**
release sorted by `created_at` — the commit date, not the publish date. A
release published later can therefore fail to become Latest if its commit is
older. The workflow sets `make_latest: true` explicitly so the intended
release becomes Latest regardless of that ambiguity.

Rules:

- Drafts and pre-releases can never be Latest.
- Publish releases in version order.
- If publishing an older/backport release, do not leave it as a normal full
  release; mark it `make_latest: false` or publish it as a pre-release.
- To move Latest back to an earlier release:

```bash
gh release edit v0.1.2 --latest
```

### Cutting a release

```bash
node -p "require('./app.json').expo.version"   # read current
# bump expo.version in app.json
# bump version in package.json and package-lock.json
# add the matching section to CHANGELOG.md
yarn release:notes v0.2.0 --check
git add app.json package.json package-lock.json CHANGELOG.md
git commit -m "MOBILE: release 0.2.0"
git push origin main
git tag v0.2.0
git push origin v0.2.0
```

The workflow asserts the tag equals `v<app.json version>` and stamps
`versionCode` from the run number (monotonic, so reinstalls are always
accepted as upgrades). The APK is named `roadassist-<tag>.apk` — that name
is a contract: the in-app updater locates the download by it, so renaming
breaks updates without a compile error anywhere.

### Current rollout

`v0.2.2` is the current published build. It adds the tower-owned TOW
arrival/delivery flow, return-tow billing on the journey bill, provider
pricing and subscriptions, and the walk-in quote-decline fix. Install
`v0.2.2` over `v0.2.1` with the same signing key to verify the in-app
updater path.

### Verify a published release

```bash
gh release view v0.2.0 \
  -R trunghieungth2004/ROADASSISTAPP_MOBILE \
  --json tagName,isLatest,assets

curl -sS \
  -H 'Accept: application/vnd.github+json' \
  https://api.github.com/repos/trunghieungth2004/ROADASSISTAPP_MOBILE/releases/latest \
  | jq -r '.tag_name'
```

Then download the APK, confirm `versionName`/`versionCode` with
`aapt dump badging`, install it on a physical Android device, and open the app
to confirm the updater offers the new version.

| Secret | Source | Notes |
|---|---|---|
| `GIT_CRYPT_KEY` | `git crypt export-key` on any unlocked machine, base64'd | Unlocks `google-services.json` + `src/config/secrets.ts` in CI; without it the build ships Firebase-dead and Map-dead (CI stubs the keys to empty) |
| `ANDROID_KEYSTORE_BASE64` | base64 of the upload keystore (below) | Write-only, masked in logs |
| `ANDROID_STORE_PASSWORD` / `ANDROID_KEY_ALIAS` / `ANDROID_KEY_PASSWORD` | chosen at keystore creation | Same |

### Creating the upload keystore (once, ever)

If the upload keystore does not exist yet, generate one — and back it up,
because losing it means the app's signing identity is gone for good (updates
would require an uninstall):

```bash
keytool -genkeypair -v -keystore ~/roadassist-release.keystore \
  -alias roadassist -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 ~/roadassist-release.keystore   # → ANDROID_KEYSTORE_BASE64
```

Keep `~/roadassist-release.keystore` plus the two passwords and the alias
somewhere off this machine too. Never commit the file to git.

Never paste secret values into chat, issues, or logs. Secret-consuming steps
run on tag-push and manual dispatch only — never on PRs, where fork builds
get no secrets by design.

### Reinstalling on Waydroid / devices

CI APKs carry an increasing `versionCode`, so `adb install` accepts them over
older builds. If an install ever refuses with a downgrade error, uninstall
first — that means the versionCode didn't advance, which is itself a bug
worth reporting, not working around silently.

### Debug vs release signatures

Debug builds (`yarn android`) and CI release APKs are signed with different
keys, so Android rejects installing one over the other
(`INSTALL_FAILED_UPDATE_INCOMPATIBLE`). This is one-time per device: uninstall
the debug build before installing a release APK, and uninstall the release
build before going back to `yarn android`. The in-app updater cannot detect
this — it hands the APK to the installer, which then refuses; no app-side
retry can get around the signature check.
