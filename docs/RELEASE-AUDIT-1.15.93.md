# TGym 1.15.93 / Android 129

Release candidate integrating the verified local experience changes over the published 1.15.77 baseline. Publication, official signed artifacts and update notification delivery are pending the exact-source release pipeline; the results below distinguish completed local checks from those pending steps.

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

Before the version tag, the same source commit must pass Tests, Validate PWA, Validate Android and the signed Android candidate workflow. Official APK/AAB identity, signing continuity, version 1.15.93 / code 129, hashes and public metadata must then agree. Only the normal release pipeline sends the update topics; no separate resend is planned.

The existing production update/installer validation remains intact: trusted source, SHA-256, package, newer version and installed signing identity. Profile storage keys, exercise/routine IDs, portable backup compatibility and the shared workout clock are retained. The release never seeds the QA demonstration history into user profiles.

Physical iPhone acceptance, actual notification reception/speaker audibility and production-device installation remain separate from browser, emulator, scheduling and service-acceptance evidence. The final CI, publication and public-artifact results will be recorded here after completion. Private backups, real-device screenshots, personal media and unrelated local projects are excluded from the public commit.
