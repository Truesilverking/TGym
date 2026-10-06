# TGym 1.15.56 / Android92 release audit

The user approved publication on 2026-10-06 after reviewing the update in Opera and the isolated TGym QA phone installation. This document records the candidate; publication evidence is added after the signed release, public APK/PWA and update checks succeed.

## Scope

- Stats has a compact, centered Sections dropdown independent of Training History. Its eleven existing sections retain their order and grouping. Training History and Consistency are only the fallback selection; any section can be hidden, and the final selected section cannot be removed. Visibility persists locally/offline and through the existing optional API preference synchronization.
- The existing Stats header download circle opens Export Reports. Settings no longer has that row. Confirmation combines only the selected Streak, Consistency, Progress and Stats dashboards into one PDF. Hidden Stats sections remain exportable independently of visibility, and the current filters are captured without writing preferences. Closing/canceling suppresses downloads, including asynchronous generation. Other Calendar, Consistency, Progress, CSV, plan and backup controls retain their existing functions. Home's Consistency download icon precedes Times.
- Settings adds Exercise names: My aliases (default, with original-name fallback) or Original names (retaining aliases). One ID-based resolver supplies catalogue/search, routine/session/superset/history/Stats/chart labels, timers and human-readable reports. Searches accept both names, and exercise details retain the original. The existing alias model is global by exercise ID; no routine-specific alias storage is introduced. Native workout notifications retain their existing workout/rest/set-only content.
- PDF wrapping fits long unbroken names, wide letters, CJK and emoji inside chart cards and narrow Progress columns without dropping names. Cached character advances and running widths preserve the layout while avoiding repeated quadratic work.

No original exercise names, exercise/routine IDs, workout history, calculation rules, backup/import schemas, native package identities, signing identities or update validation rules changed.

## Candidate validation

- 1,541 frontend tests / 153 files passed, including the two initial API-restore regressions that preserve a single Stats selection without reactivating defaults. Unchanged API and MCP source already passed 11 and 37 tests respectively, with the plain-Node MCP import graph check. Exact-commit Actions repeat these checks before tagging.
- Web, standalone PWA and mobile assets/Capacitor synchronization passed. Version/code validation passed against the public 1.15.55/code91 manifest. All 12 locale keysets have 1,745 keys. Source-string checks and fatigue/history-edit property probes passed. There are no frontend lint/typecheck scripts.
- Local Android `assembleRelease bundleRelease :app:lintRelease` passed in 13 seconds with JDK21/SDK35. Local artifacts are not published; the signed exact-source candidate and release come from GitHub Actions.
- Isolated Chromium/Edge and WebKit browser QA covered English/Spanish, light/dark themes, 320/390/1280px, both name modes, 72 layout checks, search by either name, missing/blank/duplicate/long aliases, editing/deletion during a running session and unchanged work deadlines. Offline persistence and IndexedDB recovery passed in both engines.
- Seven final PDFs / 13 pages passed actual download, strict parsing, image decoding, full render and visual review. Real SVG font measurements covered 228 name rows in Chromium/WebKit, including wide letters, CJK, emoji, flags and hearts; the optimization retained the same lines and positions.
- Opera's local TGym was updated and left open. The isolated physical Android QA app passed both selectors and reopen persistence. Installation preserved the exact QA state file; protected history/routine/body/alias/session data and primary-app package metadata remained equal. Final installed assets matched the build. Integrity comparisons exclude only normal accumulated-active-duration cache and last-user-interaction fields; session entries and deadlines remain protected. The primary TGym app/data were not read or changed.

Ignored test evidence is under `.tools/exercise-names/`, `.tools/stats-report-export/` and `.tools/release-1.15.56/`. Synthetic example PDFs in `output/` are excluded from the source commit. Credentials, signing material, device SDK paths and personal profiles are not committed.

## Publication status and limits

Exact-source branch Tests, PWA, Android/emulator and signed-candidate validation are required before the immutable release tag. Public manifest/source/version/code, actual APK/AAB signatures, previous official certificate continuity, GitHub/Pages APK hash parity, updater behavior and production PWA update/persistence are verified after publication.

Physical iPhone/Safari/installed iOS PWA and native iOS compilation remain unverified; WebKit emulation is separate evidence. Local QA installation does not establish installation of the official signed release in the user's primary phone app. Firebase service acceptance is recorded separately from handset receipt.
