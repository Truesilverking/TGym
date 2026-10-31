# Full report design verification 1.15.69

Date: 2026-10-17, America/Santo_Domingo. All example profiles and workouts are synthetic. No personal browser profile or physical device was read or changed.

## Scope and final layout

Both **Full report PDF** builders now produce exactly two A4 pages, with six complete month cards per page in two columns and three rows. The shared layout keeps the annual period, year, existing summary values and context visible, repeats the appropriate plain-color legend, and identifies the half-year and page number in the footer. Each date retains one plain colored square and its centered day number; accessible date/status text remains nonvisual.

The final SVG canvas is 1000 × 1414 units. Month cards are 440 × 292 units; day squares are 34 × 34 with a four-unit gap and enough space for a six-week month. Day numbers and legend labels use 18-unit text. At the final PDF placement these are about 9.69 pt; the smallest explanatory text is about 8.62 pt. The export pipeline preserves equal horizontal and vertical scale.

Completion/activity remain blue and the existing status labels, predicates and plain palette remain unchanged. The Spanish shared month label `May` was intentionally corrected from `May` to `Mayo`; this also affects other Spanish views using that same key. No locale keys were added or removed.

## Independent regression evidence

An isolated source archive of released 1.15.68 commit `53fef59c34ce4142c8c4cf38e3d2a0e973ddf231` supplies the baseline. Six scenarios cover a representative common year, leap year, empty profile, an entirely pretracking year, a future year and an active session.

- Full Streak and Consistency calculation results, date statuses and summary data exactly match that baseline after normal JSON serialization. Inputs, including the active-session snapshot, remain unchanged.
- All 22 existing non-full period/format choices per scenario retain byte-identical English SVG output. The existing Streak Full PNG is also byte-identical, giving 23 preserved choices per scenario. Year, week, month and custom layouts are unaffected. The Spanish `Mayo` correction above is the intentional shared-label exception.
- The changed Full PDF paths return exactly two pages in every scenario. Annual dates appear exactly once, including all 366 dates of 2024. Each page contains six whole months in chronological order; weekday columns and week rows match the real local calendar.

## Browser, locale and final PDF checks

Headless Chromium using the Microsoft Edge channel and Playwright WebKit each passed all 13 configured locale settings: English plus the 12 other packs. Existing English fallbacks in partially translated packs are retained; this audit verifies rendering rather than claiming translation completeness.

Each engine checked 120 generated SVG pages and 21,902 date cells, including representative and empty reports in every locale and the additional date/state scenarios. Checks verify all of the following:

- Exact cell-to-legend color and semantic correspondence; no status symbols or patterns; one rectangle and one day-number text element per cell.
- Square geometry, centered day numbers, correct month/year boundaries, exact annual coverage, and date/status labels available to assistive technology.
- Every cell and all month text remain inside their card, including six-week months. Headers, summaries, notes, cards, legends and footers have no text overlap or page clipping in the measured browser font geometry.
- Existing annual summary values appear correctly on both pages. Final day/legend sizes remain above 9 pt, with explanatory text above 8 pt.

The production file builders and actual UI exported **82 PDFs containing 172 A4 pages**. MuPDF decoded and rendered their pages: no blank pages, duplicate page images within a report, cropped images or unequal image scaling were found. Each standalone full report is two pages. Combining both reports produces four pages, with each report retaining its two-page limit.

At 320/390-pixel widths in both browsers, the existing export dialog's preview link points to the same PDF bytes as **Share / save** downloads. The Stats combined-report UI also produces exactly the four standalone page images in the correct order. Final PDF page-image comparisons show that standalone API exports, UI exports and the combined PDF contain identical report pages. The stored synthetic profile remains unchanged and no browser page errors occur. Native browser PDF-viewer behavior is not separately claimed; the actual preview blob and downloaded PDF were verified and their final pages rendered independently.

All four latest Spanish example pages were visually inspected after the final spacing and `Mayo` changes. Additional Hindi, Chinese and Russian final PDF pages were inspected for glyph rendering and layout. The final pages show readable headers/legends, clear month cards and dates, and no visible clipping or overlaps.

## Examples and reproducibility

The two Spanish review examples use activity distributed across all twelve months of completed year 2025, viewed as of 2026-10-17. They are local review artifacts, not the user's workout data:

- `.tools/reports69/TGym-Reporte-de-racha-completo-2025.pdf`
- `.tools/reports69/TGym-Reporte-de-consistencia-completo-2025.pdf`

Both pages of each example are rendered to `example-streak-page-1.png`, `example-streak-page-2.png`, `example-consistency-page-1.png` and `example-consistency-page-2.png`, with two-page contact sheets alongside them.

The PDF skill's `mark_artifact_operation_started.mjs` was found in its `container_tools` directory and successfully invoked exactly once, with `create`, expected output count `2` and format `pdf`, immediately before the first example PDF generation. Later iterations updated the same two deliverables.

Ignored `.tools/reports69/` contains `fixtures.mjs`, the archived baseline, `capture-baseline.mjs`, `regression.mjs`, `examples.mjs`, `full-qa.mjs`, `render-examples.py` and `verify-pdfs.py`. Browser runs use isolated standalone Vite at port 5199; PDF rendering uses PyMuPDF/Pillow. Evidence is recorded in `regression-proof.json`, `full-qa-proof.json`, each engine's `full-geometry.json`/`full-qa-proof.json` files and `final-pdf-proof.json`.

## Boundaries

This evidence covers desktop Chromium and the WebKit engine, not physical iPhone Safari or an installed iPhone PWA. Development-origin exports do not establish production update/offline behavior. Exact-source CI, native builds/lint, signed/public artifact identity and production-shell update/profile-retention checks are recorded separately in the release audit. No catalog, persistence, workout or calculation rule was changed by this layout work.
