# TGym 1.16.1 Streak design and annual calendar

Current published release: **1.16.1 / Android 154**, runtime source `1d7570ea5d9c2fbfa08be7dd25a4a6fd0c30aa8a`. The selected orange-gold Streak flame animates throughout the app unless TGym or OS motion preferences disable it; the shared embedded artwork also appears in Streak reports. The annual Streak Calendar uses a compact three-column, four-row layout with all twelve months visible in the tested Pixel-sized portrait viewports. Calendar rules, training/profile data and updater validation remain intact. Verification passes 3,313 frontend tests, 53 CI Android emulator tests, local Android compilation/lint (0 errors, 22 warnings), and 6 local plus 6 actual-public browser contexts / 55 groups each. Animation/settings/OS controls, synthetic-state preservation and actual PNG/PDF downloads pass; rendered PDF pages were visually reviewed. The [release](https://github.com/Truesilverking/TGym/releases/tag/v1.16.1), official signing, matching Release/Pages APKs and 51 public PWA files pass. Firebase accepted the normal release broadcast; phone receipt and installation remain unverified. Physical Pixel/iPhone, native iOS and OS-installed PWA acceptance were not performed for this update. See [structured evidence](STREAK-DESIGN-EVIDENCE-1.16.1.json). Protected main retains independent review.

## Changes

- Use the owner-selected original flame, with a rounded orange-to-gold body and a golden teardrop core. Screen and report SVGs share an embedded 162 by 256 PNG; no external artwork fetch is needed. [Artwork and final prompt](../assets/streak-flame/README.md).
- Animate active flames in the header, calendar, statistics, workout summary and milestone celebration. TGym's Reduce animations control and OS reduced-motion preference stop the motion; disabled streaks stay neutral.
- Fit twelve real mini-months in a compact annual overview, retaining day numbers, month zoom, previous/next navigation and the collapsed calendar key. Week/month views and date calculations are preserved. Very short/narrow or enlarged-font screens retain normal scrolling rather than clipping.

## Verification

Frontend: 3,313 tests / 275 files; API: 37; MCP: 39 plus plain-Node loadability; catalogue: 6. Web/PWA/mobile builds, Android debug compilation and lint pass. Exact-source push/PR Tests, PWA, Android/emulator and signed-candidate workflows pass. Android emulator: 53 tests, zero failures/skips. Local lint: zero errors and 22 warnings.

Local and actual-public browser acceptance each cover six contexts and 55 groups with no runtime errors. Pixel-sized 412 by 915, 412 by 846 and 412 by 760 viewports, narrow 320 by 740, WebKit 390 by 844 and desktop are covered. All twelve months remain visible at the initial scroll position, including a long profile name. Active flame transforms change over time; the real Settings toggle and OS preference stop/resume them. Protected synthetic profile/training fields remain equal. Actual annual PNG/PDF downloads contain the exact selected artwork; one PDF page per run is rendered and visually reviewed.

Official APK/AAB package, version, source and signing continuity pass. Release/Pages APK SHA-256: `ecde789c12c7a8080956efdf95587825484e8d7cb8fc913f4b830af7644cc5d7`. All 51 public PWA files match the release Pages artifact. Private and rejected artwork scans pass, and discarded draft flame packages are excluded.

## Boundaries

Firebase service acceptance is verified separately from phone receipt. No physical Pixel/iPhone test, phone installation, original-profile access, OS-installed PWA acceptance or native iOS build was performed. Browser viewports and the CI Android emulator do not establish those results.
