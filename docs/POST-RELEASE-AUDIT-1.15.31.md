# TGym post-release functional and browser audit

Updated: 2026-09-26 (America/Santo_Domingo). Starting checkout: `52871662c5d71ca24bc4c3435d72c90bb92e11ff`, branch `feature/dashboard-visual-polish`. Published APK/PWA remains **1.15.31 / code66** from `48dc3a1`. Follow-up corrections below are a candidate, not a replacement for that immutable release.

## Result and limits

The browser acceptance work that was blocked has now run in an isolated Edge profile using synthetic data. The user authorized continuation of the previously proposed Playwright alternative. Computer Use still returned no apps/browsers and the native pipe was unavailable. Playwright 1.63.0 and axe were installed only under ignored `.tools/browser-audit`; the existing Edge 153.0.4234.48 was used. No browser, Android SDK or duplicate native toolchain was downloaded.

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
- API, MCP and fatigue calculation source did not change in this follow-up. Previously successful unchanged local baselines were not repeatedly rerun; exact candidate CI results are recorded separately.
- Added/modified text was checked for private-key/token patterns without printing potential secret values; no matches. `git diff --check` passed.

## Native/publication checkpoint

The configured User `ANDROID_HOME` and the previously supplied SDK path are still absent to this process; `adb` is unavailable. User `JAVA_HOME` and JDK21 exist. No failed Gradle attempt or new SDK installation was repeated. The published release's prior CI is historical evidence only.

Candidate push and exact-SHA `Tests` / `Validate Android` verification are pending. These feature-branch workflows do not publish Pages, create a release or send FCM. Version remains 1.15.31/code66 until a distinct release is deliberately assigned.

## Remaining external acceptance

1. On the user's Android device: install over the previous release and retain data; open the update from real FCM; exercise download/installer permission; lock/background/terminate/reopen; validate timers/audio and notification cleanup under the manufacturer's battery restrictions.
2. With a designated test account/provider: real Drive OAuth/restore/sync and two-device conflicts, real API authentication/admin/session reopening, and actual Health Connect permission grant/revoke plus imported exercise records. Android instrumentation covers metadata/type mapping, not a live provider import.
3. Installed production PWA upgrade, virtual keyboard, safe areas, assistive technology and exhaustive editorial review beyond the tested route/dialog matrix. iOS/macOS native acceptance requires its platform.

These gaps must remain explicit in a release decision. Do not equate compilation, unit tests, simulated service boundaries or headless browser checks with physical-device acceptance.
