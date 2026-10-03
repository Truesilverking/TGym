# Settings and functional data audit

Date: 2026-10-03. This report covers the existing TGym data paths and the Settings correction under review. Release publication and physical-device acceptance are recorded separately. All test profiles were synthetic; no user profile was erased or used for testing.

## Initial baseline

Before runtime edits, the checkout passed 1,264 frontend tests in 130 files, 11 optional API tests, 37 MCP tests, and the plain-Node MCP import-graph check. Logs are in the ignored `.tools/settings49/baseline-*.log` files. These results establish the initial automated baseline; they do not certify every UI path or native notification delivery.

There are no frontend lint or typecheck scripts. JavaScript tests, Vite compilation, source/locale checks and Android build/lint are separate checks. `build:mobile` synchronizes web assets and Capacitor plugins; it does not compile an APK or an iOS application.

## Data ownership and actual transfers

The requested title, **All Data stays on this device**, describes the default local profile, not an unconditional guarantee for every supported connection mode.

| Path | Actual behavior and evidence |
| --- | --- |
| Local primary state | `store/useStore.js` writes `gym_state_v1` synchronously before replacing the displayed state. A failed primary write retains the prior state and reports `storageWarning: primary`. |
| Standalone PWA mirror | `lib/web-state.js` mirrors immutable snapshots into IndexedDB `tgym-profile/snapshots`, outside service-worker caches. Writes serialize and coalesce pending edits. Mirror failure retains the localStorage copy and reports a warning. |
| Native private mirror | `lib/mobile.js` writes `framegym-state.json` into Capacitor `Directory.Data`. Writes serialize captured snapshots. `flushPersistence` waits for the native save and rejects on failure. A normal debounced mirror is asynchronous, so a device kill before that save finishes remains a limitation. |
| Optional server profile | `store/useStore.js: pushState/pullState` sends and retrieves profile state through `/api/data` after account login or mobile pairing. `lib/api.js` applies the paired server base and authorization; `lib/remote.js` persists pairing separately. The API deliberately removes `active` before storing the profile (`api/server.js`, PUT `/api/data`). Local active workouts are retained during a pull. |
| Optional Google Drive | `lib/cloud-sync.js` uses Drive app-data access and uploads the portable backup to Google when explicitly configured/enabled. The periodic backup checks `cloudSync.on`; reviewed cloud identity and remote modification time protect against blindly replacing another device's snapshot. |
| Export and OS sharing | Full JSON backup/export is a user-selected transfer. On native platforms `shareExport/shareBase64` writes a temporary file and opens the OS share sheet; the chosen destination may leave the device. |
| Native automatic backup | `writeAutoBackup` writes dated portable files into `Directory.Documents` when enabled. Other apps or the user's document-folder synchronization can copy those files. This is distinct from the private native mirror. |

The old Data subtitle mentioned only cloud backup although optional API profile synchronization and export/share also transfer data. This was a concrete copy mismatch, not evidence of unexpected covert upload. Settings must retain the requested title and explain the actual opt-in transfers beside it. The unconditional claim cannot be certified across server-connected and Drive-enabled modes.

`lib/backup.js` removes authentication/PIN/token fields recursively from portable backups and resets cloud connection state. CRC32 detects accidental corruption; exported backups are not encrypted or cryptographically signed. Source inspection and mocked transfer tests establish these paths. This audit did not use a live Google account, capture production network traffic, or validate a physical device's file protection.

## Functional correction

An outstanding API read could replace newly edited preferences on a profile without routines/history. The previous `pullState` condition treated `!hasData(S)` as sufficient to accept the response, even if the profile was marked dirty. A response could also apply after switching accounts.

`pullState` now captures the local state revision and account identity before requesting data. A changed account discards the response. Any local edit during the request keeps the current snapshot and queues the current profile for the same account. The dirty flag protects preference-only edits as well as profiles containing training records; populated profiles retain the existing timestamp freshness check. The existing clean-empty-profile restoration rule remains, so signing out and back in does not upload empty defaults over remote history merely because the sign-out snapshot has a newer timestamp. A valid same-account pull still restores the profile and preserves the local active workout. This change adds no storage key or migration.

Eight new tests in `store/useStore.pull.test.js` cover edits during GET with and without upload intent, unsent preferences before GET, restoring remote history after a newer clean-empty sign-out snapshot, account replacement, logout, normal restoration and local active-session preservation. These tests and the existing session suite passed together: 26 tests in two files (`.tools/settings49/pull-state.log`).

## Transversal coverage

| Flow | Inspected implementation and existing/new automated evidence |
| --- | --- |
| Preferences and persistence | `useStore.update` is the normal edit boundary. `useStore.pwa.test.js`, `useStore.mobile-workout.test.js`, `native-state.test.js`, `web-state.test.js`, `mobile-save.test.js` cover reopen/mirror recovery, newer-local protection, immutable serialized writes and storage failures. `useStore.session.test.js` covers serialized uploads, reconnect retry and retaining unsent edits/active workouts at sign-out. |
| Routines and schedule | `daily-plan.js` resolves ordered IDs, date overrides, intentional skips, pending work and training pauses. `daily-plan.test.js`, `DailyPlan.test.jsx`, `routine-order.test.js` and `state-migrations.test.js` cover routine identity, multi-routine days, additive legacy migration and display-order persistence. |
| Session start/history | `sheets.jsx` captures a stable session ID and origin at start. `doFinishWorkout` rechecks current active ID and existing history IDs before inserting. `useStore.origin.test.js` covers start/edit/reopen/backup/cloud-origin retention. New `store/session-idempotency.test.js` calls the actual finish twice, reopens persisted state and retries: one history row and one completion sound remain. |
| Measurements | Stable draft/sample IDs distinguish retries from legitimate same-value readings. `body-records.js` updates by ID; selected-record deletion preserves other same-date readings. `body-records.test.js`, `MeasurementHistory.test.jsx`, native/PWA store tests and the new idempotency test cover editing legacy rows, images, units, date validation, retry and distinct equal-value readings. |
| Timers and recovery | `workout-time.js` owns elapsed time; `useUI` persists rest deadlines. `workout-time.test.js`, `workout-lifecycle.test.js`, `workout-recovery.test.js`, `session-contract.test.js`, `useUI.test.js` cover pause/resume, final-work freezing, abandoned restore, continued sessions, suspended renders and one-shot timed-set completion. Serialized tests named restart/update simulate data boundaries; they are not physical process-kill tests. |
| Progression and deload | `progression.js` excludes scheduled deload sessions and warmups from ordinary progression. `training-plan.js` generates reduced session prescriptions without rewriting the routine/history. `progression.test.js`, `training-plan.test.js` and `backoff-preference.test.js` cover legacy/manual targets, deload exclusion, recorded historical deload state and top/back-off behavior. No formula change was needed for the Settings layout work. |
| Import/export and merge | `backup.js`, `json-import.js`, `plan-share.js`, `state-merge.js` retain compatible formats and stable identity. Backup/checksum/malformed/prototype-key tests, plan ID-remap tests and atomic workout/conflict tests passed at baseline. `RestoreSheet.flow.test.jsx` checks reviewed cloud identity, undo snapshot and refusing a local edit made during a conflict dialog. No bulk historical deduplication or data wipe was performed. |
| External activity imports | `activities.js` reconciles stable provider source IDs and preserves existing notes/history under its existing documented manual/provider matching rule. `activities.test.js` covers repeated provider imports, source updates, invalid rows and strength-record preservation. This audit did not broaden that matching rule or deduplicate equal-valued unrelated records. |
| API and MCP | The API suite covers its pure reminder, training-pause, push-message and authentication-error helpers. It is not a full authenticated endpoint or live web-push audit. MCP's 37 tests and plain-Node graph check exercise the read-only calculation/import contract. |

The new idempotency tests and existing body-record/session-contract tests passed together: 17 tests in three files (`.tools/settings49/idempotency.log`).

## Settings integration coverage

Eight new component integration cases in `views/Settings.ux.test.jsx` mount the real Settings, reminder components and persisted store. They establish that the requested Data row remains first after a theme change, leaving/returning to Settings, and remounting a saved profile; the local and connected-server subtitles explain their actual transfers. The two reminder panels preserve independent frequency/time/configuration through edits, disable/reactivate and persisted reopen. Repeated enable presses while scheduling is pending execute one guarded action; rapid time edits retain the latest value while an independent frequency edit is also saved. Denied permission, scheduler error and primary storage failure render feedback without a false next-notification confirmation. Visiting/remounting Settings does not schedule through the UI action bridge.

The original measurement-frequency test now reflects the explicit activation switch: editing an off reminder's frequency saves the frequency while leaving it off, and enabling it retains that saved frequency. Settings integration, original MeasurementReminders and the separate DeloadSettings suite passed together: 18 tests in three files (`.tools/settings49/settings-components.log`). Their scheduler/status bridge is mocked; the native scheduler unit suite and real device delivery remain separate evidence. The deload component tests exercise expansion versus activation, persistence, invalid date drafts, save failure and concurrent alert toggles.

## Integrated automated result

After integrating the functional, Settings and native-reminder unit changes, the complete local frontend suite passed 1,305 tests in 135 files. The optional API suite passed 11 tests; MCP passed 37 tests and its plain-Node import-graph check. Logs are in `.tools/settings49/final-frontend.log`, `final-api.log`, `final-mcp.log` and `final-mcp-node.log`. The Brazilian Portuguese snapshot now has 316 explicit overrides after adding the 25 Settings/reminder translations; its 449 inherited entries retain the existing reviewed SHA-256 fingerprint unchanged. Build, visual and exact-release-commit CI results are recorded by the delivery coordinator separately.

## Remaining acceptance boundaries

- Native plugin mocks establish scheduling requests, failures and cancellation behavior; a real device must verify notification permission prompts, OS delivery, background/process restart and system time/timezone changes.
- Browser rendering/accessibility and responsive checks must inspect the final integrated Data order, both independent reminder panels and the deload accordion. Compilation alone does not validate those layouts.
- Native Android compilation/emulator instrumentation, APK signing/update integrity and service acceptance are separate from physical phone receipt or installation.
- iOS native compilation needs macOS/Xcode. WebKit browser checks can cover the shared UI, not native iOS notifications.
- Existing localStorage/IndexedDB/native mirrors improve recovery but do not guarantee survival after every site-data deletion, external document deletion or kill before asynchronous mirroring finishes. An exported or explicitly configured cloud backup remains the recovery path for those cases.

Release source/Actions IDs and publication proof belong in the release audit; this report does not infer a successful release from a branch push.

## Integrated design and build verification

The final Settings-only targeted run passed nine tests, including a subsequent regression proving that a failed cancellation remains visible while the saved preference is off. The complete suite above preceded that additional test; exact-source CI records the final combined count.

Actual isolated Chromium/Edge and WebKit flows exercised both standalone PWA and mobile-mode bundles. Data stays first through preferences, navigation and reload. Measurement frequency/time and workout time persist independently through off/on and reopen. Deload expansion/collapse does not write its configuration. Dark/light layouts at 320/390/768/1280 pixels, Spanish language selection through the actual picker, enlarged root font and keyboard activation passed without horizontal overflow or page errors. Representative dark/light/Spanish screenshots were inspected. Mobile-mode browser rendering is shared-UI evidence, not native device delivery.

Web, PWA and mobile asset/synchronization builds passed. Local Android `assembleRelease lintRelease` passed using JDK21/SDK35. Existing chunk-size, SDK/dependency and Android lint warnings remain; no frontend lint/typecheck check is claimed. No new dependency was added.

Pre-publication review found that sound-channel cleanup still ran after a failed notification replacement. Cleanup now runs only after all reminder families are successfully reconciled and verified; an independently successful family cannot delete the old sound/channel of another family's pending notice. Three added regressions cover cancellation, scheduling and pending-list failures plus successful retry. The scheduler/native-sound targeted run passed 20 tests in two files.
