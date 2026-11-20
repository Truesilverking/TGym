# TGym 1.15.107 swipe navigation audit

Published runtime: `ac612bf6869eae6fbf1ea13d27492213c9b9b201`, Android versionCode 143. [Release](https://github.com/Truesilverking/TGym/releases/tag/v1.15.107). Development remains on Dev; protected main still requires independent review.

Small diagonal starts, a stationary pause and sparse pointer delivery could discard deliberate page gestures. Recognition now keeps an uncertain contact pending, accepts the final release sample, uses a shorter deliberate distance and preserves clear vertical scrolling, native cancellation, reversals, control ownership and OS edge gestures. Inertial scroll events no longer invalidate a new contact merely because scrolling was still settling. Blank space below short pages remains a navigation surface.

Module and Routine/Exercises navigation uses a directional cover: the previous screen remains visible while the incoming screen covers it. Stats sections combine horizontal travel with subtle depth; the Stats heading, export/history/InBody controls and floating section selector remain outside that motion. An inert, identity-safe DOM picture provides only the outgoing visual. Hidden retained pages are skipped before copying, no second React tree mounts, and the picture is removed on completion or interruption. A failed picture falls back to immediate navigation. Reduced motion skips the transition. Navigation does not write a profile.

Stats filters and drafts retain their existing Activity boundaries; report exports read the latest retained filters. The generic media editor protection and removal of superseded bundled artwork are included. Personal artwork remains local and is absent from the candidate and published runtime.

## Verification

- 3,059 frontend tests across 257 files, API 24, MCP 38 and plain-Node imports pass. Web/PWA/mobile builds and local Android assembleDebug/lintDebug pass. The confirmed PWA process exits 0 and all 50 local build files match the exact-source browser build.
- Five exact-source CI gates pass. The downloaded Android HTML report has 52 tests, 0 failures and 0 skipped (44.096s). These emulator tests cover native components and persistence; they do not measure physical swipe performance.
- Edge CDP touch and Windows WebKit pointer/mouse checks pass 10 compiled contexts / 292 checks at 320, 390, 430 reduced-motion and 844 landscape widths, plus empty short Stats. They cover all sections and module boundaries, controls, blank bottoms, hold/flick/diagonal/scroll/cancellation, repeats, data equality and unchanged Stats header geometry. No runtime errors were observed. Native iOS gesture arbitration is not reproduced by Windows WebKit.
- Public Edge/WebKit regressions pass 4 contexts. Public swipe checks pass 2 contexts / 71 checks; complete synthetic profiles remain equal, Settings and Workout stay dock-free, no current update is offered again, and Edge offline cold-open passes.
- Official package/signature, nondebuggable state, exact source metadata, APK/AAB runtime parity, matching Release/Pages APKs, 51 deployed PWA files and 55 candidate-shared runtime assets are verified. Candidate and public APK/AAB/PWA scans check 92 private/rejected hashes with 0 matches and 0 GIF files. Update-topic broadcasts were suppressed by the annotated tag.

Release APK SHA-256: `bee41b0b6edd5798297602b6d7d92cef8afe834e86e7a1f86c0de48ad58a6f51`.

Physical Pixel/iPhone, native iOS, physical frame-rate acceptance, original-phone installation and Windows WebKit offline cold-open are unverified. No phone was accessed for this update. This audit records bounded observed checks, not a universal zero-defect claim.

Design references: [PowerPoint cover transition](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.presentation.covertransition?view=openxml-3.0.1), [Material shared-axis motion](https://developer.android.com/reference/com/google/android/material/transition/platform/MaterialSharedAxis). The implemented effect combines directional travel and depth; it does not claim a particular unnamed transition was identified with certainty.

See [structured evidence](SWIPE-EVIDENCE-1.15.107.json).
