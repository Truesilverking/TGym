# Functional audit - 2026-10-01

Candidate: TGym 1.15.44 / Android 80, feature/dashboard-visual-polish. Baseline: 21ed80e (published 1.15.43). This is an audit of the current implementation and available automated flows, not a guarantee that every device or external service is defect-free.

## Corrected data flow

Exercise configuration in `frontend/src/sheets.jsx` uses the same Back-off offset resolver as `frontend/src/lib/training-plan.js`. Session creation (`buildSets` -> progression prescription -> `applyTrainingPlan`) and edits (`Workout.setField` -> history cascades) now share weight/repetition derivation. Normal edits still call `useStore.update`; completed history still uses `buildCompletedWorkout`.

- Editor default could display +2 while persisting +0; inferred legacy zero could display +2. One resolver now defines displayed, saved and applied offsets, including explicit zero.
- Legacy unilateral offsets are stored as both-side totals: the 0-5 visible-rep limit is scaled accordingly, avoiding halving/clipping the configured offset.
- Automatic reps = edited Top reps + offset, bounded by the configured Top range shifted by that offset. Initial values use the upper bound, as TGym already does. With automatic reps disabled, the independent Back-off range supplies its own upper-bound initial value and Top rep edits leave it unchanged.
- Weight = Top load minus configured percentage (1-50%), rounded to the exercise increment. Initial generation and edits now agree even for small/zero loads. Rounding cannot raise Back-off load above Top load. Cleared Top load clears pending derived load instead of coercing it to zero.
- Pending cascades stay within a contiguous Top block and following Back-off block. TGym's editor creates one such block per exercise, potentially with multiple Tops. The most recently edited Top controls that block; completed/partially completed rows and manually edited fields remain protected. No cross-exercise association, name lookup, new index table or dangling persisted reference is introduced.
- Pending Back-off UI identifies automatic fields; manual fields retain their values after serialization, reopen and finish/history. A visual review caught and fixed a grid-column displacement from this hint.
- Repetition bounds normalize incomplete/inverted legacy targets into a valid integer range.
- Consistency no longer adds undefined extras for untracked days (which produced NaN).
- Progression reads unique, non-cancelled/non-active workouts in chronological order rather than import order; malformed empty entries are ignored.
- Plan import recognizes role-specific RIR min/max targets, including zero, when enabling effort logging.

## Audit coverage and source of truth

| Area | Source / invariants | Evidence |
| --- | --- | --- |
| Routines, schedule, order | routine IDs, `routine-order.js`, `daily-plan.js`; presentation order separate from week/day assignments | Unit suite; arrows/boundaries/info/open/reload/offline flows; edit/delete/undo flow |
| Exercises, warmups, work, Top/Back-off | `history.js`, `training-plan.js`, `warmup.js`, `workout-model.js`; warmups excluded from required work/progression | Critical new derivation tests, new/existing history seeding, group isolation, manual protection and Workout integration |
| Reps/load/RIR, progression | target snapshots and actual set rows, `workout-input.js`, `progression.js` | Range and rounding boundaries, actual edits, chronological/deduplicated history, imported RIR tests |
| Supersets and rest | existing pairing helpers and `rest-policy.js`; saved rest deadline | Full suite covers pairing/order/policies and native notification invariants; no changes to those helpers |
| Workout clock, completion, history | `workout-time.js`, `workout-lifecycle.js`, `finish-workout.js`; same persisted active/history boundary | Full lifecycle suite and browser recovery/finish; Back-off UI edit/reopen/finish/history test |
| Home, This Week, calendar, Consistency | stable IDs and `daily-plan.js`, calendar data, training-history boundaries | Full suite; corrected untracked-day aggregation; calendar PNG/PDF browser export |
| Stats, Progress Report | `progress-report.js`, session filtering and routine -> exercise groups | Eight sections x five widths, rich/empty profiles, period combinations, disclosures, selected/multiple/all PDF exports in Chromium/WebKit |
| Measurements, InBody, reminders | dated records, units, IDs, legacy fields in body-records/body-report/reminder modules | Existing full tests include edits/deletion, incomplete dates/values, comparisons, reminders and shared body model |
| Replay Tour | ephemeral UI preview; no fake persisted session | Twelve steps, Back/Done/Replay/Skip, six sizes, light/dark/reduced motion, new/existing profiles in both engines; data equality assertions |
| Persistence/backup/cloud | `useStore.update`, localStorage, queued file/IndexedDB mirrors; portable checksummed backup | Store/migration/backup/cloud tests; browser reload/offline, restore/import/undo. No real cloud-account mutation performed |
| PWA/offline/update | service worker shell/cache and separate profile; trusted update URLs/hash/package/signature/version checks | Offline shell/reload and data writes in Chromium; WebKit local offline edits; updater suite. Release artifact/updater checks recorded separately after publication |

## Validation

- Final full frontend suite: 1,225 tests /126 files passed. Affected Back-off/history/Workout suite: 179 tests passed, including new/existing-user seeding.
- API10 and MCP37 plus Node-loadability passed. Locales/source strings/version checks and fatigue probes (108,000 monotonic +14,076 history-edit comparisons) passed.
- No frontend lint or typecheck scripts exist. Android lint is a separate check.
- Production/PWA/mobile builds passed with exit 0. Clean Android release/lint passed; final synchronization and rebuild also required before publication. Android lint: 0 errors, 18 existing warnings (dependency/resources/icons/FCM token callback); none caused by these JavaScript changes.
- Chromium and WebKit Back-off input/cascade/manual/reload/offline persistence at 320/360/375/390/430 and 844x390 passed.
- Chromium onboarding/offline reopen, workout recovery/finish, routine edit/delete/undo, backup/import/undo, calendar PNG/PDF and activity edit flows passed.
- Downloaded PDFs opened and rasterized successfully: empty/selected 1 page, multiple sections 2 pages, full synthetic history 24 pages. All full-report pages and empty report visually inspected; no corrupt/blank pages or clipped components observed. PDF pages use raster dashboard content, so text-extraction-only validation is inappropriate.
- Test-browser teardown hung after completed assertions on Windows; the owned QA harness now bounds teardown waits. This is not counted as an application failure or as device coverage.

## Compatibility and publication limits

No physical phone detected by ADB during this run. WebKit is desktop automation, not real iPhone Safari/Home Screen validation. Native user notification delivery, physical installation and a real cloud account remain unverified. Existing bundler chunk/dynamic-import and Android dependency warnings are disclosed in release evidence. No persistence schema, keys, native package identity, signing identity or historical records were migrated or rewritten.
