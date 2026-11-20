# TGym 1.15.110 bottom navigation audit

Published runtime: `179ec5f6cb7b1e0d8f0dcf4aed89fdd3031ab34b`, Android versionCode 146. [Release](https://github.com/Truesilverking/TGym/releases/tag/v1.15.110). The verified pre-update public metadata was 1.15.109 / Android 145, source `22f3ead389871ee9db6d8ce5b90c0c3468d0e75f`; that baseline metadata check did not redownload the old APK.

## Result

The four module buttons — Today, Routine, Nutrition and Stats — are visible immediately beside the central Start/Resume action on main module pages. Navigation no longer requires lifting a handle, and there is no collapsing menu, backdrop, extra focus trap or navigation-specific Back interception. Module buttons navigate directly and retain their active-module indication.

Workout, Settings, routine editors, login and onboarding retain their full-screen navigation without this bar. The keyboard can hide the bar while editing; safe-area and timer clearance continue to use measured control geometry, including the raised Start/Resume button.

Swiping between modules, directional cover transitions and Stats section transitions are retained. The main Stats heading and its controls remain outside the moving section content. The nine gesture/Stats source files listed in the evidence are byte-equal to the 1.15.109 baseline. Exercise IDs, routines, history and profile storage are not rewritten by this presentation change. Gesture checks preserve synthetic profiles; Start/Resume regression checks preserve protected data while allowing normal workout interaction bookkeeping.

## Verification

- Local frontend: 3,080 tests across 259 files. API: 24 tests. MCP: 38 tests across 2 files; plain-Node imports pass. Locale validation reports 1 locale with 2,189 synchronized keys. All 1,381 source strings are present; that checker uses the workflow's report-only mode.
- Web, PWA and mobile asset builds pass, together with local Android assembleDebug/lintDebug. Mobile synchronization is distinct from native compilation. Five exact-source branch/candidate CI gates pass. The downloaded native Android HTML report has 52 tests, 0 failures and 0 skipped (49.403s); it covers native components in an emulator.
- Compiled Edge/WebKit navigation checks pass 8 contexts / 135 checks, plus 4 Start/Resume regression contexts / 20 checks. The matrix covers portrait/landscape, light theme, reduced motion, empty lower Stats space, direct module actions, controls, repeated gestures and retained Stats behavior. No runtime errors were observed.
- Actual public navigation checks pass 2 contexts / 81 checks, plus 4 regression contexts / 23 checks. Start/Resume, full-screen route guards, timer clearance and protected synthetic data pass. The current version is not offered again as an update. Edge offline cold-open passes.
- Official package/signing continuity, nondebuggable state, APK/AAB source metadata, matching GitHub/Pages APKs, 51 deployed PWA files and 55 candidate-shared runtime assets are verified. Public APK/AAB/PWA scans check 92 known private/rejected image hashes with zero matches and zero GIF files. The annotated tag suppresses update-topic broadcasts; the actual send step was skipped.

Release APK SHA-256: `b8ef771f02f8598f6473b0dfbcfa1c756359db4700a43a72ae4abe3fba387e2a`.

## Evidence limits

No Pixel or iPhone was accessed or updated for this task. Physical gesture performance, native iOS compilation and physical iPhone/PWA acceptance are unverified. Windows WebKit automation is a separate browser test and does not reproduce native iOS touch arbitration. Results apply to the recorded checks rather than every possible device interaction. Protected main keeps its independent review requirement.

See [structured evidence](NAVIGATION-EVIDENCE-1.15.110.json).
