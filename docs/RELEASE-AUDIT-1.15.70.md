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
