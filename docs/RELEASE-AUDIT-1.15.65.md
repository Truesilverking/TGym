# TGym 1.15.65 / Android 101 release audit

Status: published and independently verified. Runtime source `dbf2c690dca3fe86a99c580ae01c61e97508f262`, branch `fix/iphone-routine-quota-1.15.65`, immutable annotated tag object `0cb2ed820274898b4467096cb791dbfbed5d70ca`. [Release](https://github.com/Truesilverking/TGym/releases/tag/v1.15.65), [production PWA](https://truesilverking.github.io/TGym/) and [successful release workflow](https://github.com/Truesilverking/TGym/actions/runs/38201188458) identify that runtime source. A documentation follow-up records the completed evidence without moving the tag.

The [routine import audit](ROUTINE-IMPORT-QUOTA-AUDIT-1.15.65.md) records the original private-file reproduction, exact storage operation, valid source content, quota recovery, atomic failure/retry behavior and storage migration. The personal JSON, exported personal round trips and screenshots remain ignored; committed tests generate anonymous equivalent resources. Unrelated `cv-studio/` and `output/` changes are excluded.

## Exact-source checks before publication

| Gate | Run / artifact | Verified result |
| --- | --- | --- |
| Tests | [38200733278](https://github.com/Truesilverking/TGym/actions/runs/38200733278) | Frontend 1,976 / 179 files, API 11, MCP 37, build, locale/source checks, fatigue/history probes and Node loadability |
| PWA | [38200734683](https://github.com/Truesilverking/TGym/actions/runs/38200734683), artifact 11725885842 | Exact version/source metadata, valid ZIP CRC and complete frozen PWA |
| Android | [38200735844](https://github.com/Truesilverking/TGym/actions/runs/38200735844), report 11726125534 | Debug compile/lint; 11 API 35 emulator tests, zero failures/ignored; XML/report totals agree with actual logs |
| Signed candidate | [38200737034](https://github.com/Truesilverking/TGym/actions/runs/38200737034), artifact 11724334851 | APK/AAB signatures, archive CRC, checksums, package/code/SDK, production signing continuity and release lint |

All four runs completed successfully at the exact accepted runtime commit before tagging. Candidate package is non-debuggable `app.framegym.mobile`, version 1.15.65 / code 101, minimum SDK 23 / target and compile SDK 35. Candidate APK/AAB share 61 byte-identical web assets. Candidate APK SHA-256: `7fd6f3fae63ff80f228d85dd48d0c55075094f86e2c47cae6c006450554e899e`; AAB: `c175d3edbf3a5a0986f9c25f8619356c34792f74a7a377f344d815a0ce23843b`.

Local final frontend checks also passed 1,976 tests / 179 files; API 11 and MCP 37 plus plain-Node loadability passed. All 12 locale packs contain 1,830 synchronized keys, and all 1,175 translated source strings are present. Version checking, web/PWA/mobile asset builds and local `assembleDebug lintDebug` passed with JDK 21 / SDK 35. The local application lint report has 20 warnings and zero errors. There are no frontend lint/typecheck scripts; mobile synchronization is not native iOS compilation.

## Browser and deployed-payload acceptance

The original-file workflow passed nine groups in each of isolated Edge and WebKit on the actual final CI artifact and then again on independently downloaded public PWA assets. These groups cover matching-unit preview/cancel, existing-data import/double confirmation, reload hydration, actual JSON export/reimport/repeated Keep, empty-target explicit lb-to-kg conversion/schedule/prescriptions, aborted second resource write/retry, actual exhausted localStorage/final-primary rollback/retry, entire-browser origin-down reopen/export and actual custom-media rendering offline. No page errors occurred. All required images/GIFs, notes, series, reps/RIR ranges, rests, time goals and Top/Back-off prescriptions survive; unrelated routines, preferences and history are retained. Store regressions additionally preserve an active session across unsuccessful primary/intermediate writes.

Separate actual Check/Update 64→65 tests pass eight groups per engine against the final CI artifact and downloaded public payload. The old published-64 worker is loaded first; Update backs up before switching, activates the correct new worker/entry and verifies each cached file by SHA-256. The pre-update portable safety copy equals the original64 backup; the sole permitted portable change after upgrade is `storageVersion: 3→4`. Complete-process reopen, subsequent full backup equality, offline JSON/XLSX/PDF/template downloads, actual XLSX review/cancel and another reopen all pass without reseeding storage.

Spanish original-file browser checks pass three groups per engine on the public payload: actual source/device lb display with no false kg-to-lb conflict, translated deload/effort notices, neutral general warning plus precise quota/recovery text, initially collapsed original technical details, unchanged previous profile/retained choices and retry without duplicate routines/custom exercises or preference changes. The synthetic destination enables deload/RPE to exercise those notices; that is not evidence about the unknown original phone's settings.

Edge's updater suite verifies complete browser-process reopen with network offline. WebKit uses a stopped app-origin server because Playwright's `setOffline` issue was independently demonstrated earlier; live app-origin requests fail and the cached application/resources work, while `navigator.onLine` remains true. This is explicit browser-engine evidence, not a disconnected physical iPhone or installed Home Screen acceptance claim.

## Public integrity and updater

Release workflow 38201188458 completed successfully and its actual test logs contain 1,976 / 179. Fresh public downloads independently verify GitHub/Pages APK byte equality, APK/AAB signatures, checksums, package/version/code/SDK and retained certificate SHA-256 `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082`.

Public APK SHA-256: `4bcb1c3d33603662d6aafa066d72c8c4ae1657a9f1452ce1815b7fc9fe34fe20`. Public AAB SHA-256: `c175d3edbf3a5a0986f9c25f8619356c34792f74a7a377f344d815a0ce23843b`. Although APK container hashes differ from the candidate, all 66 runtime files, including 61 web files, are byte-identical; both archives have valid CRCs. The container difference is not a source/payload difference.

Live release/Pages update metadata and build metadata agree on 1.15.65 / code101 / runtime source. The public worker is `tgym-app-1.15.65-dbf2c690dca3fe86a99c580ae01c61e97508f262-4f4727f66e8b`; all 57 precached resources and its digest are verified. Actual updater calls with separate storage offer 65 from64 for GitHub/PWA and do not offer an update from65. No personal browser or application profile is changed by those probes.

The original remote annotated tag, source and standalone `[skip-update-notifications]` marker are verified. The completed release workflow's notification-delivery step is actually skipped. No notification acceptance or handset receipt is claimed.

Physical iPhone Safari/Home Screen tests are unavailable: the screenshot belongs to another person, so iOS/TGym version and launch mode cannot be obtained. Native iOS compilation is unavailable on Windows. Native Capacitor keeps its prior persistence path; the demonstrated standalone Safari/PWA quota fallback is the scope of this correction. No physical Android65 acceptance is inferred from API35 emulation or earlier Pixel release audits.

Ignored proofs include `pretag-verified.json`, `publication-source-gate.json`, `publication-verified.json`, `public-artifacts-verified.json`, `candidate-public-payload-verified.json`, `updater-verified.json`, public browser import proofs, `pwa-update-*-public/` and `spanish-*-public/`. Prior superseded-commit proofs are archived separately and do not count as final-source acceptance.
