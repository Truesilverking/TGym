# TGym 1.17.0 workout progression and layout

Current published release: **1.17.0 / Android 156**, runtime source `9b36a0e4dd571766dc9f67f9afa28cf1f086d328`. New exercise sessions ask before applying a suggested load increase. Keeping the load retains the current rows; accepting recalculates remaining automatic Top, Back-off, warm-up and drop loads while preserving recorded/manual values. Decisions persist through reload, backup/restore and unit changes. The workout header and counter align left, three exercise actions sit beside the name and the last-session context is clearer. Verification passes 3,339 frontend tests, 53 CI Android emulator tests, local Android compilation/lint (0 errors, 22 warnings), and 8 local plus 8 actual-public browser contexts / 104 groups each, with no runtime errors and protected synthetic data retained. Official signing, Release/Pages APK parity and 51 public PWA files pass. Update broadcasts were skipped. Physical phone installation/receipt, native iOS, OS-installed PWA, offline cold-open and previous-worker upgrade remain unverified for this release. See [audit](WORKOUT-AUDIT-1.17.0.md), [evidence](WORKOUT-EVIDENCE-1.17.0.json) and [release](https://github.com/Truesilverking/TGym/releases/tag/v1.17.0). Protected main retains independent review.

## Behaviour and preservation

- A per-exercise question compares the current and proposed load, with explicit Keep and Increase choices. No suggested increase is applied while pending.
- Top and Back-off weights, ordinary warm-ups and generated drop chains follow the choice. Rest-pause activation and burst totals retain their existing semantics. Completed/partial rows and manual entries remain intact.
- Decisions survive active-session reload, portable backup/restore and kg/lb conversion. Drop provenance stays attached when rows or drops are inserted or removed. Existing active sessions retain their saved rows.
- The title and substitute/note/details controls share a row, with 44 px controls. The optional plate calculator remains available in exercise metadata. Routine name and elapsed/sets counter align left.

## Verified scope

Frontend: 3339 tests in 277 files. CI also passed API, MCP/loadability, catalogue and PWA gates. Android emulator: 53 tests, no failures/skips. Local debug compilation and lint: 0 errors, 22 warnings. Signed APK and AAB metadata, package identity, official signing continuity and bundled source were verified before tagging. Public manifests, all 51 PWA files and Release/Pages APK byte parity were verified after publication. Private and rejected artwork scans pass.

Compiled browser acceptance uses isolated synthetic profiles in Edge and WebKit at 320, 390, 430 and 1280 px, with EN/ES, light/dark and reduced-motion cases. Both local and public matrices pass 8 contexts / 104 groups with zero runtime errors. Pending, declined and accepted decisions survive reload; routine/history/profile fields stay unchanged. Representative screenshots were visually reviewed. A synthetic example keeps 150/140/140 lb when declined, and accepts 160/150/150 lb using its configured 7 percent reduction and 10 lb grid.

APK SHA-256: `69f0dbbb509884b4ba121ef05e189eb59349f0ef6db7fa4a6e14dd8909e64cb8`. Certificate SHA-256: `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082`.

## Limits

No physical device was accessed or installed. Phone receipt, native iOS, OS-installed PWA, offline cold-open and prior-worker upgrade were not tested for this update. Browser engine checks do not establish physical phone acceptance. Update-topic broadcasts were suppressed by the annotated tag. No protected-main merge was performed.
