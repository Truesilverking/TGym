# TGym 1.15.69 / Android 105

Runtime source: `d1d31bf2b394fa65150724c4f8453b638678f7d7`. Scope: redesign the Full Streak and Consistency PDFs into two readable A4 pages per report. The shared layout shows six complete months per page, existing summaries and temporal context, neutral month cards, plain colored date squares, accessible date/status text, a readable legend and half-year/page footers. Dates, predicates, calculations and storage are unchanged. No export format is added. Spanish May is corrected to Mayo through its existing shared locale key.

## Local verification

- Frontend: 184 files / 2,027 tests passed with two workers and unchanged test timeouts. The first four-worker run, concurrent with heavy browser/PDF rendering and Gradle, passed 2,024 tests and hit the existing five-second limit in three XLSX tests; no assertion failure occurred. The complete idle rerun passed without changing those tests or their timeouts.
- Web, PWA and mobile builds passed. Capacitor synchronization is separate from native compilation.
- JDK 21 / SDK 35 Android `assembleDebug :app:lintDebug` passed locally (386 tasks).
- Locale keysets remain synchronized: 12 packs, 1,908 keys each; 1,214 detected source strings are present.
- Frontend has no lint/typecheck scripts; neither is claimed as passed. Native iOS compilation requires macOS/Xcode and was not performed.
- Independent Chromium/Edge and WebKit checks passed all 13 configured language settings: each checked 120 SVG pages and 21,902 date cells. All dates appear exactly once in two pages per Full report, including leap years and six-week months; summaries, statuses, square geometry, plain colors, contrast and text remain valid. The actual PDF minimum day/legend size is about 9.69 pt. See `FULL-REPORT-DESIGN-AUDIT-1.15.69.md`.
- Production builders and actual UI produced 82 PDFs / 172 A4 pages with no blank, duplicated, cropped or stretched pages. Existing preview/download and combined-report pages are equivalent. Each Full report is two pages; a combined PDF containing both is four pages.
- An isolated released-68 source baseline confirms exact calculation and input/profile preservation across six scenarios, including an active session; 23 other period/format choices per scenario retain identical English SVG output. The Spanish Mayo label is the documented shared-label exception.

## Boundaries

All test profiles and example PDFs are synthetic. No personal browser profile or physical phone was read or changed. Physical iPhone Safari/PWA, native sharing, notification receipt and phone installation remain unverified. WebKit and emulator evidence are recorded separately from physical devices. Official catalog tooling/distribution are unchanged; remote catalog publication remains deferred by the owner's choice.

## Verified publication

[Published release](https://github.com/Truesilverking/TGym/releases/tag/v1.15.69), annotated tag `v1.15.69`, exact runtime source `d1d31bf2b394fa65150724c4f8453b638678f7d7`.

| Exact-source workflow | Result |
| --- | --- |
| [Build signed Android candidate 39055811932](https://github.com/Truesilverking/TGym/actions/runs/39055811932) | success |
| [Validate Android 39055810512](https://github.com/Truesilverking/TGym/actions/runs/39055810512) | success |
| [Validate PWA 39055809398](https://github.com/Truesilverking/TGym/actions/runs/39055809398) | success |
| [Tests 39055807953](https://github.com/Truesilverking/TGym/actions/runs/39055807953) | success |
| [Release 39056389471](https://github.com/Truesilverking/TGym/actions/runs/39056389471) | success |

Exact-source CI passed frontend 2,027 tests in 184 files, API 11, MCP 37 plus plain-Node loadability, catalog 6, locale/source keys and fatigue probes. Android compilation/lint and all 11 emulator tests passed with zero failures/skips. The signed candidate passed release compilation/lint, signatures, checksums, package identity, official certificate continuity and source metadata.

Public APK SHA-256: `700f90e61f9cce9fe4a570c34b0c37db409062e18a485881bc73ff34567d89b7`. GitHub Release and Pages APK bytes are identical. The verified non-debuggable package is `app.framegym.mobile`, version `1.15.69`, code `105`, min/target/compile SDK `23/35/35`. Certificate SHA-256: `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082`. APK/AAB signatures and checksums validate. All 61 candidate/public web assets match; all 57 live PWA precache resources match the exact-source content digest. Local Windows and CI/Linux asset hashes differ, so their frozen shells were kept distinct.

The local exact-source shell and the actual downloaded public shell independently passed the 1.15.68 to 1.15.69 Check/Update flow in isolated persistent Edge/Chromium and WebKit profiles. Complete official backups remain equal before, after and after offline reopening; the retained pre-update backup matches the original. Every activated worker asset matches its frozen shell SHA-256. Edge restarted fully offline; WebKit restarted with the app-origin server stopped.

After closing and reopening without the app origin, the existing UI successfully generated and downloaded both **Full** calendar reports, with two actual PDF pages each. Existing JSON/XLSX/PDF/template exports and import review/cancel also retain the complete profile. The first source-shell attempt stopped on a test-harness field locator after the update/profile checks had passed; the screenshot showed Full selected and PDF correctly disabled. The harness was corrected to locate the existing second select, its failed proofs were retained, and both complete flows passed without any app-source change.

Public update checks offer 1.15.69 to 1.15.68 and no update to already-current 1.15.69 for native/GitHub and PWA, using separate in-memory update storage. The original remote annotated tag has no suppression marker and logged policy is `send=true`. FCM accepted `tgym_updates` and `tgym_updates_v2` once each. No release or notification rerun was performed. Service acceptance does not establish receipt or installation on a particular phone.

Local release evidence under `.tools/reports69/`: `pretag-verified.json`, `candidate-artifacts-verified.json`, `android-ci-test-evidence.json`, `public-artifacts-verified.json`, `candidate-public-payload-verified.json`, `notification-verified.json`, `updater-verified.json`, `complete-verified.json` and `public-update-{edge,webkit}/pwa-*-proof.json`. Visual evidence and the two Spanish synthetic example PDFs are listed in `FULL-REPORT-DESIGN-AUDIT-1.15.69.md`.

An additional final check decoded all eight source/public offline Full PDFs (16 pages), verified two A4 pages per file with equal image scale, and found identical embedded report images between accepted source and actual public shells in each engine. Public-page PNGs were rendered for final visual review; evidence: `.tools/reports69/offline-full-pdf-final-proof.json`. No local Android phone or emulator was connected during the final inventory.
