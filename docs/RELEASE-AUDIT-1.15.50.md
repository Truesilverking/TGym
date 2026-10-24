# TGym 1.15.50 / Android86 release audit

Published and independently verified 2026-10-03. Source: `dcdb9b714f02eace1b3d887e7be085128857bbf5` on `feature/settings-reminders-ux`; versionName 1.15.50, versionCode 86. The [GitHub release](https://github.com/Truesilverking/TGym/releases/tag/v1.15.50), signed Android downloads, update manifest and production PWA are available. This supersedes 1.15.48 / Android84; 1.15.49 was canceled before distribution.

## Scope and corrected failures

- Data now places **All Data stays on this device** directly below the section heading in its real render structure. Its subtitle explains optional server synchronization, cloud backup and exported copies; it does not certify an unconditional no-transfer claim.
- Measurement and workout reminder panels share accessible controls, explicit activation, saved configuration and scheduler feedback. Editing an off measurement reminder's frequency preserves its off state. Disabling/reactivating retains configuration; rapid edits preserve the latest value rather than dropping it behind a pending native operation.
- Native reminder reconciliation serializes immutable snapshots, uses distinct owned ID families and compares the actual pending list. Repeated reconciliation does not recreate matching notices. Mutations that return before the pending list reflects the change are verified before success is reported. Failed cancellation remains visible even after the preference is off. Permission denial, invalid configuration and scheduler failure are distinct from an operational notification schedule.
- Deload uses a compact accordion. Expansion is separate from activation, does not persist default parameters or change training history, and retains edits across navigation. Invalid dates/save errors remain discoverable when collapsed. Existing deload formulas and progression exclusion remain unchanged.
- The initial API-profile read now protects both local edits and existing server history. The earlier candidate could send an empty preference-only snapshot after a delayed GET; the API replaces the complete server profile on PUT. The corrected gate reads/reconciles the complete baseline before debounce, reconnect, background or manual uploads. Local preference changes are applied over that baseline; existing unit-conversion helpers normalize records and a cloned active session. Failed reads/ambiguous merges retain local and server copies and block partial uploads. Account changes discard obsolete responses; failed pairing/login synchronization does not report success.
- New idempotency coverage verifies actual repeated workout finalization/reopen retries and stable-ID measurement retries without merging legitimate equal-value records.

Detailed data paths, privacy facts and limits are in [SETTINGS-FUNCTIONAL-AUDIT.md](SETTINGS-FUNCTIONAL-AUDIT.md).

## Unpublished 1.15.49 candidate

Release workflow [37132802685](https://github.com/Truesilverking/TGym/actions/runs/37132802685) was canceled after the initial-profile replacement failure was identified, before release assets, production Pages or FCM submission. The immutable `v1.15.49` tag remains at `288708b96c9bee31bfbbc05878abf56398727a3b`; it was not moved or reused. The correction is prepared as version 1.15.50 / code86. This canceled candidate is not evidence of a delivered phone update.

## Local validation

| Check | Verified result |
| --- | --- |
| Local complete frontend suite | The recorded local run passed 1,323 tests in 136 files; `.tools/settings49/final50-frontend.log`. Exact-source CI below is the authoritative final combined result. |
| Optional API suite | 11 tests passed. |
| MCP suite and plain-Node graph | 37 tests passed; the complete MCP import graph loads under plain Node. |
| Web, standalone PWA and mobile assets | All three builds passed. Mobile build includes Capacitor synchronization, not APK compilation. |
| Local Android | `assembleRelease lintRelease` passed with JDK21/SDK35; 18 inherited warnings, zero lint errors. `.tools/settings49/final50-android.log`. |
| Focused bootstrap regressions | 47 tests in four files passed. Read/merge/upload tests use populated synthetic remote profiles and the API's whole-profile replacement contract. Coverage includes delayed GET beyond the save debounce, online/background/manual uploads, repeated read failure/retry, account change, new-account uploads, pairing failure and 5 kg → 11.02 lb conversion without losing IDs/history. |

There are no frontend lint/typecheck scripts, and those checks are not claimed. Existing build chunk-size, SDK/dependency and Android lint warnings remain. No new dependency, storage key, package identifier or signing identity was introduced.

## Shared UI verification

Isolated Chromium/Edge and WebKit flows exercised standalone PWA and mobile-mode browser bundles with synthetic profiles. Data remains first after changing preferences, leaving/returning and reloading. Both reminder configurations persist independently through edits, off/on and reopen. Deload expand/collapse does not write configuration. Dark/light layouts at 320/390/768/1280 pixels, actual Spanish language selection, enlarged root font and keyboard activation were checked without horizontal overflow or page errors; representative screenshots were inspected. Repeating these checks in mobile mode verifies the shared UI, not native phone delivery or process lifecycle.

## Exact-source Actions

These completed runs refer to `dcdb9b714f02eace1b3d887e7be085128857bbf5`. Tests passed 1,327 frontend tests, 11 API tests and 37 MCP tests. Final CI covers four more frontend cases than the recorded 1,323-test local run. MCP plain-Node loading, locale/source checks and the fatigue probe also passed. Release verification followed exact-source Tests/PWA/Android success.

| Workflow | Run | Verified result |
| --- | --- | --- |
| Tests | [37134153264](https://github.com/Truesilverking/TGym/actions/runs/37134153264) | PASSED: exact source; frontend 1,327, API 11 and MCP 37. |
| PWA validation | [37134153511](https://github.com/Truesilverking/TGym/actions/runs/37134153511) | PASSED: exact source. |
| Android/emulator validation | [37134153248](https://github.com/Truesilverking/TGym/actions/runs/37134153248) | PASSED: exact source, debug build/lint and 11 Android35 emulator instrumentation tests. |
| Signed release/publication | [37134621498](https://github.com/Truesilverking/TGym/actions/runs/37134621498) | PASSED: signed APK/AAB, public metadata/PWA, artifact verification and FCM submission. |

## Public artifacts and update verification

| Required publication evidence | Verified result |
| --- | --- |
| Immutable v1.15.50 tag/source | VERIFIED: remote tag points to `dcdb9b714f02eace1b3d887e7be085128857bbf5`. |
| GitHub release/assets | Non-draft/non-prerelease; APK, AAB, checksums.txt and latest.json available. Independently downloaded AAB matches its published checksum. |
| Public Pages metadata | latest.json/build.json report 1.15.50, code86 and the tagged source. |
| Independently downloaded APKs | GitHub and Pages bytes both match the published SHA-256 below. |
| Package/version/signature | `aapt` reports `app.framegym.mobile`, versionName 1.15.50/code86. `apksigner` verifies APK Signature Scheme v2 and the actual signer equals the manifest and previous official release. |
| Updater behavior | Actual updater module with public metadata offers 1.15.50 for Android/PWA version 1.15.48; current 1.15.50 is not reoffered. |
| Actual production PWA update | Real Check for updates / Update UI in an isolated persistent 1.15.48 profile loads 1.15.50; 33 history rows, routines, body records and selected preferences remain equal. Offline reopen passed. Published Settings flows also passed in Chromium/Edge and WebKit. |
| FCM topic submission | Release logs confirm service acceptance for `tgym_updates` and `tgym_updates_v2` after public artifact verification. This is submission evidence, not phone receipt. |
| Physical phone receipt/installation | NOT VERIFIED: service acceptance and browser/emulator evidence do not establish these outcomes. |

Public APK SHA-256: `fce337207a7ac17a7e8e1e4a07901421c2784957773137bd23c6f780a457fcb2`.

Public AAB SHA-256: `baff390536015ce3a4bab44c58a66ea7dab7e95151e0bc722744c6f25babf097`.

APK signer SHA-256: `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082`.

Independent verification records are in ignored `.tools/release-1.15.50/verified-web.json`, `aab-verified.json`, `signature.txt`, `public-pwa-verified.json` and `action-37134621498.json`. No signing credentials or private profiles are included in the repository.

## Acceptance boundaries

- Automated API checks cover helper behavior and synthetic/mock profile transfer contracts. No live passkey authentication, production API account, personal data or real Google Drive account was used for destructive testing.
- Google Drive transfer and conflict protections were inspected and tested through existing mocks; this is not a live cloud-account or production network/privacy audit. Portable JSON backups are not encrypted, and CRC32 is an accidental-corruption check.
- Ambiguous initial API merges deliberately preserve both copies and block automatic replacement. Existing populated-profile synchronization semantics remain; this release does not provide a general real-time multi-device database merge guarantee.
- Native notification mocks and scoped emulator instrumentation are distinct from physical-device permission, delivery, timezone/DST, app-kill and OS-background acceptance. Exact delivery time is not guaranteed by the shared UI.
- Local mirrors improve recovery but do not guarantee survival after every storage deletion or kill before asynchronous mirroring completes. Existing user records were not deleted to make tests pass.
- Native iOS compilation requires macOS/Xcode and has not been performed here. WebKit verifies browser/shared UI behavior only.

The immutable release tag identifies the runtime above. A subsequent documentation-only commit records this completed evidence without changing the published binaries.
