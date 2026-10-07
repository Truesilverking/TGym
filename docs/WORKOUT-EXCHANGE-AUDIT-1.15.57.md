# TGym 1.15.57 / Android93 candidate audit

Requested on 2026-10-07: accurate Finish/Continue and 30-minute inactivity clocks, plus routine PDF/XLSX/JSON exchange and an editable catalogue-backed Excel template. This candidate is prepared for installation in the owner's TGym and isolated TGym QA packages. It does not publish a release, Pages update or update notification.

## Data flow

The persisted workout timestamps and accumulated pause duration remain authoritative through `workout-time.js`. Completion freezes immediately; explicit Continue excludes review time and permits additional session exercises without editing the original routine. Trusted app input extends the inactivity deadline, while timers and background work do not. Suspension/reload/offline reconciliation pauses the same active session at the original input+30-minute timestamp. Manual/completion/inactivity reasons remain distinct; inactivity never saves history or resumes automatically. Audited duration correction reaches completed history, statistics, routine averages and Progress through the same helper. Native notifications freeze at the matching deadline. Existing historical sessions and storage/package identifiers retain compatibility.

The existing plan tools open the selection, confirmation, preparation, download and preview flow. JSON exchange v1 and XLSX carry routines, exercise configurations, order, schedule, catalogue identities, aliases, library notes and supported defaults. Excel has the five requested visible sheets, real catalogue dropdowns and native validations; preservation metadata retains fields not represented by editable columns. Editable cells take precedence and unsupported prescriptions are rejected with row/field errors. Import validates references, units, ranges, associations, unknown-exercise mappings and conflict choices before one atomic persisted update. Replacing selected routines applies their reviewed order/schedule while preserving unrelated routines. Conflict fingerprints prevent overwriting changes made after preview. Legacy plan v1 stays accepted without silently removing unknown exercises. PDF uses the shared save infrastructure and preserves paginated prescription/note content.

Format rules and compatibility are documented in [WORKOUT-CLOCK.md](WORKOUT-CLOCK.md) and [ROUTINE-EXCHANGE.md](ROUTINE-EXCHANGE.md).

## Local verification before candidate signing

- Frozen pnpm10 installation passed. The complete initial frontend run passed 1,580 tests; one existing 255-combination report test exceeded its five-second timeout during simultaneous browser automation. Its full 19-test file passed independently afterward. Final changed exchange/App/parity coverage passed 47 tests; clock-focused tests passed separately. Exact-source CI records the final complete suite below when available.
- API11 tests, MCP37 tests and plain-Node loadability passed. Locale/source checks passed for12 synchronized packs; fatigue probes passed108,000 comparisons and14,076 history-edit comparisons. There are no frontend lint/typecheck scripts.
- Web, standalone PWA and mobile asset/Capacitor builds passed. Bundling retains the existing large-chunk warning. Windows Capacitor sync is not iOS native compilation.
- Production-bundle Chromium clock flows passed: Finish→20-minute controlled wait→Continue→additional exercise with logged sets→Finish; inactivity→reload→duration correction→Continue→Finish; manual pause→35-minute controlled wait→reload→explicit resume. These are accelerated browser tests.
- Chromium routine downloads passed for one/multiple/all JSON, full XLSX/PDF and the template. XLSX preview did not mutate state; confirmed replacement preserved IDs, complete configuration, custom definitions, aliases and schedule. Invalid references and unknown-exercise mapping/cancel left the profile unchanged.
- Native XLSX XML confirmed exact string exercise IDs, blank cells, catalogue named range and validations through row10001. PDF width stress checks covered wide letters, CJK, emoji and long notes without overflowing the page. Final document visual review and offline/other-engine results are recorded below when available.

## Device and signing evidence

A physical Pixel10 is connected. Main TGym1.15.56/code92 and its installed signing certificate were verified. The full main profile was privately exported to an offline local receiver, its backup checksum validated, and comparison hashes retained outside Git. TGym QA's original browser/native snapshots and installed APKs were also retained privately. No production profile was seeded with synthetic data.

At this initial checkpoint, final QA/main installation, native instrumentation, the real31-minute lock/process-stop/offline recovery test and post-install full-profile comparison remain pending. Physical iPhone/PWA acceptance is unavailable; desktop WebKit and controlled clocks do not replace it.
