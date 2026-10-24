# TGym 1.15.42 / Android code 78

Published from `6ca09b328868e741d5e23b12731cfcda6c8eba11` on `feature/dashboard-visual-polish`.

- Scope, data flow and recent-change inventory: [recent changes audit](RECENT-CHANGES-AUDIT-2026-09-28.md). Permanent routine arrows, reliable hold/drag, compact long names, reachable swipe-delete and order-preserving Undo.
- [Tests](https://github.com/Truesilverking/TGym/actions/runs/36491907287): success on the exact runtime commit, including frontend/API/MCP, build, locale/source checks, fatigue and Node-loadability.
- [Android build and emulator](https://github.com/Truesilverking/TGym/actions/runs/36491907219): success, including background workout notification instrumentation.
- [Release workflow](https://github.com/Truesilverking/TGym/actions/runs/36492680484): success, including signed APK/AAB, PWA deployment, public update metadata verification and update-topic notification submission.
- [Stable release](https://github.com/Truesilverking/TGym/releases/tag/v1.15.42): public, not a draft/prerelease. APK, AAB, checksums and update manifest available. Annotated tag resolves to the runtime commit above.
- Independent GitHub and Pages APK downloads match SHA-256 `12a5b2db24cdab36824587a238102f64f1981be3d2b7e74c693ca7fbd09fd2df`. APK signature verified; certificate remains `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082`. Package `app.framegym.mobile`, version 1.15.42/code 78 verified with aapt.
- Live update manifest and PWA build metadata match the runtime commit and version. The actual app-update module detects 1.15.42 from 1.15.41 in Android/GitHub and PWA modes; the current version does not offer itself again.
- Local frontend: 1,201 tests / 124 files passed with four workers; API 10, MCP 37 plus Node-loadability, locale/version checks, web/PWA/mobile builds passed. A default-concurrency timeout in the 10,000-workout test passed isolated and in the full bounded run. No tests/assertions were disabled. CI default execution also passed.
- Android clean debug/release and release lint passed locally; final Capacitor sync/rebuild includes all changes. Zero lint errors, 22 existing warnings. There are no frontend lint/typecheck scripts.
- Chromium/WebKit dashboard responsive, period/section, report generation/download/opening and routine drag checks passed; all pages of the full PDF were visually reviewed. Real PWA service-worker update via Settings preserves order/training data and supports offline edits/reopen. The invalid synthetic history fixture encountered during that test was corrected, not production validation weakened.
- Physical Pixel, synthetic TGym QA: OS touch first-to-last and reverse drag, arrows/drag alternation, swipe/Undo, Info, normal routine opening, retention across APK install, blocked-network reload and force-stop/relaunch passed. Production TGym data were untouched.
- Physical iPhone/Safari/Home Screen behavior is unverified; WebKit results are engine coverage only. FCM submission succeeded; actual user-phone notification receipt and production installer completion are not confirmed. No universal compatibility claim.
- No credentials, signing material, private backups or binaries committed. Local verification artifacts remain ignored under `.tools/ux42/` and `.tools/release-1.15.42/`.
