# Session origin and daily activity correction

Branch: `feature/session-origin-activity`. Scope: the requested origin, activity, consistency and streak correction. Published as [1.15.48 / Android84](https://github.com/Truesilverking/TGym/releases/tag/v1.15.48) from `91d5d26dd344471a242b5826c8414abfe20bbe34`. See `RELEASE-AUDIT-1.15.48.md` for artifact and production-upgrade verification.

## Data flow and changes

- `api/session-activity.js` owns pure session-origin/activity rules. Frontend uses an adapter with existing workout-model row mode/phase helpers. API reminders use the same rules; GET/PUT profile endpoints persist the workout JSON without stripping origins (active sessions remain device-local); parity tests cover standalone API versus frontend mode handling. Docker COPY instructions include the shared module and reminder dependencies.
- `beginWorkout` captures `sessionOrigin: {type, routineId}` when the session starts. Prebuilt routine starts are planned; unscheduled freestyle starts are extra. The completed snapshot retains the origin. Active/history edits through `useStore.update` preserve it, including changes to routine identity, name and exercise content.
- Existing manual/imported activity edits preserve their own session origin instead of attaching the same session to a new pending routine. Serialized local storage, web/native mirrors, portable backups and atomic cloud workout merging retain the field. Legacy active sessions receive an additive origin on restoration; keys, schema number and native package identity stay unchanged.
- Legacy routine IDs provide stable historical classification. Unique legacy name matches remain compatible; ambiguous names cannot complete a scheduled slot. No exercise-list comparison or historical workout-content rewrite is used.
- Valid activity requires a performed non-warmup row with positive recorded repetitions/time, including partial unilateral confirmation. Pending, empty, zero-result, active, canceled and duplicate-ID records do not advance activity metrics. External load is not required for bodyweight or cardio/time work.
- `dailyPlan` separates scheduled slot completion, planned/extra session counts and an activity flag. Prebuilt sessions on a changed/rest calendar date remain planned. Extra sessions cannot complete another routine's pending slot.
- Consistency is `activeDays / (activeDays + missedDays)`. Dates are deduplicated; evaluated scheduled days without valid activity supply the denominator's missed days. Today's valid activity is included immediately; unfinished today/future days remain pending. Planned/completed/missed/extra session counters are displayed separately.
- The training streak advances once per valid activity date, including extra activity. Missed scheduled dates still break it; rest/pause dates without training remain neutral and pending today does not erase yesterday's run. The detail sheet includes extra activity dates. Progress's explicitly named consecutive-calendar-day streak keeps its previous temporal definition while using the shared activity predicate.
- Home/Stats cards, Heatmap, calendar cells and Progress/PDF summaries use the same origin/activity rules. Added exercise rows are never counted as additional sessions.

## Required acceptance cases

| Case | Evidence and result |
| --- | --- |
| 1. Complete unchanged prebuilt routine | Origin planned; planned 1, extra 0, active day 1, daily rate 100%, streak 1. |
| 2. Add three exercises | Same session ID/origin; planned 1, extra 0. Unit, store integration and actual Chromium/WebKit UI flow. |
| 3. Substitute/remove exercises | Replacement and removal tests retain one planned session; no additional record. |
| 4. Change sets/reps/load/rest | Prescription edits preserve origin; row mode and activity remain independent. |
| 5. Finish planned, start separate unscheduled session | Actual browser Start → Freestyle flow creates a separate extra session; planned 1 + extra 1. |
| 6. Planned and extra on same date | Active day 1, daily rate 100%, streak 1. Both session counters retained. |
| 7. Extra-only valid activity | Advances streak and daily consistency, even if the scheduled slot remains pending/missed. Calendar reflects activity; scheduled slot counter is independent. |
| 8. Edit without false extra records | Start/edit/finish store integration asserts one record; origin overwrite attempts during active/history edits are preserved as planned. |
| 9. Reload/reopen | Serialized migration/replacement, backup/cloud roundtrip, mocked native mirror recovery, two-browser reload and Chromium offline reload preserve classification. |
| 10. Home/Progress agreement | Home and shared Home/Stats card/component tests, Progress screen/export tests, actual Home/Stats/Progress browser checks and inspected screenshots. |

Adjacent tests also cover duplicate IDs, empty/pending/warmup-only/canceled activity, legacy identity ambiguity, multiple scheduled routines, schedule/deletion edits, rest/pause/pending-today semantics and independently deployed API reminders.

## Local validation

- Complete frontend suite: 1264/1264 tests in 130 files. Targeted origin, persistence, screen and calendar checks also passed.
- API: 11/11 tests. MCP: 37/37 tests plus plain-Node import-graph validation.
- Web, PWA and mobile asset/synchronization builds passed. Local Android `assembleRelease lintRelease` passed with JDK 21/SDK 35. `build:mobile` itself is not APK compilation. Android lint reports 18 warnings and zero errors; existing SDK/flatDir and bundle-size warnings remain.
- Locales: 12 packs, 1689 keys each, synchronized; 1078 used translated strings present; Spanish UI audit passed.
- Actual isolated browser flow passed in Chromium/Edge and WebKit at 390px: start planned, perform work, add three exercises, reload, finish, inspect Home, start/finish separate freestyle, inspect Home/Stats/Progress and reload. Planned 1, extra 1, active day 1, daily rate 100%, training streak 1. Chromium also passed offline reload. Responsive overflow checks passed at 320/390/768/1280px.
- Inspected Home and Progress screenshots and a separate Spanish Home rendering: `Planificado 1`, `No completados 0`, `Adicional 0`, `Días activos 1`, `Cumplimiento 100%`, flame count 1. Browser profiles were synthetic and isolated. Standalone Vite development was also tested successfully, including the shared module imported from the API directory.
- Native origin-recovery evidence uses the native-save adapter mock; it is not a physical-phone installation or notification receipt. No physical Android/iPhone validation is claimed. Docker images and iOS native compilation were not executed locally.
- No frontend lint/typecheck scripts exist; neither is claimed. Storage keys, updater integrity checks, signing material and package identity were not changed.

## GitHub verification

Runtime commit: [`f4ee04ad3bafc5c43075e72b2c22139473d15512`](https://github.com/Truesilverking/TGym/commit/f4ee04ad3bafc5c43075e72b2c22139473d15512). `git ls-remote` confirmed the branch matched this local commit after push. All three workflows succeeded on that exact source:

- [Tests 37099954603](https://github.com/Truesilverking/TGym/actions/runs/37099954603): frontend/API/MCP checks and web build.
- [PWA 37099954601](https://github.com/Truesilverking/TGym/actions/runs/37099954601): tests, standalone build and artifact.
- [Android 37099954600](https://github.com/Truesilverking/TGym/actions/runs/37099954600): mobile build, debug compilation/lint, background notification instrumentation on the emulator and report artifact.

A subsequent version-only commit publishes the same correction as 1.15.48/code84. Tests, PWA and Android/emulator checks passed on that exact tagged commit before publication. The public Chromium/WebKit flow also passes: editing a planned workout produces planned 1/extra 0; a separate freestyle session produces planned 1/extra 1 while active days and streak remain 1. No force push or default-branch merge was performed.
