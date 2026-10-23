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
check, version stamping, signed release APK, GitHub Release with generated
notes. Branching stays trunk-based: short branches → PR → squash onto `main`,
release = tag. No `develop` branch.

### Cutting a release

```bash
node -p "require('./app.json').expo.version"   # read current
# bump expo.version in app.json, commit
git tag v0.2.0 && git push origin main v0.2.0
```

The workflow asserts the tag equals `v<app.json version>` and stamps
`versionCode` from the run number (monotonic, so reinstalls are always
accepted as upgrades). The APK is named `roadassist-<tag>.apk` — that name
is a contract: the in-app updater locates the download by it, so renaming
breaks updates without a compile error anywhere.

### Planned updater rollout

The installed build is `v0.1.1`, and the in-app updater cannot replace it
reliably, so the rollout is staged:

1. Bump `expo.version` to `0.1.2`, tag `v0.1.2`, and distribute that APK as a
   manual install (uninstall `v0.1.1` first where signatures differ).
2. After `v0.1.2` is installed on the test devices, bump to `0.1.3`, tag it,
   and use it to verify the in-app updater path.

Until that approval, `app.json` stays at `0.1.1` and no tag is cut.

| Secret | Source | Notes |
|---|---|---|
| `GIT_CRYPT_KEY` | `git crypt export-key` on any unlocked machine, base64'd | Unlocks `google-services.json` + `src/config/secrets.ts` in CI; without it the build ships Firebase-dead and Map-dead (CI stubs the keys to empty) |
| `ANDROID_KEYSTORE_BASE64` | base64 of the upload keystore (below) | Write-only, masked in logs |
| `ANDROID_STORE_PASSWORD` / `ANDROID_KEY_ALIAS` / `ANDROID_KEY_PASSWORD` | chosen at keystore creation | Same |

### Creating the upload keystore (once, ever)

No release keystore exists yet, so generate one — and back it up, because
losing it means the app's signing identity is gone for good (updates would
require an uninstall):

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
