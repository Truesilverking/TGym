# TGym 1.15.54 / Android90 release audit

Published and independently verified 2026-10-05 (America/Santo_Domingo), continuing the session's explicit authorization to publish and send updates. Runtime source: `567a8748e182bee4f2d27a4e88d9c3dcbd9cc344` on `feature/report-export-locations`; immutable tag `v1.15.54` points to that SHA. The [GitHub release](https://github.com/Truesilverking/TGym/releases/tag/v1.15.54), signed Android artifacts, production manifest and PWA supersede 1.15.53/code89. Manifest timestamp: 2026-10-06T02:58:46Z.

## Scope and checks

Export Reports moved from Stats/calendar to Settings → Data only. The calendar/streak sheet retains only Export Calendar. The existing Consistency section on Home now opens Consistency Report directly; the Stats summary has no report action. Existing report builders, ranges, filters, formats, Stats HTML/print, Progress/History navigation, Times and backup/restore remain. See [REPORT-EXPORT-LOCATIONS.md](REPORT-EXPORT-LOCATIONS.md) for data flow and UX evidence. No dependency, persisted schema, workout identity or updater validation rule changed.

| Check | Verified result |
| --- | --- |
| Tests | 1,439 frontend tests / 146 files; 11 API tests; 37 MCP tests and plain-Node import graph check passed. Targeted location/dialog/export suite: 47 tests / seven files passed. Existing report selection/content regression coverage remains. |
| Builds | Web, PWA and mobile assets/Capacitor sync passed; locale/source-string and version checks passed. No frontend lint/typecheck scripts exist; neither is claimed. |
| Local Android | JDK21/SDK35 `assembleRelease bundleRelease :app:lintRelease` passed in 36s; zero errors, 18 inherited warnings. Unsigned local artifacts were not published. |
| Browser | Isolated Edge/Chromium and WebKit, English/Spanish, 390px/reduced motion, synthetic profiles. 44 nonempty downloads; 16 PDFs / 106 pages strictly parsed, drawn images decoded, no duplicate pages within each PDF. PNGs decoded. Direct report and selected/all flows, exact entry locations, existing Stats export, theme/overflow and unchanged profiles passed; no page errors. |
| Production UI | Same English Edge location/download flow passed on the actual deployed app with 11 downloads and unchanged synthetic profile; Consistency unselected by default in global export. |
| Android CI | Debug build/lint and all 11 Android35 emulator instrumentation tests passed. |

All exact-source Actions succeeded. The first four finished before tagging:

- [Tests 37405796030](https://github.com/Truesilverking/TGym/actions/runs/37405796030)
- [PWA validation 37405797573](https://github.com/Truesilverking/TGym/actions/runs/37405797573)
- [Android/emulator validation 37405799003](https://github.com/Truesilverking/TGym/actions/runs/37405799003)
- [Signed candidate 37405800436](https://github.com/Truesilverking/TGym/actions/runs/37405800436)
- [Release/Pages/notification 37406412471](https://github.com/Truesilverking/TGym/actions/runs/37406412471)

The candidate independently passed actual signature/package, hash, embedded source/version and previous official certificate checks before tagging. Candidate SHA-256: `c09cadf081e20dbc0c75228c4793b824b701ce67cd5827e008f492a30fd85e14`; metadata records `published: false`. The separately built published APK has a different checksum below.

## Public artifacts and delivery

| Evidence | Verified result |
| --- | --- |
| Release/source | Non-draft/non-prerelease; APK, AAB, checksums.txt and latest.json available. Production update manifest, PWA build.json and actual APK embedded build.json agree on 1.15.54 and runtime SHA; Android code90. |
| GitHub/Pages APK | Independently downloaded bytes match each other, manifest and checksums.txt: SHA-256 `0fe503e04b6fc88ebc7e2065b3a3e32dbf8eff3e3de36c567b9443b28d73876d`. |
| AAB | Independently downloaded checksum matches published checksums.txt: `d09ac54ba13f4e9c8d702450b74caed02207fb74f849f81312170008bf75fcaa`; actual `jarsigner -verify` passed. |
| Actual package/signatures | APK v2 signature verified; `app.framegym.mobile`, 1.15.54/code90, not debuggable. APK and AAB certificates match the previous official release: `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082`. |
| Updater | Actual module offers public 1.15.54 to Android/PWA 1.15.53 and does not reoffer current 1.15.54. Trusted host/hash/package/version/signer validation remains intact. |
| PWA update/persistence | Actual Check for updates / Update changed cached 1.15.53 to 1.15.54 in an isolated persistent Edge profile. All selected fields, including 33 synthetic workouts, routines, body records and preferences, stayed equal. Offline reopen passed; no page errors. |
| Notification | FCM accepted `tgym_updates` at 2026-10-06T02:59:06.264Z and `tgym_updates_v2` at 02:59:06.535Z, after public artifact verification. No separate resend was run. |
| Physical devices | Phone receipt/installation and physical Android/iOS share-sheet acceptance remain unverified. Service acceptance does not establish handset receipt. |

Ignored evidence is under `.tools/release-1.15.54/`: exact-run records/logs, candidate and public artifacts/signatures, checksums, screenshots, public PWA and report-flow evidence, decoded-file QA and filtered FCM responses. No credentials, signing material or personal profile is committed. A documentation-only follow-up records these results without moving the runtime tag.
