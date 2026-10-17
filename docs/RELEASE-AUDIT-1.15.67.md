# TGym 1.15.67 / Android 103

Release scope: shared accessible Streak/Consistency calendar presentation and isolated local official-catalog draft tooling. `REPORT-CALENDAR-AUDIT-1.15.67.md` documents palette, status predicates, layout and export coverage. `OFFICIAL-CATALOG-PROPOSAL.md` separates implemented local tooling from the proposed remote channel and its authorization requirements.

## Local checks

| Check | Result |
| --- | --- |
| Frontend | 183 files, 2,021 tests passed with `pnpm test --maxWorkers=4` |
| Initial fully parallel frontend run | Four existing XLSX tests timed out at 5 seconds under concurrent QA load; 2,016 passed. No assertion failure. The complete suite then passed with four workers and unchanged test timeouts. |
| API | 11 tests passed |
| MCP | 37 tests and plain-Node import/loadability passed |
| Catalog draft tool | 6 Node regression tests passed; no publishing endpoint exists |
| Locales/source keys | 12 locales, 1,908 keys each synchronized; 1,213 source strings present |
| Fatigue invariants | 108,000 monotonic comparisons and 14,076 deletion comparisons passed |
| Web/mobile builds | Passed; Capacitor synchronization is separate from native compilation |
| PWA build/update/offline | Exact-source acceptance recorded below after compilation |
| Android native build/lint | JDK 21 / SDK 35 `assembleDebug :app:lintDebug` passed locally (386 tasks); signed release and emulator evidence follow below |
| Frontend lint/types | No lint or typecheck scripts exist. These checks were not claimed as passed. |

## Browser and export evidence

Independent Edge/Chromium and WebKit runs generated 56 initial PNG/PDF files over all existing periods/formats, empty and long ranges, month/year boundaries and combined reports, plus four UI PDFs and eight Spanish sample exports. The checks cover 102 initial SVG pages and 6,632 square day cells, exact cell/legend correspondence, 42 real PDFs / 92 pages with uniform final image transforms, nonblank pages, profile immutability, all eight real accents, light/dark themes and enlarged text. Rendered samples and machine-readable evidence are local under `.tools/reports67/`; `REPORTS-VISUAL-AUDIT-1.15.67.md` records the independent review.

The initial live-screen QA caught an ellipsized week range at 320 px; the corrected title wraps and includes years. Miniature month views now include day numbers and weekday headings and use a readable single column on narrow screens. Keyboard focus, deload indication, measurement reminders and existing navigation remain available.

## Publication and device boundaries

The requested release uses the existing signed Android/PWA pipeline with normal update-topic notifications enabled. Before tagging, exact-source Tests, PWA, Android/emulator and signed-candidate workflows must pass, and candidate identity/signing continuity must match the preserved public 1.15.66/102 baseline. After publication, verify tag/commit/version/code, SHA-256, signing identity, GitHub/Pages APK equality and the PWA shell digest.

No physical device was connected. Physical iPhone Safari/installed PWA, a second device, native share-sheet acceptance, phone notification receipt and installation on the owner's phone are pending. FCM acceptance is distinct from actual receipt. No production personal profile was opened or modified during QA.

The catalog editor's local GIF creation/replacement/validation/reopen checks do not prove remote distribution. Creating a global exercise, publishing it, detecting/updating on another device, offline reopening and rejecting unauthorized remote publishers remain pending the separately authorized catalog channel.

The real local master was initialized outside the repository at `%LOCALAPPDATA%/TGymCatalog` with 1,324 current official exercises and no new resources or personal fields. Local-only browser acceptance passed adding a synthetic exercise/GIF in a separate temporary master, observing changing rendered frames, saving/reloading and preparing an unsigned review package. The real master contains no synthetic QA exercise. WebKit checked GIF decoding and reduced-motion playback controls; no remote publication was performed.
