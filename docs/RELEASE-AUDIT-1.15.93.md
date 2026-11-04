# TGym 1.15.93 / Android 129

**Published and verified**, integrating the local experience changes over the 1.15.77 baseline. Runtime source: `f9850f6ce0448764cef6df6e0c2a357bfc95f214`, annotated tag [v1.15.93](https://github.com/Truesilverking/TGym/releases/tag/v1.15.93). The release pipeline, official artifacts, public PWA and update notification service acceptance passed. [Structured evidence](RELEASE-EVIDENCE-1.15.93.json) records the exact source, runs, hashes and remaining device-specific boundaries.

## Changes

| Flow | Included behavior |
| --- | --- |
| Training / Home | Centered routine information action, larger streak/title/date, responsive layout and reorganized Body Weight. Current and target weights align, the previous-record change stays below them and the last-record date sits at the lower right. |
| Streak calendar | Week opens first, Month/Year remain available, compact period headings and annual mini-months, independent recent workouts, optional local name/photo, tracking-start marker and existing export/muscle actions. Visible legend text is separate from the retained current/future date styling. |
| Recent lists | Three session times and five recent workouts initially, newest first, with localized Show more only when more records exist. Storage and complete history remain intact. |
| Stats | A movable side arrow opens section selection; selection order controls display order. Local preferences retain the selection, order, side and vertical position. Total-time presentation adapts to duration and supports the existing long-press unit selector. |
| Body comparison | Before/After are side by side with centered dates, readable borderless values, smaller leader arrows and adjacent changes. No change is represented by `=`; existing unit conversions and record identities remain authoritative. |
| Reminders / rest timers | Larger time controls, simplified main settings, advanced scheduling retained, configurable in-app reminders and sound preferences. Recurring reminders use Today/Tomorrow when applicable; explicit dated plans retain weekday/date. Stable notification IDs and shared scheduling/deduplication are preserved. |
| Workout | Time-mode cardio duration is displayed/edited in minutes while compatible stored seconds remain unchanged. Inactivity time editing requires its explicit action. Shared duration, pause and rest helpers remain authoritative. |
| Tour / unlock / profile | Nineteen brief grouped tour steps with Back/Next/Skip/Finish and an ephemeral workout preview. Clearer unlock layout reuses the existing credentials. Local profile editing supports optional photo add/change/remove without requiring cloud sign-in. |
| Performance | Input-only clock persistence preserves unrelated collection identities, batches bounded metadata writes and flushes before suspension. Media poster decoding is shared and bounded; no device-wide latency guarantee is claimed. |

The independent exercise catalogue updater is a **proposal**, not a shipped updater. See [the versioned catalogue plan](CATALOG-UPDATE-PLAN-2026-10-22.md) for stable identifiers, personal overlays, deferred installation and transactional rollback.

## Validation before publication

- Frozen frontend source matches the installed QA runtime and its tests: 603 files, tree SHA-256 `21fecee3f8a3288c33c07dbdc0fca9241fbd93783e911b35aa7c1bb4726b0cb5`.
- Local frontend suite: **2371 passed; two Excel tests reached their five-second timeout** while the independent checks ran concurrently. The two affected files then passed **36/36 tests** in isolation with the unchanged timeout and no source changes. These original failures are retained locally; they are not described as a clean full-suite run. Exact-source CI must pass before publication.
- API: **16 passed**. MCP: **37 passed**, plus plain-Node loadability. Catalogue checks: **6 passed**. Twelve locale keysets are synchronized at **2006 keys** each; source-string and fatigue checks passed.
- Local web/PWA/mobile and isolated QA Android compilation passed for this runtime. `build:mobile` synchronizes Capacitor; Gradle compiles the APK separately.
- Compiled Home validation: **six Edge/WebKit cases**, Spanish/English, 320/390/1440 px, empty/single/multiple histories and optional goals. The final sizes, alignment, date, persistence and reload checks passed without page errors or profile writes. Existing editor actions have separate open/cancel coverage.
- Physical Pixel TGym QA 1.15.93: final Home geometry and cold reopen passed. Protected data, preferences, active session and native/WebView agreement were preserved. This QA package/signature is separate from official production signing; it does not prove production installation.
- Earlier focused checks cover Stats selection/position, reminders, tour, unlock, profile and body comparison. They are not presented as a new complete physical acceptance run of every feature in this publication.

Public screenshots use **fictitious browser profiles**, not personal device photos or backups:

- [Home, Spanish mobile](assets/experience-1.15.93/home-mobile-es.png)
- [Home, English desktop](assets/experience-1.15.93/home-desktop-en.png)
- [Stats section selection](assets/experience-1.15.93/stats-sections-mobile-es.png)
- [Date-specific reminders](assets/experience-1.15.93/reminders-date-specific-es.png)

## Publication gate and remaining evidence

All required workflows passed for the same runtime source before the version tag:

| Check | Confirmed result |
| --- | --- |
| [Tests](https://github.com/Truesilverking/TGym/actions/runs/40063083214) and [PR Tests](https://github.com/Truesilverking/TGym/actions/runs/40063086410) | **2373 frontend tests / 213 files**, API 16, MCP 37, catalogue 6 and Node/locale checks passed. The exact-source CI suite is clean; it supersedes the local timeout limitation above. |
| [Validate PWA](https://github.com/Truesilverking/TGym/actions/runs/40063083195) | Complete frontend suite and PWA build passed. |
| [Validate Android](https://github.com/Truesilverking/TGym/actions/runs/40063083197) | Compilation, Android lint and **15 instrumented tests, zero failures, zero skipped**. Counts were independently checked against the HTML report, class pages and source test methods; the uploaded artifact contains HTML rather than JUnit XML. |
| [Signed candidate](https://github.com/Truesilverking/TGym/actions/runs/40063101333) | Production package, version/code, official certificate, APK/AAB signatures, build metadata and checksums verified before tagging. |
| [Release](https://github.com/Truesilverking/TGym/actions/runs/40063641537) | **Success**: signed APK/AAB, GitHub Release, Pages deployment, public metadata checks and update topic sends. |

The public APK and the Pages mirror are byte-identical: SHA-256 `18c58d0f062116f5b9d7c33cd77470c1a128fbda375fbee59b2f8b6b65560eb7`. AAB SHA-256: `f76748b74df776dcbcc370ec017b68a320e6068d804a68d6ab32bda3a960824e`. Both checksums and signatures passed. The retained production certificate is `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082`; package `app.framegym.mobile` is not debuggable. All 66 shared APK runtime assets match the signed candidate, and all **62 deployed PWA files** match the release Pages artifact. Public manifest/build metadata identifies the same runtime commit and version/code.

The release pipeline received FCM acceptance once for each intended topic, `tgym_updates` and `tgym_updates_v2`, at 2026-10-24 04:50:06 UTC. No manual resend was dispatched. This proves service acceptance, not reception on a particular phone.

## Isolated PWA update and offline preservation

A persistent, fictitious Edge profile first loaded **1.15.77 offline** under its original service worker with the existing cached shell. The normal Check/Update flow then activated **1.15.93** from the published runtime source and committed a valid pre-update backup. All previous fields, history, preferences, custom exercise and paused active session/set entries remained intact, with no duplicates. The protected original-field CRC remained `abc4dad2` before and after.

The only additive preference was the source-defined default `streakCalendarShowProfile:false`, absent in the old profile. The complete new-profile checksum therefore differs; this is not described as byte-identical whole-profile JSON. The initial strict-check expectation and transport recovery were retained locally, without changing app source or repeating the update. Up-to-date detection, offline reload, two persistent-browser restarts offline and the IndexedDB current mirror passed with zero page errors or warnings. The actual installed desktop PWA and Pixel were not used for this isolated migration test.

## Integration and boundaries

Changes and the release tag are available on GitHub from `Dev`. [PR #12](https://github.com/Truesilverking/TGym/pull/12) integrates the same work into `main`; its required independent review remains pending. Branch protection was not changed or bypassed. Later evidence-only commits may update these documents without changing the tagged runtime source.

The existing production update/installer validation remains intact: trusted source, SHA-256, package, newer version and installed signing identity. Profile storage keys, exercise/routine IDs, portable backup compatibility and the shared workout clock are retained. The release never seeds the QA demonstration history into user profiles.

Physical iPhone acceptance, actual notification reception/speaker audibility and production-device installation remain separate from browser, emulator, scheduling and service-acceptance evidence. Private backups, real-device screenshots, personal media and unrelated local projects are excluded from the public commit.
