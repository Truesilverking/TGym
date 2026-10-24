# TGym 1.15.35 / Android code 71

## Scope

Complete Progress Report entry, generation and PDF download, responsive typography/cards, selected-period snapshot parity, native base64 sharing, cancellation/error/retry handling, stale-file invalidation and resource cleanup. No workout clock, storage schema, backup or updater security changes.

## Local evidence

- Frontend: 1117 tests / 115 files passed. API: 10; MCP: 37 plus plain Node-loadability passed.
- All 12 locale packs / 1624 keys synchronized; 1050 source strings covered. Version check 1.15.35/code71 passed.
- Fatigue: 108000 monotonic and 14076 history-deletion comparisons passed.
- Web, PWA and mobile asset/sync builds passed. Final SDK35/JDK21 assembleDebug and lintDebug passed; 0 errors and 20 pre-existing warnings. No frontend lint or typecheck scripts exist. Windows does not compile iOS.
- Synthetic browser UI: visible Statistics entry opens report; 320/360/375/390/430/1024 widths in ES light and EN dark have no horizontal overflow. Existing reduced-motion styles are preserved; no animation added.
- Actual PDF download saved to Downloads, strict pypdf opened the file and PyMuPDF rendered every page. Full fixture: 33 workouts / 72 records / 28 pages. Empty and single-reading downloads each produce one valid page. The selected last-month download is 23 pages, 13 workouts / 31 records / 780 minutes, matching the UI; every page rendered. Charts are embedded losslessly; long summary labels wrap and records separate exercise, record type and date.
- PDF values reuse the selected pure report. Regression tests cover periods, real stored readings, units, bodyweight/per-side modes, deduplication, PRs, generation/save failures, cancellation, duplicate clicks, stale snapshots and native binary encoding. Test fixtures are synthetic and no personal training data was modified.

## Limitations and resolved findings

The integrated browser denied blob-PDF preview navigation. That navigation was not bypassed; actual downloaded files were instead parsed/rendered locally. Initial Web Share use did not produce a verifiable browser download, so web Download now uses a direct attached link; native keeps its system share sheet. A stale local service-worker cache was avoided with a fresh test origin. Long overview labels were corrected, and lossless images replace JPEG in the standalone report.

ADB detected no physical Pixel. No iPhone was available. Physical native/PWA download, notification receipt and install on those devices are not claimed. Native file bytes/share behavior has automated coverage. Build warnings about large chunks/ineffective dynamic imports remain non-fatal.

## Publication

Published [v1.15.35](https://github.com/Truesilverking/TGym/releases/tag/v1.15.35), code71, from `a0f9d0c2fdeb0d4289cae7e7c75884ce1c3ead15` on `feature/dashboard-visual-polish`. Remote branch and annotated tag target verified.

- [Tests 36251535168](https://github.com/Truesilverking/TGym/actions/runs/36251535168): SUCCESS.
- [Validate Android 36251535156](https://github.com/Truesilverking/TGym/actions/runs/36251535156): SUCCESS, including emulator instrumentation.
- [Release 36251979315](https://github.com/Truesilverking/TGym/actions/runs/36251979315): SUCCESS, signed APK/AAB, Pages deployment, published-byte verification and FCM submission. Submission is not confirmation of phone delivery.
- Independently downloaded GitHub APK and Pages `downloads/TGym-latest.apk` have identical SHA-256 `58efe3d5d703f0793073d24b0762ed32eb51f7677a226cdc2688a56a32f0df3e`.
- `apksigner` verifies signature; signer remains `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082`. `aapt` verifies `app.framegym.mobile`, version1.15.35/code71. Public manifest and PWA build metadata match the exact source commit.
- Executed the real `checkForAppUpdate` module through Vite SSR against the live published endpoints with isolated in-memory storage: Android/GitHub and PWA both detect1.15.35 from1.15.34; current1.15.35 returns no duplicate update. This verifies app update detection logic and availability, not physical phone reception/installation.
- Final standalone PDF:28pages,7954600bytes, SHA-256 `3fca357d3f54a2f8957453d08d000aa976affeef14ee1058fb1473853587e8cd`; strict parse and all pages rendered. Last-month PDF23pages also opened/rendered. Final empty and single-reading PDFs are one page. Browser landscape844x390 also had no horizontal overflow. QA viewport reset, tabs closed and servers5180-5183 stopped.

Local reproducible evidence is under ignored `.tools/release-1.15.35/` and `.tools/browser-audit/progress-pdf/`; no credentials, signing material, generated APKs or private backups are committed.
