# TGym 1.15.58: actual repetitions and streak recognition

## Scope and confirmed rule

The owner's clarification on 2026-10-08 supersedes the proposed complete-calendar-week rule: the existing streak counter reaching 7 represents a week equivalent, and reaching 30 represents a month equivalent. This release labels that existing counter; it does not introduce calendar-week fulfillment, daily training requirements, points or rankings. A streak counts distinct local dates with valid recorded activity, retains scheduled rest/pause behavior, breaks on a missed scheduled date, and leaves an unfinished current date pending. More than one session on a date still counts once. Unscheduled profiles keep their existing continuity rules.

The internal configuration sets 7/30 divisors and the 2× milestone sequence: 2, 4, 8, 16, 32, 64… week equivalents, at counts 14, 28, 56, 112, 224, 448…. Month equivalents are ordinary summary labels; they do not add another celebration sequence.

## Data and presentation

- Actual-reps label, input and −/+ controls occupy one centered block across the card's interior. Load/effort controls retain their values and handlers; cardio/time modes and unilateral storage conventions are unchanged.
- Every completed summary shows the shared streak component. Active streaks use its optional full fill; zero uses the neutral state. The original counter and description remain, with the confirmed period equivalent.
- The special recognition is separate, inline and dismissible, with an active flame, localized positive message and next target. It has no confetti, forced navigation, new sound or vibration. App/OS reduced-motion preferences govern the ordinary flame; the special flame is static.
- Finish adds the workout, clears active state and records the highest pending claim in one normal persisted transaction. A storage failure cannot consume the claim or open a successful summary. A repeated/duplicate-ID save cannot replay completion effects.
- `streakMilestoneLedger` is optional and additive. Native/web mirrors, optional API snapshots and portable backups retain it. Legacy `streakCelebrations`, workout/routine identities, history and storage/package keys are preserved.
- Each continuity episode retains consumed thresholds and observed date/ID anchors. The highest pending milestone consumes lower milestones together. Real missed-date breaks permit a fresh episode to celebrate again. Same-date saves, active/canceled sessions and silent/recovered saves do not show recognition.
- Historical edits crossing a new threshold absorb recognition through that threshold instead of generating a retrospective celebration; prior consumed anchors survive deletions/restorations. Lower pending milestones are also absorbed by such an edited-history crossing. Reopening/remounting the same summary cannot replay a claimed message; live history/local-time checks remove a claim that becomes invalid.

## Local verification

- Frontend: 1,692 tests in 163 files passed with two workers and a 15-second test timeout. Six further boundary regressions then passed in the 47-test milestone file, bringing the source suite to 1,698 tests for the exact-source CI gate. The first complete local run hit the pre-existing XLSX exporter test's 5-second timeout under simultaneous browser load; the final complete local run passed. No source timeout or dependency changes were made.
- API: 11 tests passed. MCP: 37 tests passed and the complete existing import graph loaded under plain Node.
- Locale/source checks: 12 packs with 1,784 keys each; all 1,148 scanned source strings present. New recognition/equivalent strings have translations and matching interpolation placeholders in every pack.
- Existing fatigue/history probes: 108,000 fatigue comparisons and 14,076 randomized deletion comparisons passed.
- Web and standalone PWA builds passed. Mobile synchronization, native compilation/lint/instrumentation, signed candidate verification and publication are separate release gates.
- Reps browser QA: 308 layout/text/zoom cases and eight editing/reload flows passed in Chromium and WebKit at widths 320–1,440, light/dark themes, 100%/200% text, bodyweight/weighted, effort, unilateral and top/backoff/superset cases. Measured centering error was 0px; controls remained at least 44px high; no horizontal overflow. CSS text/zoom tests do not prove native system accessibility zoom.
- Summary integration tests cover explicit Finish at 14/28, largest pending milestone, atomic persistence, independent dismissal, remount, offline rehydration, same-date/duplicate IDs, history deletion/edit/restoration, real new streak and failed-save retry. Pure tests additionally cover before/at/after thresholds through 64 week equivalents, local dates, week/year boundaries, rest/pause, legacy/numeric IDs and silent pending claims.

Final browser-summary/PWA offline evidence, exact-source CI/native candidate checks, physical Pixel QA restoration and published artifact checks are recorded separately in the private task evidence as they complete. WebKit emulation is not a physical iPhone or native iOS test; macOS/Xcode and a physical iPhone are unavailable here. No frontend lint/typecheck scripts exist; Android lint is a distinct native check.
