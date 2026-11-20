# TGym 1.15.63 / Android99 release audit

Runtime source: `937a024f9235a9a9f44e751743147799078258f7`, pushed to `fix/desktop-pwa-update-1.15.63`. [Version1.15.63 is published](https://github.com/Truesilverking/TGym/releases/tag/v1.15.63), including the [production PWA](https://truesilverking.github.io/TGym/). This corrects the owner's installed Windows PWA update failure with a large local profile. See [desktop audit](DESKTOP-UPDATE-AUDIT-1.15.63.md) for the actual failure, exact-artifact reproduction, storage correction and profile-preservation checks. Commit, push and publication follow the original authorized release scope; unrelated `cv-studio/` and `output/` are excluded. Version 1.15.62 and its immutable tag remain intact.

## Local and browser acceptance

Frozen pnpm installation, frontend 1,853 tests/170 files, API 11 tests, MCP 37 tests/plain-Node load, version validation, locale/source-string checks and web/PWA/mobile builds passed. Local Gradle `assembleDebug lintDebug` passed on JDK21/SDK35. The application lint report has 20 warnings and zero errors. The 108,000-comparison fatigue and 14,076-comparison history-edit probes passed. No frontend lint/typecheck scripts exist; these checks are not claimed. Windows Capacitor synchronization is not native iOS compilation.

The old exact published 1.15.62 artifact reproduces native `QuotaExceededError` in isolated real Edge155 with a 4,762,671-character synthetic profile. Corrected-source builds with deliberately older QA version labels pass the mounted Check for updates → Update → worker activation → reload path. Every profile field, current mirror and five synthetic GIFs remain intact. The committed pre-update envelope passes CRC; a physical close/reopen of the persistent browser offline retains the profile, safety copy and version. These QA labels do not represent a successful Update using the old published handler.

Before the new publication, an official full-backup export and hard reload recovered the owner's actual Windows PWA from 1.15.60 to 1.15.62. The two validated portable envelopes compare completely equal: six routines, fourteen custom exercises and five uploaded animations, with every embedded media byte and portable preference preserved. No site-data deletion or reinstall was used.

## Exact-source CI and signed candidate

All four workflows passed on the runtime SHA:

| Workflow | Run |
| --- | --- |
| Tests | [38111198943](https://github.com/Truesilverking/TGym/actions/runs/38111198943) |
| PWA validation | [38111200172](https://github.com/Truesilverking/TGym/actions/runs/38111200172) |
| Android validation | [38111201397](https://github.com/Truesilverking/TGym/actions/runs/38111201397) |
| Signed Android candidate | [38111202649](https://github.com/Truesilverking/TGym/actions/runs/38111202649) |

Downloaded logs confirm the frontend/MCP results and actual successful `assembleDebug`, `lintDebug`, `connectedDebugAndroidTest`, `assembleRelease`, `bundleRelease` and `lintRelease` tasks. Android15/API35 emulator report artifact11691956264 passes CRC and agrees with logs on 11 tests, zero failures and zero ignored tests. The workflow does not upload the lint HTML report; lint completion is verified from the actual logs. PWA artifact11691835832 passes CRC with matching source/version metadata, worker and manifest.

Candidate artifact11690964143 passes archive CRC/checksums, independent APK/AAB signatures, non-debuggable package `app.framegym.mobile`, version/code99, SDK23/35/35 and certificate continuity. Certificate SHA-256 remains `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082`. Both embedded `build.json` files and all61 embedded web assets agree with the source and each other.

Candidate APK SHA-256: `d005ff4b8a40afc233d6d16ccc3c42f1d5732f50b8aa8720e507e623c982c644`. Candidate AAB SHA-256: `228929d979dd517c35d293b6ce69f7bec2c161f21c5a57fdd8e7f46d279c6335`. Public artifact hashes are verified separately after publication.

## Publication and installed-PWA verification

After all four exact-source gates, signed-candidate validation and corrected-source browser acceptance passed, annotated tag `v1.15.63` was pushed. Fetching the original remote tag into an isolated ref verifies object `558cd97a27afb5ec283967c6c43b790ebd388601`, runtime source and exact standalone `[skip-update-notifications]` marker.

[Release workflow38111554284](https://github.com/Truesilverking/TGym/actions/runs/38111554284) completed successfully at the runtime source. Downloaded policy logs confirm notifications enabled:false and the actual Notify update topic delivery step skipped. Credential validation is distinct from notification delivery; no handset receipt is claimed.

Published APK SHA-256: `2b7433162ccc93807f40d40b0118c8fe33c804041776068d6e7d34bbb57f5a83` (8,997,109 bytes). Published AAB SHA-256: `228929d979dd517c35d293b6ce69f7bec2c161f21c5a57fdd8e7f46d279c6335` (8,045,834 bytes). GitHub Release and Pages APKs are byte-identical; manifests and checksums agree. Independent signature, package, SDK, non-debuggable status and unchanged certificate checks pass. All1,116 APK ZIP entry payloads match the signed candidate even though the APK container hash differs; the AAB is byte-identical to its candidate. Both APK/AAB web assets and build metadata agree.

The actual public PWA `build.json` identifies63 and the exact runtime SHA. All57 precached shell files reproduce the exact source-template content digest for `tgym-app-1.15.63-937a024f9235a9a9f44e751743147799078258f7-00f336822043`. The isolated in-memory updater offers63 from62 and no update from63 in both GitHub/PWA distributions (4/4 checks); this is distinct from installed-browser acceptance.

A new isolated persistent Edge155 profile loaded the exact production63 shell without rebuilding. Its complete 4,762,671-character synthetic profile and current IndexedDB mirror remained equal. It reported up to date, reloaded offline and physically closed/reopened the persistent browser offline with all five GIFs decoding and zero page errors/warnings. This verifies public63 load/reopen, not an old published62 Update-handler success.

The owner's actual existing Edge PWA then loaded63 through the documented hard-reload bootstrap. Fresh official full-backup exports before and after63 passed envelope CRC and compared entirely equal to the original60 portable profile: six routines, fourteen custom exercises, five embedded animations and every portable preference/media byte. The installed63 Check for updates displayed `TGym is up to date.`; the final screenshot was saved. Site data was not cleared and the app was not reinstalled.

Ignored evidence includes `pretag-verified.json`, `ci-evidence-verified.json`, `candidate-artifacts-verified.json`, `native-ci-verified.json`, `android-instrumentation-verified.json`, `publication-verified.json`, `public-artifacts-verified.json`, `candidate-public-comparison.json`, `notification-policy-verified.json`, `updater-verified.json`, `public63-isolated-proof.json` and `user-after63-verified.json`.

## Boundaries

After the owner's version, portable-profile and real update-check results passed, Windows Computer Use stopped an additional ordinary reload attempt because it could not determine the current browser URL with sufficient confidence. No further UI input was issued; an extra ordinary reload/reopen/offline verification in the owner's actual profile remains pending. The saved preceding installed63 screenshot and validated exports remain independent evidence.

The physical Pixel/Excel acceptance for routine exchange remains documented separately under 1.15.62. No physical Android/iPhone acceptance or native iOS compilation is claimed for this Windows updater correction. Native installer/package/signature/download validation, routine format/history/storage identifiers and Progress Report are unchanged. Private exports, screenshots and synthetic profiles remain ignored local evidence under `.tools/desktop-update`; no private profile or credential is committed.
