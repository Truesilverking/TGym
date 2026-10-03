# TGym 1.15.48 / Android84 publication audit

Published 2026-10-03 from `feature/session-origin-activity`, immutable tag/source `91d5d26dd344471a242b5826c8414abfe20bbe34`. This is the installable release of the session-origin/activity correction described in `SESSION-ACTIVITY-AUDIT.md`; the preceding branch push alone did not update phones.

## Exact-source validation and publication

- [Tests 37128984659](https://github.com/Truesilverking/TGym/actions/runs/37128984659): successful frontend/API/MCP tests and web build.
- [PWA 37128984695](https://github.com/Truesilverking/TGym/actions/runs/37128984695): successful tests and standalone build.
- [Android 37128984773](https://github.com/Truesilverking/TGym/actions/runs/37128984773): successful build/lint and background notification instrumentation on the emulator.
- [Release 37129370025](https://github.com/Truesilverking/TGym/actions/runs/37129370025): successful signed APK/AAB, checksum/certificate/package verification, GitHub release, Pages deployment, published-update verification and notification topic submission.

Local version checking, PWA/mobile builds and Android `assembleRelease lintRelease` also passed after the version bump. Runtime tests and acceptance cases are recorded in the linked session audit.

## Public artifacts and actual update flow

[GitHub v1.15.48](https://github.com/Truesilverking/TGym/releases/tag/v1.15.48) is a non-draft, non-prerelease release with APK, AAB, checksums and latest.json. Public Pages latest.json and build.json both report 1.15.48 and the tagged source; Android code is 84, greater than preceding code83.

GitHub and Pages APK downloads independently match SHA-256 `726962bcd550e573fb745e4f392750b490e1ac978513a9d242bed70e59d266e3`. Downloaded APK v2 signature verification passed. Package is `app.framegym.mobile`; versionName 1.15.48/code84; certificate SHA-256 `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082` matches the preceding official release.

The actual app-update module detects 1.15.48 from 1.15.47 in Android and PWA distributions and does not reoffer current 1.15.48. An isolated persistent production PWA profile used the real Check for updates / Update UI to move 47 to 48. Selected profile arrays/preferences, including 33 history rows and Same reps, remained identical; offline reload passed.

Fresh isolated Chromium and WebKit profiles on the public site passed the actual start/edit/add-three/reload/finish flow. Home shows planned1/extra0/active1/completion100%/streak1. A separate freestyle workout then shows planned1/extra1, with daily activity/streak still1. Home, Stats and Progress agree; reopen preserves both origins. Chromium offline reopen and responsive overflow checks passed.

Notification topic submission was accepted by the service. Physical Android/iPhone receipt, installation and native phone UI were not observed. Emulator, browser and service evidence do not establish those physical-device outcomes. No signing identity, storage key or updater integrity requirement changed, and no tag was moved.
