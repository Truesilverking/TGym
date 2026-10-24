# TGym pre-release audit — 2026-09-25

## Status and publication gate

Publication follow-up: **1.15.31/code66 is published** from `48dc3a1`; exact-commit Tests, Android build/lint/emulator and release workflows passed, and FCM accepted both update-topic messages. See [RELEASE-AUDIT-1.15.31.md](RELEASE-AUDIT-1.15.31.md). The preparation evidence and acceptance gaps below are retained for traceability.

**Automated audit complete; full visual/device audit incomplete.** After being informed that the fixes were still local and that visual/Android checks were blocked, the user explicitly instructed: "subelos a github y manda el update". This authorizes publishing the existing corrections with Android compilation and instrumentation validated by GitHub Actions. It does not turn the unperformed visual/device checks into passes. Neither complete visual pass has been performed.

Existing checkout: `feature/dashboard-visual-polish`, starting clean at `31917fe282d6b01f67b69a1d2a034b0fcb44fc62`. Release candidate **1.15.31**, Android code **66**. The publication sequence is branch commit/push, successful Tests and Validate Android on that exact commit, then the existing tag-triggered release. That workflow checks signed APK/AAB, matching PWA and published metadata before notifying both native FCM topics. Publication evidence will be recorded separately after it finishes. No private user backup or credential file was read.

The already-published [v1.15.30 release](https://github.com/Truesilverking/TGym/releases/tag/v1.15.30) was confirmed through GitHub on this date. Its exact baseline commit has successful [Tests](https://github.com/Truesilverking/TGym/actions/runs/36171858144), [Validate Android](https://github.com/Truesilverking/TGym/actions/runs/36171858103) and [TGym release](https://github.com/Truesilverking/TGym/actions/runs/36172594461) runs. These runs do **not** validate the uncommitted changes below.

## Reproduced defects and local corrections

| Area | Root cause and correction | Regression evidence |
| --- | --- | --- |
| Cloud merge: workout data | Generic object-array union combined old and edited sets while retaining an incompatible volume. Conflicting workouts and active sessions now remain whole snapshots requiring a choice. | Same workout ID with 100/150 volume retains exactly one version, including sets and totals. |
| Cloud merge: conflict selection | Paths used record IDs as array indexes and split IDs containing dots. Structured path segments now locate records by identity. | Remote choice works despite different record order and dotted IDs; originals remain unchanged. |
| Cloud merge: deleted exercises and cleared values | Ordered exercise lists were unioned; null was treated as absent. Ordered routine exercises are atomic choices; explicit null is an edit. Closed training pauses retain their existing precedence. | Removed exercises stay removed locally; null goals/stale sessions require a choice; pause regression suite passes. |
| Cloud merge: legacy measurements | The legacy date field `d` was not an identity. Edited weigh-ins were duplicated; ambiguous same-date reports could be unioned. Unique legacy dates are matched; ambiguous collections require choosing a snapshot. | One edited weigh-in stays one record; two same-date InBody reports are not collapsed. |
| Cloud conflict review | Object values appeared as `[object Object]`, and only the first 12 conflicts were shown. All conflicts now expose both snapshots with localized device labels and expandable details. | EN/ES component checks inspect both actual values. Rendered layout remains pending. |
| Plan sharing | Export omitted `activityType` and explicit cardio mode. Shared activity routines could fail to match manual completion to the daily plan. Both fields now travel with the prescription. | Export → JSON parse → ID-remapped import → activity completion yields one completed assignment and zero extras. |
| Activity imports/entry | A null provider row aborted a batch; JavaScript coercion accepted booleans/collections as measurements. Malformed rows are skipped; numeric input rejects nonnumeric types. | Valid provider record survives malformed neighbors; invalid measurements are rejected. |
| Health normalization helpers | Invalid distance became zero, invalid HRV counted toward available recovery inputs, and Celsius fields were converted using a Fahrenheit offset. Preserve unknowns, accept only numeric HRV and distinguish absolute temperatures from differences. | Missing/invalid/zero values, Celsius/Fahrenheit and insufficient inputs covered. These helpers do not imply new native health integrations. |
| Work timer | Early completion used stale rendered seconds after background suspension. It now uses the deadline and caps elapsed time at the target. | Suspended 90-second timer finished at 38 seconds records 38 rather than 1; overdue completion caps at 90; repeat completion is inert. |
| History/CSV | Export included duplicate/cancelled identities, used profile units rather than session units, omitted completion/effort/phase context and allowed text to be interpreted as spreadsheet formulas. Use shared logged-workout filtering, session units, additive status/effort columns and text escaping. Period filtering now uses the local calendar date. | Duplicate/cancelled exclusion, lb/kg identity, pending/completed rows, formula text and CSV import regressions pass. |
| Backup validation | Nested entries, sets, routines and schedule maps could have invalid shapes yet replace the current profile. Reject malformed defined collections before restoration; optional legacy fields and unknown fields remain supported. | Invalid routine exercises, null sets, malformed active entries and array schedule map all rejected. Existing portable/legacy backup tests pass. |
| Accessibility/error copy | Home calendar dates and routine edit affordances were click-only containers; routine input and weight slider lacked names. Use native buttons, named controls, Home/End slider keys and 44px routine controls. Unexpected activity-save exceptions now show actionable localized copy. | Component flow persists reordering without opening the editor accidentally; keyboard bounds, labels, cloud EN/ES and storage failure/retry tests pass. |

No changes to updater trust/host/hash/package/version/signature validation, native package identity, storage keys, signing configuration or dependency lockfiles. State schema remains 3 and portable backup schema remains 1. New conflict descriptors are ephemeral; no migration rewrites historical training data. CSV columns are appended, so consumers assuming an exact old column count may need adjustment.

## Audit coverage and outstanding user-flow verification

The rows below distinguish code/test coverage from actual UI acceptance. A passing component test is not a browser, phone, screen-reader or process-kill test.

| Surface | Evidence reviewed/executed | Still required |
| --- | --- | --- |
| Onboarding, tour, returning user | App boot, additive migration, persisted flags, PWA/native-mirror tests and tour tests. | New/existing profile walkthrough in real browser, tour dismissal/back/reopen and installed-update migration. |
| Home, routine CRUD, weekly/multiple daily schedules | Daily-plan, calendar and consistency helpers; scheduling components; routine edit/reorder persistence; shared-plan activity round trip. | Complete create/edit/delete/undo/cancel/back sequence at all target viewports. |
| Active workout and every set mode | Existing workout input, warmup, top/backoff, superset, progression, per-side, readonly/undo, timed completion and finish tests; shared clock/lifecycle source reviewed. | Trusted keyboard/touch input, interrupted sessions and large/long-label routines on actual devices. |
| Workout/rest timers, inactivity and sounds | Deadline recovery, serialized restore, suspension regression, 24 sound presets, existing native-bridge/coalescing and inactivity tests. | Actual audio, app termination, background/lockscreen and notification cleanup on phone. |
| Pause/resume training, history, streak, consistency | Pause/history/daily-plan tests and shared date calculations; CSV fixes; fatigue monotonic/deletion probes. | Calendar/date/timezone interaction during actual lifecycle changes and visual achievement states. |
| Stats, exercise progress, PRs, body records | Existing calculation/component tests, routine-duration, body-record, recovery and history suites. | Every displayed metric against a representative populated UI; full edit/cancel/reopen and empty/large states. |
| Calendar, PNG/PDF/full reports | Existing calendar/report/export tests and current export source; revised CSV tests. | Browser-produced PNG/PDF/download/share, page appearance and print layout. |
| Health & wearables | Activity merge tests; Android adapter and read-only HealthActivitiesPlugin source. It imports exercise sessions from Android 14+, not sleep/HRV/routes. | Permission grant/revocation and actual provider sync on a supported Android device. HealthKit/direct vendor connections are unavailable. |
| Backup/cloud/persistence | Strict backup checks, merge regressions, ordered native writes, IndexedDB mirror, migration and preserved preferences tests. | Actual Drive restore/sync with authorized test profiles; offline/termination/update recovery. No live private cloud data was accessed. |
| PWA/service worker/updater | Worker VM tests, cache exclusions, build metadata, version/trust validation and existing update tests; production web/PWA build succeeds. | Installation, true offline relaunch, waiting-worker activation and previous-installed-version update in browser. |
| Library, settings, profile, optional API/admin | Routing/state architecture, settings controls, API tests and MCP read-only calculation imports. | Complete interactive path/state matrix, including admin/server-connected surfaces where applicable. |
| Copy, design, responsiveness, accessibility | Locale parity/source checks, targeted ES/EN copy, shared CSS tokens, reduced-motion rules, named controls and keyboard component assertions. | Word-by-word rendered ES/EN review; 320/360/375/390/430, tablet, desktop and large screens; Dark/Light/reduced-motion; contrast, focus, safe areas and keyboard occlusion. |

## Actual verification

- Fresh baseline: **969 frontend tests / 101 files passed**. New regression cases were run against the old implementation and failed before the fixes.
- Final local suite: **994 frontend tests / 103 files passed**, including 25 added cases. API: **10 passed**. MCP: **37 passed**; plain Node import graph passes.
- `pnpm install --frozen-lockfile`: exit 0, installed dependencies already match the lockfile. Optional pnpm version-metadata lookup emitted a certificate-chain warning; TLS verification was not disabled.
- Locales: **12 packs / 1534 keys** in sync; **1016** source strings covered. This verifies key coverage, not word-by-word editorial acceptance.
- Fatigue probe: **108000** monotonic and **14076** deletion comparisons passed. All **24** sound clips validate.
- `pnpm build`, `pnpm build:pwa`, `pnpm build:mobile`: **passed**, with final Capacitor synchronization. Existing large-bundle and ineffective dynamic-import warnings remain. Windows skipped CocoaPods/Xcode; iOS was not compiled.
- No frontend lint/typecheck scripts exist. They were **not run or claimed passed**.
- Android: loaded JDK/SDK variables from User, retained Windows-ROOT TLS configuration, and ran Gradle offline with `--no-daemon :app:assembleDebug :app:lintDebug`. **Failed: SDK location not found** (20 seconds). The explicitly verified path and normalized User paths are absent to this process; JDK exists. No SDK/toolchain was downloaded or duplicated. Current APK and Android lint are unverified.
- `git diff --check` passes. Only intended source/tests/docs appear in status; generated assets/logs/checkpoint stay ignored. Added diff lines have no private-key/token credential-pattern matches. This is a scoped hygiene check, not a comprehensive security certification.

## Second pass and remaining work

The local changes received a second diff/data-flow review and the full applicable automated suite after the targeted fixes. This is **not** the requested second complete app audit: the UI could not be exercised even once. `cua` inventory returned no browsers, IAB was unavailable, and native Computer Use failed twice with a missing native pipe. No unsupported browser workaround was used.

Under the user's subsequent publication instruction, validate the candidate on the existing CI, then publish a new immutable 1.15.31 release and verify its remote SHA, Actions, APK/manifest/signature and matching PWA metadata before confirming notification submission. Keep 1.15.30 intact. The UI matrix and actual user-flow checks above remain follow-up work using disposable test profiles; real device update preservation and notification receipt cannot be inferred from successful CI or FCM acceptance.

Primary changed paths: `frontend/src/lib/state-merge.js`, `backup.js`, `activities.js`, `health/normalize.js`, `plan-share.js`; `frontend/src/store/useUI.js`; `frontend/src/views/History.jsx`, `Home.jsx`, `RoutineEdit.jsx`; `frontend/src/components/RestoreSheet.jsx`, `Activities.jsx`, `ui.jsx`; `frontend/src/sheets.jsx`, `index.css`, `locales/es.js`, `lib/english-fallback.js`, accompanying regression tests and `docs/ARCHITECTURE.md`. Resume checkpoint: `.codex/tgym-progress.md`.
