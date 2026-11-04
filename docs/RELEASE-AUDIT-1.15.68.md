# TGym 1.15.68 / Android 104

Runtime source: `53fef59c34ce4142c8c4cf38e3d2a0e973ddf231`. Scope: restore plain Streak/Consistency date squares and legend swatches, with Completed in blue. No calculation, tracking rule, storage schema, user data or catalog changes. This supersedes the owner's earlier request for visible status symbols/patterns. Accessible date/status text and existing interactive measurement reminders remain.

| Presentation | Applied fill |
| --- | --- |
| Completed / Recorded activity (separate predicates and labels) | Blue `#115bb2` |
| Partially completed (Consistency only) | Orange `#e49b32` |
| Not completed | Red `#ac2040` |
| Pending | Slate `#475569` |
| Rest day | Yellow `#f2d36c` |
| Training paused | Purple `#6b3e91` |
| Not tracking yet | Pale gray `#d7dee8` |

## Local verification

- Frontend: 183 files / 2,021 tests passed with four workers and unchanged timeouts.
- Web, PWA and mobile builds passed; Capacitor synchronization is separate from native compilation.
- JDK 21 / SDK 35 Android `assembleDebug :app:lintDebug` passed (386 tasks).
- Frontend has no lint or typecheck scripts; neither is claimed as passed. Native iOS compilation requires macOS/Xcode.
- Independent Edge/Chromium and WebKit export checks passed across all existing periods and formats: 6,632 plain square date cells on 102 SVG pages, plus 42 actual PDFs / 92 pages with equal final image scale and decoded PNGs. Spanish samples, month/year boundaries, empty/long periods, narrow screens and enlarged text passed. See `REPORTS-PLAIN-COLORS-AUDIT-1.15.68.md`.
- Frozen published 1.15.67 to locally compiled exact-source 1.15.68 PWA Check/Update passed in isolated persistent Edge and WebKit profiles. Complete official backups remained equal; retained pre-update backup and all activated worker hashes matched. Both reports and routine exchange exports remained usable after complete browser close/reopen without the app origin. WebKit's origin server was stopped for this test; this does not establish physical iPhone behavior.

## Verification boundaries

No physical phone was connected. Physical iPhone/PWA, native share sheets, phone notification receipt and installation remain unverified. FCM service acceptance is separate from receipt. Synthetic QA profiles were isolated from personal profiles. The official catalog remains the approved local editor/proposal; independent content publication and client catalog updates remain deferred by the owner's explicit choice.

## Verified publication

[Published release](https://github.com/Truesilverking/TGym/releases/tag/v1.15.68), annotated tag `v1.15.68`, runtime source `53fef59c34ce4142c8c4cf38e3d2a0e973ddf231`. All exact-source checks passed on their first attempt.

| Exact-source workflow | Result |
| --- | --- |
| [Build signed Android candidate 39052916068](https://github.com/Truesilverking/TGym/actions/runs/39052916068) | success |
| [Validate Android 39052914735](https://github.com/Truesilverking/TGym/actions/runs/39052914735) | success |
| [Validate PWA 39052913501](https://github.com/Truesilverking/TGym/actions/runs/39052913501) | success |
| [Tests 39052912115](https://github.com/Truesilverking/TGym/actions/runs/39052912115) | success |
| [Release 39053470217](https://github.com/Truesilverking/TGym/actions/runs/39053470217) | success |

The Tests workflow passed frontend 2,021 tests in 183 files, API 11, MCP 37 plus plain-Node loadability, catalog 6, locale/source keys and fatigue probes. Android compilation/lint and all 11 emulator tests passed with zero failures/skips. The signed candidate passed release compilation/lint, APK/AAB signatures, package identity, checksums, CRC, official certificate continuity and exact-source metadata.

Public APK SHA-256: `669fde0395b2545730e7694400671b20a2ec39e84637643c2e9d3d9a5f231a93`. GitHub Release and Pages APK bytes are identical. Package `app.framegym.mobile`, version `1.15.68`, code `104`, min/target/compile SDK `23/35/35` and non-debuggable status were verified independently. Certificate SHA-256: `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082`. All 61 candidate/public web assets are byte-identical; all 57 public PWA precache resources match the exact-source content digest.

The actual downloaded public PWA shell was tested independently from the local build. The public 1.15.67 to 1.15.68 Check/Update flow passed in isolated persistent Edge/Chromium and WebKit profiles. Complete official backups before, after and after offline reopening are equal; the retained pre-update backup matches the original, and every activated worker asset matches the downloaded public SHA-256. Both corrected calendar PDFs and existing routine JSON/XLSX/PDF/template exports remain available without the app origin. Import review/cancel also preserves the complete profile. Edge restarted fully offline; WebKit restarted with the app-origin server stopped.

The public updater offers 1.15.68 to 1.15.67 and offers no update to already-current 1.15.68 in both native/GitHub and PWA paths, using separate in-memory update storage. The original remote annotated tag has no suppression marker; logged policy is `send=true`. FCM accepted `tgym_updates` and `tgym_updates_v2` once each. No release/notification rerun was performed. This verifies service acceptance, not receipt on a particular phone.

Local evidence is under `.tools/reports68/`: `pretag-verified.json`, `candidate-artifacts-verified.json`, `android-ci-test-evidence.json`, `public-artifacts-verified.json`, `candidate-public-payload-verified.json`, `notification-verified.json`, `updater-verified.json`, `complete-verified.json` and `public-update-{edge,webkit}/pwa-*-proof.json`. Representative visual evidence: `chromium-es-streak.png`, `chromium-es-consistency.pdf` and `webkit-320-es-week.png`.
