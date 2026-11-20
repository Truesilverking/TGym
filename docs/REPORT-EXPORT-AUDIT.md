# Report export isolation audit (2026-10-05)

The calendar and statistics exports explicitly appended Progress Report output. Calendar Full Report called `progressReportPages` after its four calendar pages, while statistics HTML injected `progressReportHTML` before its closing body tag. Existing calendar tests even required that mixed output. History CSV separately ignored the visible period and search filters.

## Current contract and entry points

| Export / entry point | Content source | Period / filters | Format and filename |
| --- | --- | --- | --- |
| Export Calendar / Streak | `buildStreakReport` / `trainingStreak` / `streakOfRows` | This/last week, this/last month, selected week/month, year/full, inclusive custom dates | PNG/PDF, `TGym-Streak-FROM_TO`; Full Report and custom spans over 366 days use PDF |
| Explicit Consistency Report: Week | `calendarReportPages` / `calendarPeriod` | Monday-Sunday containing the calendar anchor | PNG/PDF, `TGym-Consistency-Week-YYYY-MM-DD` |
| Explicit Consistency Report: Month | Same consistency-only builder | Anchored month | PNG/PDF, `TGym-Consistency-YYYY-MM` |
| Explicit Consistency Report: Year | Same consistency-only builder | Anchored year | One overview PNG or three four-month PDF pages, `TGym-Consistency-YYYY` |
| Explicit Consistency Report: Full Report | Same consistency-only builder | Anchored year | PDF only: one annual overview and three detail pages, `TGym-Consistency-Report-YYYY` |
| Progress Report dialog | Exact `buildProgressReport` snapshot passed to `progressReportPages` | Since Start, 1/3/6 months, 1 year, or custom inclusive dates; selected sections and Before/After records | PDF, `TGym-Progress-Report-FROM_TO`, with single-section or `-selected` suffix |
| Progress HTML helper | `progressReportHTML` from a progress snapshot | Snapshot's range | Standalone HTML or explicitly requested fragment; no longer included by Stats |
| Statistics download | `statsReportHTML` from `statisticsState` | Training start through today; complete statistics snapshot, independent of individual chart windows | HTML, `tgym-stats-YYYY-MM-DD.html` |
| Statistics Print / Save as PDF | Current Stats DOM via browser print | Current screen and its independent card filters | Browser print/PDF; never opens or appends Progress Report |
| History Export for Excel | `historyCsv` / `filteredHistory` | Same All/30/90-day period and search/alias filter as History | UTF-8 BOM CSV, `TGym-history-YYYY-MM-DD.csv`; local filename date |
| Plan Export file | `buildPlanBundle` | Current routines, prescriptions, schedule and required custom exercises | Existing `framegym-plan-YYYY-MM-DD.json` |
| Plan Print / Save as PDF | `planPrintHTML` / `printPlan` | Current plan only | Browser print/PDF in an isolated iframe |
| Settings full backup | `createBackup` | Explicitly complete portable profile | Existing `TGym-full-backup-YYYY-MM-DD.json`, checksum/schema retained |
| Storage recovery export | Raw saved profile from the recovery screen | Explicitly complete recovery payload | Existing `tgym-recovery.json` |
| Native/cloud automatic backups | Existing portable backup/snapshot adapters | Explicitly complete portable profile | Existing dated JSON snapshots; unchanged |

The annual overview intentionally summarizes the same year as the three detail pages. Detailed dates occur exactly once across those detail pages. Repeated page context and explicitly labelled summary/trend metrics remain part of their own report; no other report document is embedded.

## Changes and boundaries

- Calendar now returns only its own page groups and never imports progress rendering or body geometry.
- Statistics has a dedicated HTML content builder, preserving its original summary and tables without an appended Progress Report. It reuses the existing date/identity rules to exclude duplicate, active, canceled and out-of-range sessions.
- `report-file.js` centralizes rasterization, PDF packaging, browser download/Web Share, native base64 saving and temporary URL cleanup. It accepts caller-provided pages/files and never selects a dataset or report type.
- Progress no longer imports a calendar component. Selected section IDs are normalized/deduplicated, empty selections rejected before allocating a PDF, and body assets loaded only for body selection. Existing names, formats, periods and selected body comparisons remain intact.
- History shares one filter function between the visible list and CSV. Its BOM, quoting/formula protection, per-side reps, row completion, units and shared workout clock remain intact.
- Calendar generation guards duplicate clicks, source changes and unmounting; save failures retain the file for retry and share cancellation remains a dismissal.
- No storage/schema, exercise/routine identity, updater/signature checks or native identifiers changed. The initial fix commit `997aa48` did not publish a release. A subsequent explicit request published these fixes as 1.15.52 / Android88; see [RELEASE-AUDIT-1.15.52.md](RELEASE-AUDIT-1.15.52.md). No merge to the default branch was performed.

The initial 1.15.52 fix did not add a global selector. The subsequent explicit request adds **Export Reports** in Stats and the calendar, with report checkboxes, Select All, Download Selected and Download All. Streak is the sole default selection; Consistency is included only by its checkbox, Select All or explicit Download All. Streak, Consistency, Progress, Stats, History, Plan and the explicitly complete backup retain independent builders/files and applicable controls. See [STREAK-EXPORT-AUDIT.md](STREAK-EXPORT-AUDIT.md) for the current data flow, date semantics and validation. Native multiple exports use one share sheet containing separate file URIs; browser exports retain separate downloads.

## Validation

- Frontend: **1,406 tests / 142 files** passed. New regressions cover all seven supported calendar period/format pairs, all pages of Full Report, unrelated body dataset invariance, progress periods and **all 255 nonempty section selections**, independent file construction, empty/invalid selections, native UTF-8/binary saving, cleanup, cancellation, source invalidation and retry.
- API: **11 tests** passed. MCP: **37 tests** plus `check:node-loadable` passed.
- `pnpm build`, `pnpm build:pwa` and `pnpm build:mobile` passed. Mobile includes Capacitor asset synchronization, not APK/native compilation. Existing large-chunk warnings remain; Windows skips unavailable CocoaPods/Xcode steps.
- Locale keysets and source strings passed; fatigue probes passed (108,000 rest comparisons and 14,076 history-edit comparisons). No frontend lint/typecheck scripts exist.
- Isolated Chromium (Edge engine) and WebKit contexts used synthetic profiles, America/Santo_Domingo time and a 390px viewport. Real button downloads covered Stats HTML, filtered History CSV, every calendar format, Progress checkbox selection, plan JSON and full-backup JSON. Empty Progress selection disabled download; Calendar Full Report forced PDF.
- Production file builders also downloaded each of the eight Progress sections, all 28 section pairs and all sections together, as independent PDFs in each engine. Browser errors were absent and the persisted synthetic profile was unchanged.
- **84 downloaded PDFs / 144 pages** passed strict pypdf parsing, image decoding, nonblank rendering and per-file duplicate-page checks. Calendar PNGs decoded successfully. Calendar Full Report and representative complete/body Progress PDFs were rendered and visually inspected. Scratch evidence lives under ignored `.tools/report-export-audit/`.
- Browser/WebKit and native adapter tests do not establish physical Android/iOS share-sheet or file-manager acceptance. Plan/Stats printing delegates to the browser; its OS print dialog was not manually exercised.
