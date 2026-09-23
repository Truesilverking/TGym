# TGym — UI and persistence audit (2026-09-23)

Branch: `feature/ui-persistence-audit`. Release target: 1.15.21, Android versionCode 56. Publication authorized after the UI audit. Native CI additionally checks the finished-rest label, selected accent and an elapsed workout longer than one hour.

## Changes
- Global theme, accent, reduced-motion and language preferences initialize outside the PIN gate. The privacy overlay inherits the same theme.
- Consistency uses two compact primary metrics and three secondary metrics, preserving the shared calculation.
- Routine duration retains period filters, stable routine IDs, sample count, average and median; removes repeated average labels and displays sub-minute sessions in seconds. Session timing now accepts the same numeric timestamps as duration validation.
- Native workout notifications inherit the selected accent, retain a running seconds clock beyond one hour, show the rest completion boundary, and use smaller clocks and accent indicators. Scheduled native notices inherit the user accent and app icon. In-app rest labels and accessible toast announcements were improved. Android controls notification chrome; remote server/FCM layouts were not replaced.
- Body entry uses reusable field groups, visible units, decimal-comma support and inline validation. History entries expand instead of presenting every metric at once, and records beyond the previous six-record cutoff are accessible.
- InBody groups composition, metabolism and water/nutrients. Editing retains identity and image when the date changes. Multiple reports on the same date no longer overwrite each other. Add starts a fresh draft; OCR failure does not discard an attached photo. Bitmap resources are released on failure too.

## Persistence and compatibility
No destructive schema migration. Legacy records and unknown fields remain intact; an ID is assigned when a legacy record is edited. Legacy bilateral measurements remain readable. Editing a measurement into another occupied date is rejected instead of destroying the destination record.
New photos remain portable JPEG data URLs inside the existing JSON backup/cloud/native state. They are bounded to 1500 pixels on the longest edge and 700,000 encoded characters, with adaptive quality. Existing images are not recompressed or removed. External file references would require changing the synchronous backup/cloud format; this change deliberately preserves its portability. Storage quota can still be reached with a large history; saves report failure and retain the draft rather than falsely confirming success.
Explicit body saves wait for the serialized native file write. Native failure is reported while the existing local copy remains available. A state containing only body records is now recognized as existing data during restoration/onboarding.

## Verification
- Frontend: 779 passing tests in 76 files, including saved theme before unlock, native restore after simulated WebView storage loss, failed-save retry, retained image/ID, date edits and invalid input.
- API: 6 passing tests. MCP: 37 passing tests; Node import graph check passed.
- Locale parity: 12 packs, 1313 keys. Source-string check: 889 entries passed. New strings have Spanish translations and use the existing English fallback in other packs.
- Web, PWA and mobile builds passed; Capacitor assets synchronized.
- Android assembleDebug and lintDebug passed: zero errors, 18 warnings. No frontend lint/type-check scripts are configured.
- Browser: grouped form input with decimal comma, save, reload, InBody edit-date without duplication, attach a non-personal test image, close/reopen, and verify restored image. At 360 px, InBody document width remained 360 px with no horizontal overflow; desktop layout was also inspected.
- git diff --check passed.

## Limits / preexisting findings
No Android device is connected: physical app termination/relaunch and native notification rendering are not device-verified. Native persistence is covered by mocked filesystem/store tests. iOS compilation requires macOS/Xcode and was not run.
Existing bundle-size and ineffective dynamic-import warnings remain. Browser OCR is unavailable in the tested environment; manual image-backed entry works. Existing InBody comparison heuristics are unchanged. No new reference screenshots were included with this request.

## Files changed
- `frontend/android/app/src/main/java/app/framegym/mobile/WorkoutNotificationService.java`
- `frontend/android/app/src/main/res/layout/workout_notification.xml`
- `frontend/android/app/src/main/res/layout/workout_notification_expanded.xml`
- `frontend/src/App.jsx`
- `frontend/src/components/RestTimer.jsx`
- `frontend/src/components/RoutineDuration.jsx`
- `frontend/src/components/Toast.jsx`
- `frontend/src/index.css`
- `frontend/src/lib/english-fallback.js`
- `frontend/src/lib/mobile-save.test.js`
- `frontend/src/lib/mobile.js`
- `frontend/src/lib/stats-insights.js`
- `frontend/src/lib/workout-notification.js`
- `frontend/src/locales/es.js`
- `frontend/src/sheets.jsx`
- `frontend/src/store/useStore.js`
- `frontend/src/store/useStore.mobile-workout.test.js`
- `frontend/src/views/Stats.jsx`
- `frontend/src/components/MetricFields.jsx`
- `frontend/src/components/ThemePreferences.test.jsx`
- `frontend/src/lib/body-records.js`
- `frontend/src/lib/body-records.test.js`
- `docs/UI-PERSISTENCE-AUDIT.md` (this report)
