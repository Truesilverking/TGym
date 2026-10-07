# Workout clock and recovery

`frontend/src/lib/workout-time.js` is the single effective-duration authority used by the active UI, saved history, routine averages, statistics, Progress Report and notifications. The timestamp representation remains compatible with existing backups: `start`, the running endpoint or `timerPausedAt`/`end`, and `pausedDurationMs` (the sum of finished pause intervals). No ticking counter accumulates seconds. `accumulatedActiveDuration`, `sessionStatus`, `sessionStartedAt` and `endedAt` are persisted derived aliases, never a second independent clock.

## Finish and Continue

Completing every required non-warmup row pauses immediately and records `routineCompletedAt` with `pauseReason: completion` and `sessionStatus: awaiting_finish`. Reviewing the decision or an early Finish confirmation contributes no time. Completion remains pending until the user confirms: the previous ten-minute automatic save and four-hour abandonment rules have been removed. Warmups do not determine required work completion.

Explicit Continue excludes the paused interval, removes the completion marker and persists `timerContinuedAt`. That marker prevents restore/persistence from immediately pausing an intentionally continued session whose original rows remain complete. Additional exercises belong to the active workout and do not rewrite the original routine. Completing newly added work pauses again. Finish persists the effective clock at the pause boundary and the existing identity guard prevents duplicate history rows.

Manual pauses use `pauseReason: manual`; inactivity uses `pauseReason: inactivity`. Neither silently resumes after editing a row, navigation, input or reopening. The explicit Resume/Continue control resumes the same active session and excludes waiting.

## Thirty-minute inactivity

Every trusted pointer, keyboard, input or scroll interaction with TGym updates `lastUserInteractionAt` through the store. Exercise/set edits and explicit Continue also initialize/update this field; they retain the existing meaningful-training aliases. Synthetic events, renders, animations, API synchronization and autonomous rest/work timer callbacks do not extend the deadline.

The deadline is `lastUserInteractionAt + 1,800,000 ms`. At the exact deadline, or on the first later execution, the active session pauses at that original timestamp. It is never automatically completed or moved to History. Normal rest counts during the active interval. Switching applications, locking or hiding the app does not immediately pause it. A work/rest deadline cannot postpone inactivity.

`reconcileWorkoutClock` applies the same rule at local load, all persistence boundaries, native/IndexedDB restore, foreground return, pagehide and active checking. `recordInteraction` reconciles before recording returning input so a late touch cannot erase a pause which should already have occurred. Display reads also clamp an unreconciled active session at the same deadline. The result works without a network connection and without JavaScript continuing in the background.

The recovery dialog preserves all rows and offers Continue, Finish and duration review/correction. It requires an explicit continuation; app focus or reading the dialog is not a resume command. Corrections accept positive minutes with an effective endpoint no later than now and retain `originalTimerPausedAt`, `originalDurationMs` and `durationCorrectedAt`. The corrected endpoint flows through the same duration helper and the audit survives the completed snapshot. Existing history is never bulk recalculated. Legacy abandoned/automatically completed records remain readable and keep their existing correction/continuation tools.

For active legacy sessions missing the new input field, recorded meaningful activity and valid done timestamps provide the fallback. Existing paused snapshots receive an additive pause reason: completion where a completion decision exists, manual otherwise. Completed historical clocks retain their terminal timestamps. Invalid or reversed times cannot produce negative effective duration.

## Persistence and Android notifications

Normal mutations use `useStore.update`, maintaining localStorage, the PWA IndexedDB mirror, native file mirror and optional API upload queue. Pause/Continue changes still trigger immediate serialized native writes; pagehide/visibility loss flush pending writes.

The Android bridge sends `autoPauseAt` alongside elapsed time and observation time. The foreground notification service freezes its chronometer at that deadline even when the WebView is suspended, retains the live notification and persists its paused notification snapshot. Returning React reconciles the same original timestamp. The obsolete `autoFinishAt` field cannot auto-complete or stop the session. Notification rendering does not write training history.

## Validation

Controlled-clock tests exercise Finish → wait → Continue → additional exercise → Finish; manual pause and repeated pause/resume calls; 29.999, 30 and 30.001 minutes plus long suspension; serialized lock/app-switch/process-restart/offline/PWA-update recovery; autonomous work completion beyond the inactivity deadline; trusted interaction extension; legacy repair; duration correction parity across history, routine averages and Progress; and nonnegative clocks.

Store tests verify synchronous cutoff persistence, reconciliation before returning input, preserved pending/logged rows, no inactivity history save, offline restore and native-mirror boot. Existing component tests cover explicit manual pause, Finish cancellation, workout input and daily-session identity. These are automated simulations; they do not establish physical iPhone/PWA acceptance or replace a real unaccelerated interval longer than thirty minutes. Real-device and build evidence is recorded separately in the delivery audit.
