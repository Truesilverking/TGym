# TGym 1.15.47 / Android83 - final audit

Candidate branch: `feature/backoff-reps-settings`. Publication and exact commit evidence are appended after checks complete. Date: 2026-10-02.

## Corrective PWA patch

A real production PWA45->46 upgrade discovered that the new46 Service Worker cached old45 index.html through cache.addAll and the browser HTTP cache. The activated worker then served the old UI; history and the seeded preference remained present. This finding supersedes46 upgrade acceptance, despite valid46 APK/signing/metadata and green CI.

Version47 replaces install/repair addAll with fresh network fetches using `cache:no-store` and a build-specific query. Responses are stored under canonical cache keys, preserving offline navigation and previous-tab lazy assets. Missing/failed assets reject installation; the existing worker/profile remains intact. Regression tests distinguish stale HTTP HTML from fresh responses and reject404 assets. The original46 release is immutable;47 uses Android83 and a new signed tag.

## Change and data flow

Settings owns `S.backoffRepsMode` (`same` / `increased`). Increased is the default and matches 1.15.45's standard automatic +2 behavior. Same copies both Top limits; Increased adds two visible reps to both limits. Examples: 4-6 ->4-6 /6-8; 6-8 ->6-8 /8-10; fixed5 ->5 /7. Legacy bilateral total storage scales visible +2 into +4 stored reps.

`withBackoffRepsMode` materializes automatic ranges for routine saves, routine session creation and exercises added during a session. The per-exercise automatic-offset control is replaced with the selected Settings mode, removing a competing preference. Independent ranges (`autoBackoffReps:false`) remain explicit. Global mode owns automatic offsets; old offset fields remain readable for historical/shared helper compatibility, but new automatic session targets use the selected mode.

Settings updates call `useStore.update`; `refreshActiveBackoffReps` updates pending automatic Back-offs within each Top block. Logged Top actual reps plus the selected offset are clamped to the derived range. Performed, partially performed and directly manually edited reps remain unchanged. Load reduction, load rounding, RIR, warmups, progression and history are untouched. Straight/time/cardio prescriptions receive no mode metadata.

Persistence is additive: existing localStorage key, schema3, IndexedDB mirror, mobile file mirror and portable backups are retained. No migration of routines/history or key/package/signing identity occurs. Session targets snapshot the mode; completed history remains a snapshot. Preference and pending rows survive primary persistence, mirror restoration, offline reopen and service-worker activation tests.

## Systematic module review

The full frontend suite covers calculations, missing/legacy data, IDs, editing/deletion, empty states and regression boundaries. Source review rechecked the affected flow and the shared identity/storage/report boundaries. Browser evidence below checks resulting saved values, not only responsive controls.

| Modules | Reviewed invariant and current evidence |
| --- | --- |
| Routines, scheduling, reordering | Stable IDs; presentation ordering independent of week/day arrays; deleted assignments removed, scalar legacy schedules normalized and duplicate IDs deduplicated. Routine edit/delete/undo and arrows/boundaries/reload browser flows passed. |
| Exercises, warmups, working/Top/Back-off sets | Shared workout-model/history/training-plan helpers; warmups excluded from completion/progression. New range/fixed/multiple-row and Top edit tests, manual/partial protections, group isolation and Workout integration passed. |
| Weight, reps, RIR, progression/deload | Existing load percentage/increment behavior preserved; role targets and unit/per-side semantics covered by calculation tests. Progression uses deduplicated valid chronological history. |
| Supersets, workout/rest/work timers | Existing pairing/rest-policy helpers and shared workout-time clock retained. Full lifecycle, timer and notification contract tests passed; browser recovery/finish/history flow passed. Android emulator evidence is recorded after CI. |
| History, Home/This Week, calendar, tracking/Consistency | Daily plan matches routine IDs and consumes legacy name matches once; cancelled/active/duplicate sessions excluded. Calendar data/consistency tests and PNG/PDF export passed. |
| Stats and Progress Report | Stable routine/exercise grouping, deduplicated sessions, validated dates/units, distinct empty states. Chromium/WebKit rich+empty reports: 8 sections x5 widths, period changes and PDF downloads passed. Selected/multiple/all exports checked; export implementation tests passed. |
| Body measurements, InBody, reminders | Dated identity separate from date edits, legacy fields retained, strict positive metric parsing. Chromium/WebKit create/edit/backdated-height/daily-weight-sample/reload flows passed; full body/reminder suites passed. No real notification receipt claimed. |
| Replay Tour | Preview state must not create history or corrupt active training. Current 12-step, Back/Done/Replay/Skip, empty/existing-profile and six-width Chromium/WebKit results are recorded below. |
| Settings, themes/accents, responsive/a11y | Existing controls/theme variables/reduced-motion reused. 32 route/English-Spanish/dark-light checks passed without layout, axe or page-error findings; new control tested at320/390/768/1280. |
| Persistence, backups, optional cloud/API | Single useStore mutation path, serialized mirrors/uploads and additive migrations preserved. Offline IndexedDB recovery and backup roundtrip preference/history tests passed; browser backup/import/undo passed. No real cloud-account mutation tested. |
| PWA/cache and updates | Production secure-context worker; profile outside shell cache. Chromium offline shell/reload and both-engine offline mode edits passed. Synthetic newer-worker activation via real update UI preserved33 history records, mode=Same and separate audio/unrelated caches. Trusted download/hash/package/version/signing protections unchanged and tested. |

## Problems corrected

- Missing global Back-off repetition choice and conflicting per-exercise automatic offset editor.
- Dependency audit advisories: patch overrides brace-expansion2.1.7/5.0.12 and DOMPurify3.4.16; retain existing tar/sharp/uuid overrides. MCP ip-address updated to10.7.3. Final frontend/API/MCP audits report zero vulnerabilities.
- Five ineffective dynamic imports now use their already-eager module imports (app lock, mobile backup, Progress Report export and measurement navigation), removing those build warnings without broad splitting/refactoring.
- README used npm frontend setup despite pnpm CI. Architecture/release docs had stale version/code; mobile mirror filename and self-hosting upstream image instructions were misleading. Preserve historical changelog/audit evidence while updating current instructions.
- New feature branch is included in Tests, Android and PWA workflow triggers. Ignore local JKS signing files and local environment overrides; no credentials or build/QA artifacts are staged.

## Local validation

The Back-off/report/body/tour validations below were performed for46 and remain applicable to unchanged functionality. The47 patch reran the full frontend suite,40 targeted worker/updater/persistence tests, all builds, the synthetic worker activation scenario and the12 Back-off/offline scenarios. Final public upgrade acceptance is appended after47 publication.


- Frontend: 1,245 tests /127 files passed after implementation and dependency fixes; targeted20 tests passed. API10; MCP37 and plain-Node loadability passed.
- Frozen-lockfile install, locale keysets (12 x1688), source strings (1077), version1.15.47/code83 and fatigue probes (108000 +14076 comparisons) passed.
- Web, PWA, mobile assets/sync builds passed. Android assembleRelease/lintRelease passed before and after final asset sync. Lint has zero errors; inherited Android warnings are not hidden.
- Six real Chromium flows passed: onboarding/offline mirror recovery, workout recovery/finish, routine edit/delete/undo, backup/import/undo, calendar PNG/PDF, activity edit.
- Twelve Chromium/WebKit Settings/start/switch/reload scenarios passed for4-6,6-8,fixed5 in both modes with three Back-offs. Actual persisted bounds/reps/load verified. Chromium also reloaded the installed shell offline; WebKit verified online reopen then offline writes.
- Real PWA update UI/worker activation with a synthetic newer build passed: history, preference, backup and separate caches preserved.
- Browser logs/screenshots/PDFs are temporary ignored `.tools/ux46` artifacts, not repository deliverables.
- No frontend lint/typecheck scripts exist; production compilation and separate Android lint are the available checks.

## Limits and remaining warnings

No physical Android/iPhone was tested for this release; no macOS/Xcode native iOS build, live Drive account or phone notification/installer receipt is claimed. Desktop WebKit failed internal navigation on fully offline reload; online reload and offline editing passed. This does not establish iPhone Home Screen acceptance. Existing large bundle warnings and Android SDK/dependency/resource lint warnings remain; changing those requires a separately scoped optimization/native tooling update. Some locale strings intentionally use English fallback, with Spanish translated and keysets synchronized. Docker source configuration was reviewed, not deployed.

## Modified files

Runtime also includes `frontend/public/sw.js` and worker regressions in `service-worker.test.js`. Runtime: `training-plan.js`, `useStore.js`, `Settings.jsx`, `Workout.jsx`, `sheets.jsx`, `App.jsx`, `app-lock.js`, `mobile.js`, `progress-file.js`. Tests: `backoff-preference.test.js`, `useStore.pwa.test.js`, `ExConfig.per-side.test.jsx`. All12 locale files receive synchronized keys. Version/dependencies: frontend `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, Android `app/build.gradle`, MCP `package-lock.json`. Workflow/config: `.gitignore`, Tests/Android/PWA YAML. Documentation: README, CHANGELOG, Architecture, Mobile, both Releasing guides, Self-hosting, this audit and the workspace checkpoint.

## Publication

Pending exact-commit GitHub CI and signed47 release publication. Production46 sourcee585d1c passed Tests37014192178/PWA37014192252/Android37014192397 and release37015053274; its stale-HTML upgrade defect is corrected here. Do not interpret candidate checks as final public47 acceptance.

