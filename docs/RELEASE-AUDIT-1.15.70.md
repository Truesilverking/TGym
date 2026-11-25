# TGym 1.15.70 / Android 106

Scope: add complete-year ranges to Streak and Consistency PDF exports, including the combined report selector. Each inclusive year occupies one landscape A4 page with twelve whole months, the existing annual metrics and context, plain fixed-color day squares and the appropriate legend. Existing Full reports retain two portrait pages; other existing periods and PNG output remain unchanged. No storage schema, personal data, IDs, completion predicates or streak rules change.

`calendar-year-range.js` accepts integral four-digit years from 1000 through 9999, including future years, and limits one export to 25 years to bound mobile PDF work. Invalid, reversed or oversized ranges fail before profile processing. `calendar-year-report.js` supplies the shared annual layout. The file writer supports per-page orientation so combined PDFs can contain annual landscape pages and existing portrait pages. A Date-based loop termination fixes the year-9999 boundary in two existing date iterators; normal-year calculations and legacy SVGs match the released baseline.

## Local and visual verification

The final visual/data evidence is recorded in `COMPLETE-YEAR-REPORT-AUDIT-1.15.70.md`. Tests use synthetic data and isolated profiles. All 26 old period/format contracts across six scenarios match released 1.15.69 runtime `d1d31bf2b394fa65150724c4f8453b638678f7d7`, including exact legacy SVG bytes, preserved errors and unchanged annual data. New annual pages reuse each year's existing data, statuses and evaluation context.

Both Chromium using Edge and WebKit passed all 13 language settings, annual/leap/current/future/pretracking/empty/active cases, actual preview/save and mixed-orientation combined-report flows. Final PDF verification covers 92 files and 268 A4 pages. Day numbers and legend text remain about 9.69 pt; images retain equal horizontal/vertical scale. A narrowly bounded WebKit text-raster difference between independent contexts is documented without claiming cross-context byte identity; actual UI preview/save bytes and each combined file's standalone page images match.

The first local two-worker frontend run overlapped final PDF processing and passed 2,053 tests while two existing XLSX tests reached their unchanged five-second timeout. The isolated full rerun passed all **2,055 tests in 185 files**, with two workers and unchanged timeouts (91.34 seconds). No test timeouts were increased. Local JDK 21 / SDK 35 `assembleDebug :app:lintDebug` passed (386 tasks).

Locale/source checks pass: 12 packs with 1,915 keys each and all 1,218 detected source strings present. Web and mobile builds pass; Capacitor synchronization is separate from APK compilation. Frontend has no lint/typecheck scripts. Native iOS compilation requires macOS/Xcode and is not performed on this Windows machine.

## Boundaries

No personal browser profile or phone data are read or changed by these checks. WebKit does not establish physical iPhone Safari or installed-PWA acceptance. Physical phone installation, native sharing and notification receipt remain unverified. Official catalog publishing and distribution remain deferred by the owner's prior choice; this release does not configure them.

## Verified publication

[Published release](https://github.com/Truesilverking/TGym/releases/tag/v1.15.70), annotated tag `v1.15.70`, runtime source `0ba497819052a17c71c67f2080fe3c451c20110b`. The original remote tag object is `99fa099d091b8436990576e2de1e0aa461934759` and has no notification-suppression marker.

| Exact-source workflow | Result |
| --- | --- |
| [Tests 39058450390](https://github.com/Truesilverking/TGym/actions/runs/39058450390) | success |
| [Validate PWA 39058451983](https://github.com/Truesilverking/TGym/actions/runs/39058451983) | success |
| [Validate Android 39058453406](https://github.com/Truesilverking/TGym/actions/runs/39058453406) | success |
| [Signed candidate 39058454836](https://github.com/Truesilverking/TGym/actions/runs/39058454836) | success |
| [Release 39059033378](https://github.com/Truesilverking/TGym/actions/runs/39059033378) | success |

CI passed frontend 2,055 tests / 185 files, API 11, MCP 37 plus plain-Node loadability, catalog 6, locale/source checks and the fatigue probe. Android build/lint and all 11 emulator tests passed, with zero failures or skips. The signed candidate passed native compilation/lint, archive CRC, signatures, checksums, package/version identity and official signer continuity before tagging.

Public APK SHA-256: `b0f4ce1b6014dc43e9628bf8ba07f2d834e8bbd93f1dc46333bfcbf305385218`. Public AAB SHA-256: `c7d834d2ddb9a598b2837fd61d548b6d36e06dc6d95a80c45081b721ee36726e`. Release and Pages APK bytes are identical. The non-debuggable package is `app.framegym.mobile`, version `1.15.70`, code `106`, min/target/compile SDK `23/35/35`. Official certificate SHA-256 remains `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082`. All 66 candidate/public runtime assets (61 web assets) match; all 1,116 APK ZIP entries and their metadata match, with archive differences confined to the 12,288-byte signing block. The AAB is byte-identical. All 57 live PWA precache resources match the exact-source shell digest.

Both the locally compiled exact-source shell and the independently downloaded actual public shell passed the 1.15.69 to 1.15.70 Check/Update flow in isolated persistent Edge/Chromium and WebKit profiles. Every official portable-profile field and schema 4 remain equal before, after and after complete browser reopening. The retained pre-update snapshot matches the original checksum-valid backup. Every activated worker asset matches its frozen shell SHA-256. Edge restarted fully offline; WebKit restarted with the app-origin server stopped and is not represented as a disconnected physical iPhone test.

After reopening without origin access, both existing Full reports generated two actual portrait PDF pages each, and both Complete years reports generated three landscape pages each for 2024-2026 through the existing export/Open flow. Routine JSON/XLSX/PDF/template exports and import review/cancel also preserved the complete profile. Final decoding examined 16 source/public offline PDFs / 40 pages: correct A4 orientations, uniform scaling, unclipped nonblank images, and exact source/public embedded-image and decoded-pixel equality for all 20 compared pages. All 12 actual public annual page renders were visually reviewed in four contact sheets; each year shows all twelve months, clear date cells, summaries and legends. No raster tolerance was needed for these source/public comparisons.

Public update checks offer 1.15.70 to 1.15.69 and offer nothing newer to current 1.15.70, for both native/GitHub and PWA, using separate transient storage. The normal release policy is `send=true`; FCM accepted `tgym_updates` and `tgym_updates_v2` once each. No release or notification rerun was performed. Service acceptance does not establish delivery, display or installation on a particular phone. Final local ADB inventory contained no attached phone or emulator; native emulator evidence above comes from CI.

Evidence under ignored `.tools/reports70/`: `pretag-verified.json`, `candidate-artifacts-verified.json`, `android-ci-test-evidence.json`, `ci-test-evidence.json`, `public-artifacts-verified.json`, `candidate-public-payload-verified.json`, `notification-verified.json`, `updater-verified.json`, `complete-verified.json`, `offline-pdf-final-proof.json`, `offline-pdf-review/` and `source-update-{edge,webkit}` / `public-update-{edge,webkit}`. The tagged runtime remains immutable; this publication record is a documentation-only follow-up.
