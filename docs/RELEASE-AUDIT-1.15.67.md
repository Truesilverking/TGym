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
| PWA build/update/offline | Passed for local, CI and actual public shells; full-profile retention and corrected calendar exports after offline reopen |
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

## Verified publication — 17 October 2026

Runtime source: `0e48a8c3ad1f6503906111beb2d4fac69cf303a3`; annotated tag `v1.15.67`. [Published release](https://github.com/Truesilverking/TGym/releases/tag/v1.15.67).

| Exact-source workflow | Result |
| --- | --- |
| [Tests 39050725989](https://github.com/Truesilverking/TGym/actions/runs/39050725989) | Passed frontend 2,021 / 183 files, API 11, MCP 37 + Node loadability, catalog 6, locales and fatigue probes |
| [PWA 39050727914](https://github.com/Truesilverking/TGym/actions/runs/39050727914) | Passed; compiled CI shell version/source verified |
| [Android 39050729632](https://github.com/Truesilverking/TGym/actions/runs/39050729632) | Debug compilation/lint and 11 emulator tests passed, zero failures/skips |
| [Signed candidate 39050731331](https://github.com/Truesilverking/TGym/actions/runs/39050731331) | Release APK/AAB + release lint passed on attempt 2. Attempt 1 failed resolving existing Maven dependencies before compilation; the same-source retry passed. Original failure logs retained. |
| [Release 39051300503](https://github.com/Truesilverking/TGym/actions/runs/39051300503) | Passed signed publication, Pages deployment, actual public artifact validation and update notification submission |

The public APK SHA-256 is `5f8033970bba750fc93d835482322726a6bdc549cc7a72d94ab0078577f82e8c`; GitHub Release and Pages APK bytes are identical. Package `app.framegym.mobile`, version `1.15.67`, code `103`, min/target/compile SDK `23/35/35`, non-debuggable status and the installed signing lineage match the preserved 1.15.66 baseline. APK and AAB signatures and published checksums were verified independently. Certificate SHA-256: `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082`.

Candidate/public AAB archives are byte-identical. APK archive hashes differ only inside the signing block: all 1,116 ZIP entries, including DEX/native resources and all 61 web assets, have identical contents and entry metadata. Both APK signatures validate against the same official certificate.

The live `updates/latest.json`, `build.json`, release tag and all 57 PWA precache resources agree with the exact runtime source and service-worker content digest. Windows local and Linux CI shells have different byte-level cache identities; those differences were documented rather than treated as identical artifacts. The actual downloaded public shell was then tested separately.

In isolated persistent Edge/Chromium and WebKit contexts, the **actual public** 1.15.66 → 1.15.67 Check/Update flow passed. Official portable backups before, after and after offline reopening are completely equal, the IndexedDB pre-update snapshot matches the original backup, and every activated worker asset matches the downloaded public SHA-256. Edge restarted fully disconnected; WebKit restarted after the app-origin server was stopped (a physical disconnected-iPhone claim is not made). Both corrected calendar PDFs downloaded through their existing UI entry points after offline reopening, and JSON/XLSX/PDF/template exports plus import review/cancel retained the complete synthetic profile.

Public update checks offer 1.15.67/code 103 to 1.15.66 and offer nothing to already-current 1.15.67, for native/GitHub and PWA distribution paths. They used separate in-memory update storage, not the owner's app profile.

The original remote annotated tag contains no suppression marker. Logged policy is `send=true`; FCM accepted `tgym_updates` and `tgym_updates_v2` once each. No notification resend/release rerun was performed. This proves service acceptance, not receipt or installation on a particular phone.

Local evidence: `complete-verified.json`, `public-artifacts-verified.json`, `candidate-public-apk-entries.json`, `notification-verified.json`, `updater-verified.json`, and `public-update-{edge,webkit}/pwa-*-proof.json` under `.tools/reports67/`. The owner explicitly selected local catalog tooling/proposal only; global content publishing and catalog updates remain deferred by choice.
