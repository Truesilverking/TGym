# TGym 1.15.26 — validation record

Android versionCode 61. Branch: `feature/dashboard-visual-polish`.

## Corrections and behavior
- Completion freezes the session clock at completion; Continue resumes accumulated active time without counting the decision interval.
- Only real user interaction refreshes activity. Automatic work timers, renders and synchronization do not. Inactivity ends the session at the last interaction plus 30 minutes, even when the app is reopened much later; unfinished entries and partial sides are retained.
- Explicit continuation after inactivity starts a new session identity and preserves the original historical record.
- Additive sessionStartedAt, lastActivityAt, accumulatedActiveDuration, sessionStatus, endedAt and finishReason metadata accompany the existing timestamp fields. Existing storage keys/schema and history remain compatible; no destructive migration is performed.
- Independent left/right confirmations complete one set only when both sides are done. Undo retains the opposite side. New per-side prescriptions keep entered reps using repsPerSide; legacy total-rep targets keep their prior meaning. Confirmations never double reps or volume.
- Compact labelled set controls, clear current/pending/completed states, touch targets and responsive metric grouping reuse theme variables.
- Shared orbital TGym identity improves login and PIN lock screens. Accent, passkey/guest/recovery behavior are preserved. The lock screen now subscribes to language changes during asynchronous locale loading.
- Pause action is compact on the left, Plan Activity aligns with Week Schedule on the right, and Home's Training Paused section is last.
- ES/EN accessibility labels and Spanish import errors are translated; narrow settings rows prevent labels breaking into individual letters.

## Validation (2026-09-24)
- Frontend: 911 tests passed across 95 files (`pnpm test --maxWorkers=2`).
- API: 7 tests passed. MCP: 37 tests and plain-Node import graph passed.
- Web, PWA and mobile builds plus Capacitor synchronization passed.
- Android app-scoped debug APK, instrumentation APK compilation and lint passed (`:app:assembleDebug :app:assembleDebugAndroidTest :app:lintDebug --offline`). Device execution is a separate CI gate before release.
- Locale parity: 12 packs, 1498 keys; 1003 source translation strings covered. Version validation passed.
- Fatigue probe: 108000 comparisons and 14076 historical-deletion comparisons passed.
- No frontend lint/typecheck scripts exist. Existing Vite chunk-size/dynamic-import warnings remain.
- Browser review: ES/EN Home, Plan, RoutineEdit, Stats, History, Library and Settings on desktop and 320–390 px mobile; no horizontal overflow or console errors. Modified set, partial-side, completion/Continue, inactivity and access flows were exercised with synthetic data.
- Reload retained partial-side state and frozen completion time. Continue resumed from 10:06, excluding paused time. An expired fixture ended at its exact 50-minute deadline rather than reopening time.
- Serialization/backup/store tests cover metadata, pause, partial sides and restoration after simulated refresh/background/offline/restart/update. These are not physical phone restart tests.

## Publication gates and limits
Commit and tag publication require passing remote Tests and Validate Android workflows. The existing release workflow builds signed APK/AAB, checks identity/certificate/checksums, publishes matching PWA/update metadata, verifies published assets, then sends both Firebase update topics. Actual receipt on a particular phone cannot be confirmed from CI.
