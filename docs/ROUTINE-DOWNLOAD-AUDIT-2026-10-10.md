# Routine download correction — 2026-10-10

Correction based on published `v1.15.59` (`7a6fccf29dff7b154fc1d2a5e15c065cb9d9b044`), branch `fix/routine-export-download-1.15.59`. Target release: `1.15.60` / Android `96`. Publication was explicitly authorized after local review; exact-source CI and signed candidate validation precede the release tag.

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

The installed app uses the public 1.15.59 build until the 1.15.60 release is published and applied. Publication and installed-app results will be recorded separately after verification.
