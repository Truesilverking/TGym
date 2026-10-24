# Workout / routine UX audit - 2026-09-28

Candidate: 1.15.41 / Android77, feature/dashboard-visual-polish. Scope is the six requested workout/routine/calendar changes.

## Changes and data flow

- Warm-up, Top set and Back-off use the same phase element/style. Normal exercises receive one Working sets heading; top/back-off exercises do not receive a redundant working heading.
- New-set RIR initialization uses the lower bound of the applicable role's range. Fixed targets and zero remain valid. Actual saved/history RIR values, manual edits, range advice and the legacy scalar target API retain their semantics. No existing recorded RIR is reseeded.
- RoutineList supports a 2.5-second hold, drag target/preview, optional existing vibration and edge scrolling. Scroll/cancel abort pending holds, drag suppresses accidental navigation/deletion, and normal swipe-to-delete remains available. Explicit move-up/down controls provide a keyboard and touch alternative.
- Presentation order is stored separately in `routineOrder`. Additive migration normalizes existing IDs, removes stale/duplicate references and appends new routines. The original routine array, schedule, history and active workouts are untouched. Portable backups retain the field; conflicting cloud orders are treated atomically. Existing schema/storage keys remain compatible.
- A single pause/resume icon beside elapsed time replaces the detached timer controls. It uses the existing workout-time helpers, still prevents pausing during a running timed set and stops rest when manually pausing.
- Home reuses `nextScheduledWorkout` and `nextDailyRoutine`: completed/canceled/active distinctions, rest days and date overrides follow the existing calendar. The label becomes Tomorrow or the actual date. Opening a future item opens its calendar date without prematurely starting a session. An active session still wins.
- Untracked calendar cells previously depended on undefined `--fill` plus reduced opacity. They now use an existing surface and border. All twelve months/day cells remain rendered. Calendar PDF/export generation is unchanged.

## Verification

- Full frontend suite: 1195 tests / 123 files passed. Targeted coverage includes fixed/ranged/zero/role RIR, manually edited values after reopen/history, added sets, identical phase labels, paused elapsed persistence, two/five/twenty/thirty routine cases, native touch event long press, swipe/cancel/click suppression, backup/migration/cloud conflict, tomorrow/rest/empty/active/canceled Home cases, 365/366 cells and mid-month/year tracking.
- API10; MCP37 and plain Node loadability passed. Final versioned web, PWA and mobile production builds passed; Capacitor synchronized. Local Android assembleRelease and lintRelease passed: package app.framegym.mobile, version1.15.41/code77; zero lint errors and22 existing warnings. Final targeted checks passed41 tests. No frontend lint/typecheck scripts exist.
- Real Opera production-build UI on an isolated synthetic profile: 60 combinations of Home/routine/plain/warm-up/top-backoff, dark/light with red/sky accents, 320/360/375/390/430 widths and 844x390 landscape. No horizontal overflow. Desktop iframes are responsive evidence, not iPhone emulation.
- Phase geometry at320: identical 28px height, 251px width, 11px font and 4px/8px padding. Normal/warm-up/top-backoff headings confirmed from rendered DOM.
- Browser verified Tomorrow/Lower A, reorder via accessible controls and reopen, RIR1 manually changed to3, pause/resume and reopen. With the local server stopped, root reload retained edited RIR and paused timer; routine order was edited and retained again after reload. No app console warning/error in the final isolated run. This is origin-offline, not airplane mode.
- Annual calendar rendered12 months/365 cells; January's31 untracked cells had nonzero geometry and an opaque background. Representative narrow dark calendar and light routine screens were visually reviewed.
- QA fixture isolation was corrected so an outgoing tab could not overwrite the next fixture. An initial temporary server header error was fixed in ignored QA tooling; neither issue was application code. An assertion expecting null instead of the existing resume helper's deleted property was corrected without changing clock logic.
- Follow-up visual correction removes the swipe-delete red seam from expanded reorder controls. Final versioned builds, Android validation and exact-SHA CI/publication results are recorded in the release audit.

## Limits

Physical iOS long-press/haptics, installed iPhone PWA and actual mobile keyboard/gesture behavior remain unverified: the available Windows/browser control cannot operate the connected iPhone. The previously explicit user decision to proceed without physical iPhone validation remains in effect; no hardware coverage is claimed. Automated touch events are not a physical-device gesture test. Existing Vite chunk/import and Android lint warnings are not claimed resolved by this scoped update.

Evidence: ignored `.tools/ux41/` and `.tools/browser-audit/ux41-*.log`. No user training data, credentials or build artifacts are included in Git.
