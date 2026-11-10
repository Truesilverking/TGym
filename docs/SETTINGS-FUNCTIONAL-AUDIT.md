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

An outstanding API read could replace newly edited preferences on a profile without routines/history. The previous `pullState` condition treated `!hasData(S)` as sufficient to accept the response, even if the profile was marked dirty. A response could also apply after switching accounts. Protecting only the edited local snapshot was insufficient: the API replaces the whole stored profile on PUT, so uploading a preference-only local snapshot could discard routines, history, schedules and measurements already on the server.

`store/useStore.js` and the focused `lib/api-bootstrap.js` helper now handle the first read of an empty local API profile as follows:

- The complete remote profile is the base. `rebaseEmptyApiProfile` applies only local values changed relative to the captured pre-read snapshot; when existing preference-only edits are already marked dirty, defaults supply that comparison baseline. Nested preference objects are reconciled by property, so editing `deload.loadPct` retains the remote cycle, activation and start date. This is a value-delta rebase, not a second store or a general synchronization rewrite.
- Existing unit-conversion helpers normalize cloned remote, comparison and current profiles to the selected weight/measurement units before reconciling changes. A local unit edit wins; otherwise the remote units remain. Tests cover routine loads/increments, workout rows and volume, bodyweight samples, circumference fields, legacy height and the local active workout. Normalization does not mutate the original active snapshot or convert it twice.
- The existing identity-based merge retains distinct new local and remote record IDs. Ambiguous records, conflicting snapshots and unsafe deletions stop the bootstrap without persisting a merged profile or issuing PUT. No bulk deduplication, data deletion or storage migration was introduced.
- An account-scoped gate holds autosave, reconnect, background and manual uploads until GET and rebase succeed. A cached empty profile that requests an upload before boot starts GET must also read the baseline first. Uploads capture the current state after that gate, preserving edits made while waiting. A failed initial read keeps this fence; retry reads again before uploading. Account changes discard the old response and its queued empty upload. Populated-profile freshness checks and new-account uploads with actual local training data retain their existing behavior.
- Read, merge and upload failures return a failure result, retain local data and expose `serverSyncError`; existing unsent edits remain marked dirty. Strict sign-out refuses to log out after failed initial synchronization. Failed pairing does not complete onboarding. Settings keeps the privacy row first, displays the sync error beneath it and offers a guarded **Sync now** retry. Login/upload flows avoid welcome or data-moved success messages when their required synchronization failed.

The final targeted bootstrap/session/conversion/idempotency run passed 47 tests in four files: 19 pull-state tests, 18 session tests, eight conversion tests and two idempotency tests (`.tools/settings49/bootstrap-targeted.log`). It supersedes the earlier 26-test pull/session run. The regression fixture models the API's whole-profile replacement and confirms that every emitted PUT retains the remote records after delayed reads, local preference/unit edits, repeated retry and background/online events. These are mocked API contract tests, not a live authenticated server or production-profile exercise.

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

Component integration cases in `views/Settings.ux.test.jsx` mount the real Settings, reminder components and persisted store. They establish that the requested Data row remains first after a theme change, leaving/returning to Settings, and remounting a saved profile; the local and connected-server subtitles explain their actual transfers. The two reminder panels preserve independent frequency/time/configuration through edits, disable/reactivate and persisted reopen. Repeated enable presses while scheduling is pending execute one guarded action; rapid time edits retain the latest value while an independent frequency edit is also saved. Denied permission, scheduler error and primary storage failure render feedback without a false next-notification confirmation. Visiting/remounting Settings does not schedule through the UI action bridge.

The original measurement-frequency test now reflects the explicit activation switch: editing an off reminder's frequency saves the frequency while leaving it off, and enabling it retains that saved frequency. Settings integration, original MeasurementReminders and the separate DeloadSettings suite passed together: 18 tests in three files (`.tools/settings49/settings-components.log`). Their scheduler/status bridge is mocked; the native scheduler unit suite and real device delivery remain separate evidence. The deload component tests exercise expansion versus activation, persistence, invalid date drafts, save failure and concurrent alert toggles.

The current Settings-only run passed 12 tests: nine UX cases plus three `views/Settings.account.test.jsx` account-flow cases. Those three verify the existing registration form, failed required upload retaining local routines without a data-moved success message, failed sign-in synchronization without a welcome success message, and a failed-sync retry that keeps Data first and ignores a repeated press while pending. Account/network calls are mocked; these tests do not establish production passkey authentication or real account transfers.

## Integrated automated result

The complete local frontend run recorded 1,323 passing tests in 136 files; the subsequent final targeted bootstrap run passed 47 tests. The optional API suite passed 11 tests; MCP passed 37 tests and its plain-Node import-graph check. Local logs are in `.tools/settings49/final50-frontend.log`, `final50-api.log`, `final50-mcp.log` and `final50-mcp-node.log`. These supersede the earlier 1,305-test integrated run.

For exact source `dcdb9b7`, [Tests 37134153264](https://github.com/Truesilverking/TGym/actions/runs/37134153264) passed with 1,327 frontend tests, 11 API tests and 37 MCP tests. That exact-commit CI count is the current whole-suite evidence; the 1,323 local count belongs to the earlier run. [Validate PWA 37134153511](https://github.com/Truesilverking/TGym/actions/runs/37134153511) and [Validate Android 37134153248](https://github.com/Truesilverking/TGym/actions/runs/37134153248) also passed, including 11 Android35 emulator instrumentation tests. [RELEASE-AUDIT-1.15.50.md](RELEASE-AUDIT-1.15.50.md) records completed signed publication, independent downloads, actual production PWA upgrade and FCM service acceptance.

The Brazilian Portuguese snapshot has 317 explicit overrides after adding 25 Settings/reminder translations and the server-sync failure message; its 449 inherited entries retain the existing reviewed SHA-256 fingerprint unchanged.

## Remaining acceptance boundaries

- Native plugin mocks establish scheduling requests, failures and cancellation behavior; a real device must verify notification permission prompts, OS delivery, background/process restart and system time/timezone changes.
- Browser rendering/accessibility and responsive checks must inspect the final integrated Data order, both independent reminder panels and the deload accordion. Compilation alone does not validate those layouts.
- Native Android compilation/emulator instrumentation, APK signing/update integrity and service acceptance are separate from physical phone receipt or installation.
- Exact-commit Tests, PWA and Android CI passed. Local Android compilation and emulator instrumentation are separate from signed publication and physical-device acceptance.
- API contract and account UI tests use synthetic responses. A live authenticated server with real latency, reconnect and multiple clients was not exercised; this bootstrap gate is not a general multi-device conflict-resolution guarantee.
- iOS native compilation needs macOS/Xcode. WebKit browser checks can cover the shared UI, not native iOS notifications.
- Existing localStorage/IndexedDB/native mirrors improve recovery but do not guarantee survival after every site-data deletion, external document deletion or kill before asynchronous mirroring finishes. An exported or explicitly configured cloud backup remains the recovery path for those cases.

Release source/Actions IDs and publication proof belong in the release audit; this report does not infer a successful release from a branch push.

## Integrated design and build verification

The earlier Settings-only targeted run passed nine tests, including a regression proving that a failed cancellation remains visible while the saved preference is off. The current 12-test Settings run adds the account UI coverage. The final 47-test bootstrap run and exact-source 1,327-test frontend CI establish the subsequent functional coverage separately.

Actual isolated Chromium/Edge and WebKit flows exercised both standalone PWA and mobile-mode bundles. Data stays first through preferences, navigation and reload. Measurement frequency/time and workout time persist independently through off/on and reopen. Deload expansion/collapse does not write its configuration. Dark/light layouts at 320/390/768/1280 pixels, Spanish language selection through the actual picker, enlarged root font and keyboard activation passed without horizontal overflow or page errors. Representative dark/light/Spanish screenshots were inspected. Mobile-mode browser rendering is shared-UI evidence, not native device delivery.

After the API bootstrap follow-up, the web, PWA and mobile asset/synchronization builds passed again; actual isolated Chromium/Edge and WebKit checks also passed against the final mobile-mode shared UI bundle. Those browser checks do not establish native notification delivery or a live authenticated API transfer.

The final bootstrap source's local Android `assembleRelease lintRelease` passed using JDK21/SDK35 (`.tools/settings49/final50-android.log`), with 18 inherited lint warnings and zero errors. Existing chunk-size and SDK/dependency warnings remain; no frontend lint/typecheck check is claimed. No new dependency was added.

Pre-publication review found that sound-channel cleanup still ran after a failed notification replacement. Cleanup now runs only after all reminder families are successfully reconciled and verified; an independently successful family cannot delete the old sound/channel of another family's pending notice. Three added regressions cover cancellation, scheduling and pending-list failures plus successful retry. The scheduler/native-sound targeted run passed 20 tests in two files.

iOS resolves the native scheduling/cancellation call before its notification-center callback completes. Pending-list confirmation therefore allows at most three reads, 200ms apart (400ms total wait), after a mutation. It never reschedules to obtain confirmation. Delayed creation/cancellation, persistent mismatch and read failure are covered; the final scheduler/native-sound run passed 24 tests in two files. This bounded verification still does not guarantee OS delivery.
