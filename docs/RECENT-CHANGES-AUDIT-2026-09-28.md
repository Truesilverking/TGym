# Recent changes audit ? 2026-09-28

Candidate: TGym 1.15.42 / Android 78, branch `feature/dashboard-visual-polish`. Baseline `b88ab669d9f903e779f889e480d18699511916f8`; published runtime `e999554` (1.15.41). This report covers the eleven commits and 87 changed paths in `c88db48^..b88ab66`, plus the scoped fixes below. Publication evidence is recorded separately after CI and release verification.

## Findings and fixes

- Routine reordering: replace the hidden move menu with always-visible up/down controls beside Info, bounded at the first/last row. A deliberate 650 ms hold tolerates 12 px finger jitter. Document-level pointer tracking and suppression of native browser drag prevent WebKit from losing movement mid-drag. Native touch cancels ordinary scrolling gestures and prevents a post-drop ghost click. Existing edge autoscroll and visual/haptic feedback remain.
- Compact layout: clamp long names to three lines while retaining the full title/detail, fit controls at 320 px, and hide the red swipe-delete surface until actually swiping. Swipe activation is reachable from the name area beside permanent controls.
- Undo regression: deleting and restoring a routine now restores its display position; deleting/restoring all routines preserves the complete order.

## Data flow and compatibility

Both arrows and drag call the existing `reorderRoutine` helper by persistent routine ID, through `Plan` and `useStore.update`. `routineOrder` remains the only order field. Existing store persistence writes localStorage and the web/native mirror; no storage keys or migrations change. Ordering does not mutate routines, scheduled days, workout history or report data. Undo snapshots add optional position/order fields and retain fallback compatibility with older session snapshots.

## Audit matrix

| Recent changes | Validation |
| --- | --- |
| `c88db48`, `c2970e7`: report hierarchy, section dashboard, body comparison, selective PDF | Chromium and WebKit: eight sections at 320/360/375/390/430 px with rich and empty profiles (160 geometry cases), period/section combinations, expansion state, body deltas, downloads. Opened and visually reviewed body-only, empty, multi-section and 24-page full PDF with 33 sessions; no corruption, cut cards or wholly blank pages found. |
| `3c1d19c`: shared body model and units | Existing model reused; automated body measurement, conversion, fatigue/balance and report suites pass. Browser body comparison matches synthetic stored measurements (waist -4 cm). |
| `f7fd0ce`: offline persistence and PWA | Automated store, mirror, service worker and updater coverage; real-browser offline workout recovery/finish, backup/import/undo and reopen checks. Actual Settings > Check for updates > Update activates the candidate service worker, retaining stored routine order/training data and supporting offline edits/reload. |
| `e999554`: Home, sets/RIR/timer, calendar, routines | Browser onboarding/reopen, workout recovery/finish, routine edit/delete/undo, backup/import/undo, calendar PNG/PDF and activity log edit: six flows pass. Scoped routine fixes tested below. |
| Six release/documentation commits | Metadata and historical evidence reviewed; no unrelated runtime changes introduced. |

## Final checks

- Frontend: 1,201 tests / 124 files passed with `pnpm test --maxWorkers=4`. Default unconstrained execution had one 5-second timeout in the 10,000-workout archive test under concurrent browser load; the same test passed isolated and the complete suite passed with four workers. No test timeout was relaxed or assertion removed.
- Targeted archive/routine/Undo suite: 28 tests passed. API: 10 passed. MCP: 37 passed and Node-loadability passed. Locale/version checks passed. There are no frontend lint/typecheck scripts.
- Web, PWA and mobile builds passed. Clean Android debug/release build and release lint passed; final Capacitor sync and Android rebuild include the final source. Android lint has zero errors and 22 pre-existing warnings.
- Thirty long-name routines: Chromium/WebKit first-to-last and reverse drag with edge scrolling pass; six viewport sizes include landscape. Browser tests use synthetic profiles, not user data.
- Physical Pixel, TGym QA: OS-injected hold/drag first-to-last and reverse, alternating arrows/drag, actual swipe-delete and Undo, Info and normal opening pass. Installing the final QA APK preserves order and training data; blocked-network edits/reload and force-stop/relaunch preserve order. Production TGym and its data were not modified.

## Limits and publication checks

WebKit is browser-engine coverage, not physical iPhone/Safari/Home Screen validation. Native Android QA is physical-device evidence; it does not establish all OEM/device compatibility or notification delivery. PWA deployment activation passed; post-publication metadata/artifact/updater verification remains pending until recorded in the release audit. The first update test used an invalid synthetic profile (start date without required training history), so the pre-update backup correctly rejected it; a complete valid fixture passed without production-code changes. No claim of universal compatibility is made.

## Changed-path inventory in the audited window

- `docs/ARCHITECTURE.md`
- `docs/BODY-MODEL-AUDIT-2026-09-27.md`
- `docs/OFFLINE-AUDIT-2026-09-27.md`
- `docs/PROGRESS-REPORT.md`
- `docs/RELEASE-AUDIT-1.15.37.md`
- `docs/RELEASE-AUDIT-1.15.38.md`
- `docs/RELEASE-AUDIT-1.15.39.md`
- `docs/RELEASE-AUDIT-1.15.40.md`
- `docs/RELEASE-AUDIT-1.15.41.md`
- `docs/WORKOUT-UX-AUDIT-2026-09-28.md`
- `frontend/android/app/build.gradle`
- `frontend/android/app/src/androidTest/java/app/framegym/mobile/WorkoutNotificationTest.java`
- `frontend/package.json`
- `frontend/pnpm-lock.yaml`
- `frontend/pnpm-workspace.yaml`
- `frontend/public/sw.js`
- `frontend/scripts/pwa-metadata.mjs`
- `frontend/src/App.jsx`
- `frontend/src/components/BodyMap.jsx`
- `frontend/src/components/BodyMap.test.jsx`
- `frontend/src/components/CalendarExport.jsx`
- `frontend/src/components/MeasurementBodyMap.jsx`
- `frontend/src/components/MeasurementHistory.test.jsx`
- `frontend/src/components/Media.jsx`
- `frontend/src/components/Media.test.jsx`
- `frontend/src/components/OfflineStatus.jsx`
- `frontend/src/components/OfflineStatus.test.jsx`
- `frontend/src/components/ProgressBody.jsx`
- `frontend/src/components/RoutineList.jsx`
- `frontend/src/components/RoutineList.test.jsx`
- `frontend/src/index.css`
- `frontend/src/lib/api.js`
- `frontend/src/lib/api.test.js`
- `frontend/src/lib/backup.js`
- `frontend/src/lib/body-geometry.js`
- `frontend/src/lib/body-report.js`
- `frontend/src/lib/body-report.test.js`
- `frontend/src/lib/calendar-report.js`
- `frontend/src/lib/cloud-sync.js`
- `frontend/src/lib/cloud-sync.test.js`
- `frontend/src/lib/exercises-data.js`
- `frontend/src/lib/measurement-map.js`
- `frontend/src/lib/progress-export.js`
- `frontend/src/lib/progress-file.js`
- `frontend/src/lib/progress-report.js`
- `frontend/src/lib/progress-report.test.js`
- `frontend/src/lib/progress-sections.js`
- `frontend/src/lib/pwa-metadata.test.js`
- `frontend/src/lib/routine-order.js`
- `frontend/src/lib/routine-order.test.js`
- `frontend/src/lib/service-worker.test.js`
- `frontend/src/lib/state-merge.js`
- `frontend/src/lib/state-migrations.js`
- `frontend/src/lib/training-plan.js`
- `frontend/src/lib/training-plan.test.js`
- `frontend/src/lib/unit-conversion.js`
- `frontend/src/lib/unit-conversion.test.js`
- `frontend/src/lib/web-state.js`
- `frontend/src/lib/web-state.test.js`
- `frontend/src/locales/de.js`
- `frontend/src/locales/es.js`
- `frontend/src/locales/fr.js`
- `frontend/src/locales/hi.js`
- `frontend/src/locales/it.js`
- `frontend/src/locales/ko.js`
- `frontend/src/locales/pl.js`
- `frontend/src/locales/pt-BR.js`
- `frontend/src/locales/pt.js`
- `frontend/src/locales/ru.js`
- `frontend/src/locales/tr.js`
- `frontend/src/locales/zh.js`
- `frontend/src/main.jsx`
- `frontend/src/sheets.jsx`
- `frontend/src/store/useStore.js`
- `frontend/src/store/useStore.pwa.test.js`
- `frontend/src/store/useStore.session.test.js`
- `frontend/src/views/Home.calendar.test.jsx`
- `frontend/src/views/Home.jsx`
- `frontend/src/views/Plan.jsx`
- `frontend/src/views/ProgressReport.css`
- `frontend/src/views/ProgressReport.jsx`
- `frontend/src/views/ProgressReport.test.jsx`
- `frontend/src/views/Stats.jsx`
- `frontend/src/views/Workout.input.test.jsx`
- `frontend/src/views/Workout.jsx`
- `frontend/src/views/Workout.test.jsx`
- `mcp/package-lock.json`
