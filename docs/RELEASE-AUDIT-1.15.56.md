# TGym 1.15.56 / Android92 release audit

The user approved publication on 2026-10-06 after reviewing the update in Opera and the isolated TGym QA phone installation. [TGym 1.15.56](https://github.com/Truesilverking/TGym/releases/tag/v1.15.56) is published from immutable runtime commit `415f4a715d2b1cb89140ac915cd4416a924856e1`, with Android versionCode 92.

## Scope

- Stats has a compact, centered Sections dropdown independent of Training History. Its eleven existing sections retain their order and grouping. Training History and Consistency are only the fallback selection; any section can be hidden, and the final selected section cannot be removed. Visibility persists locally/offline and through the existing optional API preference synchronization.
- The existing Stats header download circle opens Export Reports. Settings no longer has that row. Confirmation combines only the selected Streak, Consistency, Progress and Stats dashboards into one PDF. Hidden Stats sections remain exportable independently of visibility, and the current filters are captured without writing preferences. Closing/canceling suppresses downloads, including asynchronous generation. Other Calendar, Consistency, Progress, CSV, plan and backup controls retain their existing functions. Home's Consistency download icon precedes Times.
- Settings adds Exercise names: My aliases (default, with original-name fallback) or Original names (retaining aliases). One ID-based resolver supplies catalogue/search, routine/session/superset/history/Stats/chart labels, timers and human-readable reports. Searches accept both names, and exercise details retain the original. The existing alias model is global by exercise ID; no routine-specific alias storage is introduced. Native workout notifications retain their existing workout/rest/set-only content.
- PDF wrapping fits long unbroken names, wide letters, CJK and emoji inside chart cards and narrow Progress columns without dropping names. Cached character advances and running widths preserve the layout while avoiding repeated quadratic work.

No original exercise names, exercise/routine IDs, workout history, calculation rules, backup/import schemas, native package identities, signing identities or update validation rules changed.

## Pre-publication validation

- 1,541 frontend tests / 153 files passed, including the two initial API-restore regressions that preserve a single Stats selection without reactivating defaults. Exact-commit Actions passed these tests, 11 API tests, 37 MCP tests and the plain-Node MCP import graph check before tagging.
- Web, standalone PWA and mobile assets/Capacitor synchronization passed. Version/code validation passed against the public 1.15.55/code91 manifest. All 12 locale keysets have 1,745 keys. Source-string checks and fatigue/history-edit property probes passed. There are no frontend lint/typecheck scripts.
- Local Android `assembleRelease bundleRelease :app:lintRelease` passed in 13 seconds with JDK21/SDK35. Local artifacts are not published; the signed exact-source candidate and release come from GitHub Actions.
- Isolated Chromium/Edge and WebKit browser QA covered English/Spanish, light/dark themes, 320/390/1280px, both name modes, 72 layout checks, search by either name, missing/blank/duplicate/long aliases, editing/deletion during a running session and unchanged work deadlines. Offline persistence and IndexedDB recovery passed in both engines.
- Seven final PDFs / 13 pages passed actual download, strict parsing, image decoding, full render and visual review. Real SVG font measurements covered 228 name rows in Chromium/WebKit, including wide letters, CJK, emoji, flags and hearts; the optimization retained the same lines and positions.
- Opera's local TGym was updated and left open. The isolated physical Android QA app passed both selectors and reopen persistence. Installation preserved the exact QA state file; protected history/routine/body/alias/session data and primary-app package metadata remained equal. Final installed assets matched the build. Integrity comparisons exclude only normal accumulated-active-duration cache and last-user-interaction fields; session entries and deadlines remain protected. The primary TGym app/data were not read or changed.

Ignored test evidence is under `.tools/exercise-names/`, `.tools/stats-report-export/` and `.tools/release-1.15.56/`. Synthetic example PDFs in `output/` are excluded from the source commit. Credentials, signing material, device SDK paths and personal profiles are not committed.

## Publication verification

All five workflows completed successfully against the same runtime commit:

| Check | Exact-source run | Result |
| --- | --- | --- |
| Frontend, API, MCP and source checks | [37490863130](https://github.com/Truesilverking/TGym/actions/runs/37490863130) | Passed |
| PWA validation | [37490866667](https://github.com/Truesilverking/TGym/actions/runs/37490866667) | Passed |
| Android build, lint and emulator | [37490869888](https://github.com/Truesilverking/TGym/actions/runs/37490869888) | 11 instrumented tests, zero failures/skips |
| Signed candidate | [37490873446](https://github.com/Truesilverking/TGym/actions/runs/37490873446) | Passed; downloaded APK independently verified before tagging |
| Signed release and Pages publication | [37491944349](https://github.com/Truesilverking/TGym/actions/runs/37491944349) | Passed, including public artifact verification and notification submission |

The actual public manifest, GitHub release assets and PWA `build.json` agree on 1.15.56/code92 and runtime commit `415f4a715d2b1cb89140ac915cd4416a924856e1`. The downloaded GitHub and Pages APKs are byte-identical. Actual APK verification, non-debuggable package identity, AAB JAR signature/certificate and embedded APK/AAB build metadata passed independent checks. The official package remains `app.framegym.mobile`; its certificate matches the previous public 1.15.55 release.

| Published artifact | SHA-256 |
| --- | --- |
| APK (GitHub and Pages) | `d4eb42c38337d3a89db3c8f335dddd00721402b5f8c02bf3a21820f7639a9ac1` |
| AAB | `1e10319aded051e1a52b86ef764b36b1069c15c01984a2e4d8adfd936ad166e5` |
| Official signing certificate | `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082` |

The real updater module passed all four public checks: Android/GitHub and PWA on 1.15.55 offer 1.15.56, while 1.15.56 does not offer itself. Android uses the trusted manifest/APK metadata; PWA uses its own build metadata. Their storage keys remain separate.

The production PWA updated from 1.15.55 to 1.15.56 through the actual Settings Check for updates → Update flow in an isolated persistent Edge profile at 390px. It preserved 33 synthetic workout rows and exact protected routine, schedule, bodyweight, exercise-weight, alias, active-session and preference fields, including `statsSections: ['exercise']` and `exerciseNameMode: 'original'`. The current worker cache identifies version 1.15.56 and the runtime commit. Closing the complete browser and reopening that profile offline preserved the same data/preferences and functional UI.

The public UI displayed originals despite aliases and found exercises by either name. Stats kept only Exercise progress visible, exposed all eleven options without Training History and blocked removing the final selection. Canceling report export created no files. A confirmed Stats PDF included Exercise progress and hidden Recent workouts, retained original labels and did not change visible sections. The actual downloaded PDF opened and rendered to two pages, both visually reviewed without clipping or overlaps. Public verification used only synthetic storage; the user's browser storage and primary phone app were untouched.

Firebase accepted one update notification for each existing topic, `tgym_updates` and `tgym_updates_v2`, in the successful release workflow. This proves service acceptance, not receipt on a particular handset.

## Device limits

Physical iPhone/Safari/installed iOS PWA and native iOS compilation remain unverified; WebKit emulation is separate evidence. Local QA installation does not establish installation of the official signed release in the user's primary phone app. Firebase service acceptance is recorded separately from handset receipt.
