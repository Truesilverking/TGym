# TGym 1.15.38 / Android code 74

## Scope

Progress Report now has matching Period/Section selectors, persistent routine/exercise folds, expandable charts, and section selection before export. Body Progress uses an interactive anatomical reference and exact selected dated measurements; its PDF has a static model and comparisons. Routine → session → exercise calculations remain unchanged. No storage writes, schema changes or migrations. English/Spanish copy is complete; all 12 locale keysets are synchronized, with English fallback for the new strings outside Spanish.

## Validation

- Final frontend: 1139 tests / 116 files passed. API: 10 passed. MCP: 37 passed and plain Node import graph passed. Targeted tests cover selection/confirmation, retry/cancellation, stale snapshots, chart state, period filters, exact body records, missing values, legacy sides, units, increases/decreases/unchanged values and PDF section isolation.
- 12 locale packs / 1645 keys synchronized; 1064 source strings covered. Version 1.15.38 / code 74 validated. No frontend lint or typecheck scripts exist.
- Final web, PWA and mobile asset/sync builds passed. Final local SDK 35 / JDK 21 assembleDebug and app lintDebug passed: 0 errors, 20 existing warnings. Existing chunk/import build warnings remain non-fatal. Windows does not compile native iOS.
- Opera with synthetic data: all eight sections, routine expansion/collapse, chart expansion/collapse and preserved state after navigation, period changes, exact Before/After selection, single/multiple/all export selection and actual files saved to Downloads. Dark/light responsive widths 320/360/375/390/430/1024 and landscape 844×390 checked without horizontal overflow. Application reduced motion verified as 0s transition duration.
- PDF files reopened with strict pypdf and rendered with PyMuPDF; visual page review includes body-only, duration+body, complete, many-session, empty and single-reading fixtures. Final fixtures: combined duration/body 2 pages; body with incomplete baseline 2; single reading 1; empty 1; Spanish full 33 sessions / 13 body fields / 72 records 27; English large 330 sessions 24. Every final full-report page and relevant comparison pages were rendered and visually reviewed. No clipped components, corrupt files or blank pages found.
- The browser download-event observer timed out although the PDF was saved; filesystem verification confirmed real download. A stale PWA QA cache initially retained an older layout; final validation used a fresh isolated origin. No cache/security protection was disabled on the user's production app.
- No physical Android/iOS file-manager, installation or notification receipt claim. Native adapter tests/build and CI emulator evidence are distinct from device testing.

## Publication

Pending exact-source CI and authorized release verification. No private records, credentials or signing files are included. Reproducible ignored QA evidence is under `.tools/browser-audit/progress-dashboard/`.
