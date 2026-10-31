# TGym 1.15.51 / Android87 release audit

Published and independently verified 2026-10-03. Runtime source: `58e5e20496cf659338ffa4df8ba24c1d911bb758` on `feature/home-streak-refresh`; versionName 1.15.51, versionCode 87. The source and immutable `v1.15.51` tag were pushed after exact-source checks passed. The [GitHub release](https://github.com/Truesilverking/TGym/releases/tag/v1.15.51), signed Android downloads, update manifest and production PWA supersede 1.15.50 / Android86.

## Scope

Home now refreshes its calendar calculations at local midnight and after foreground/focus/page restoration. The UI-only `use-local-now.js` clock also detects local-day, UTC-offset and timezone-ID changes during visible checks. Timers/listeners are removed on unmount; hidden views wait for resume. The initial refresh covers a midnight/timezone change between render and effect setup.

Home passes one date snapshot to the streak, consistency card, calendar strip, daily plan and training-history boundary. It reuses the existing activity/streak calculations. Classification, streak temporal rules, deload/progression formulas, workout clocks, storage keys and recorded workout dates remain unchanged. Clock refresh does not persist state or rewrite history.

Profiles are **synthetic**: two planned and three extra sessions occupy four dates, sharing one date. They verify flame four, daily deduplication and existing pause/rest rules. These fixtures do not establish the user's actual history or streak. No personal records were altered.

## Validation

| Check | Verified result |
| --- | --- |
| Frontend | 1,362 tests in 139 files passed. New coverage includes activity/date deduplication, edits/deletions, persisted reopen, local midnight, suspended resume, timezone changes, DST, initial-render race and StrictMode cleanup. |
| Optional API | 11 tests passed. |
| MCP | 37 tests and the plain-Node import-graph check passed. |
| Builds | Web, standalone PWA and mobile assets/Capacitor synchronization passed. Mobile asset synchronization is not APK compilation. |
| Local Android | `assembleRelease lintRelease` passed with JDK21/SDK35; 18 inherited lint warnings, zero errors. |
| Android CI | Debug build/lint and 11 Android35 emulator instrumentation tests passed. Emulator evidence is separate from physical phone acceptance. |

No frontend lint/typecheck scripts exist; neither check is claimed. No new dependency or persisted streak counter was introduced.

## Exact-source Actions

Ignored `.tools/release-1.15.51/action-*.json` records confirm success and the source SHA for these runs.

| Workflow | Run | Result |
| --- | --- | --- |
| Tests | [37143065787](https://github.com/Truesilverking/TGym/actions/runs/37143065787) | PASSED: frontend 1,362, API 11, MCP 37 and related checks. |
| PWA validation | [37143067228](https://github.com/Truesilverking/TGym/actions/runs/37143067228) | PASSED. |
| Android/emulator validation | [37143068449](https://github.com/Truesilverking/TGym/actions/runs/37143068449) | PASSED: 11 instrumentation tests. |
| Signed release/publication | [37143481302](https://github.com/Truesilverking/TGym/actions/runs/37143481302) | PASSED: signed APK/AAB, deployed PWA, public metadata/artifact checks and FCM submission. |

## Publication verification

| Required evidence | Status |
| --- | --- |
| Immutable source/tag | Remote `v1.15.51` points to the runtime SHA above; no existing tag was moved. |
| GitHub APK/AAB/checksums and public update metadata | Non-draft/non-prerelease release; all four assets available. Public `updates/latest.json` and `build.json` report 1.15.51/code87 and the tagged source. |
| Independently downloaded GitHub/Pages APK SHA-256 | Both APKs match the manifest and published checksum: `fb78f5e304eec62a4700dbc8807da43e582a25283871e386d1f9b1b4bbc699fe`. |
| Independently downloaded AAB SHA-256 | Matches published checksum: `05d3843bd5f000bb989eb3fb11ee44c6f9e47f44df734fde6f58025b7b52cd19`. AAB signing verification passed in the release workflow. |
| Actual package/version/signing verification | `aapt`: `app.framegym.mobile`, 1.15.51/code87. `apksigner`: APK v2 verified; actual certificate equals the manifest and previous official release: `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082`. |
| Updater with public metadata | Actual module offers 1.15.51 to Android/PWA 1.15.50; current 1.15.51 is not reoffered. Existing trusted-host/hash/package/version/signer validation remains intact. |
| Actual production PWA 1.15.50 -> 1.15.51 update | Real Check for updates / Update controls load 1.15.51 in an isolated persistent profile. All selected fields, including 33 synthetic workout records, routines, body records and preferences, remain equal. Offline reopen passed. |
| Published Home UI | Chromium/Edge and WebKit show four for the synthetic four-date case. After midnight, pause preserves four; a missed scheduled day resets the flame to zero while daily consistency retains four active dates. No history write, horizontal overflow or page error. |
| FCM topic submission | Release logs confirm service acceptance for `tgym_updates` and `tgym_updates_v2` after public artifact verification. Acceptance is not phone receipt. |
| Physical phone receipt/installation | NOT VERIFIED. |

Ignored verification records are in `.tools/release-1.15.51/verified-web.json`, `aab-verified.json`, `signature.txt`, `public-pwa-verified.json` and `action-37143481302.json`; public Home flows are in `.tools/streak51/browser-proof.json`. No credentials or private backups are committed. See [HOME-STREAK-AUDIT.md](HOME-STREAK-AUDIT.md) for the data flow and synthetic dates.

Native iOS needs macOS/Xcode. Browser/mock/emulator checks do not prove physical delivery, process-kill recovery or installation. The screenshot alone cannot establish the user's real four workout dates. No historical repair was attempted. A subsequent documentation-only commit records this evidence without changing the tagged runtime.
