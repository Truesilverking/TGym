# TGym 1.15.25 — validation record

Android versionCode 60. Feature branch: `feature/dashboard-visual-polish`.

## Changes
- Compact streak badge and a discoverable training-break action beside the weekly plan; existing pause/resume and deload semantics retained.
- Six-step skippable/replayable tour, persisted completion flags, additive state schema 2 and an IndexedDB profile mirror for standalone PWA.
- Manual activities, recurrent/date planning and hybrid routines reuse normal exercise/routine/workout identities. New activity schedules start today without changing previous days. Extra sessions do not suppress pending routine reminders.
- Read-only Health Connect exercise import on Android 14+, explicit permissions, source-aware reconciliation, update handling, disconnect without deletion, separate activity metrics and CSV/HTML report support.
- PWA releases now use current source and version; published build metadata is verified before sending update notifications. Existing APK checksum/package/signature protections are unchanged.
- Spanish translations again override the source-language fallback, including Failure/Fallo and sound settings.

## Local checks (2026-09-23)
- Frontend: **897 tests passed, 93 files**, `pnpm test --maxWorkers=2`.
- API: **7 passed**; MCP: **37 passed** and plain-Node import graph check passed.
- Web, standalone PWA and mobile asset builds passed. Capacitor Android/iOS asset synchronization passed; Windows does not compile iOS/Xcode.
- Android: `:app:assembleDebug :app:assembleDebugAndroidTest :app:lintDebug --offline` passed, including compilation of the Health Connect instrumentation tests. Execution of native instrumentation is a separate CI check.
- Locale parity: 12 packs, 1477 keys; 990 source translation strings covered. Version validation passed.
- Fatigue probe: 108000 monotonic comparisons plus 14076 historical-deletion comparisons passed.
- `git diff --check` passed. No frontend lint/typecheck scripts exist.

## Flow evidence
- Component/pure tests cover new and existing onboarding, completed/skipped/replayed tour, persistence retry, compatible migration, pause/resume, running log, recurrent planning, hybrid routines, import updates, manual/provider reconciliation, native strength-set preservation, disconnect retaining history and incomplete/failed imports.
- PWA store tests restore the mirrored profile after primary storage loss; service-worker tests cover offline shell fallback, incomplete installation and versioned-cache cleanup without deleting data caches.
- Browser review: desktop and 390px mobile, blank profile onboarding, tour skip/replay, corrected spotlight placement, activity form, weekly running assignment and manual 30-minute/5km run. Closing the browser tab and reopening preserved the run, routine and completed onboarding/tour flags. These are local synthetic fixtures, not personal training records.

## Limits and pre-existing issues
- No physical wearable/phone was connected. Real Health Connect permission/data availability and actual push receipt on the user's device remain unverified; native compilation, permission declarations, mapping tests and mock-source reconciliation are separate evidence.
- The unsupported root-level `assembleDebugAndroidTest` also attempted dependency plugins' own test APKs and exposed a pre-existing Kotlin stdlib conflict in `capacitor-cordova-android-plugins`. TGym's app-scoped APK/test APK/lint checks passed; no unrelated dependency changes were introduced.
- Vite reports existing large chunks and ineffective dynamic imports. An earlier highly concurrent local test run timed out; the complete bounded-concurrency run passed unchanged assertions.
- Local mirrors do not survive deletion of all site/app data; an external backup remains required for that case.
- See [HEALTH-INTEGRATIONS.md](HEALTH-INTEGRATIONS.md) for supported data, provider requirements and explicit unsupported-platform behavior.
