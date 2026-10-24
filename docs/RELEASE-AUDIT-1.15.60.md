# TGym 1.15.60 verification — 2026-10-10

Source: `9313c40a0a0e81e4153e30c390bc9e7032810b12`, immutable annotated tag `v1.15.60`, Android versionCode `96`, based on published 1.15.59 / 95. Publication and updating the installed desktop PWA were explicitly authorized after local review.

## Correction

Routine Download now calls the existing file adapter without requesting Web Share. Browsers and installed PWAs save JSON, XLSX and PDF directly; native binary sharing retains its existing path. There are no data schema or storage changes. Regression tests cover direct downloads when Web Share advertises availability but rejects, and retrying the same prepared file. See [routine download audit](ROUTINE-DOWNLOAD-AUDIT-2026-10-10.md).

## Exact-source checks before tagging

| Check | GitHub Actions run | Result |
| --- | --- | --- |
| Tests | [38036501017](https://github.com/Truesilverking/TGym/actions/runs/38036501017) | Success; frontend 1,763 tests / 165 files, API 11, MCP 37, plain-Node imports, web build, locale/source-string checks and fatigue probes |
| PWA | [38036502388](https://github.com/Truesilverking/TGym/actions/runs/38036502388) | Success; standalone production build |
| Android | [38036503602](https://github.com/Truesilverking/TGym/actions/runs/38036503602) | Success; debug compilation/lint and 11 emulator instrumentation tests |
| Signed APK/AAB candidate | [38036504677](https://github.com/Truesilverking/TGym/actions/runs/38036504677) | Success; release compilation/lint, package, signatures and checksums |

The downloaded candidate was independently verified with SDK 35 and JDK 21. Both artifacts embed the exact source/version. APK identity is `app.framegym.mobile`, code 96, version 1.15.60, non-debuggable. APK/AAB signatures retain the official certificate SHA-256 `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082`. Candidate checksums match; publication rebuilds its own artifacts, whose checksums are verified separately.

Local frontend tests, web/PWA builds, mobile asset build/Capacitor sync, API/MCP tests and Node-loadability passed. The final-version PWA build also passed. Before publication, 60 isolated Edge assertions validated direct exports online/offline, round-trip routine data, workbook/template structure and rendered PDF pages. Existing large-chunk warnings remain. There are no frontend lint/typecheck scripts.

## Publication and app verification

Release workflow: [38036905409](https://github.com/Truesilverking/TGym/actions/runs/38036905409) succeeded. Pages deployment completed at 08:14:04 UTC and public metadata verification at 08:14:06 UTC. [TGym 1.15.60](https://github.com/Truesilverking/TGym/releases/tag/v1.15.60) is the latest public release.

Independent public checks agree on version 1.15.60, code 96, source `9313c40a0a0e81e4153e30c390bc9e7032810b12`, package and official signing certificate. GitHub/Pages APK SHA-256 is `104e6dd8da087032ea134d25abc14599f788e95904c0e47da4042861efbb6bfd`; GitHub AAB SHA-256 is `29bb538da79e3ea16122c6c9c338c23feb6a493635092bfcedb131eed7c01504`. Release checksums, actual APK/AAB signatures, AAB structure/manifest and embedded build metadata pass. Pages publishes APK only; AAB is on GitHub. Existing JDK AAB signature notices also occur in the prior official artifact. The GitHub/PWA updater offers 1.15.60 to 1.15.59 and offers no update to 1.15.60.

Retained production PWA QA passed 35 assertions: ordinary Check for updates → Update activated 1.15.60 from the cached 1.15.59 shell, created its pre-update backup, and preserved the exact saved synthetic profile. JSON/XLSX/PDF downloads worked online and after an offline reopen; offline was confirmed by navigator.onLine=false and a blocked live build.json request. The new worker's precache was complete; no page errors or fixed-flow Web Share calls occurred.

The actual installed Windows Edge PWA also now shows 1.15.60 after closing/reopening its original desktop shortcut and reports up to date. In that profile, Update twice showed a generic error; a forced reload applied the new version while retaining the existing profile and visible routines/settings. The exact local failure is unclassified and was not reproduced in the isolated ordinary-update test. All three routine formats were successfully downloaded from the installed app and their local file structures parsed. This verifies the requested desktop download correction; it does not claim the earlier generic updater error was diagnosed or fixed.

The original remote annotated tag was fetched into an isolated ref and verified: its source equals the release SHA and its body contains the exact standalone `[skip-update-notifications]` marker. Release logs confirm notification policy false and the Notify update topic step skipped; the workflow sent no phone update notification.

Browser QA uses synthetic data in a separate Edge profile. The user's installed PWA was verified through the Windows UI; private data and exports are not committed or uploaded. Physical Android/iOS installation, export/share-sheet behavior and iOS native compilation are outside this desktop verification.
