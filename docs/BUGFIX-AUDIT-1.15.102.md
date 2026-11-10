# TGym 1.15.102: persistence, offline and workout audit

Published [v1.15.102](https://github.com/Truesilverking/TGym/releases/tag/v1.15.102), Android versionCode **138**, uses runtime `a6145c753ce56f8c8a5847b150bdef2937f345a1` from `Dev`. The annotated remote tag, successful official APK/PWA workflow, deployed metadata, signing identity and public artifacts are verified. A prepared TGym QA APK has not been installed on a phone; physical receipt/installation remains separate from publication.

The [1.15.101 corrections](BUGFIX-AUDIT-1.15.101.md) remain included. This follow-up addresses additional reproduced failures rather than repeating that audit's feature list.

## Corrected behavior

| Area | Reproduced problem and resulting behavior |
| --- | --- |
| PWA weigh-ins | A full primary profile could fail while logging weight even though the existing resource fallback could store it. Weight saves now use the atomic persistence path, verify resource storage and retain the previous profile and open draft when a write fails. A successful commit precedes starting the reviewed workout. |
| Daily readings and cancellation | Legacy numeric-string samples no longer corrupt daily averages through string concatenation. Existing samples are retained, a reading keeps its identity across retries, invalid drafts cannot save, and completing an asynchronous save after its sheet was cancelled cannot start a workout. |
| Offline readiness | Reuse the installed worker and verify its cache without requiring a fresh worker-script network request. A failed background registration/update does not discard an already verified offline cache. Worker listeners, message ports and timeout/error paths are cleaned up. |
| Workout lifecycle | Discarding a session stops the timed-work callback as well as rest state. Finish/Cancel actions apply to the session reviewed by the dialog; they cannot finish or discard a replacement session. Finishing retains a historical muscle snapshot if the exercise is no longer in the current catalog. |
| Strength history | Estimated 1RM uses completed working repetition sets, excluding warmups, timed/cardio rows, cancelled sessions and active copies. Repeated entries select the best eligible set. Legacy date-derived ID collisions do not hide another exercise's history. |
| Profile, imports and PIN | The profile's latest valid weight tolerates supported legacy dates. Import Undo captures the current profile at confirmation, and replacement stops if that safety snapshot cannot be saved. PIN creation/unlock/removal report storage failures, block repeated actions while pending and retain recoverable input. |
| Onboarding | Guided-plan choices are keyboard-activatable buttons, including Enter and Space. |
| Optional music bridge | Rest/finish events follow the shared clock and completed-session rules; idle stops do not emit false rest completion, disabled preferences clear stale state and channels are closed after use. Failed launch requests show feedback. Sharing reaches compatible receivers on the same origin/partition; it does not provide cross-origin or separate native-app music synchronization. |

## Validation at this checkpoint

| Check | Result |
| --- | --- |
| Exact-runtime CI | [Tests 40546405369](https://github.com/Truesilverking/TGym/actions/runs/40546405369), [PWA validation 40546405442](https://github.com/Truesilverking/TGym/actions/runs/40546405442), [Android validation 40546405621](https://github.com/Truesilverking/TGym/actions/runs/40546405621) and [signed candidate 40546445656](https://github.com/Truesilverking/TGym/actions/runs/40546445656) succeeded for `a6145c7`. [PR Tests 40546415384](https://github.com/Truesilverking/TGym/actions/runs/40546415384) also succeeded. |
| Regression suites | Frontend **2699/2699**, 241 files; API **16**; MCP **38**, including the real stdio protocol check; catalog **6**. The MCP import graph loads under plain Node. Android CI passed **43 instrumented tests**. |
| Calculations and strings | **108000** fatigue monotonic comparisons and **14076** history-deletion comparisons passed. Strict source coverage: **1367** strings; Spanish locale: **2159** keys. |
| Dependency advisory snapshot | Frontend production/development, API and MCP package audits reported **0 known vulnerabilities** on 2026-10-27. This records the advisory snapshot, not a guarantee against future disclosures. |
| Builds and publication | Web, standalone PWA and mobile asset builds passed. [Release workflow 40548010107](https://github.com/Truesilverking/TGym/actions/runs/40548010107) succeeded from the exact runtime. The signed candidate and published production package have version 1.15.102/code 138, exact embedded metadata, official signing continuity and no remote development server or debug flag. Release/Pages APK hashes match; all **49** checked deployed PWA/metadata files match the Linux release Pages artifact byte for byte. |
| Compiled weight matrix | Repeated against the actual Linux release Pages bytes: four isolated configurations across Edge/WebKit, English/Spanish and kg/lb passed **28 checks** with no page errors. Coverage includes comma entry, invalid/empty drafts, cancellation, legacy daily averages, primary/resource failure and retry, verified media compaction, one normal Save-and-start activation, discard and reload preservation. This is a single-activation matrix. In the separately inspected double-Start sequence, the second trusted click reached the newly opened backdrop and dismissed the sheet; it did not invoke a second start flow or lose a saved reading. |
| Settings and tour matrix | Repeated against the actual Linux release Pages bytes: **104 checks** passed in four Edge/WebKit configurations at 320, 390 and 1440 px, English/Spanish, dark/light and reduced motion. Profile drafts in short viewports, language changes, backup choices, PIN failure/retry/unlock/removal and all **19 tour steps** were checked. No page errors or horizontal overflow were reported; unrelated profile fields were preserved. The narrow WebKit and wide Edge screenshots were inspected visually. |
| Keyboard onboarding | Four Edge/WebKit Enter/Space component-harness cases passed. This is development-component evidence, not a compiled/native onboarding acceptance claim. |
| Offline server outage | Repeated against the actual Linux release Pages bytes: Edge and WebKit passed Home, Nutrition and Plan navigation while the origin server was stopped. All **46** shell cache entries were present, responses came from the worker and stored profile bytes were unchanged. Direct requests and a no-worker control both failed, confirming that the test did not depend on a live origin. |
| Normal PWA 100 to 102 update | Repeated using the actual Linux release: both engines used **Check for updates → Update**, retained a valid pre-update backup and all tested profile fields, and preserved **1600126 characters** of embedded synthetic media. The current version was not offered again. Cold reopen in the same store during an origin outage returned the cached shell and a byte-identical profile. |
| Update notifications | FCM accepted one send to `tgym_updates` and one to `tgym_updates_v2` in the release workflow. No manual resend ran. This proves service acceptance; phone receipt is unverified. |

The server-outage checks establish offline behavior in the tested Edge/WebKit browser environments. They replace the earlier inconclusive WebKit network-emulation result with a controlled outage and negative controls; they do not establish physical iPhone acceptance.

## Published artifacts and remaining delivery

| Item | Verified published value |
| --- | --- |
| Package | `app.framegym.mobile` |
| APK SHA-256 | `df7e137d76cf52318fec981f2396a51132b89986e2dec051bdc8672959806b4c` |
| AAB SHA-256 | `27f552f69985e0944a442c480452b800802b4ecbf6200a94e988c65e3bafd9d5` |
| Signing certificate SHA-256 | `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082` |

The published APK container differs from the candidate APK (`4a73c1bba041776143e85722127c53ebf14258211bcb166c411a5cb71679e084`); **53 shared mobile runtime assets** match exactly. The published AAB matches its candidate hash. GitHub Release and Pages serve the same published APK, and `updates/latest.json` and `build.json` identify the exact version/code/runtime.

The complete Windows-build-to-Linux-Pages byte comparison failed for five of 48 local files and is retained as a failed exact comparison. Three files differ only in CRLF/LF line endings; `index.html` also has one extra blank line, and `sw.js` has its correctly derived cache digest. All **39 compiled JS/CSS/font assets** and `build.json` are byte-identical. Classification did not turn that failure into a byte-identity pass: public verification compares the actual Linux release Pages artifact with the deployment. Release acceptance completed after the weight, Settings/tour, offline and update-preservation browser checks were repeated against those actual release bytes.

The separate `app.framegym.mobile.qa` APK is prepared with version 1.15.102/code 138, the existing QA signing identity and both labels set to `TGym QA`. Its SHA-256 is `984cb07e65d6edd43a4fad255ec4c8b6540d65f10414814a7451a0f056ba63b9`. It remains **not installed** because no Pixel is available over ADB. No physical 1.15.102 installation or owner's installed desktop-PWA update is asserted. The earlier Pixel QA 1.15.101 result belongs to its [own audit](BUGFIX-AUDIT-1.15.101.md).

## Coverage limits

This audit records reproduced failures and tested boundaries; it cannot establish the absence of every possible defect. Readiness, plateau, volume targets, weekly summary, progress photos, hands-free and share-card modules remain without production-screen wiring in the inherited Dev code. Their library/component tests do not establish completed product flows or native photo/share integration. The optional Spotifree bridge does not control another origin or a separate native app, and launching a player does not verify playback. Real cloud consent/synchronization, a physical iPhone and new physical Android acceptance were not exercised at this checkpoint.

Only public summaries belong in Git. Synthetic browser artifacts and private device profiles, backups and screenshots remain in ignored local directories. Structured status is recorded in [BUGFIX-EVIDENCE-1.15.102.json](BUGFIX-EVIDENCE-1.15.102.json).
