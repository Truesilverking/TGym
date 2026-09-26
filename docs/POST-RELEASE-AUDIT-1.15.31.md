# TGym post-release functional and browser audit

Updated: 2026-09-26 (America/Santo_Domingo). Starting checkout: `52871662c5d71ca24bc4c3435d72c90bb92e11ff`, branch `feature/dashboard-visual-polish`. Published APK/PWA remains **1.15.31 / code66** from `48dc3a1`. Follow-up corrections below are a candidate, not a replacement for that immutable release.

## Result and limits

The browser acceptance work that was blocked has now run in an isolated Edge profile using synthetic data. The user authorized continuation of the previously proposed Playwright alternative. Computer Use still returned no apps/browsers and the native pipe was unavailable. Playwright 1.63.0 and axe were installed only under ignored `.tools/browser-audit`; the existing Edge 153.0.4234.48 was used. No browser or full Android SDK was downloaded. A later, separately authorized Platform-Tools installation enabled the physical-device follow-up below.

This is **not a guarantee that every function is defect-free**. Physical Android acceptance, a designated live Drive test account, real self-hosted authentication/admin flows and installed-PWA acceptance remain unverified. Automated accessibility scans do not certify all WCAG criteria or screen-reader behavior. The browser checks below exercise a production standalone build, not Android WebView.

## Defects reproduced and corrected

| Trigger | Previous behavior | Correction |
| --- | --- | --- |
| API upload or logout fails during sign-out | The local profile could be erased despite an unsuccessful save. | Sign-out requires a successful final upload and logout; failures keep local data and report an error. |
| Local edits arrive while signing out | An older upload could clear the dirty marker and delete later edits. | Strict uploads reject stale snapshots. If authentication already ended, keep the newer profile locally and disclose that retention. |
| An earlier autosave is still pending | Parallel PUTs could complete out of order and overwrite the final sign-out upload. | Serialize uploads in this store instance. Final upload waits for earlier requests; failure does not poison retries. Queued snapshots do not run under another account. This does not provide multi-device server conflict resolution. |
| Sign-out with an active workout | API `/api/data` deliberately removes `active`, but the client deleted its only remaining copy. | Successful logout retains the full local profile when a workout is active and reports that data remains. Regression mocks reproduce the actual API omission. |
| Drive changes/replaces/deletes the reviewed backup while a conflict dialog is open | Final save could overwrite the newer remote snapshot. | Pass the reviewed file ID/modification time to the final metadata check and require re-synchronization if it changed. This is **not atomic compare-and-swap** between the final read and upload; live two-device Drive concurrency remains open. |
| Optional PIN is partially entered, then skipped | Skip performed PIN validation and blocked onboarding. | Skip advances without creating a PIN. Continue still validates. |
| Dark/Light UI uses muted or tinted text | Measured small-text contrast failed on tabs, dates, badges and actions. | Adjust theme colors, muted text and filled-control labels; preserve the user's accent selection. |
| Zoom, calendar arrows and body maps | Page disabled zoom; some buttons and SVG images lacked names; credits links relied on color alone. | Allow browser zoom, name controls/maps, underline inline credit links. |
| Reduced motion with exercise animations or uploaded GIF/WebP | CSS reduction did not stop image animation; media playback lacked a keyboard control. | Start with a still frame under either app or OS preference, including decoded static posters for custom images/thumbnails. Allow deliberate play/pause through a real button. Uploaded data remains unchanged. |
| Spanish data-safety copy | English fallback spread overwrote the newly added Spanish messages. | Apply fallback first and assert the Spanish messages at runtime. |

No private backups, credentials, signing keys or live Google Drive account data were read. No storage key, state schema, package identifier, signing identity or Android update integrity validation changed.

## Second browser pass

Artifacts and executable audit scripts are local/ignored under `.tools/browser-audit/`; logs are `audit-browser-*-final.log`. A localhost-only static server serves the compiled `frontend/dist`. Each test uses a fresh disposable profile. API/cloud/network unit mocks are separate from these browser results.

- **512 route/layout cases:** 8 routes (Home, Plan, routine editor, workout entry, Stats, History, Library, Settings) x 8 widths (320, 360, 375, 390, 430, 768, 1280, 1920) x EN/ES x Dark/Light x normal/reduced motion. Screenshots captured at 320/390/1280; representative Home, routine/workout and calendar captures were visually inspected. Library filter strips scroll horizontally by design and were excluded from false offscreen-control warnings. Remote-media decoding was checked separately after waiting for image load; initial layout screenshots can capture the white loading area.
- **140 dialog/layout cases:** streak, calendar, session times, bodyweight, goal, restore and activity dialogs at the five phone widths, both languages/themes. Checks include focus entering the dialog; nested dialogs are exercised. No observed layout or axe failures in the final pass.
- **14 workout variants / 70 layout cases:** warmups, per-side confirmations, drop sets, rest-pause, timed sets, cardio and supersets, both themes at five phone widths. Entered completion persists after reload; early timed/cardio completion records elapsed work. These variants use English and reduced motion.
- **32 additional accent scans:** Home/Plan with all 8 accent choices in both themes. Automated scans use axe WCAG 2 A/AA and 2.1 AA tags.
- **Six real browser flows:** initial setup/PIN skip and reopen; workout start/navigation/reload/offline/finish; routine editing/delete/cancel/undo; downloaded JSON backup/import/undo; downloaded PNG and four-page PDF calendar report; log/edit activity without duplication. PNG and PDF opening/rendering were inspected. Download fallback was selected in the test profile; native share-sheet acceptance is not claimed.
- **Clock recovery:** rest deadline survives reload; completed-workout decision survives reload; continuing excludes paused time; finishing saves history once. A top-weight confirmation must be saved before the completion decision; the initial test omission was corrected. This does not prove restoration of an in-progress timed-set callback after OS process death.
- **PWA offline recovery:** install and activate the actual service worker, reload offline, recover preferences from IndexedDB after removing only the test localStorage state, retain active/saved workout data. Uncached remote exercise media still needs connectivity.
- **PWA update:** real Settings update dialog with a synthetic newer `build.json` and worker cache identity, activation/reload, pre-update backup, retained 33-row history, old TGym cache cleanup, unrelated/audio caches retained, and offline reload. It does not download an Android manifest. No live manifest, release or notification was changed; this is not an upgrade test of an installed production PWA.
- **Motion/keyboard:** custom-image poster decoding and Enter-key play/pause verified under both app and OS motion preferences. Static posters are generated locally and are not added to backups.

The first offline probe failed under Vite preview because its `Vary: Origin` header made module/CSS cache entries differ from preload requests. The exact compiled files passed with the static server. No application service-worker change was made to conceal that harness mismatch. Early test selector/confirmation/download-fallback errors were diagnosed and rerun; they are not counted as passing evidence.

## Automated candidate checks

- **1,032 frontend tests / 107 files passed**, including 38 added cases over published 1.15.31. Sign-out defects and optional-PIN/cloud review failures were reproduced before correction. Media has six new tests; Spanish fallback has a regression assertion.
- Store/DOM suites cover real App/router/store and restore dialogs with simulated API/cloud boundaries. They do not authenticate against a real account.
- `build`, `build:pwa` and `build:mobile` passed, including final Capacitor synchronization and validation of all 24 sound clips. Twelve locale packs contain 1,542 synchronized keys; all 1,019 detected source strings are covered.
- There are **no frontend lint or typecheck scripts**. Existing bundle-size and ineffective-dynamic-import warnings remain. iOS native compilation is not available on Windows.
- API, MCP and fatigue calculation source did not change in this follow-up. Previously successful unchanged local baselines were not repeatedly rerun; fresh exact-candidate CI passed as recorded below.
- Added/modified text was checked for private-key/token patterns without printing potential secret values; no matches. `git diff --check` passed.

## Native/publication checkpoint

The full local Android build SDK is unavailable; User `JAVA_HOME` and JDK21 exist. After explicit user authorization, only the official Google Platform-Tools 37.0.1 were installed in the standard Android location, enabling ADB diagnostics. Android Studio/build tools/platform packages were not downloaded. The published release's prior CI is historical evidence only.

Candidate `1b189fdd0dbb68a4cefa7ad5226edb2a01b0d9a1` was committed and pushed to `feature/dashboard-visual-polish`; the remote branch SHA was verified. Both workflows completed successfully for that exact source SHA:

- [Tests, run 36217292406](https://github.com/Truesilverking/TGym/actions/runs/36217292406): 1,032 frontend tests, 10 API tests, 37 MCP tests, plain-Node MCP loadability, web build, locale/source-string checks, 108,000 fatigue comparisons and 14,076 history-deletion comparisons.
- [Validate Android, run 36217292398](https://github.com/Truesilverking/TGym/actions/runs/36217292398): mobile build/Capacitor sync, `assembleDebug`, `:app:lintDebug` and all 9 instrumented tests on Android 15/API 35. These tests cover package identity, the background workout notification service, sound/channel persistence and Health Connect metadata/type mapping. They do not establish live provider imports, real FCM delivery, installation over the user's signed release or full app-process recovery.

These feature-branch workflows did not publish Pages, create a release or send FCM. Version remains 1.15.31/code66 until a distinct release is deliberately assigned. A documentation-only follow-up does not change the tested application source.

### Physical-device follow-up

ADB access was authorized on a Pixel 10 running Android 17/API 37. The installed app is 1.15.31/code66; its APK SHA-256 exactly matches both the published artifact and the current public manifest (`f0e906dc1a961b668d34bd8cbb7f6321318378dad065d9e9dc47af14b1bba515`). Android reports notification and exercise-reading permissions granted, with package installation allowed. No newer APK is offered by the public manifest, so the absence of an update prompt is currently expected. Permission status alone does not prove delivery, installation or Health Connect import.

Inspection of the real Home screen exposed a native layout defect: Android's status bar overlaps the header controls. Capacitor 7 defaults to disabled edge-to-edge margin adjustment; CSS safe-area values alone did not protect this device. The follow-up sets `android.adjustMarginsForEdgeToEdge` to `auto`, using Capacitor's native system-bar/display-cutout insets on Android 15+. `SafeAreaTest` checks actual WebView bounds on all four sides before and after activity recreation. The mobile asset build and final Capacitor synchronization passed.

The fix was pushed as `a8b88e159567bd996dbbe52d06fca5cab7627f2e`, with remote SHA verified. [Tests run 36218534450](https://github.com/Truesilverking/TGym/actions/runs/36218534450) passed all frontend/API/MCP jobs; [Validate Android run 36218534416](https://github.com/Truesilverking/TGym/actions/runs/36218534416) passed build/lint and **10 instrumented tests on API 35**, including the added geometry regression. No frontend source changed after the previous full browser matrix. The corrected APK has not yet been installed on the physical API 37 phone, so physical confirmation of the fix remains open.

On the installed release, tapping the actual Settings `Check for updates` control returned `TGym is up to date.` Navigation through Home, Routine, Stats and Exercises rendered, and Home remained available after sending the app to the background and reopening it. Filtered retained logs for this app process contained no TGym update warnings, workout/audio errors or AndroidRuntime errors. This was navigation/background smoke coverage, not an active-workout process-death test.

Device screenshots are private, ignored local evidence and must not be published. No workout/profile state was edited, reset or removed. App-version verification and navigation on the published release are distinct from acceptance of the unpublished candidate.

## Remaining external acceptance

1. On the user's Android device: install over the previous release and retain data; open the update from real FCM; exercise download/installer permission; lock/background/terminate/reopen; validate timers/audio and notification cleanup under the manufacturer's battery restrictions.
2. With a designated test account/provider: real Drive OAuth/restore/sync and two-device conflicts, real API authentication/admin/session reopening, and actual Health Connect permission grant/revoke plus imported exercise records. Android instrumentation covers metadata/type mapping, not a live provider import.
3. Installed production PWA upgrade, virtual keyboard, safe areas, assistive technology and exhaustive editorial review beyond the tested route/dialog matrix. iOS/macOS native acceptance requires its platform.

These gaps must remain explicit in a release decision. Do not equate compilation, unit tests, simulated service boundaries or headless browser checks with physical-device acceptance.

## Signed candidate preparation

Candidate version 1.15.32/code67 is assigned for installation over the verified 1.15.31/code66 device build. `android-candidate.yml` runs only for an explicit `android-candidate-*` QA tag or manual dispatch. It produces a signed release APK as a short-lived Actions artifact, verifies its package/version and certificate against the currently published manifest, and has no release, Pages or notification step. Signing material remains in the runner and is excluded from the artifact. The QA tag does not match the production `v*.*.*` release trigger. Web/PWA/mobile builds and final Capacitor sync passed for the assigned version.

Source `27e3c914c1049ef217ce7331d58d89978eccad05` and QA tag `android-candidate-1.15.32-01` were verified remotely. All exact-source workflows passed:

- [Tests 36218938863](https://github.com/Truesilverking/TGym/actions/runs/36218938863): frontend/API/MCP and their existing checks.
- [Validate Android 36218938888](https://github.com/Truesilverking/TGym/actions/runs/36218938888): debug build/lint and 10 emulator tests.
- [Signed candidate 36218941338](https://github.com/Truesilverking/TGym/actions/runs/36218941338): release build/lint, matching published signing identity, package/version checks and artifact upload.

Artifact `10899265080` was downloaded with its archive digest verified. APK SHA-256 is `30c7addb5b633abe502315030e37ffdfd7297cc071dca852775b9a4d6f1202fa`. Installation on the Pixel succeeded using replacement mode, without uninstalling/resetting TGym. Android reports 1.15.32/code67, preserves the original first-install date, and the installed APK hash matches the candidate. The phone automatically locked during installation: the post-install visual/data comparison is still pending an unlock, so physical confirmation of the margin correction is not yet claimed. Production release, Pages and FCM remain unchanged.

### Per-side repetition follow-up

The user requested that 8 reps per side display as 8 throughout the routine/workout UI. Legacy targets store the combined total (16), while newer `repsPerSide` targets store 8. UI adapters now show and accept the one-side count for either representation, including ranges, completed/undone rows, intensity extensions, history, printed plans, CSV and unloaded rep statistics. Normal reps and timed work retain their semantics. Storage, portable JSON backups, historical volume and progression calculations remain compatible; no bulk migration runs.

Local validation passed: **1,050 frontend tests across 108 files, API 10, MCP 37 and plain-Node import validation**; web/PWA/mobile builds and final Capacitor sync succeeded. There are no frontend lint/typecheck scripts. The initial seven test failures were corrected before the successful full run. Build warnings about existing mixed static/dynamic imports remain non-fatal.

An isolated real-Edge audit passed **8 flows and 80 layout checks**: legacy/new targets, EN/ES, dark/light, 320/360/375/390/430 px and reduced motion. It exercised routine editing, single-rep increments, side confirmations, completion, reload and undo, checking persisted values and runtime errors. Representative 320 px screenshots were visually inspected. These synthetic-profile checks do not modify the phone's training data.

The replacement candidate is assigned **1.15.32/code68**, superseding code67 for QA. Its signed CI artifact, physical installation/visual verification and any production publication are still pending at this checkpoint. Candidate01 does not contain the per-side correction.
