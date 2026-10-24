# TGym 1.15.55 / Android91 release audit

Published and independently verified 2026-10-05 (America/Santo_Domingo), under the user's explicit instruction to upload the update. Runtime source: `e339664bfe541913533a658186f54a016fb00a08` on `fix/consistency-header-download`; immutable tag `v1.15.55` points to that SHA. The [GitHub release](https://github.com/Truesilverking/TGym/releases/tag/v1.15.55), signed Android artifacts, production manifest and PWA supersede 1.15.54/code90. Manifest timestamp: 2026-10-06T03:20:30Z.

## Scope and checks

The bottom Consistency Report text button was replaced by one download icon immediately after Times in Home's Consistency header. It uses the existing button/glyph/theme style and the exact existing `onExport` callback. Its localized report name remains an accessible label/tooltip only. The optional action is still supplied only by Home; Stats has no report action. Metrics, calculations, report builders, ranges, persistence and all other export entry locations remain unchanged. No dependency, schema, identity or updater validation rule changed.

| Check | Verified result |
| --- | --- |
| Tests | 28 targeted tests / five files; 1,439 frontend tests / 146 files; 11 API tests; 37 MCP tests and plain-Node import graph check passed. Regressions assert a single icon after Times, no visible report text, equal metric markup and exact existing dialog wiring. |
| Builds | Web, PWA and mobile assets/Capacitor sync passed; version, 12 locale keysets and source-string checks passed. There are no frontend lint/typecheck scripts; neither is claimed. |
| Local Android | JDK21/SDK35 `assembleRelease bundleRelease :app:lintRelease` passed in 15s; zero errors, 18 inherited warnings. Unsigned local artifacts were not published. |
| Browser | Isolated Edge/Chromium and WebKit, English/Spanish, reduced motion, synthetic profiles, 320px/390px/414px widths. One icon after Times, equal control height/alignment/color/font/padding, 4px gap, no overflow or page errors. Keyboard activation downloaded four nonempty PDFs; strict PDF parsing and drawn-image decoding passed. Times still opens its existing sheet. Metrics and profiles stayed unchanged; Stats has no report icon. |
| Production UI | The deployed English Edge flow passed the same layout/style/keyboard checks and actual Consistency PDF download. Theme-blue screenshot inspected; no bottom report link, duplicate card action, metric change or profile mutation. |
| Android CI | Debug build/lint and all 11 Android35 emulator instrumentation tests passed. |

All exact-source Actions succeeded. The first four finished before tagging:

- [Tests 37407596157](https://github.com/Truesilverking/TGym/actions/runs/37407596157)
- [PWA validation 37407597917](https://github.com/Truesilverking/TGym/actions/runs/37407597917)
- [Android/emulator validation 37407599376](https://github.com/Truesilverking/TGym/actions/runs/37407599376)
- [Signed candidate 37407601113](https://github.com/Truesilverking/TGym/actions/runs/37407601113)
- [Release/Pages/notification 37408176757](https://github.com/Truesilverking/TGym/actions/runs/37408176757)

The candidate independently passed actual signature/package, hash, embedded source/version and previous official certificate checks before tagging. Candidate SHA-256: `4816e033940efb16405bfd3cfa92bbd45a08cd2252d32058d574e0b0e8f5df54`; metadata records `published: false`. The separately built public APK has the checksum below.

## Public artifacts and delivery

| Evidence | Verified result |
| --- | --- |
| Release/source | Non-draft/non-prerelease; APK, AAB, checksums.txt and latest.json available. Public update manifest, PWA build.json and APK embedded build.json agree on 1.15.55 and runtime SHA; Android code91. |
| GitHub/Pages APK | Independently downloaded bytes match each other, manifest and checksums.txt: SHA-256 `fac93b37ceca3d980497384f468e9e505b3914bfeb806107d87b9c64efa1b100`. |
| AAB | Independently downloaded checksum matches checksums.txt: `ef4d74289c0b0d99c75cb2dc5d4471d7515897c1732076b82ff1d4a0db61030a`; actual `jarsigner -verify` passed. |
| Actual package/signatures | APK v2 signature verified; `app.framegym.mobile`, 1.15.55/code91, not debuggable. APK and AAB certificates match the previous official release: `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082`. |
| Updater | Actual module offers public 1.15.55 to Android/PWA 1.15.54 and does not reoffer current 1.15.55. Trusted host/hash/package/version/signer validation remains intact. |
| PWA update/persistence | Actual Check for updates / Update changed cached 1.15.54 to 1.15.55 in an isolated persistent Edge profile. Selected fields, including 33 synthetic workouts, routines, body records and preferences, stayed equal. Offline reopen passed; no page errors. |
| Notification | FCM accepted `tgym_updates` at 2026-10-06T03:20:49.8809915Z and `tgym_updates_v2` at 03:20:50.0125552Z, after public artifact verification. No separate resend was run. |
| Physical devices | Phone receipt/installation and physical Android/iOS share-sheet acceptance remain unverified. Service acceptance does not establish handset receipt. |

Ignored evidence is under `.tools/release-1.15.55/`: exact-run records/logs, candidate/public artifacts and signatures, checksums, browser screenshots/downloads, PDF QA, public PWA update/persistence and filtered FCM responses. No credentials, signing material or personal profile is committed. This documentation-only follow-up records completed verification without moving the runtime tag.
