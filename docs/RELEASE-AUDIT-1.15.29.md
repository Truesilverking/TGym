# TGym 1.15.29 release candidate audit

Status at commit: implementation and local automated checks complete; release candidate authorized for publication after CI. The user selected a subsequent manual visual review using screenshots from the installed update. Android instrumentation runs in the repository CI emulator before the release tag is created.

## Scope and fixes

- Ordered daily schedules now accept multiple routine IDs in weekly assignments and date overrides. The shared daily-plan calculation selects the first pending session, tracks partial completion, skips and extras, and prevents a single legacy session from completing two routines with the same name.
- Home, routine scheduling, calendar/report, streak, consistency, reminders, activity scheduling, sharing and MCP consumers use these assignments. Empty schedules are rest days, and outdated notification taps cannot start yesterday's routine today.
- Schedule editor supports add, remove, reorder, routine editing, existing per-weekday reminder times and reset to weekly plan. Completion offers Continue/Later; each session preserves its own ID, clock, history, progression and inactivity window. Starting another routine cannot overwrite an active session.
- Weight/reps/RIR retain direct decimal-aware entry and +/- controls. Fixed/ranged reps follow the prescription; AMRAP, warmups and unspecified targets permit free valid reps. Warmup RIR is editable. Invalid intermediate drafts do not overwrite persisted values. The document-level input activity handler no longer causes a store render before React consumes the field value.
- Set cards emphasize the centered target and entered values with theme-based states. Native expanded workout notifications separate workout/rest clocks, exercise context, work-set progress and daily position; compact content stays within the platform height. Paused duration retains seconds, and completion has a separate dismissible notification. Actions use existing supported app navigation.

## Persistence

Schema 3 normalizes legacy scalar weekly/date assignments to ordered arrays and rest to an empty array. Existing histories, active workouts, stable routine/exercise IDs and unknown fields are retained. Optional daySkipped state records intentional per-date omissions. Cloud merge treats a day's ordered list atomically to avoid resurrecting removed assignments. Existing localStorage/native mirror synchronization remains authoritative; no storage-key or database change.

## Verification

- Frontend: 960 tests across 100 files passed. Added scheduler component and three-session lifecycle coverage (Later/Continue, serialized reopen, independent durations/IDs, active-session guard, skip/undo, overrides and inactivity).
- API: 10 tests passed, including ordered next-pending reminders, cancellations, active sessions, legacy matching, pauses and rest overrides.
- MCP: 37 tests passed; the plain Node import graph check passed.
- Web, standalone PWA and mobile asset/sync builds passed. Twelve locales with 1531 keys and 1014 source strings checked successfully.
- Fatigue probes: 108000 monotonic comparisons and 14076 deletion comparisons passed. Twenty-four local sound presets verified.
- Android debug and instrumentation packages compile; app lint has zero errors. Existing warnings concern dependency versions, splash/resources, Firebase token callback and redundant SDK check. Final candidate debug/instrumentation builds and lint also passed after the version/layout adjustment (zero errors, 20 pre-existing warnings).
- Frontend has no lint/typecheck scripts. Mobile asset sync is not iOS compilation.
- Browser access to the local QA origin was explicitly denied by a saved permission. No browser or OS workaround was attempted. Visual EN/ES/mobile/desktop, actual trusted-keyboard input and production PWA offline checks remain pending. Component tests are not physical-device or process-kill validation. The user explicitly chose to proceed with publication and review the installed UI together via screenshots.
- Expanded/compact native notification, rest background/sound and paused-clock instrumentation assertions are included; CI emulator execution remains pending.

## Publication

Candidate version: 1.15.29, Android code 64. Last public release verified: 1.15.28. This audit records the pre-publication verification; CI and publication results are verified separately against the final commit. After CI passes, use the existing tag-triggered workflow, then verify remote commit, release APK identity/hash/signature, matching PWA/update manifests and accepted FCM topics. FCM acceptance does not establish receipt on a particular phone.

## Changed files

- `api/server.js`
- `frontend/android/app/build.gradle`
- `frontend/android/app/src/androidTest/java/app/framegym/mobile/WorkoutNotificationTest.java`
- `frontend/android/app/src/debug/java/app/framegym/mobile/WorkoutNotificationTestActivity.java`
- `frontend/android/app/src/main/java/app/framegym/mobile/WorkoutNotificationPlugin.java`
- `frontend/android/app/src/main/java/app/framegym/mobile/WorkoutNotificationService.java`
- `frontend/android/app/src/main/res/layout/workout_notification.xml`
- `frontend/android/app/src/main/res/layout/workout_notification_expanded.xml`
- `frontend/package.json`
- `frontend/src/App.jsx`
- `frontend/src/components/TabBar.jsx`
- `frontend/src/components/ui.jsx`
- `frontend/src/index.css`
- `frontend/src/lib/activities.js`
- `frontend/src/lib/activities.test.js`
- `frontend/src/lib/calendar-data.js`
- `frontend/src/lib/calendar-report.js`
- `frontend/src/lib/consistency.js`
- `frontend/src/lib/english-fallback.js`
- `frontend/src/lib/history.js`
- `frontend/src/lib/mobile.js`
- `frontend/src/lib/plan-share.js`
- `frontend/src/lib/state-merge.js`
- `frontend/src/lib/state-migrations.js`
- `frontend/src/lib/training-history.js`
- `frontend/src/lib/training-plan.js`
- `frontend/src/lib/workout-notification.js`
- `frontend/src/lib/workout-notification.test.js`
- `frontend/src/lib/workout-reminders.js`
- `frontend/src/locales/es.js`
- `frontend/src/sheets.jsx`
- `frontend/src/store/useUI.js`
- `frontend/src/views/Home.jsx`
- `frontend/src/views/Plan.jsx`
- `frontend/src/views/RoutineEdit.jsx`
- `frontend/src/views/Settings.jsx`
- `frontend/src/views/Workout.input.test.jsx`
- `frontend/src/views/Workout.jsx`
- `mcp/src/tools.js`
- `api/workout-plan.js`
- `api/workout-plan.test.js`
- `frontend/src/components/DailyPlan.jsx`
- `frontend/src/components/DailyPlan.test.jsx`
- `frontend/src/lib/daily-plan.js`
- `frontend/src/lib/daily-plan.test.js`
- `frontend/src/lib/workout-input.js`
