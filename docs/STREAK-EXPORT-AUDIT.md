# Streak/calendar and multiple report exports

## Cause and contract

After the 1.15.52 isolation fix, Export Calendar still called the Consistency Report builder. Removing embedded Progress pages did not make it a streak report. The follow-up gives Streak its own `streak-report.js` builder, and `calendar-file.js` exposes separate Streak and Consistency file builders. Export Calendar now always calls Streak; a distinct Consistency Report button explicitly opens the existing consistency options.

`buildStreakReport` consumes the existing `trainingStreak` rows. The unchanged current/best reduction is extracted as `streakOfRows`, so Home and historical exports share one calculation. Past range endpoints include missed scheduled days; today remains pending. Planned/extra activity advances once per active date. Rest/pause are neutral, duplicate/active/canceled/zero-result/warmup sessions cannot inflate it, and dates before tracking are untracked. No workout records or persisted counters are changed.

Only calendar dates/statuses and the existing current/best streak appear. Summary values are explicitly labelled **as of** the selected endpoint (or today for a current/future predefined period), including earlier activity needed for streak continuity. Exported date cells remain strictly inside the selected range; no outside workouts, body measurements, Progress pages, consistency completion metrics or routine names are embedded.

## Date and format semantics

| Choice | Dates |
| --- | --- |
| This week / Last Week | Current/previous local Monday–Sunday, independent of calendar navigation. |
| This month / Last Month | Current/previous local calendar month; December/January and leap days supported. |
| Selected Week / Selected Month | Week/month of the calendar anchor. |
| Year / Full report | Anchored year. Year PDF is compact (three pages); Full Report PDF uses detailed pages (up to nine). No repeated date cells in either. |
| Custom Range | Inclusive start/end dates; missing, impossible, reversed or future endpoints are rejected. |

Predefined current periods include future dates as pending scheduled dates or neutral rest/pause, never fabricated activity. Periods without recorded activity show an explicit message and still export the selected calendar statuses. PNG keeps one image; custom ranges over 366 days automatically use PDF in the dialog and reject direct PNG requests. PDF divides dates across pages without mixing documents.

## Global selection and other exports

**Export Reports** is visible below the Stats header and in the calendar. It initially selects only Streak. Checkboxes support one/many/all and show applicable controls inline. Download Selected generates only the normalized/deduplicated selection. Download All explicitly selects all seven entries and reveals invalid hidden filters before generating anything. Files are fully prepared before saving, so a bad selected range cannot trigger partial generation/download of unrelated reports.

The seven entries are Streak PDF, Consistency PDF, Progress PDF, Stats HTML, History CSV, Plan JSON and full-backup JSON. Streak has its own date range, Consistency its own period/anchor, Progress its existing periods/custom dates, and History its existing All/30/90-day and search filters. Stats remains explicitly Since Start. Plan/full backup clearly state that date filters do not apply. Full backup intentionally contains the complete portable profile; it is not an individual analytical report. Recovery and automatic/cloud backups remain their existing recovery/backup flows, not additional report selections.

`report-exports.js` only routes selection to independent builders. `report-file.js` owns file packaging/save infrastructure; content stays with each report. History CSV/filter helpers move unchanged into `history-export.js`, avoiding a view dependency or duplicate filtering implementation; History re-exports them for compatibility. Progress section selection and existing statistics/plan/backup formats remain intact.

Browser saves download separate files; native batches write separate base64 cache files and use one OS share sheet with a URI array. Failed/canceled saves retain generated files for individual retry. Busy guards prevent double generation; source changes/unmount discard late results, and date changes invalidate prepared files. Theme variables and localized strings are shared with the app; all 12 locale keysets stay synchronized.

## Verification

- Unit coverage includes Home parity, deduplicated daily activity, pause/rest/pending behavior, missed historical endpoints, range carry-in, all predefined ranges, custom validation, year/month/leap boundaries, unrelated dataset invariance and unique PDF date cells.
- All **127 nonempty combinations** of the seven global entries validate exact selection, order, uniqueness and independent saving. UI tests cover defaults, Select All/clear, Download All, custom dates, stale results, failures and individual retry. Existing 255 Progress section combinations and seven Consistency period/format pairs remain covered.
- Native adapter tests verify independent binary/text payloads and a single share invocation with separate URIs.
- Actual isolated Edge/Chromium and WebKit flows exercise all Streak periods, PDF/PNG variants, explicit Consistency Full Report, one/three/all seven global downloads, unchanged synthetic profiles and no page errors or horizontal overflow. **32 downloaded PDFs / 66 pages** passed strict parsing, decoded drawn images, nonblank and per-file duplicate-page checks; PNGs decoded. Representative Streak/Consistency content and selector UI were visually reviewed.
- Web, PWA and mobile asset/sync builds, frontend/API/MCP tests, locale/source checks and plain-Node MCP loadability are required before publication. There are no frontend lint/typecheck scripts; Android lint is a separate native check.

Scratch fixtures/downloads/evidence are ignored under `.tools/streak-export-audit/`. Synthetic profiles do not establish the user's real history. Native adapter tests and browser downloads do not establish physical Android/iOS share-sheet acceptance or handset installation. No dependency, storage key, workout identity, schema or updater trust/signature rule changed.
