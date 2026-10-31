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

Published [v1.15.38](https://github.com/Truesilverking/TGym/releases/tag/v1.15.38), Android code 74, from runtime commit `c2970e79253f72be284c40a7ddab5d0897cfa5e7` on `feature/dashboard-visual-polish`.

- Exact-source [Tests](https://github.com/Truesilverking/TGym/actions/runs/36340334021) and [Validate Android](https://github.com/Truesilverking/TGym/actions/runs/36340334048) succeeded, including the Android emulator job.
- [Release workflow](https://github.com/Truesilverking/TGym/actions/runs/36340739552) succeeded, including signed APK/AAB, PWA deployment, published metadata verification and update-topic notification submission. The release is public, stable and non-draft; APK, AAB, checksums and latest.json are present.
- Independently downloaded GitHub and Pages APKs are identical by SHA-256: `efa19d8d8e2903d86df6a1b68128c37a8eba6fe575ee3d34e245de6f477d9ec3`.
- APK signature verified. Signing certificate is unchanged from 1.15.37: `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082`. aapt confirms package `app.framegym.mobile`, version 1.15.38 / code 74.
- Published PWA build metadata and update manifest identify the runtime commit above. The real app-update module, executed against live public metadata, detects 1.15.38 from 1.15.37 in Android/GitHub and PWA distributions; 1.15.38 does not offer itself again.
- FCM submission succeeded. Physical phone delivery, installation and iOS behavior remain unverified in this run.

No private records, credentials or signing files are included. Reproducible ignored QA evidence is under `.tools/browser-audit/progress-dashboard/` and `.tools/release-1.15.38/`.
