# Back-off repetitions - 1.15.45 / Android81

The automatic Top + Back-off prescription now defaults to Top minimum+2 and maximum+2. Fixed5 becomes7; fixed8 becomes10. All pending Back-offs in the prescription receive the same derived range, while the existing actual-Top rep cascade remains bounded by that range. Weight reduction/rounding is unchanged.

Legacy automatic zero offsets (including zeros persisted by the old editor) and missing offsets resolve to+2 rather than copying the Top range. A positive explicitly configured offset remains an override; autoBackoffReps:false retains independent explicit Back-off limits. Legacy both-side totals scale the visible+2 to4 stored reps. Straight, time and cardio configuration is unaffected.

The editor no longer saves stale topRepsMin after editing the displayed minimum. Saving fixed reps collapses both Top bounds to the fixed value. Reading fixed targets also ignores stale legacy minimums, so existing fixed5 remains5 and derives7 without requiring a configuration edit. withBackoffRepTargets materializes automatic Back-off bounds in saved configurations and new session snapshots through deloadTargetFor. Existing completed history/actual rows are not rewritten, and manualFields protection remains intact. No schema/key migration or history rewrite.

Validation:194 targeted tests/4files and full1,236 frontend tests/126files passed; API10; MCP37+Node-loadability; locale/source/version; web/PWA/mobile builds passed. No frontend lint/typecheck scripts exist. Chromium and WebKit each started real sessions for4-6,5-7,6-8,8-10,5fixed,8fixed with three Back-offs, checked saved bounds/load/reps and reload; both edited4-6 into8-10 and confirmed persisted10-12. Existing Workout integration test now starts with the legacyzero offset and verifies manual protection, reopen, finish and history. Clean Android release and lint passed (19s; 0 errors, existing warnings); final synchronization and rebuild/lint passed after the legacy fixed-target correction. Publication evidence follows.

No Pixel is attached for this version; prior1.15.44 hardware evidence is not claimed as a1.15.45 device test. WebKit is not a real iPhone.

## Publication verification

Published v1.15.45 / Android81 from source/tag commit `4bed460a4cb1f1564b7e7702c9a36729a633d4b7` on `feature/dashboard-visual-polish` (preceding main fix `82757acc32cb0c9f68eede0c767c2868da6399d6`). Exact-source GitHub Tests run36944680608 and Android/emulator run36944680651 succeeded. Release run36945224499 succeeded, including signed APK/AAB generation, Pages deployment, published metadata verification and Notify update topic. Notification submission success does not establish handset receipt.

Public release: https://github.com/Truesilverking/TGym/releases/tag/v1.15.45

Downloaded release APK and Pages latest APK both match manifest SHA-256 `e2e1fdd9ee79a963162b01343e8a7a18b8eb27efcb18381ee64abb4547d6039c`. Local apksigner verification passed; signing certificate SHA-256 `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082` matches the previous release. aapt confirmed `app.framegym.mobile`, code81/version1.15.45. Public PWA build metadata matches the release source. Actual app-update.js checks against the published manifest detect1.15.45 from1.15.44 for Android and PWA; current1.15.45 is not offered again. Hardware installation and real iPhone behavior were not validated for this version.
