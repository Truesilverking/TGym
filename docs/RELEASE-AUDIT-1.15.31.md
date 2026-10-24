# TGym 1.15.31 release verification

Published on **2026-09-25 at 22:34 America/Santo_Domingo** (2026-09-26 02:34 UTC), following the user's explicit instruction to upload the changes and send the update. The remaining visual/device audit is disclosed in [the pre-release report](PRE-RELEASE-AUDIT-2026-09-25.md); publication does not establish that those checks passed.

## Published identity

- Release: [v1.15.31](https://github.com/Truesilverking/TGym/releases/tag/v1.15.31), Android versionCode **66**.
- Source: [`48dc3a122e5c6b8e59391253aa72403ff2e61da1`](https://github.com/Truesilverking/TGym/commit/48dc3a122e5c6b8e59391253aa72403ff2e61da1), on `feature/dashboard-visual-polish`. The remote annotated tag resolves to that exact commit. The branch and tag were pushed without force; the previous release remains unchanged.
- Package: `app.framegym.mobile`; signing certificate continuity with 1.15.30 was verified before publication.
- PWA version and source commit match the Android release. Storage keys and native package identity are unchanged; no data migration was introduced by these fixes.

## Checks on the exact release commit

| Check | Result and evidence |
| --- | --- |
| Frontend/API/MCP | [Tests 36211489347](https://github.com/Truesilverking/TGym/actions/runs/36211489347): success. Frontend 994 tests / 103 files; API 10; MCP 37 and plain Node loadability. Locale/source coverage, build and fatigue probes also passed. |
| Android compilation, lint and emulator | [Validate Android 36211489361](https://github.com/Truesilverking/TGym/actions/runs/36211489361): success. `assembleDebug`, `:app:lintDebug` and **9 tests on Android 15/API 35 emulator** passed. This supplies current native evidence despite the SDK being unavailable to the local process. |
| Signed release and PWA | [TGym release 36211895158](https://github.com/Truesilverking/TGym/actions/runs/36211895158): success. Repeated frontend tests, web/mobile/PWA builds, `assembleRelease bundleRelease`, APK signature/certificate continuity, package/version metadata and AAB signature validation passed. |
| Published assets | The release workflow downloaded APK, AAB, checksums and manifest and verified identical bytes to the built artifacts. Pages manifest and PWA `build.json` match the release version/code/source. |
| Notification submission | The release job verified the publication first, then **FCM accepted both `tgym_updates` and `tgym_updates_v2` messages** at 02:34:43 UTC. No extra resend was requested. Server acceptance does not prove receipt or installation on a particular phone. |

There are no frontend lint/typecheck scripts. Android lint is a separate check and passed. Existing bundle/dynamic-import warnings remain; iOS native compilation was not performed on Windows. Unchanged successful local suites were not rerun; the final 1.15.31 mobile build and Capacitor sync passed before the commit.

## Independent public-download verification

At 02:35:25 UTC, a separate local download verified that the GitHub release and Pages APK copies are identical (**8,605,170 bytes**), both manifest copies are identical, the APK/AAB match `checksums.txt`, the APK matches the manifest hash, and the PWA `build.json` has version 1.15.31 and source `48dc3a1`. Certificate metadata matches the prior public release; actual signature validation was performed in the release workflow.

| Public artifact | SHA-256 |
| --- | --- |
| APK | `f0e906dc1a961b668d34bd8cbb7f6321318378dad065d9e9dc47af14b1bba515` |
| AAB | `6f74f6b19eb2e2d6ccafe6918242fdb24038462a93f7abbef7986bcbd9290d3a` |
| Signing certificate | `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082` |

## Corrections included

Cloud restore preserves coherent workout snapshots and ordered exercises, resolves dotted record IDs, and exposes both sides of conflicts. Backup import rejects malformed nested collections. Activity sharing retains its type; malformed activity/health measurements no longer produce false values. Early work-timer completion uses its deadline after suspension. History/CSV preserves session units, excludes duplicate/cancelled identities, records set status/effort and escapes spreadsheet formulas. Calendar/routine controls and weight-slider keyboard accessibility are improved. The pre-release report contains regression details and compatibility notes.

## Remaining acceptance gaps

The full responsive Dark/Light/reduced-motion matrix, complete browser walkthroughs, installed PWA offline/update recovery, live Drive sync and physical-phone lifecycle/permission/update behavior remain unverified. Computer Use was unavailable. The emulator checks cover specific native behavior, not those complete user flows. No claim of a complete visual audit or guaranteed phone delivery is made.
