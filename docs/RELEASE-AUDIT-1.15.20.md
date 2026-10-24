# TGym 1.15.20 audit

Audited the clean `7622aba` checkout, recent changes since `56e1c8b`, route integration, workout clock/persistence, consistency and duration calculations, calendar reports, backup boundaries, native installer, FCM routing and release pipeline before making targeted fixes.

## Corrected findings

- Manual update checks had no pending state, duplicate-click guard or persistent result. Settings now exposes a full-size localized button, accessible status, available version and retryable connection errors; the existing update sheet/installer is reused.
- Metadata requests could hang indefinitely. A 15-second timeout includes response-body parsing and aborts the request; failed checks do not throttle retries.
- PWA update could reload before the new worker finished installing. Wait for installation and controller handover, with bounded waiting and listener cleanup.
- Failed native push initialization leaked listeners; token resubscription could reject without handling. Cleanup is now idempotent and failures remain contained.
- Initial guided plans and the Settings starter plan lacked a schedule start date, creating fictitious missed workouts. New schedules start on their installation date. Historical records are not rewritten based on an inferred date.
- The Spanish Home title overlapped the Settings control at 320px. Scope responsive typography to that header. Translate the calendar export controls that fell back to English.
- Android lint found an API-24 call in the API-23-supported updater and an API-26 call in the debug test host. Use compatible APIs, retaining APK size/hash/package/version/signer validation.
- Declare camera hardware optional. Put FCM channel metadata under the application instead of the file provider and order manifest declarations correctly.
- Document a narrowly scoped lint false positive for SCHEDULE_EXACT_ALARM: it is user-granted special access, with Capacitor's existing canScheduleExactAlarms/inexact fallback. See https://developer.android.com/develop/background-work/services/alarms.
- Android CI now runs app lint alongside compilation, preventing recurrence.

## Local validation

- Frontend: 772 tests / 74 files passed, including timeout, retry, duplicate check, update dialog, PWA activation, push failure cleanup and onboarding consistency regressions.
- API: 6 passed. MCP: 37 passed and plain Node import graph passed.
- Locale validation: 12 locales / 1302 keys; all 888 statically discovered source strings present.
- Fatigue probes: 108000 monotonic and 14076 deletion comparisons passed.
- Production web, PWA and mobile builds passed. Capacitor sync completed. Existing bundle-size/dynamic-import warnings remain.
- Local Android assembleDebug and app lintDebug passed: zero errors, 19 warnings (dependency updates and existing resource diagnostics). No JavaScript lint or typecheck scripts are configured. iOS native compilation requires macOS and was not run.
- Browser smoke test: onboarding, Home, calendar, PNG generation, Settings/manual-check error, light/dark themes, reduced motion, plan editing, library, workout start/add exercise/complete/save and Stats integration. Completion clock remained paused at 0:26 while the finish dialog stayed open.
- Home overlap reproduced and corrected at a verified 320px viewport. Additional requested viewport sizes were not applied by the browser backend; broader responsive matrix remains unverified. Generated PNG preview was blocked by browser URL policy; generation succeeded but exported pixels were not visually reviewed.
- No physical Android notification receipt, APK installation or process-kill test is claimed. CI emulator and signed publication results must be checked before considering the release complete.

## Release contract

Candidate: 1.15.20 / Android versionCode 55. Publish the exact validated commit using the existing tag workflow, preserve the signing identity, verify release/Pages artifacts and FCM submission. Preserve the separately versioned PWA lineage as configured; this native release does not publish the full current native UI to the PWA.

No training storage schema, authentication credentials, signing material or unrelated architecture changed. Git diff and status are reviewed before publication.
