# TGym 1.15.99 / Android 135

**Published and verified.** Runtime source: `85681b6f3a81458790ede41a7c1d2d71edafa80d`, annotated tag [v1.15.99](https://github.com/Truesilverking/TGym/releases/tag/v1.15.99). Exact-source CI, signed artifacts, public Pages files and isolated PWA updating passed. [Structured evidence](RELEASE-EVIDENCE-1.15.99.json) records the runs, hashes and boundaries.

## Included changes

The body-weight editor uses a large editable number and a fixed-center horizontal ruler in the configured kg/lb unit. Quick flicks coast toward a planned tenth-unit endpoint; keyboard entry and direct editing remain available. Save reads the committed visible number. Cancel, invalid input, external changes and reduced-motion preferences are covered without changing existing weigh-in identities, daily averages or the separate goal/workout-load controls.

Pressed ruler movement renews the quiet period, while animation never counts as activity. Marked Android gestures retain the independent two-second bound through a small durable clock journal. Full-profile transfers use bounded strings, a native worker and atomic verified commits. Existing full quiet, ordinary and explicit/background flush paths remain. Native workout links no longer replay an old launch URI when navigating between tabs. [Design and measured behavior](WEIGHT-RULER-AUDIT-1.15.99.md) explains the implementation and retained failed trials.

## Validation and publication

| Check | Confirmed result |
| --- | --- |
| [Tests](https://github.com/Truesilverking/TGym/actions/runs/40112330253) / [PR tests](https://github.com/Truesilverking/TGym/actions/runs/40112333688) | Exact runtime source passed. Final frontend: **2541 tests in 220 files** with the normal timeout; API **16**, MCP **37**, catalogue **6**, Node-loadability, locales, source strings, version and fatigue checks passed. |
| [PWA validation](https://github.com/Truesilverking/TGym/actions/runs/40112330269) | Tests and PWA build passed for the same source. |
| [Android validation](https://github.com/Truesilverking/TGym/actions/runs/40112330302) | Compilation/lint and **43 CI instrumented tests**, zero failures or skipped tests, independently checked against the HTML summary. |
| [Signed candidate](https://github.com/Truesilverking/TGym/actions/runs/40112330198) | Production identity, version/code, official signing continuity, APK/AAB signatures, checksums and build metadata passed before tagging. |
| [Release](https://github.com/Truesilverking/TGym/actions/runs/40113021500) | Signed APK/AAB, GitHub Release, Pages deployment, public checks and normal update-topic sends succeeded. |
| Separate local QA | Web/PWA/mobile and Android builds passed. **28 isolated native tests** passed on the Pixel; five compiled browser cases passed. The QA installation/cold reopen preserved protected data and saved no test weigh-in. QA signing is separate from production signing. |

The earlier concurrent local run timed out in two unchanged Excel tests. Their isolated rerun and the final complete single-worker suite passed without raising the timeout or changing Excel code. Earlier browser/native performance failures are retained locally; one browser host gap was unattributed and its first pointer-movement audit was corrected in the harness without changing runtime source.

The public APK and Pages mirror are byte-identical: SHA-256 `e9224865c4974e12b2bce80bed29c848cef3240be18b7cbf1e7247490d5faece`. AAB SHA-256: `2fab398688c7a49f6debec94fa0e4f96d84d73375d1fa68292578b92fbea9d01`. The retained public certificate is `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082`; package `app.framegym.mobile` is not debuggable. All **66 shared APK runtime assets** match the signed candidate, and **62 deployed PWA files** match the release Pages artifact. Candidate and release container hashes are recorded independently; their runtime assets and official signer are compared directly.

FCM accepted one send per intended topic, `tgym_updates` and `tgym_updates_v2`. No manual resend was dispatched. This proves service acceptance, **not reception on a particular phone**.

## Isolated PWA update and boundaries

A separate synthetic Edge profile first loaded the cached **1.15.93** shell offline. The normal Check/Update flow activated **1.15.99** from this exact runtime source and saved a CRC-valid pre-update backup. Protected records, preferences and the manually paused active session/set identities were retained without duplicates. Only observed trusted-input clock metadata is normalized by the shared helper; this is not a claim of byte-identical whole-profile JSON. Up-to-date detection, offline reload, an offline browser restart and the IndexedDB mirror passed.

Public screenshots use synthetic browser profiles only: [Spanish mobile](assets/weight-ruler-1.15.99/mobile-es.png), [English desktop](assets/weight-ruler-1.15.99/desktop-en-lb.png). Private device images, profiles, backups and device identifiers are excluded.

The actual installed desktop PWA, production-phone installation, physical iPhone acceptance and release-push receipt were not established by these isolated checks. Pixel callback/DOM observations are not a device-wide FPS guarantee. Development remains on `Dev`; [main integration](https://github.com/Truesilverking/TGym/pull/12) retains its independent-review requirement. The [exercise catalogue updater](CATALOG-UPDATE-PLAN-2026-10-22.md) remains a proposal, not a shipped updater.
