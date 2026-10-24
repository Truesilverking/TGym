# TGym 1.15.52 / Android88 release audit

Published and independently verified 2026-10-05, following the explicit request to publish and send the mobile update. Runtime source: `84710bcba1f8b9f54c5a2969f8f355f31e687bb0` on `fix/report-export-isolation`. The immutable `v1.15.52` tag points to that source. The [GitHub release](https://github.com/Truesilverking/TGym/releases/tag/v1.15.52), signed Android downloads, update manifest and production PWA supersede 1.15.51 / Android87.

## Scope and validation

The report fixes in `997aa48` remove explicitly appended Progress Report content from Calendar Full Report and statistics HTML, isolate specific data builders from shared file infrastructure, and apply the visible History search/period filters to CSV. Existing Progress selection controls and individual export options remain. See [REPORT-EXPORT-AUDIT.md](REPORT-EXPORT-AUDIT.md) for the complete inventory and regression/browser evidence. The release preparation changed only the package version and Android version/code.

| Check | Verified result |
| --- | --- |
| Frontend | 1,406 tests / 142 files passed, including all 255 nonempty Progress section selections and seven calendar period/format combinations. |
| Optional API / MCP | 11 API tests; 37 MCP tests and plain-Node import graph check passed. |
| Builds | Web, PWA and mobile assets/Capacitor sync passed. Locale/source checks and fatigue probes passed. |
| Local Android | JDK21/SDK35 `assembleRelease bundleRelease :app:lintRelease` passed; 18 inherited lint warnings, zero errors. Local artifacts are unsigned and were not published. |
| Browser export verification | Isolated Chromium/Edge and WebKit synthetic profiles; 84 PDFs / 144 pages parsed, decoded and checked for nonblank/duplicate pages. Real download buttons exercised, with unchanged synthetic profiles. |
| Android CI | Debug build/lint and all 11 Android35 emulator instrumentation tests passed. |

No frontend lint/typecheck scripts exist; neither check is claimed. Physical Android/iOS share sheets and OS print dialogs remain outside the browser verification.

## Exact-source Actions

All runs below succeeded on the runtime SHA above before or during publication.

| Workflow | Run |
| --- | --- |
| Tests | [37379156033](https://github.com/Truesilverking/TGym/actions/runs/37379156033) |
| PWA validation | [37379159076](https://github.com/Truesilverking/TGym/actions/runs/37379159076) |
| Android/emulator validation | [37379161529](https://github.com/Truesilverking/TGym/actions/runs/37379161529) |
| Pre-publication signed APK candidate | [37379164026](https://github.com/Truesilverking/TGym/actions/runs/37379164026) |
| Signed release, Pages publication and notification | [37379943322](https://github.com/Truesilverking/TGym/actions/runs/37379943322) |

Before tagging, the downloaded candidate APK independently passed `apksigner`, `aapt`, checksum, embedded `build.json`, exact-source/version and previous official signer checks. Candidate SHA-256: `62894b06525a7520637c5e7dc378b336f651b376d2742d0f2fe3b5194875951b`. Candidate metadata explicitly records `published: false`; the separately built published artifact has its own checksum below.

## Published artifacts and updater

| Evidence | Verified result |
| --- | --- |
| Public release | Non-draft/non-prerelease; APK, AAB, checksums.txt and latest.json available. |
| Metadata | Production `updates/latest.json`, PWA `build.json` and APK embedded `build.json` agree on version 1.15.52 and runtime source. Android code is 88. |
| GitHub/Pages APK SHA-256 | Independently downloaded copies are identical: `5b19b6e10c65b0346ea134b958fd6cf2cd194836acaacd2cc1275f45a1477fe3`, matching the public manifest/checksum. |
| AAB SHA-256 | Independently downloaded AAB matches the published checksum: `249c36126e6b8831224e26e1e54ec249a9e60cb78cb5d75c7d64a00e94b2dc43`. Local `jarsigner -verify` passed. |
| Package/signing identity | Actual APK: `app.framegym.mobile`, 1.15.52/code88, not debuggable; APK v2 signature verified. APK and AAB certificates match the previous official release: `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082`. |
| Actual updater module | Public metadata offers 1.15.52 to Android and PWA 1.15.51. Current 1.15.52 is not reoffered. Existing host/hash/package/version/signer validation remains intact. |
| Production PWA update | Actual Check for updates / Update controls changed the cached 1.15.51 shell to 1.15.52 in an isolated persistent Edge profile. All selected fields, including 33 synthetic workouts, routines, body records and preferences, remained equal. Offline reopen passed; no page errors. |
| FCM submission | Release logs confirm acceptance for `tgym_updates` at 22:07:52 UTC and `tgym_updates_v2` immediately afterward, after public artifact verification. No separate resend workflow was run. |
| Physical phone receipt/installation | NOT VERIFIED. Service acceptance does not establish notification receipt or successful installation on the user's phone. |

Ignored evidence is stored under `.tools/release-1.15.52/`, including exact-run records, candidate metadata, verified-web.json, signatures, package metadata, AAB checksum, production PWA evidence and filtered FCM acceptance logs. No credentials, signing material or personal profiles are committed. GitHub release notes describe the report fixes and update instructions. A subsequent documentation-only commit records this evidence without changing the immutable runtime tag.
