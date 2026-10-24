# Shared body model audit - 2026-09-27

## Scope and corrections

Body Measurement in Stats and Progress Report now use the same male/female BodyMap geometry as Muscle Balance, Fatigue and Strength. The PDF and calendar full-report exporters load that same asset. The separate silhouette was removed. Selection, before/after values, directional markers, an expandable measurement history and comparison details share one UI. Measurement styles are scoped so existing muscle heatmaps retain their scales.

Fixed a failed lazy geometry request becoming permanently cached: loading and error states now offer retry and ignore completion after unmount. The model supports keyboard zone selection as well as the labeled measurement selector. Contrast and marker positions were reviewed in dark/light mobile layouts.

Fixed explicit unit stamps becoming stale after conversion, which could convert measurements or bodyweight twice in reports. Editing, history display, HTML export and Progress Report now interpret measurements in the selected unit. Saving a measurement stamps its unit while preserving its ID/date/timestamp. Legacy unstamped rows and arm/thigh/calf fields remain compatible. No storage keys were changed; no destructive migration is needed. Missing measurements remain absent in report calculations.

## Verification

- Frontend: 1,145 tests in 117 files passed. After consolidating the final measurement projection, 70 relevant report/calendar/UI tests passed again.
- New regressions cover mixed-unit conversion/round trips, stamped bodyweight samples, editing an inch record in cm without replacing its identity, asset-load retry, male/female geometry and keyboard selection.
- API: 10 tests passed. MCP: 37 tests and the plain-Node import graph passed.
- Locales: 12 packs / 1,650 keys; 1,067 source strings covered. Version check passed. Fatigue: 108,000 monotonic comparisons plus 14,076 history-edit comparisons passed.
- Final production web, standalone PWA and mobile/Capacitor builds passed. There are no frontend lint/typecheck scripts.
- Final JDK21/SDK35 `clean assembleRelease :app:lintRelease` passed after Capacitor sync. Local release APK is unsigned. Android lint: 0 errors/fatal, 22 warnings (dependency versions, unused resources, icon checks, obsolete SDK branch and Firebase service token-refresh lint). No Android code changed. Bundler warnings about mixed static/dynamic imports and large chunks remain; they do not fail compilation.
- Opera synthetic profile: all eight report sections, period filtering, Stats navigation, Muscle Balance/Fatigue front/back geometry, model selection, before/after values, edit/save and persisted value after reloading without reseeding. No captured console warnings/errors in these flows.
- Responsive body/report view: 320, 360, 375, 390, 430 px and 844x390 landscape, no horizontal overflow. Dark/light, male/female, English/Spanish, reduced-motion fixture, single/empty and 330-session data were exercised.
- Actual downloaded PDFs were parsed and rendered: body-only 2 pages, single-record 1, empty full report 1, large full Spanish report 27. Reviewed all rendered pages for clipped/overlapping components and body geometry. Downloads retained consistent TGym filenames.

## Limits and publication

This audit does not establish absolute compatibility with every phone. Physical Android, iOS Safari/Home Screen, native share-sheet delivery and keyboard/system-inset behavior were not retested on hardware. Existing automated/native CI remains complementary evidence, not physical-device validation.

Current request is commit/push on `feature/dashboard-visual-polish`; version stays 1.15.38/code74. This is not a new APK release, update-manifest publication or FCM notification. Runtime release 1.15.38 remains unchanged. QA fixtures, PDFs, screenshots, logs, APKs and local SDK/signing paths are excluded from Git.
