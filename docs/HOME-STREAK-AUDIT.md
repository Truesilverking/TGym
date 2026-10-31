# Home streak audit

Date: 2026-10-03. Published release: **1.15.51 / Android versionCode 87**. Branch: `feature/home-streak-refresh`. Frozen source: `58e5e20496cf659338ffa4df8ba24c1d911bb758`.

**Published and independently verified.** Exact-source CI and public artifacts are recorded below and in [RELEASE-AUDIT-1.15.51.md](RELEASE-AUDIT-1.15.51.md). This report does not establish installation or behavior on the user's phone.

## Scope and available evidence

The user authorized working from the supplied Home screenshot without their real workout history. The image supplies visible counters, including a flame value of two; it does not establish workout dates, row results, session IDs, installed version or device timezone. No real profile or private backup was obtained, modified or used in tests.

The screenshot can be consistent with an older build: its completion label differs from the current daily-activity presentation. That is a candidate explanation, not confirmation of the installed version or the user's expected streak. The implementation must derive a result from recorded activity and the existing temporal rules; it must not assign four because four was requested.

## Classification and the synthetic four-day case

Session origin remains the source of truth. A planned session keeps its origin after adding, replacing or deleting exercises and after editing sets, repetitions, load or rest. Extra sessions are separate records. Neither class has to match an exercise template to establish activity.

The following dates are **invented test data**, not dates inferred from the screenshot or the user's history:

| Synthetic date | Independent sessions | Active dates contributed |
| --- | --- | --- |
| 2026-09-28 | One planned | 1 |
| 2026-09-29 | One planned plus one extra | 1 |
| 2026-09-30 | One extra | 1 |
| 2026-10-01 | One extra | 1 |

With positive confirmed work rows, a pause starting 2026-10-02 and evaluation on 2026-10-03, the shared calculations return **two planned/completed sessions, three extra sessions, four active dates, 100% daily completion and current/best streak four**. The extra session on September 29 does not contribute a second day. Paused dates do not break this streak.

Only a scheduled past date without valid activity breaks the Home training streak. Rest and pause dates remain neutral; an unfinished scheduled today remains pending. These existing temporal rules are preserved. Progress retains its separately labeled consecutive-calendar-day metric.

## Historical defect versus the new Home refresh defect

The old `trainingStreak` function at `e585d1c` marked unscheduled activity as `extra`, filtered it out of best-streak calculation and skipped it while counting the current streak. A read-only comparison extracted that exact function and supplied compatible shared helpers and a synthetic four-date/two-planned/two-extra profile: the old function returned two and the current function returned four. This was a function-level comparison, not a test of an installed historical APK.

The origin/activity correction published in 1.15.48 and retained in 1.15.50 already fixes that calculation. Current `trainingStreak` uses `dailyPlan.active`, which accepts valid planned or extra activity once per recorded date. `statisticsState` applies tracking boundaries and excludes active/canceled sessions, invalid/future dates and duplicate IDs. Valid activity requires confirmed non-warmup work with positive recorded repetitions or time. The new candidate does not alter these formulas or rewrite historical sessions.

A separate defect was confirmed in Home: its calendar calculations read `new Date()` when React rendered, but the idle screen had no subscription to a day or timezone change. Without a profile change or another render, it could retain the previous day's flame, pending/missed state and date-dependent cards after midnight or a suspended foreground return.

`lib/use-local-now.js` supplies an ephemeral render clock. It schedules local midnight, observes foreground visibility/focus/pageshow, and checks visible clock changes every 30 seconds. Its key contains the local date, timezone ID and UTC offset, including timezone changes that preserve the date and offset. Hidden checks do not trigger renders; timers and listeners are cleaned up. A source review also found a render-to-effect race: midnight or timezone could change after the render snapshot and before effect setup. The effect now compares against the key captured during render and immediately refreshes that gap; dedicated tests cover both transitions.

Home passes one clock snapshot to streak, statistics, next scheduled session, deload, pause state, week strip, DailyPlan and ConsistencyCard. ConsistencyCard accepts that snapshot while retaining its existing default for other callers. The clock invalidates React only: it does not call `useStore.update`, change persisted keys, migrate data, save a backup or write history. Recorded workout `d` remains the local start date captured when the session began; completing across midnight or subsequently changing timezone does not relabel it.

## Validation evidence

All profiles below are synthetic. Component tests use happy-dom with external network/media/mirror dependencies mocked; they exercise the real Home/store/finish path rather than a physical device.

| Check | Result and scope |
| --- | --- |
| `lib/training-streak.test.js` | **21 passed.** Exact two-planned/three-extra/four-date case; edited origin and serialized reopen; unchanged raw history; same-day and duplicate-ID handling; rest versus missed schedule; pending today; tracking boundary; warmup/zero/unconfirmed/active/canceled/empty rejection; recorded date across midnight. Separate native Node processes use Santo Domingo, New York, UTC and Tokyo timezones, plus the New York fall DST transition, without changing another Vitest worker's timezone. |
| `views/Home.streak.test.jsx` | **4 passed**, reported by the coordinator. Visible flame and counters; actual `doFinishWorkout` plus repeated finish; valid/zero-result edits and deletions; fresh store boot and Home remount from saved profile. |
| `lib/use-local-now.test.jsx` | **10 passed**, reported by the coordinator. Midnight; hidden/foreground return; focus/pageshow; timezone ID/offset and system-clock changes; quiet unchanged checks; ordinary rerenders; StrictMode cleanup; the render-to-effect race. |
| Full frontend suite | **1,362 tests passed in 139 files** on the frozen source. `.tools/streak51/frontend-final.log` records start time 14:05:57 on 2026-10-03 and a 9.80-second run. The exact-source Tests workflow also passed the same 1,362 frontend tests. |
| Real browser UI | Coordinator reports Chromium and WebKit checks showing flame four for the synthetic profile. Midnight checks keep flame four while paused, but reset it to zero when the prior scheduled date is missed; the four active-date consistency count remains four. These are browser-engine observations, not phone installation or native lifecycle acceptance. |
| Tests CI, API and MCP | [Tests 37143065787](https://github.com/Truesilverking/TGym/actions/runs/37143065787) **passed** on the frozen source: frontend 1,362, optional API 11 and MCP 37, as verified by the coordinator. |
| PWA CI | [PWA 37143067228](https://github.com/Truesilverking/TGym/actions/runs/37143067228) **passed** on the frozen source, as verified by the coordinator. This validation does not establish production Pages publication. |
| Local web/PWA/mobile builds | Final web, standalone PWA and mobile asset/Capacitor synchronization builds **passed**, reported by the coordinator. |
| Local Android compilation/lint | `assembleRelease lintRelease` **passed**: `.tools/streak51/android-final.log` records `BUILD SUCCESSFUL in 17s`. The final release lint XML contains **18 warnings and zero errors**. This is local build evidence, separate from signing/updater publication and Android CI. |
| Android CI | [Android 37143068449](https://github.com/Truesilverking/TGym/actions/runs/37143068449) **passed** on the frozen source: debug build/lint and 11 Android35 emulator instrumentation tests. |

There are no frontend lint or typecheck scripts. `build:mobile` synchronizes Capacitor assets and is not APK compilation. Native Android build/instrumentation, APK signature/update validation, publication and physical installation are separate evidence.

## Release record

| Item | Final evidence |
| --- | --- |
| Source branch | `feature/home-streak-refresh` |
| Final source SHA | `58e5e20496cf659338ffa4df8ba24c1d911bb758` |
| Version/versionCode consistency | **Verified:** `frontend/package.json` version 1.15.51; Android `versionName` 1.15.51 and `versionCode` 87. |
| Complete frontend suite | **Passed:** 1,362 tests / 139 files; `.tools/streak51/frontend-final.log`. |
| Exact-commit Tests | [37143065787](https://github.com/Truesilverking/TGym/actions/runs/37143065787) **PASSED:** frontend 1,362 / API 11 / MCP 37. |
| Exact-commit PWA validation | [37143067228](https://github.com/Truesilverking/TGym/actions/runs/37143067228) **PASSED**. |
| Exact-commit Android CI | [37143068449](https://github.com/Truesilverking/TGym/actions/runs/37143068449) **PASSED**, 11 emulator tests. |
| Local builds | Web/PWA/mobile assets **passed**. Android `assembleRelease lintRelease` **passed**, 18 warnings / zero errors. |
| APK package/signing identity, SHA-256 and updater metadata | **Verified:** public GitHub/Pages APK hashes match, package `app.framegym.mobile`, 1.15.51/code87, APK v2 signature and previous official certificate retained. See release audit for hashes. Actual updater offers 1.15.51 to 1.15.50 and does not reoffer the current version. |
| GitHub release/assets, served PWA version and update notification | [Release 37143481302](https://github.com/Truesilverking/TGym/actions/runs/37143481302) **PASSED**. Public release/assets, manifest and PWA identify the frozen source. Actual PWA50 -> 51 update preserves 33 synthetic history records and selected profile fields; offline reopen and published Chromium/WebKit Home flows passed. FCM accepted both update topics; physical receipt is unverified. |

## Limits

The image alone cannot prove the user's actual four training dates or explain every filtered historical row. Installed version, real history and device timezone remain unavailable; no historical repair was attempted. Physical Android midnight/foreground/timezone behavior and update installation are unverified. No real iPhone/iOS native compilation or device run was performed. This focused change does not establish live authenticated API/Drive synchronization, notification delivery or comprehensive acceptance of every TGym feature.
