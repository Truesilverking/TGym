# Weight presentation and pending update - 1.15.103 / Android 139

Published [1.15.103 / Android 139](https://github.com/Truesilverking/TGym/releases/tag/v1.15.103), runtime source `309ff599d2d13940e8e33c811b5bc2e81f44a186`, includes pending `Dev` correction `b8720be` and the Android weight-control fix. The Iron theme's legacy three-column stepper rules no longer override the shared weight field's value, increment buttons and ruler action.

Weight readouts use whole kg/lb across training, body measurements, goals, charts, history, calculators and visual exports. Focusing an editable value exposes its original precision. Calculations, saved records, JSON backups and editable Excel exchanges retain their precise numbers; opening, cancelling or confirming an unchanged editor does not round stored data.

Legacy backups may contain numeric strings such as `"42.75"`. Shared weight entry now recognizes these values for presentation, ruler drafts and increments while leaving the original saved record untouched until an explicit edit. Empty or invalid values remain distinct from zero.

The review also fixed secondary-pointer release cancelling an active ruler drag, legacy `start:null/0` excluding dated workouts from plateau/volume calculations, and repeated or absent chart-axis labels for sub-unit weight ranges.

Compiled WebKit checks reproduced an existing media-cache error in both 1.15.102 and the initial candidate: a no-cors animation's opaque response could be reused for a CORS poster request. The worker now reuses an opaque media response only for compatible no-cors requests, preserving existing caches and using the normal network/error fallback otherwise. The regression fails before the correction and all 17 worker tests pass afterward.

Final verification on 2026-10-30: frontend 2,743 tests in 242 files, API 16, MCP 38, catalogue 6, Node-loadability, locale/source-string/version checks and fatigue probes pass. All five exact-source CI runs pass; Android's instrumented report contains 43 tests, zero failures and zero skipped. Local web, PWA, mobile, Android compilation and lint pass; local Android lint retains 20 nonfatal warnings and no errors. The integrated source was reviewed independently.

The final runtime is installed as `app.framegym.mobile.qa` on the physical Pixel 10. Package/version, QA signing continuity, labels, cold reopen, five real workout weight fields and WebView/native profile agreement pass. All stored user fields match the pre-install profile except the documented monotonically advancing workout clocks and activity timestamps. An earlier synthetic test exposed an incomplete QA restoration procedure; QA was stopped, its complete verified sandbox snapshot was restored, and independent cold-reopen and whole-profile comparisons passed before publication. Private snapshots and diagnostic failures are retained outside Git.

Compiled browser geometry passes four Edge cases and twelve mobile WebKit cases across 320/390/412 px, light/dark themes and kg/lb, including legacy numeric strings, precise editing, cancellation and increments. Normal 1.15.102-to-1.15.103 updating through Settings passes in Edge and WebKit, preserving exact numeric/string weights, routines, history and a 1.6-million-character embedded resource, with valid backup checksums and current mirrors. Cached reopen with an unavailable origin passes in WebKit. Its forced `setOffline` reload reports an internal Windows WebKit engine error in both the old and new builds; that path is not counted as a pass.

[Release workflow](https://github.com/Truesilverking/TGym/actions/runs/41078632579) passed. Independent downloads verify APK/AAB identity, version, checksums, official signing continuity, all 53 shared runtime assets against the signed candidate, identical GitHub/Pages APKs and all 49 published PWA/metadata files. Tests against the actual public Linux build pass in Edge and WebKit with no JavaScript errors, clipped weights or overlapping actions. Structured results are in [the evidence file](WEIGHT-ANDROID-EVIDENCE-1.15.103.json).

Safari/WebKit automation is not physical iPhone acceptance or a native iOS build. Production-phone installation and physical push receipt are not claimed. The annotated tag suppresses update-topic notifications; no resend occurred. No finite audit guarantees that every possible error has been eliminated.

Private phone snapshots, profiles and local test tooling stay outside Git. Production phone data and protected `main` are separate from the isolated QA installation and `Dev` release workflow.
