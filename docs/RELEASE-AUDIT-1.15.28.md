# TGym 1.15.28 active-workout audit

Version: 1.15.28 / Android versionCode 63. Scope: active-workout input, persistence, navigation, timer safety and set layout.

## Findings and corrections

- Strict-rep clamping ran on every typed value, rewriting actual results to the prescription. Manual reps now record the actual result for exact, range, free and AMRAP prescriptions; a separate target row retains the prescription. Plus/minus still respects strict targets when the current value is within them.
- Weight entry already supported decimals, but automatic forward/backoff/warm-up recalculation could overwrite an explicitly edited pending set or a partially completed unilateral set. Per-field manual markers now preserve those values. Added-load entry is available for bodyweight exercises even when the initial load is zero.
- Invalid text, negative values, overflow, fractional reps and out-of-range/non-half-step effort are rejected without replacing the last valid stored value. Comma decimals remain supported. Cardio minutes accept decimals; timed durations must be positive.
- The tab bar defined its button component inside render. Workout activity persisted during pointer capture caused those buttons to remount before the click, breaking navigation. Stable button rendering fixes this without changing routes.
- Timed-work callbacks referenced row indexes after structural changes. A generation guard cancels stale completion and delayed second-side callbacks when rows/exercises are changed.
- Legacy stepper classes conflicted with the current set grid, compressing effort controls. The revised local layout separates target/actual values, restores usable effort buttons, adds linked labels and invalid/focus cues, and preserves the global theme.

## Persistence and compatibility

No storage keys, exercise/routine identities or existing records are migrated or removed. Optional `manualFields` flags on sets and `logAddedWeight` on active entries use backward-compatible defaults. Normal persisted store updates, file mirrors and backups remain the source of truth. New workouts do not inherit manual-edit flags. Completed/partial-side sets are protected from automatic cascades; completion and volume calculations are unchanged.

## Automated validation

- Frontend: 98 files / 944 tests passed. Coverage includes manual decimal load, kg/lb conversion, exact/range/free/AMRAP reps, Greyskull, RIR/RPE, invalid inputs, completed-set edits, added load, unilateral completion/volume, notes, add/remove sets, stale timer cancellation, navigation and file-mirror restoration.
- API: 7 tests passed. MCP: 37 tests passed; Node import graph check passed.
- Web, standalone PWA and mobile/Capacitor builds passed. All 12 locales have 1514 keys; 1009 source strings checked.
- Fatigue probe passed 108000 comparisons and 14076 deletion checks.
- Android debug compilation and lint passed locally. Final signed Android artifacts and native emulator checks are verified by the existing GitHub workflows before distribution.
- No frontend lint or type-check scripts exist. Existing bundle-size/dynamic-import build warnings remain.

## Interactive validation

Used synthetic browser-local data, Spanish and English, 390px/320px mobile and 1280px desktop. Confirmed no horizontal overflow at 320px.

- Entered decimal weights and reps outside the target, edited a completed set, retained a separately edited pending set, and preserved values through refresh and navigation.
- Completed a four-set workout with notes, rest/skip, left/right completion, timed work, automatic clock pause and Continue. History reported four sets and 1258.8 kg rounded from 1258.75 kg, without duplicated volume.
- Started another workout, recorded 54.75 kg and 8 actual reps against a 10-rep target, switched units and verified 120.70 lb / 8 reps.
- After the production service worker activated, stopped the preview server, closed the tab and reopened the cached PWA. The active workout and 120.70 lb / 8 reps were retained. An initial offline attempt before the cache was ready was blank; the subsequent activated-cache reopen passed.
- Fresh production-tab console inspection showed no errors or warnings during this flow.

Physical Android-device interaction, physical speaker output, an OS-installed PWA window and Safari/iOS were not available. FCM acceptance establishes publication/send success, not receipt on an individual phone.

## Changed components

Workout, NumberField/Check, TabBar, workout-local CSS, history cascades, warm-up recalculation, strict-rep helpers, English/Spanish strings, focused regression tests, package/Android versions and this audit.
