# TGym architecture

Current published source: `48dc3a1` (1.15.31), with corrections described in `docs/PRE-RELEASE-AUDIT-2026-09-25.md` and exact-commit CI/publication evidence in `docs/RELEASE-AUDIT-1.15.31.md`. The user authorized publication using automated verification; the full visual/device audit remains incomplete. Older release reports below are historical evidence.

## Repository and runtime

`frontend/` contains the React 19 application, Vite build, assets, tests and Capacitor Android/iOS projects. React Router 7 handles navigation and Zustand 5 holds application state. `api/` is an optional Node HTTP backend with WebAuthn and web-push. `mcp/` exposes read-only tools and imports pure frontend calculations. `web/` supplies the nginx/container layer; `website/` is separate website material. GitHub Actions are in `.github/workflows/`.

`frontend/src/main.jsx` mounts React in StrictMode. `App.jsx` supplies the HashRouter, boot effects, app lock, update handling, tabs, timers, sheets and toast infrastructure. The same React application is bundled for the server-backed web mode, standalone PWA and Capacitor mobile mode. Mobile persistence and integrations are selected by the mobile adapter, not a separate workout UI.

## Navigation and file map

| Area | Main source |
| --- | --- |
| React entry and routing | `frontend/src/main.jsx`, `frontend/src/App.jsx` |
| Persistent state/defaults/boot | `frontend/src/store/useStore.js` |
| Ephemeral UI and rest timer | `frontend/src/store/useUI.js` |
| Home | `frontend/src/views/Home.jsx` |
| Routines and editing | `frontend/src/views/Plan.jsx`, `frontend/src/views/RoutineEdit.jsx` |
| Active workout | `frontend/src/views/Workout.jsx` |
| History | `frontend/src/views/History.jsx`, `frontend/src/lib/history.js` |
| Statistics | `frontend/src/views/Stats.jsx`, `frontend/src/lib/stats-insights.js` |
| Library/settings | `frontend/src/views/Library.jsx`, `frontend/src/views/Settings.jsx` |
| Calendar, measurements, finish/summary dialogs | `frontend/src/sheets.jsx` |
| Calendar status/export | `frontend/src/lib/calendar-data.js`, `frontend/src/components/CalendarExport.jsx` |
| Workout schema/time/lifecycle | `frontend/src/lib/workout-model.js`, `workout-time.js`, `workout-lifecycle.js` |
| Progression/deload | `frontend/src/lib/progression.js`, `frontend/src/lib/training-plan.js` |
| Backup/cloud/native restore | `frontend/src/lib/backup.js`, `cloud-sync.js`, `native-state.js`, `mobile.js` |
| Updates | `frontend/src/lib/app-update.js`, `app-meta.js`, `frontend/src/components/AppUpdate.jsx` |
| Localization/styles | `frontend/src/lib/i18n.js`, `frontend/src/locales/`, `frontend/src/index.css` |
| Ordered daily schedules, activities and training breaks | `frontend/src/lib/daily-plan.js`, `activities.js`, `training-pause.js`, `components/DailyPlan.jsx`, `components/Activities.jsx` |
| PWA mirror and additive migrations | `frontend/src/lib/web-state.js`, `state-migrations.js` |

Routes are `/home`, `/plan`, `/plan/r/:id`, `/workout`, `/stats`, `/history`, `/library`, `/settings` and admin-only `/admin`. Main tabs expose Home, Routine, Start/Resume, Stats and Exercises. Calendar and measurements are sheets, not standalone routes. Nested dialogs/sheets share UI state and back handling.

## State, models and storage

`useStore` owns `S`. Defaults include units, language/theme, rest/reminder settings, routines, weekly schedule, date overrides, workout history, active workout, exercise preferences, bodyweight, measurements, InBody records and cloud settings. Updates clone the state, reconcile workout edits, write synchronously to localStorage key `gym_state_v1`, then schedule native/server synchronization. `_ts` supports freshness comparisons.

- Routines have stable IDs and exercise prescriptions. Schema 3 stores ordered routine-ID arrays in `week` and `dayPlan`; an empty array explicitly means rest. Legacy scalars normalize additively. `daySkipped` records intentional per-date omissions. Daily completion requires every scheduled routine, with one legacy name match consumed only once.
- Active workouts contain `id`, `d`, `start`, `routineId`, name, unit/bodyweight snapshot, current entry, deload state and entries. Entries refer to exercise IDs and carry prescription/plan, superset grouping and set rows.
- Set rows distinguish warmup/work, top/back-off role, repetition/time/cardio data, load, effort (RIR/RPE), completion and completion timestamp. Drops and rest-pause clusters are intensity data, not extra independent exercises. Legacy warmup/mode representations remain supported.
- Completed workouts add the finished clock, saved exercise metadata/notes and computed summary fields. Inactivity completion can retain a resume snapshot.
- Bodyweight uses dated weight records. Measurements use dated circumference fields, including left/right values with legacy arm/thigh/calf fallbacks. InBody records may include an image.

On mobile, state is mirrored to `framegym-state.json` in Capacitor's private data directory, normally with an 800 ms debounce. Pause/Continue transitions enqueue a native write immediately; writes serialize immutable snapshots so an older write cannot finish after a newer snapshot. Visibility loss and `pagehide` flush pending writes. Boot compares the native mirror and browser state before restoring. The standalone PWA separately mirrors snapshots in IndexedDB (`tgym-profile` / `snapshots`); this data is outside service-worker asset caches. Remote pairing configuration is separate from the workout file. Mirror write failures retain the localStorage fallback; this is not a guarantee against a device being killed before an asynchronous write completes.

The optional API stores per-user JSON state and account/credential/subscription records under its data directory; state writes use temporary-file replacement. Authentication uses WebAuthn and signed sessions. Mobile can pair with this server; otherwise it operates locally. A remote pull respects dirty local state and preserves an active local workout.

## Workout flow

Routine/schedule selection in `sheets.jsx` creates an active workout from the next prescription. Progression, warmups, top/back-off plans, deload and intensity planning shape the set rows. `Workout.jsx` edits/logs those rows. Completion saves history, updates exercise defaults, computes personal records/volume, clears the active workout and shows the summary.

`workout-time.js` is the shared elapsed clock: end or provisional pause bounds elapsed time, with accumulated paused duration subtracted. `workout-lifecycle.js` reconciles meaningful row edits, detects completion of required non-warmup rows, pauses after the final row and resumes after additional work/unchecking. At load, persistence and background boundaries, completed work missing its pause is repaired using recorded completion/activity timestamps (or start when no timestamp is available), never time spent away. Explicit Continue persists `timerContinuedAt`, preventing that repair from re-pausing intentionally resumed work. Reopening the workout route restores its Finish/Continue decision without duplicate sheets. Inactivity protection warns at 20 minutes and auto-finishes at 30 using last meaningful activity rather than adding the grace interval. Tests cover serialization, background repair, native-mirror boot and ordered native writes; a real device process-kill scenario remains unverified.

Progression supports off, linear, Greyskull, double and timed modes. Warmups and planned deload sessions do not drive ordinary progression. Required effort information can hold progression. Rest-policy and superset helpers decide inter-set/round behavior separately from workout duration. Work timers and rest timers have their own notification needs.

Completed set rows render read-only summaries until explicitly undone. Per-side confirmations retain their own flags; legacy total repetitions and explicit `repsPerSide` targets remain distinct. `active.restTimer` persists a deadline and total duration, never ticking seconds. It is removed from completed history. Early work-timer completion also derives elapsed time from its deadline so suspended render ticks cannot undercount a set.

## Calendar, history and statistics

The shared calendar sheet supports week/month/multiple-month/year views, date scheduling, deload context and measurement reminders. Calendar export uses dedicated SVG report pages, rasterized at 2x and fitted proportionally into jsPDF pages. Year PDFs have three four-month pages; full reports add a twelve-month overview. Calendar day completion can mean any workout that day, while routine consistency matches the scheduled routine (ID, or a legacy name fallback); these are different metrics.

History feeds statistics, progression and workout detail. Routine consistency examines planned/completed/missed/extra sessions over its window. Other cards derive streak/frequency, exercise/muscle effort, bodyweight and measurement trends. Time summaries use the shared clock. `validTimedSessions` requires finite recorded start/end, a positive elapsed duration and consistent pause bounds; it excludes active/cancelled and duplicate sessions. Valid long sessions and sub-minute sessions are retained. IDs deduplicate records, with a content-based fallback for ID-less imports.

`components/RoutineDuration.jsx` shows mean, median and sample count for each routine, with its own 1M/3M/1Y/All rolling period filter (90 days initially, based on start time). `routineDurationSummary` groups by routine ID, retaining identity through renames and separating same-name routines. ID-less legacy sessions form separate name groups; unnamed sessions display Freestyle. Current routine names take precedence over saved names. Future starts are excluded. Other Stats cards retain independent filters. The new strings have Spanish translations and explicit English fallback elsewhere.

The duration card wraps names and aligns numeric values with tabular numerals using existing theme variables. Headers now wrap their action row on narrow screens. Existing OS/app reduced-motion rules apply. The full 320/360/375/390/430 dark/light/reduced-motion visual matrix remains pending: the continuation session could not obtain a connected browser, and Windows Computer Use stopped because it could not confidently determine Opera's URL. Component tests do not establish rendered layout quality.

## Backup and cloud

Full backups use a versioned `tgym_backup` envelope, creation metadata and CRC32 checksum (integrity check, not a cryptographic signature). Validation and portable-state cleanup exclude sensitive/transient configuration. Import also recognizes legacy FrameGym/openGym formats. Plan sharing carries routines, schedule and custom exercises with ID remapping when merged.

Google Drive backup uses app-data access, a backup file and bounded daily snapshots. Automatic backup combines dirty-state timing and periodic age checks. Tokens are not meant to travel inside portable backups. Restore/merge has conflict handling and undo support; array identity prefers stable identifiers and known date fields. Conflicting workouts, active sessions and ordered routine exercises are whole-snapshot choices, preventing duplicate sets and inconsistent derived totals. Ambiguous legacy collections require a choice; conflict paths retain ID segments and resolve array records by identity. Explicit null edits are distinguished from absent legacy fields. A remote timestamp check protects against blindly overwriting newer cloud data. Do not equate this with real-time multi-user database synchronization.

## Android and notifications

Native code is under `frontend/android/app/src/main/`. Application/namespace identity remains `app.framegym.mobile`; the product name is TGym. The current release is 1.15.31, versionCode 66; min SDK 23, compile/target SDK 35, Gradle 8.11.1 and CI JDK 21. Its exact source commit passed Android build/lint, nine emulator tests and signed-release validation in GitHub Actions.

`MainActivity` registers Google Drive authentication, update push, installer and workout notification bridges. The foreground workout service uses native chronometers and persisted notification state. Notification taps target the activity with `tgym://workout`; React handles that navigation. This is not proof of a general externally browsable deep-link manifest filter.

Permissions cover networking, notifications, foreground special-use service, package installation requests, camera and exact alarms. Workout/reminder/update channels serve distinct flows; update push uses topic/channel `tgym_updates`. Native notification behavior and process lifecycle require device/emulator testing. `HealthActivitiesPlugin.java` implements opt-in, read-only Health Connect exercise imports for Android 14+, limited to 30 days and 5000 records. It does not import routes, sleep, HRV or physiological measurements. The separate daily-health normalization helpers are not proof of those native integrations. HealthKit/direct vendor integrations remain unavailable.

Signing and Firebase files are optional local/CI configuration and must not be exposed. Web/mobile sync does not prove Android compilation. Release signing cannot be recreated without the owner's signing material.

## PWA and update pipeline

The PWA manifest and generated service worker support installation, asset precaching and navigation offline fallback. API, update and download traffic are excluded from ordinary asset caching. Service-worker registration requires a secure context and a production non-mobile build; development-mode browser rendering does not validate production offline behavior.

The updater checks trusted release metadata, compares versions and supports foreground/manual/periodic checks. Android downloads enforce trusted HTTPS locations and redirects, size limits, SHA-256, package identity, newer versionCode and signer compatibility with the installed application before handing off to the system installer. The user may need to grant installation permission. PWA updates instead activate a waiting service worker and refresh. Backups precede update handoff where implemented. FCM prompts a fresh update check rather than bypassing validation.

## CI, testing and builds

- `test.yml`: frontend tests/build, locale/source-string checks, fatigue probe and MCP checks using the repository's package-manager choices.
- `android.yml`: Capacitor/Android build and scoped app instrumentation with emulator API 35 and required CI configuration.
- `release.yml`: version-tag release validation, tests, web/native assets, signed APK/AAB, checksums/update metadata, GitHub release/Pages publication and update notification sequencing.
- `pages.yml`: Pages-related validation.
- `docker-publish.yml`: container publication for its configured main/release events.

Frontend Vitest covers pure calculations and happy-dom component behavior; API and MCP have Node tests. Android instrumentation is distinct from JS unit tests. Do not describe the JS suite as complete real-device E2E coverage.

Local verification on 2026-09-20: frontend 728 tests in 69 files, API 6 and MCP 36 passed; MCP loadability, locale/source-string/version checks and fatigue probes passed. Web, standalone PWA and final mobile asset/sync builds passed. Vite reported large chunks and ineffective dynamic imports. Capacitor skipped CocoaPods/Xcode steps on Windows; this is not an iOS compilation. No lint/typecheck scripts exist. The environment used Node 24.15.0 and pnpm 10.34.5 (CI uses Node 22); installed Vite/Vitest versions match the pnpm lockfile. Android final compilation and production PWA offline verification remain separate checks; see the local checkpoint for the current Android result.

Use pnpm's frozen lockfile for frontend work to match CI; do not arbitrarily update dependencies or regenerate alternate locks. API/MCP use `npm ci`. Relevant dependency categories are React/router/state, Capacitor native bridges, image/PDF/QR export/import and Vite/Vitest build/test tooling.

The initial final Android attempt failed with `SDK location not found`. The coordinator subsequently verified the final build using `--no-daemon`, User SDK/JDK variables and the Windows certificate-root configuration. Its log was read during the prompt audit: `BUILD SUCCESSFUL in 25s`, 186 tasks (20 executed, 166 up-to-date). This supersedes the Android compilation blocker. Visual/device checks remain pending; no visual matrix was marked passed.

The Prompt 1/2 audit led to shared ConsistencyCard and consistency calculations, matching the scheduled routine by stable ID with a legacy name fallback. Completion is completed / (completed + missed); today and future pending days are excluded from the denominator. Next scheduled selection skips completed scheduled work. Home opens the shared Week/Month calendar; legends, truncation and report exports have component and data coverage. Browser-based visual acceptance was explicitly removed from the publication gate by the user after Computer Use failed.
