# TGym 1.15.43 / Android code 79

Published from `1a4968e2f8c4fc93e607f768469e43ecfe7f8a7d` on `feature/dashboard-visual-polish`.

- Scope and data flow: [workout, measurements and tour audit](WORKOUT-MEASUREMENTS-TOUR-AUDIT-2026-09-29.md). Dated measurement reminders/editing, safe weight retry, chronological height, compact workout controls/notes/rest and a twelve-step ephemeral tour.
- [Tests](https://github.com/Truesilverking/TGym/actions/runs/36615665196): success on the exact runtime commit, including frontend/API/MCP, build, locales/source checks, fatigue and Node-loadability.
- [Android build and emulator](https://github.com/Truesilverking/TGym/actions/runs/36615665070): success, including background workout notification instrumentation.
- [Release workflow](https://github.com/Truesilverking/TGym/actions/runs/36616573227): success, including signed APK/AAB, PWA deployment, public update metadata verification and update-topic notification submission.
- [Stable release](https://github.com/Truesilverking/TGym/releases/tag/v1.15.43): public, not a draft/prerelease. APK, AAB, checksums and manifest available. Annotated tag resolves to the runtime commit above.
- Independent GitHub and Pages APK downloads match SHA-256 `8f7f1f8b7322eff622d85f62fa9f5d146090f2ebf5ddbff2df9eaf026ac70a1e`. APK signature verified; certificate remains `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082`. Package `app.framegym.mobile`, version 1.15.43/code 79 verified with aapt.
- Public update manifest and PWA build metadata match the runtime commit/version. The actual updater module detects 1.15.43 from 1.15.42 in Android/GitHub and PWA modes; the current version does not offer itself again.
- Local final frontend: 1,213 tests / 126 files passed. API 10, MCP 37 plus Node-loadability, locale/source/version checks and web/PWA/mobile production builds passed. Clean Android release/lint and final synchronization/rebuild passed. Zero lint errors, 22 existing warnings. No frontend lint/typecheck scripts exist.
- Chromium/WebKit browser tests passed for dated records, editing/retry/persistence, workout note/pair/rest controls, dark/light/reduced motion, and all twelve tour steps with empty/existing profiles. Six viewport sizes cover 320/360/375/390/430 px portrait and 844x390 landscape; target and panel bounds/non-overlap were checked. Screenshots were visually reviewed.
- No physical phone was connected for this release. WebKit is engine coverage, not physical Safari/iPhone/Home Screen/native keyboard/date-picker validation. The CI emulator does not establish universal Android compatibility. FCM submission succeeded; user-phone notification receipt and production installation are not confirmed.
- No credentials, signing material, private backups or binaries committed. Local synthetic QA artifacts remain ignored under `.tools/ux43/` and `.tools/release-1.15.43/`. No production user data were edited.
