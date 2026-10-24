# Workout, measurements and app tour audit - 2026-09-29

Scope: user attachment `10437f8f-e023-40ec-8241-41c0c2f5d425`, based on the phone screenshot. Baseline `84ea783`, candidate 1.15.43 / Android 79, branch `feature/dashboard-visual-polish`.

## Changes and data flow

- Measurement reminders use a category selector, status/date/record card and separate scheduling controls. Recording works even when reminders are off. Native date inputs accept valid dates up to today. Categories remain weight, height and the existing body measurements; no new measurement metrics are invented.
- Body measurements open an existing selected date for explicitly labelled editing. Stable IDs preserve other dates and other pre-existing same-day readings; changing dates loads the matching reading, or an empty form. Existing unit conversion and optional fields remain supported.
- Weight records retain the existing daily sample average and clearly announce it. Each newly submitted sample has an optional stable ID so retrying after a durable-write failure updates the same sample. Existing samples remain compatible. Pre-workout weighing keeps its synchronous start callback; ordinary dated logging awaits persistence and exposes failure without closing the editor.
- Height records remain canonical centimetres. Upserting a date preserves historical readings, and backdating no longer replaces the latest height used for BMI. Legacy dated current height is retained before the first history addition. No storage key, package identity or destructive migration changes.
- All measurement changes still pass through `useStore.update`, retaining localStorage and native/web mirror behavior. UI errors keep the editor available for retry.
- Workout phase headings share a stronger 13px/800 style. Previous and next supersets appear in that order as compact arrow controls, retaining the existing pairing/unpairing helpers and IDs. Missing neighbors remain hidden.
- Routine, standing, pinned and session notes stay intact in a collapsed native details element. First-session information appears in a separate history context, disappearing when relevant logged history exists. The permanent number-editing hint is removed.
- The rest panel keeps its deadline-based timer and controls, in a compact opaque layout. Existing measured viewport clearance lets set controls scroll above it; current-set scrolling considers the real timer position.
- Replay Tour has twelve steps, covering navigation, routines, starting, set logging/types, supersets/rest, history, Progress Report, measurements, InBody and settings/offline updates. The three workout steps render the actual ExerciseBlock through ephemeral preview props, never inserting a fake active workout or session into persisted state. The preview includes RIR even when the user's logging preference disables effort. Normal active clocks keep running; tour/replay controls do not count as training interaction. Completion changes only the tour preference plus normal persistence bookkeeping.
- Tour targets follow route mounting, scroll and resize. Highlights are bounded inside the viewport; panel and highlight do not overlap in the tested portrait/landscape sizes. Keyboard focus remains trapped with Escape/Skip exit. Theme/accent and reduced-motion styles are retained. New copy is localized in Spanish, with the existing English fallback convention in other packs; locale keysets remain synchronized.

## Verification

- Full frontend suite: 1,213 tests / 126 files pass with four workers; final focused tests also pass. Exact-commit CI is recorded in the release evidence. API 10 tests and MCP 37 plus Node-loadability pass. Locale and strict source-string checks pass. No frontend lint/typecheck scripts exist.
- Chromium and WebKit: twelve-step tour with empty and existing-data profiles, Next/Back/Done/Replay/Skip, six viewports (320,360,375,390,430 and 844x390), bounded non-overlapping highlights/panel and no training-data changes. Running elapsed-duration bookkeeping is excluded from the unchanged-data comparison.
- Chromium and WebKit: reminder disabled/enabled, dated body measurement create/edit, preservation of unedited fields and older dates, backdated height, repeated daily weight samples and reload persistence. Six responsive sizes pass.
- Chromium and WebKit, dark/light and reduced motion: collapsed/expanded notes, first-history context, directional previous/next pairing and unpairing, rest +/-15 seconds and Skip, six sizes, 44px touch heights, no horizontal overflow and set controls scroll above the compact rest panel. Visual screenshots reviewed.
- Regression tests cover phase types, exercise reordering before pairing, missing neighbors, same-day editing, multiple legacy readings, inch-to-cm edits, invalid dates/values, backdated height, weight retry identity and the pre-workout start callback.
- Web/PWA/mobile production builds and a clean Android release/lint build pass. Final Capacitor sync and Android release/lint rebuild passed after all source edits. Lint has zero errors and 22 existing warnings; ordinary Vite shared static/dynamic import warnings remain.

## Findings during validation and limits

The old tour's large-card highlight clipped the wrong portion after resizing; targeting a real set console, top alignment and viewport bounds corrected it. English directional controls originally displayed their source key instead of the intended arrow label; arrows are now explicit beside the existing Superset translation. Test harness corrections used an actual active fixture and asserted the current pair's indices after unpairing; these were not app failures.

No physical phone is connected in this run. WebKit is engine coverage, not physical iPhone/Safari/Home Screen installation, keyboard or native date-picker validation. Android release compilation and CI/emulator evidence do not establish every device's visual behavior. No production user profile was edited. Publication evidence follows in the versioned release audit after the exact-commit workflows and public artifact/updater checks pass.
