# TGym 1.15.53 / Android89 release audit

Published and independently verified on 2026-10-05 (America/Santo_Domingo), under the session's explicit authorization to publish and send the mobile update. Runtime source: `20d470a6025447817ff28ba15b58c0f143c9c5ee` on `feature/streak-report-exports`. The immutable `v1.15.53` tag points to this source. The [GitHub release](https://github.com/Truesilverking/TGym/releases/tag/v1.15.53), official signed Android downloads, update manifest and production PWA supersede 1.15.52 / Android88. Manifest publication timestamp: 2026-10-06T02:05:40Z.

## Scope and validation

Export Calendar previously still called the Consistency builder after the earlier Progress isolation fix. It now has an independent Streak builder using the same daily rows/current-best calculation as Home. This/last week, this/last month, selected week/month, year/full and validated inclusive custom dates are available. Consistency remains explicitly selectable. Export Reports is visible in Stats and the calendar, with one/many/all selections and independent files/filters. See [STREAK-EXPORT-AUDIT.md](STREAK-EXPORT-AUDIT.md) and [REPORT-EXPORT-AUDIT.md](REPORT-EXPORT-AUDIT.md) for data flow, complete inventory and date semantics. No storage key, identity, schema, dependency or updater security rule changed.

| Check | Verified result |
| --- | --- |
| Frontend | 1,435 tests / 146 files passed. New Streak/date/UI/native cases and all 127 nonempty global report selections; existing 255 Progress section selections and seven Consistency period/format pairs remain covered. |
| Optional API / MCP | 11 API tests; 37 MCP tests and plain-Node import graph check passed. |
| Builds | Web, PWA and mobile assets/Capacitor sync passed. All 12 locale keysets/source-string checks and both fatigue probes passed. |
| Local Android | JDK21/SDK35 `assembleRelease bundleRelease :app:lintRelease` passed; 18 inherited lint warnings, zero errors. Local artifacts are unsigned and were not published. Capacitor synchronization and native compilation ran sequentially. |
| Browser exports | Isolated Edge/Chromium and WebKit synthetic profiles: all Streak periods, PDF/PNG variants, explicit Consistency Full Report, one/three/all global selections. 32 downloaded PDFs / 66 pages passed strict parsing, drawn-image decoding, nonblank and per-file duplicate-page checks. PNGs decoded; English/Spanish themed UI and representative report content visually reviewed. No page errors/overflow; synthetic profiles unchanged. |
| Android CI | Debug build/lint and all 11 Android35 emulator instrumentation tests passed. |

There are no frontend lint/typecheck scripts; neither check is claimed. Native adapter tests verify separate payloads/URIs and one batch share invocation, but physical Android/iOS share-sheet acceptance remains unverified.

## Exact-source Actions

All runs succeeded on the runtime SHA above. The first four finished before tagging.

| Workflow | Run |
| --- | --- |
| Tests | [37401556558](https://github.com/Truesilverking/TGym/actions/runs/37401556558) |
| PWA validation | [37401558237](https://github.com/Truesilverking/TGym/actions/runs/37401558237) |
| Android/emulator validation | [37401559742](https://github.com/Truesilverking/TGym/actions/runs/37401559742) |
| Pre-publication signed candidate | [37401561415](https://github.com/Truesilverking/TGym/actions/runs/37401561415) |
| Signed release, Pages publication and notification | [37402089713](https://github.com/Truesilverking/TGym/actions/runs/37402089713) |

Before tagging, the downloaded candidate independently passed actual `apksigner`, `aapt`, checksum, embedded `build.json`, version/source and previous official signer checks. Candidate SHA-256: `727ed2ec86080abd7b4401086c20c2ce8672578ecffced6fb8f47d12d71ea4a4`. Candidate metadata records `published: false`; the separately built published APK has its own checksum below.

## Published artifacts, public UI and delivery

| Evidence | Verified result |
| --- | --- |
| Release | Non-draft/non-prerelease; APK, AAB, checksums.txt and latest.json available. Release notes describe the fixes and update controls. |
| Metadata | Production `updates/latest.json`, PWA `build.json` and actual APK embedded `build.json` agree on 1.15.53/source `20d470a6025447817ff28ba15b58c0f143c9c5ee`; Android code89. |
| GitHub/Pages APK SHA-256 | Independently downloaded copies are identical: `5bd8d8d47410916f45af5aece6db7241ae6451fa390deb316649781cb4ce9ac6`, matching public manifest and checksums.txt. |
| AAB SHA-256 | `d0c48c9e70974c15032a8b0f650edd868b2b8941e1df0929a2f8cb35d71ef907`, matching public checksums.txt; actual `jarsigner -verify` passed. |
| Package/signing identity | Actual APK: `app.framegym.mobile`, 1.15.53/code89, not debuggable; v2 signature verified. APK/AAB certificates match 1.15.52: `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082`. |
| Actual updater module | Public metadata offers 1.15.53 to Android/PWA 1.15.52. Current 1.15.53 is not reoffered. Existing host/hash/package/version/signer validation remains intact. |
| Production PWA | Actual Check for updates / Update controls changed cached 1.15.52 to 1.15.53 in an isolated persistent Edge profile. All selected fields, including 33 synthetic workouts, routines, body records and preferences, remained equal. Offline reopen passed; no page errors. |
| Production Export Reports | Consistency unchecked by default; explicit Download All produced seven unique, nonempty files. Three PDFs / five pages passed strict parsing, drawn-image decoding and no duplicate pages within each file. Streak/Consistency content visually reviewed separately. Actual backup checksum/import validation passed; plan excludes workout/body data, History CSV contains only the synthetic workout row, Stats HTML embeds no Progress/Consistency document. Profile unchanged; no page errors. |
| FCM submission | Accepted `tgym_updates` at 2026-10-06T02:06:00.000Z and `tgym_updates_v2` at 02:06:00.282Z after public artifact verification. No separate resend workflow ran. |
| Physical phone receipt/installation | NOT VERIFIED. Service acceptance does not establish receipt or successful installation on the user's phone. |

Ignored synthetic fixtures/artifacts/evidence are under `.tools/streak-export-audit/` and `.tools/release-1.15.53/`, including exact-run records, candidate metadata, signatures, package data, public checksum/PWA/exports evidence and filtered FCM responses. No credentials, signing material or personal profile is committed. A subsequent documentation-only commit records this evidence without moving the immutable runtime tag.
