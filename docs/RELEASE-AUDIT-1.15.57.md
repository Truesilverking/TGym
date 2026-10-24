# TGym 1.15.57 / Android93 release audit

The owner explicitly requested GitHub publication and a computer shutdown after completing the previously accepted phone update. [TGym 1.15.57](https://github.com/Truesilverking/TGym/releases/tag/v1.15.57) is published from immutable commit `7f5a090af06427e6962e8b4a3ac05975181cfe71`, with Android versionCode 93. Annotated tag object `9ffa812073b078e275b8998a85a22d398288eb75` points to that commit.

All application source under frontend, API and MCP is identical to the phone-accepted runtime commit `3e1ab358705042e8a6d34c2a461e1ece61a2bf55`. The intervening changes are release-workflow notification control and documentation. The phone-installed candidate and rebuilt public APK have different checksums and build provenance; the public APK is independently validated below.

## Accepted behavior

Finish freezes the existing authoritative workout clock immediately. Continue excludes review time and permits session-only exercises. After 30 minutes without trusted user input, the same session pauses at its original inactivity deadline, including reconciliation after backgrounding, process stop, reload or offline use. Inactivity does not finish or save history and does not resume automatically. Explicit duration correction retains an audit record and propagates through the shared duration helper.

Routine exchange provides JSON, Excel and PDF exports for one, several or all routines, plus a five-sheet editable Excel template with catalogue dropdowns. Preview, validation, unknown-exercise mapping and conflict decisions precede one atomic persisted import. IDs, prescriptions, legacy compatibility and unrelated routine/history data remain preserved. Detailed acceptance is in [WORKOUT-EXCHANGE-AUDIT-1.15.57.md](WORKOUT-EXCHANGE-AUDIT-1.15.57.md).

The physical Pixel's main TGym and isolated QA app already contain 1.15.57/code 93. Physical acceptance included 31min12.8s without new recorded input, with the exact 30-minute pause cutoff, no automatic completion/resume, explicit correction/Continue, and restored original phone profiles. That test included documented lock, background and process-stop segments; it was not 31 minutes of continuous lock. Native JSON/XLSX/PDF/template files passed 58 checks and Android-picker import passed. The public APK was not reinstalled over the already accepted candidate in this publication phase.

## Exact-source validation and publication

All required jobs and steps passed at the release commit before tagging:

| Check | Exact-source run | Result |
| --- | --- | --- |
| Frontend, API and MCP | [37581530692](https://github.com/Truesilverking/TGym/actions/runs/37581530692) | Passed |
| PWA validation | [37581532789](https://github.com/Truesilverking/TGym/actions/runs/37581532789) | Passed |
| Android compilation, lint and emulator | [37581534753](https://github.com/Truesilverking/TGym/actions/runs/37581534753) | Passed |
| Original signing identity candidate | [37581536707](https://github.com/Truesilverking/TGym/actions/runs/37581536707) | Passed |
| Signed release, Pages and public verification | [37582154775](https://github.com/Truesilverking/TGym/actions/runs/37582154775) | Passed; the intended notification skip failed as detailed below |

The previous public release was 1.15.56/code 92. Version consistency and strictly increasing Android code were checked before publication. There are no frontend lint/typecheck commands; the lint result above is native Android lint.

Actual GitHub assets, the public Pages manifest and PWA build metadata agree on 1.15.57/code 93 and release commit `7f5a090af06427e6962e8b4a3ac05975181cfe71`. GitHub and Pages APK downloads are byte-identical. APK and AAB hashes match checksums.txt. APK apksigner/aapt and AAB jarsigner/certificate checks independently confirm official package `app.framegym.mobile`, version 1.15.57/code 93 and the unchanged signing identity. Their embedded build.json values match exactly, all 61 web assets match, ZIP CRC checks pass and bundle metadata is present.

| Published artifact | SHA-256 |
| --- | --- |
| APK, GitHub and Pages | `c18a175a0d2f28e98b0198cd1f6c78115b5d78a863b32eb91474d529c6fcbee3` |
| AAB | `c9d81274d4f92e847baa936f0b881e9bd117b63a14d9f99057830e28af75c599` |
| Official certificate | `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082` |

The real updater passed four production checks: Android/GitHub and PWA on 1.15.56 offer 1.15.57, while 1.15.57 does not offer itself. Android uses the trusted update manifest; PWA uses its own build metadata. Their check-storage keys remain separate.

## Production PWA update and offline verification

An isolated persistent Edge profile at 390px loaded the real production 1.15.56 PWA before publication. The actual Settings Check for updates / Update flow then activated 1.15.57 and its exact release commit. All protected fields remained equal, including 33 synthetic workout rows, six routines, schedule, catalogue/custom definitions, aliases, measurements, active-session state and selected preferences. No user browser profile was touched.

Closing the complete test browser and reopening the same profile offline preserved the profile and functional UI. The new worker reported 57 shell assets and cached both lazy ExcelJS and PDF chunks. Actual JSON, full XLSX, PDF and Excel-template files downloaded offline; network records show the lazy code coming from the service worker, with zero page errors. All five PDF pages were parsed, rendered and visually inspected without clipping/overlaps; the parsed template contains zero routines and 1,325 catalogue exercises. The harness disabled browser Web Share to exercise the download fallback; desktop OS sharing is not established by this check. Legacy schedule-string versus exported-array normalization was checked without changing stored schedules. The earlier native phone share checks remain separate evidence.

## Notification-control incident

The annotated release tag contains the exact line `[skip-update-notifications]`, intended to omit update messages while publication/shutdown proceeded without separate notification authorization. The initial policy passed 13 local tests, but those tests did not reproduce Actions checkout rewriting the local annotated tag to its peeled commit. The actual release log recorded `Release update notifications enabled: true`; the final send therefore ran. Firebase accepted one message for each existing topic, tgym_updates and tgym_updates_v2, at 06:37:43 UTC. This is service acceptance, not proof of handset receipt. The owner was informed promptly. No notification retry was performed.

The follow-up workflow correction explicitly fetches the original remote release ref into `refs/tgym/release-policy`, checks its peeled commit against GITHUB_SHA, and reads that isolated ref's object type/body. Missing tags or mismatched source commits halt before producing a send decision. Thirteen fresh-origin/fresh-checkout tests reproduce the actual Actions fetch rewrite before running the corrected shell; the exact annotated marker now suppresses sends while ordinary tags retain existing behavior. The released tag, APK/AAB, Pages deployment and provenance remain immutable.

A further read-only test against the real GitHub origin reproduced the local tag as type commit, recovered annotated object `9ffa812073b078e275b8998a85a22d398288eb75` in the isolated policy ref and obtained `send=false`. It left the rewritten local tag unchanged and sent no notifications. The correction is a subsequent workflow/documentation commit, not a replacement of the published release.

Ignored publication evidence is under `.tools/release-1.15.57/` and `.tools/clock-exchange-qa/`. Signing material, credentials, private profiles and backups are excluded from Git. Physical iPhone/Safari/PWA, native iOS compilation and opening the workbook in installed Microsoft Excel/Google Sheets/LibreOffice remain unverified, as distinguished from the completed Android/browser/file checks.
