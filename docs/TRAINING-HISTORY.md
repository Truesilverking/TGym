# Training history and calendar audit

## Behavior

- Home asks users without a confirmed start date to confirm the earliest recorded workout (or schedule start/today for an empty profile). Settings > Data > Training history settings permits later correction.
- `trainingStartDate` is the inclusive lower bound for statistical calculations. `trainingHistory` holds `trackedFrom`, `historicalWorkouts`, `workoutsPerWeek` and `source: user-estimate`. Actual sessions remain in `workouts`; no synthetic sessions are created.
- Calendar tracking starts at the later of the training start and app tracking boundary. An actual session after the training start can move the tracking boundary earlier, preventing a mistakenly late boundary from hiding real sessions. Dates before the effective boundary are Not tracking yet, never missed or 0% adherence.
- Lifetime total = unique completed real sessions since the training start + the declared prior count. Weekly average uses inclusive elapsed calendar days / 7, including breaks. Estimates are not allocated to months, durations, exercise metrics or streaks. Historical frequency is a user declaration, not a substitute for current scheduled days or observed averages.
- Statistics, body charts, duration summaries, consistency, calendars, streaks and reports use the chosen lower bound. The archive and CSV/full backup preserve original records, including records outside the statistical period.
- Editing the start date does not delete records. Users reconfirm the prior count in the same form; no unverifiable prorating is performed.
- No destructive migration or schema version change. Existing profiles get a derived suggestion until confirmation. Standard store persistence and backups include the new optional fields. Native mirror restoration is covered by a test.
- Next-workout dates use the same weekday + numeric full date formatter in the app and native notification text, with locale-specific weekday names and UTC date-only formatting to avoid weekday shifts.

## Calendar export investigation

Full Report successfully generated in the desktop browser before this change, so the original device-specific failure was not reproduced and its exact cause is not established.

Reproduced and fixed: report data missing schedule fields could throw in calendarDay/effectiveRoutineId; a string date anchor could throw on getFullYear; date-only filename anchors could shift to the preceding day west of UTC. Added regression coverage for sparse records, strings, leap years, year boundaries, 10,000 sessions and escaped labels.

Resource issue corrected: four-page PDF generation retained large 2x PNG/canvas allocations. PDF pages now use compressed JPEG images and explicitly release each canvas in finally, including failed encoding; standalone PNG exports preserve PNG quality. Browser download anchors are attached before clicking for compatibility. Android's existing cache FileProvider and native share flow are reused.

Verified in the local browser: Spanish form validation, save/reopen, prior-count separation, mobile-width layout, Not tracking yet calendar states, and Full Report generation. The embedded browser did not expose a download event after Share/save; native file sharing still requires a connected phone. Do not describe that device-side path as verified.

## Verification

- Frontend full suite, locale key parity/source coverage, web/PWA/Capacitor builds.
- API and MCP suites, plain-Node MCP import graph.
- Targeted history/pause/report tests under America/New_York and Pacific/Auckland.
- Android assembleDebug and lintDebug. No frontend lint/typecheck scripts exist; iOS native build requires macOS.
- Publication was subsequently requested: release 1.15.22 (Android versionCode 57) from feature/training-pause, using the existing signed release and FCM update workflow.

## Files changed in both feature requests

- `api/server.js`
- `api/training-pause.js`
- `api/training-pause.test.js`
- `docs/TRAINING-HISTORY.md`
- `docs/TRAINING-PAUSE.md`
- `frontend/src/components/CalendarExport.jsx`
- `frontend/src/components/CalendarExport.test.jsx`
- `frontend/src/components/Heatmap.jsx`
- `frontend/src/components/TabBar.jsx`
- `frontend/src/components/TrainingHistory.jsx`
- `frontend/src/components/TrainingPauseCard.jsx`
- `frontend/src/components/TrainingPauseCard.test.jsx`
- `frontend/src/components/ZoomCalendar.test.jsx`
- `frontend/src/index.css`
- `frontend/src/lib/backup.js`
- `frontend/src/lib/calendar-data.js`
- `frontend/src/lib/calendar-report.js`
- `frontend/src/lib/consistency.js`
- `frontend/src/lib/english-fallback.js`
- `frontend/src/lib/format.js`
- `frontend/src/lib/history.js`
- `frontend/src/lib/measurement-reminders.test.js`
- `frontend/src/lib/mobile.js`
- `frontend/src/lib/state-merge.js`
- `frontend/src/lib/training-history.js`
- `frontend/src/lib/training-history.test.js`
- `frontend/src/lib/training-pause.js`
- `frontend/src/lib/training-pause.test.js`
- `frontend/src/lib/training-plan.js`
- `frontend/src/lib/workout-reminders.js`
- `frontend/src/locales/es.js`
- `frontend/src/sheets.jsx`
- `frontend/src/store/useStore.js`
- `frontend/src/store/useStore.mobile-workout.test.js`
- `frontend/src/views/Home.jsx`
- `frontend/src/views/Settings.jsx`
- `frontend/src/views/Stats.jsx`
- `frontend/src/views/Workout.jsx`
- `mcp/src/tools.js`
