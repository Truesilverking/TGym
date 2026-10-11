# TGym 1.15.61 / Android97 release audit

Release branch: `fix/routine-exchange-1.15.61`, based on published 1.15.60 / Android96. [Version 1.15.61 is published](https://github.com/Truesilverking/TGym/releases/tag/v1.15.61), including the [production PWA](https://truesilverking.github.io/TGym/). See [routine audit](ROUTINE-EXCHANGE-AUDIT-1.15.61.md) and [format documentation](ROUTINE-EXCHANGE.md). The user requested commit, push, exact-source CI and publication after checks. No unrelated `cv-studio/` or `output/` data is part of the change.

Local frontend 1812 tests / 168 files, API11, MCP37 plus Node-loadability, source/locale checks and fatigue probes passed. Web, standalone PWA and mobile asset builds passed. Local SDK35/JDK21 Android debug compilation/lint passed. Existing large-chunk and Android dependency warnings remain. Frontend has no lint/typecheck script; production compilation and existing source checks ran. CocoaPods/Xcode were skipped on Windows, so iOS native compilation is not claimed.

Synthetic Chromium/Edge desktop/mobile and WebKit mobile browser checks verify actual JSON/XLSX/PDF downloads, template, round-trip configurations/identity/schedules, atomic preview/cancel/errors and pending runtime workout creation. Actual PDF files reopen/render and were visually inspected. XLSX opens/parses with serialized tables/validations; reconstructed saved styles were visually reviewed. Native Microsoft Excel review stopped on the user's Escape input and remains pending. Physical Android/iOS export/share/installation and notification receipt remain unverified.

## Exact-source checks before publication

Runtime source: `7788a344069423ecb73d33feecafa3a29b3ff4b9`, pushed to `fix/routine-exchange-1.15.61`. Every job passed in these runs:

| Check | Successful run |
| --- | --- |
| Frontend / API / MCP tests | [38105268820](https://github.com/Truesilverking/TGym/actions/runs/38105268820) |
| PWA validation | [38105270235](https://github.com/Truesilverking/TGym/actions/runs/38105270235) |
| Android compilation, lint and emulator | [38105271222](https://github.com/Truesilverking/TGym/actions/runs/38105271222) |
| Signed Android candidate | [38105272466](https://github.com/Truesilverking/TGym/actions/runs/38105272466) |

The downloaded Android emulator report and logs agree on 11 tests, zero failures and zero skipped tests on Android 15. The signed candidate archive (artifact `11690170202`) reopened with valid CRC/checksums. Independent APK and AAB verification confirms valid signatures, unchanged package `app.framegym.mobile`, version 1.15.61/code97, min/target/compile SDK23/35/35, a non-debuggable APK and the established certificate SHA-256 `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082`. APK/AAB embedded `build.json` both point to the exact source and all 61 web assets match between them.

Candidate APK SHA-256: `91831d4ef2666df247fc322015332c6ed598554281685ff3f46d17dea28964a3`. Candidate AAB SHA-256: `d561b851f26554d7c819c1f37ea3a9067c4fe078559757dc7a25152eaa52068b`. These candidate hashes are separate from public release hashes: the release workflow compiles its own artifacts.

After these checks, the annotated `v1.15.61` tag was pushed. Fetching the remote tag into an isolated ref confirms object type `tag`, peeled commit equal to the runtime source and exact standalone `[skip-update-notifications]` line. This suppresses phone update notifications while physical handset acceptance remains pending.

## Published artifacts and update acceptance

Release [38105679556](https://github.com/Truesilverking/TGym/actions/runs/38105679556) completed successfully on the exact runtime source. The notification step is explicitly `skipped`, matching the remote annotated tag policy; no update notification was sent by this workflow.

Downloaded public release assets and the Pages APK reopened and passed independent checks:

| Public artifact | SHA-256 |
| --- | --- |
| APK, identical on GitHub Release and Pages | `c20454c38af70a72a335cc6239fe959b45654d9801433f754a8b0700921a4125` |
| AAB | `d561b851f26554d7c819c1f37ea3a9067c4fe078559757dc7a25152eaa52068b` |

Public `checksums.txt` and `updates/latest.json` match these bytes. Manifest version/code/source are 1.15.61/97/`7788a344069423ecb73d33feecafa3a29b3ff4b9`; the release asset manifest and Pages manifest are equal. Native signatures, package, SDK, non-debuggable status, embedded version/source, signing continuity and APK/AAB web assets pass independently. Although the recompilation changes the APK container hash, all 1116 ZIP entry payloads are identical to the checked signed candidate; the AAB is byte-identical.

Live PWA `build.json` points to the same version/source. All 57 precached files were downloaded and their source-template content digest reproduced: cache `tgym-app-1.15.61-7788a344069423ecb73d33feecafa3a29b3ff4b9-b3d80e57875d`. HTML asset references are available. The actual production updater offers 1.15.61 from 1.15.60 for both GitHub and PWA distributions and does not offer the current version again (4/4 checks).

An isolated persistent Edge profile cached public 1.15.60 before publication with three synthetic routines, one historical workout and one custom exercise. It reopened 1.15.60 offline, then completed the ordinary Check for updates → Update path to 1.15.61. Routines, order, schedules, history, custom definitions, aliases, units, language, theme and Back-off preference stayed equal; the pre-update backup exists. The current version check says up to date. The same profile reopens 1.15.61 offline and downloads JSON, XLSX and PDF without network or page errors.

These actual offline JSON/XLSX files reopen, validate and reimport into an isolated draft with equivalent complete configuration, rules, catalog identities, relationships and unchanged history. Comparisons use the effective model overlaid on the existing defaults, whose store source is identical to 1.15.60; absent persisted defaults are not user-data mutations. The actual offline PDF opens and renders two nonempty pages, both visually inspected for wrapping, hierarchy, notes, accents and Back-off relationships. PDF output remains rasterized by the existing shared binary adapter; no PDF text-extraction/search capability is claimed.

Evidence files remain ignored under `.tools/routine61`: `actions.json`, `candidate-artifacts-verified.json`, `android-instrumentation-verified.json`, `release-ci.json`, `public-artifacts-verified.json`, `candidate-public-apk-payload.json`, `updater-verified.json`, `pwa-before.json`, `pwa-after.json`, `offline-files-verified.json`, `offline-pdf-verified.json` and reopened artifacts/rendered pages. No private profile, credential, signing material or synthetic QA binary is committed.

Remaining acceptance boundaries: interactive Microsoft Excel review was interrupted by Escape and not resumed; physical Android/iPhone file sharing and installation are pending. WebKit/mobile-width tests and Android CI/emulator are separate evidence. Native iOS compilation remains unavailable on Windows. The user's original installed browser profile was not manipulated during this retained-profile acceptance.
