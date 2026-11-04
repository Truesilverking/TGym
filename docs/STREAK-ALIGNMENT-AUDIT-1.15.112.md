# TGym 1.15.112 Streak alignment audit

Client date: 2026-11-03. Runtime source: `384059889cdf5d7d498f1e5f60793e7fe261e1e7`. Android versionCode: **148**.

## Requested layout

The chosen local name is centered above the profile row. The enlarged photo stays on the left, with the flame and consecutive-day streak immediately to its right. The selected week, month or year and its distinct active-training-date total share one row between Previous and Next. Week/month/year selection, date navigation, collapsed legend, optional profile visibility and missing-photo fallback retain their existing behavior. The streak and active-date total remain independent metrics.

Only shared calendar presentation and its existing regression expectations change. No storage, streak calculations, report renderer, routine, workout, notification or media implementation changes. All Streak exports retain the 1.15.111 layouts; this correction makes no new export-verification claim.

## Validation

- Final-source frontend CI: **3,103 tests / 261 files**, verified against the downloaded successful job log.
- API: **24 tests**. MCP: **38 tests / 2 files** and complete plain-Node import-graph check.
- Local web and mobile builds, Capacitor sync, app debug APK, instrumentation test APK compilation and debug lint: actual process exits **0**. Local lint: **0 errors / 22 warnings**, with byte-identical XML compared with the saved 1.15.111 baseline.
- Android emulator: **53 tests / 0 failures / 0 skipped**. Downloaded HTML artifact digest and ZIP CRC verified; actual artifact ID **13206136708**, SHA-256 `83723485fd4c683b1c2c3bb3143a9c2cb0955f461702315a8d3c2ec960027fd8`. Compiling the local test APK is separate from executing these CI emulator tests.
- Compiled calendar: **6 primary Edge/WebKit contexts + 8 isolated variants**, **30 check groups**, zero observed runtime errors. Coverage includes 320px, 390px and desktop widths, English/Spanish, light/dark themes, long and missing names, hidden profile, a real synthetic 1,000-day history, all three calendar views, leap-day navigation and preservation of synthetic profiles.
- Actual public calendar: **2 primary contexts + 3 isolated variants**, **10 check groups**, zero observed runtime errors. The deployed build manifest matches the released commit.
- Actual public Start/Resume/updater: **4 contexts / 23 checks**, zero observed runtime errors; protected synthetic profiles preserved. Edge inactive-profile offline cold-open and both-engine no-self-reoffer checks pass. Windows WebKit offline cold-open is not claimed.

## Publication and privacy

All five required final-source CI gates succeeded before tagging. [Release workflow](https://github.com/Truesilverking/TGym/actions/runs/41581548819) completed successfully, and the update-topic notification step was skipped. The annotated release tag points to the verified runtime source; protected main remains separate for independent review.

[Published TGym 1.15.112](https://github.com/Truesilverking/TGym/releases/tag/v1.15.112) uses the official signing certificate. Release and Pages APK SHA-256 match: `b51aa50bca5d90583026264373b8cdcaa567aadd0b30c723cde26ad0331129ca`. AAB SHA-256: `d21d05586dfa424dab554838afc6876b64851a15d2bed16ea0ffcc133819bd57`. All **51** actual public PWA files and **55** shared candidate/runtime assets match their verified builds. Candidate and public scans checked **92** known forbidden artwork hashes with zero matches and no GIF files. No private profile, backup, phone identifier, personal image or local log location is included in this public evidence.

## Limits

No phone was accessed for this correction. Fresh physical Pixel/iPhone acceptance, QA/original phone installation, native iOS compilation, phone notification receipt and physical frame-rate acceptance remain unverified. Windows WebKit automation is browser-engine evidence, not a physical iPhone test. Earlier 1.15.111 physical checks are historical and are not carried forward as 1.15.112 acceptance.

Machine-readable evidence: [STREAK-ALIGNMENT-EVIDENCE-1.15.112.json](STREAK-ALIGNMENT-EVIDENCE-1.15.112.json).
