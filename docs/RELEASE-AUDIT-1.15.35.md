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

Pending exact commit CI and signed release workflow. No release published at this checkpoint.
