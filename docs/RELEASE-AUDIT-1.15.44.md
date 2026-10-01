# TGym 1.15.44 release audit - 2026-10-01

- Version: 1.15.44; Android versionCode80.
- Branch: feature/dashboard-visual-polish.
- Functional commit: b02b1f617f973a7e8b945623228a7ca57f16c2f2.
- Tested release source / annotated tag v1.15.44: 653c22bcc10127cda6e2103f5552345735e55831 (includes audit documentation).
- Release: https://github.com/Truesilverking/TGym/releases/tag/v1.15.44

## Validation

Frontend1,225 tests/126 files; API10; MCP37 and plain-Node import graph passed. Back-off targeted179 passed. Locales/source/version and fatigue probes108,000+14,076 passed. No frontend lint/typecheck scripts exist. Web/PWA/mobile builds and clean Android release/lint passed; final Capacitor synchronization and release rebuild/lint passed. Local Android lint:0errors,18existing warnings.

Chromium/WebKit tested Back-off derivation, manual protection, offline writes/reload and six sizes; report sections/periods and selected/multiple/full PDF downloads; full12-step tour with new/existing profiles and preservation assertions. All24 pages of the full synthetic PDF and the empty report were rendered and visually inspected. Chromium additionally covered onboarding/offline reopen, session recovery/finish, routine deletion/undo, backup/import/undo, calendar PNG/PDF and activity editing.

Physical Pixel10 / Android17: installed TGym QA code80; changed Top100x6 to110x5 -> Back-off100x7; manual95x6 preserved when Top changed to120x6 -> other Back-off107.5x8. Force-stop/relaunch and Resume retained the session. With WebView network blocked, Top130x6 -> pending117.5x8; manual95x6 retained across reload. Completed history stored exactly130x6,95x6,117.5x8. Production app/data untouched. Evidence: ignored `.tools/ux44/pixel-results.json` and related screenshots/scripts. Harness-only fixes addressed unsupported tap(), pagehide seeding, startup Home navigation and completion-modal targeting. Final screenshot capture timed out after save assertions; independent persisted-state verification passed.

## GitHub evidence

- Tests: https://github.com/Truesilverking/TGym/actions/runs/36941434113 - success.
- Android/emulator: https://github.com/Truesilverking/TGym/actions/runs/36941434090 - success.
- Signed release/Pages/notification: https://github.com/Truesilverking/TGym/actions/runs/36942199015 - success.

Public release is neither draft nor prerelease; includes APK, AAB, checksums.txt and latest.json. GitHub APK and Pages latest APK both hash to:

`f65ead2ba376c5a5d3b397e1055c1b152aaa340850e2d39306d59b5761848d61`

Local apksigner verification passed. Installed package identity remains `app.framegym.mobile`, versionName1.15.44/code80; signer SHA256 remains:

`8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082`

PWA build.json version/commit matches the release source. The real app-update.js checker detected1.15.44 from1.15.43 for both GitHub Android and PWA distributions, and did not reoffer the current version. Notify update topic workflow step succeeded; actual device receipt is not asserted.

## Remaining validation limits

Real iPhone Safari/Home Screen remains unverified; WebKit coverage is not hardware validation. The signed production APK was verified as an artifact, not installed over the user's production app. No real cloud account was modified. There are no known critical failures in the exercised scope; this is not a claim of universal device compatibility.
