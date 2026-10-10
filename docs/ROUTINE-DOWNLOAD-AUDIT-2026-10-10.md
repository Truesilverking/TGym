# Routine download correction — 2026-10-10

Published correction: `1.15.60` / Android `96`, source `9313c40a0a0e81e4153e30c390bc9e7032810b12`. Based on `v1.15.59` (`7a6fccf29dff7b154fc1d2a5e15c065cb9d9b044`), branch `fix/routine-export-download-1.15.59`; exact-source CI and signed candidate validation passed before tagging.

## Reproduction and data flow

The installed Windows Edge app prepared the selected XLSX routine file, then Download displayed `Could not save. Download again.`. The routine builder had completed; saving was the failing boundary.

`RoutineExchange` requested `saveReportFile(file, { share: true })`, which selected `navigator.share` whenever `navigator.canShare` accepted the file. A rejected share operation produced the generic save error without a download. An isolated browser test against the published build reproduced this path with a simulated `DataError`; it is not a measurement of the precise exception in the user's installed app.

Download now calls `saveReportFile(file)`, selecting the existing browser/PWA anchor download. File generation, payload schemas and persisted state are unchanged. Capacitor still uses the existing native binary sharing branch. Explicit sharing controls elsewhere retain their existing behavior.

## Verification

- Component regression: JSON, XLSX and PDF use direct download; failed saves retain the prepared file for retry without rebuilding. Eight component tests passed.
- Complete frontend suite: 1,763 tests in 165 files passed. Web and standalone PWA production builds passed. Locale, source-string and version checks passed. Existing large-chunk build warning remains.
- Isolated Microsoft Edge production-bundle checks: 60 assertions passed, including four online downloads (JSON, XLSX, PDF and Excel template) and all three export formats after an offline reload.
- JSON and XLSX retain exact synthetic routine/exercise IDs, prescriptions, aliases, custom catalogue, ordering, schedule and rules. The official workbook parser accepts the XLSX and empty template. The two-page PDF parses and renders; both pages were visually inspected.
- The failing Web Share service was deliberately advertised as available during browser regressions. All corrected downloads bypassed it. No browser page errors or profile changes occurred.
- Native binary adapter unit coverage verifies exact XLSX bytes and filename. API (11 tests), MCP (37 tests and plain-Node loadability), and mobile asset build/Capacitor sync passed. Physical Android/iOS export and iOS compilation are not verified by this desktop fix.

Browser evidence and generated synthetic files are under ignored `.tools/routine-export-download/`. No private browser profile or user's routine data was copied into the browser harness.

## QA hosting

Vite preview returned `Vary: Origin`, causing its precached no-Origin JS/CSS responses to miss module requests after offline reload. GitHub Pages was checked live and uses `Vary: Accept-Encoding` with identical asset responses for requests with/without Origin. Offline checks therefore used the identical production bundle through a static local server without `Vary: Origin`; no service-worker changes were needed.

Release `1.15.60` / Android `96` was published from `9313c40a0a0e81e4153e30c390bc9e7032810b12` after exact-source CI and signed APK/AAB verification. Public metadata, artifact hashes, signatures and updater checks passed; see `RELEASE-AUDIT-1.15.60.md`.

The installed desktop PWA now displays 1.15.60 and reports up to date after closing and reopening its original desktop shortcut. Its normal Update button twice displayed a generic failure; a forced reload applied the published version without clearing the profile or reinstalling. The precise cause of that updater failure is unclassified. The same normal 1.15.59-to-1.15.60 update succeeded in an isolated production Edge profile, preserving the exact saved state and creating the pre-update backup.

JSON, XLSX and PDF were then downloaded successfully from the user's installed app. Completed files remain in the user's Downloads folder, outside the repository. JSON parsing, XLSX ZIP/sheet structure and PDF image-page parsing passed. Existing selected routines and visible unit preferences were retained. Public PWA QA additionally passed 35 assertions, including all three formats online and after a verified offline reopen, with no profile changes or browser errors.
