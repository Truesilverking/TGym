# TGym 1.15.100 / Android 136

**Published and verified.** Runtime source: `cc4d7893f402db575008e4206176921c222bd597`; [release v1.15.100](https://github.com/Truesilverking/TGym/releases/tag/v1.15.100). [Structured evidence](RELEASE-EVIDENCE-1.15.100.json) records the exact checks, artifact hashes and verification limits.

## Included changes

The shared weight ruler now serves workout loads, warmups, added loads, timed holds and drop sets; routine prescriptions and progression increments; exercise goals and the 1RM calculator; historical workout edits; body-weight targets and optional InBody mass fields. Existing body-weight recording retains its flow. [Shared weight-entry design](WEIGHT-ENTRY-1.15.100.md) describes the component API and data flow.

Compact fields keep direct decimal entry and increment controls. Their scale action opens a local draft with the large ruler and Done/Cancel actions. Movement does not write workout loads or records. Confirmation reads the visible value; cancellation, invalid input, a changed field context and failed-save retry are covered. Zero remains valid for exercise loads, manual decimal precision is preserved, and the body-weight ceiling is not imposed on those loads. InBody masses remain report kilograms. Existing IDs, history schemas, calculations, unit conversion and storage adapters remain intact.

## Validation and publication

| Check | Confirmed result |
| --- | --- |
| [Exact-source tests](https://github.com/Truesilverking/TGym/actions/runs/40210096392) | The final committed source passed **2576 frontend tests in 223 files**. API **16**, MCP **37**, catalogue **6**, Node-loadability, locales, source strings, version and fatigue checks also passed. |
| [PWA validation](https://github.com/Truesilverking/TGym/actions/runs/40210096269) | Passed for the same runtime source. |
| [Android validation](https://github.com/Truesilverking/TGym/actions/runs/40210096279) | **43 CI instrumented tests**, zero failures or skipped tests. |
| [Signed candidate](https://github.com/Truesilverking/TGym/actions/runs/40210096783) | Production package identity, version/code, build metadata, APK/AAB signatures, official signing continuity and checksums passed. |
| [Release](https://github.com/Truesilverking/TGym/actions/runs/40210721037) | The tagged release workflow completed successfully; public artifacts and deployed Pages files were checked independently. |
| Local builds | Web, PWA, mobile asset synchronization and Android compilation/lint passed. A mobile asset build alone is not an APK build. |
| Compiled browsers | **6 synthetic cases** passed across Edge/WebKit, mobile/desktop, English/Spanish and kg/lb. Coverage includes narrow-field readability, precise/zero loads, goals, routines, history and a large synthetic profile's ruler interactions. All resources closed and no page errors occurred. |

The local complete frontend run (**2576/223**) belongs to baseline `8c23e8b00f2c09715f4f92914b139550bec46756`. Only the drop-load field's CSS layout changed afterward; every other frozen frontend file is identical. The final targeted run passed **139 tests in 7 files**, and exact-source CI reran the complete suite for `cc4d7893f402db575008e4206176921c222bd597`. Final browser geometry checks cover the number and all three action targets, including compact drop loads; earlier harness/visual failures are retained separately.

Public APK SHA-256: `5774c5a5f683b835a29e577c28607d743c0d2addfcaf60f99b0b266b39a53075`. AAB SHA-256: `e14e54aa32ff4f45668de861b18110107e6fe4be304a9ac05ca7509f3833f4d8`. The official signing certificate remains `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082`, package `app.framegym.mobile`, with debugging disabled. The release and Pages APKs are byte-identical; **66 shared APK runtime assets** match the signed candidate and **62 deployed PWA files** match the release Pages artifact. Candidate and release container hashes are assessed independently through source metadata, runtime assets and signer continuity.

FCM accepted one send per intended update topic. No manual resend was dispatched. Service acceptance does not prove receipt on a particular phone.

## Boundaries

These release checks did not install 1.15.100 on a physical phone, update the owner's installed desktop PWA, perform an isolated 99-to-100 worker upgrade, or revalidate offline preservation for this version. Physical iPhone acceptance and physical push receipt remain unverified. Earlier 99 preservation/device evidence remains historical and is not presented as a new 100 test. Synthetic browser measurements are not a device-wide frame-rate guarantee. Private profiles, phone images and backups are excluded from public evidence.

Development remains on `Dev`; `main` retains independent review and its protected-branch checks. The [catalogue updater plan](CATALOG-UPDATE-PLAN-2026-10-22.md) remains a proposal, not a shipped updater.
