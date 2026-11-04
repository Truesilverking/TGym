# TGym releases and verification

## Version numbering

Use semantic `major.minor.patch` versions. Compatible new features advance the
minor number and reset the patch to zero; corrections advance only the patch.
There is no automatic rollover at 99 or 100. The report/profile/smart-scale
feature release after 1.15.116 is therefore **1.16.0**, not 1.16.17. Android's
independent `versionCode` increases for every published package (153 here).
`check-version.mjs` verifies that package metadata, Android and the tag agree;
the release workflow also requires a code newer than the public updater.

Current published release: **1.15.114 / Android 150**, runtime source `f660fe2ebc8dfb4999933ed3df7272446294e6f6`. Horizontal navigation now recognizes text, blank space and tap-only controls while actual horizontal widgets retain their gestures. History exercise details retain the two-second hold with more finger-drift tolerance; its month/week calendar removes the secondary visible year while preserving full accessible dates. The service worker fixes offline shell misses caused by Vary: Origin without merging query variants or caching live endpoints. Exact-source verification passes 3,209 frontend tests, 53 CI Android emulator tests, 6 compiled browser contexts / 170 check groups, 2 PWA contexts / 13 groups, 2 upgrade contexts / 7 groups and 4 native CDP cases. Physical Pixel QA passes 13 UI checks and 6 cold-reopen checks with existing profile, history, routines and active entries preserved; the temporary awake setting was restored and the original app was not accessed. [Release](https://github.com/Truesilverking/TGym/releases/tag/v1.15.114), official signing, matching Release/Pages APKs, 51 public PWA files and 2 actual-public browser contexts pass. Lint remains 0 errors / 22 unchanged warnings. Standalone browser mode is emulated, not an OS-installed PWA; physical iPhone/native iOS and Windows WebKit offline cold-open remain unverified. Report implementations are unchanged and were not re-exported. Update broadcasts were skipped. See [audit](TOUCH-OFFLINE-AUDIT-1.15.114.md) and [evidence](TOUCH-OFFLINE-EVIDENCE-1.15.114.json). Protected main retains independent review.

Historical published release: **1.15.113 / Android 149**, runtime source `b491f31d648e7c813038c6adb06b454c38f475c0`. Workout History lists show compact exercise cards; a two-second hold opens centered existing media and saved sets grouped by their recorded warm-up, Top, Back-off and working roles. Keyboard and assistive activation remain available. Its Workout calendar uses the compact period selector and inline activity count between navigation arrows; Today, Nutrition and Streak controls retain their existing behavior. The audit fixes native image-drag ghost overlays, stale history drafts, failed-save feedback and unit-stamped historical conversion/volume/CSV/strength and full-precision Stats/BMI/report projections. Verification passes 3,154 frontend tests, 53 Android emulator tests, 6 compiled browser contexts plus 2 isolated unit cases, 2 actual-public browser contexts plus 1 isolated unit cases, and four public Start/Resume/updater contexts. The [release](https://github.com/Truesilverking/TGym/releases/tag/v1.15.113), official signing, matching GitHub/Pages APKs and 51 public PWA files pass. Local Android lint has zero errors and the same 22 warnings as 1.15.112. Private and rejected artwork remains excluded; update-topic broadcasts were skipped. Fresh physical Pixel/iPhone, phone installation, native iOS and physical frame-rate acceptance remain unverified. Stats PDF validation covers 2 compiled UI downloads (4 pages) and 1 actual-public UI download (2 pages), with every rendered page visually reviewed. Calendar and PNG exports were not repeated. See [audit](HISTORY-DETAIL-AUDIT-1.15.113.md) and [evidence](HISTORY-DETAIL-EVIDENCE-1.15.113.json). Protected main retains independent review.

Historical published release: **1.15.112 / Android 148**, runtime source `384059889cdf5d7d498f1e5f60793e7fe261e1e7`. The Streak calendar centers the chosen name above the enlarged left-side photo and its adjacent flame/streak count. Week, month or year and its separate active-date total sit together between the navigation arrows. Calendar calculations, stored profile/workout data and report renderers remain unchanged. Exact-source verification passes 3,103 frontend tests, 53 Android emulator tests, 6 compiled calendar contexts plus 8 isolated fixture variants, 2 actual-public calendar contexts plus 3 variants, and 4 public Start/Resume/updater contexts. The [release](https://github.com/Truesilverking/TGym/releases/tag/v1.15.112), official signing, matching GitHub/Pages APKs, 51 public PWA files and protected synthetic data checks pass with no observed runtime errors. Local Android lint has 0 errors and the same 22 warnings as 1.15.111. Private and rejected artwork remains excluded and update-topic broadcasts were skipped. Fresh physical Pixel/iPhone acceptance, phone installation, native iOS compilation and physical frame-rate acceptance are unverified for this correction. Report exports were not repeated because their implementations are unchanged. See [audit](STREAK-ALIGNMENT-AUDIT-1.15.112.md) and [evidence](STREAK-ALIGNMENT-EVIDENCE-1.15.112.json). Protected main retains independent review.

Historical published release: **1.15.111 / Android 147**, runtime source `d664d461bf5139d75991d7a1fe421bde77f1c78a`. The Streak calendar has a larger local profile, left-side streak and an inline period count. All Streak reports use clearer identity headers; annual, Full and Complete-years sections use a high-quality chronological 3×4 grid with lossless PDF images. Ordered Android timer notifications, session-local back-off override recovery and whole-unit exercise rulers preserve authoritative timing, completed history and legacy precision. Verification passes 3,103 frontend tests, 53 Android emulator tests, 6 compiled calendar contexts / 48 downloaded exports, plus 4 weight/back-off and 4 route/data contexts. The [release](https://github.com/Truesilverking/TGym/releases/tag/v1.15.111), signing, matching GitHub/Pages APKs, 51 public PWA files and actual public browser/export checks pass with protected synthetic data preserved and no observed runtime errors. Private/rejected artwork stays excluded and update-topic broadcasts were skipped. The existing Pixel QA app, `app.framegym.mobile.qa`, passes the 5 recorded physical scenarios with the existing profile, active session and history preserved. An in-place QA update was verified. Physical notification verification covers the collapsed card and its own QA-package record; the whole-unit check covers a ruler draft followed by Cancel. Expanded/rest/font-scale combinations have separate emulator coverage. No temporary workout or PIN was created, the screen setting was restored, and the original app was not accessed. Physical iPhone/native iOS remain unverified. See [audit](EXPERIENCE-AUDIT-1.15.111.md) and [evidence](EXPERIENCE-EVIDENCE-1.15.111.json). Protected main retains independent review.

Historical published release: **1.15.110 / Android 146**, runtime source `179ec5f6cb7b1e0d8f0dcf4aed89fdd3031ab34b`. Main module pages show Today, Routine, Start/Resume, Nutrition and Stats directly in a fixed bottom bar, with no lift handle or collapsing menu. Full-screen route and keyboard guards remain. Existing swipes, cover transitions and Stats motion retain their 1.15.109 source bytes. Local verification passes 3,080 frontend tests, 52 Android emulator component tests and 8 compiled browser contexts / 135 checks, plus 4 Start/Resume regression contexts. The [release](https://github.com/Truesilverking/TGym/releases/tag/v1.15.110), signing, matching GitHub/Pages APKs, 51 public PWA files and public navigation/regression checks pass with protected synthetic data preserved and no observed runtime errors. Personal artwork stays excluded and update-topic broadcasts were skipped. Physical Pixel/iPhone, native iOS and phone installation remain unverified. See [audit](NAVIGATION-AUDIT-1.15.110.md) and [evidence](NAVIGATION-EVIDENCE-1.15.110.json). Protected main retains independent review.

Historical published release: **1.15.108 / Android 144**, runtime source `fa039d9d6db301db9396d842dce44b80e57c3309`. The Streak calendar opens with a collapsed color key and integrates the chosen local name, current streak, avatar and selected period in a larger responsive card. Total training days replaces the unexplained next-milestone tile; optional local profile identity also appears in Streak PNG/PDF exports. Exact-source verification passes 3,079 frontend tests, 52 Android emulator tests and 6 compiled calendar browser contexts. The [release](https://github.com/Truesilverking/TGym/releases/tag/v1.15.108), official signing, matching Release/Pages APKs, 51 deployed PWA files, 6 actual-public calendar contexts and 4 public regression contexts pass with preserved synthetic profiles and no observed runtime errors. Update-topic broadcasts were skipped. The user waived Pixel testing; physical iPhone/native iOS and phone installation remain unverified. See [audit](STREAK-CALENDAR-AUDIT-1.15.108.md) and [evidence](STREAK-CALENDAR-EVIDENCE-1.15.108.json). Protected main retains independent review.

Previous published release: **1.15.107 / Android 143**, runtime source `ac612bf6869eae6fbf1ea13d27492213c9b9b201`. Swipe intent tolerates pauses, small diagonals and sparse release delivery while preserving scrolling and controls. Directional cover navigation and content-only Stats depth transitions retain a stationary Stats header. Exact-source checks pass 3,059 frontend tests, 52 Android emulator tests and 10 compiled browser contexts / 292 checks. The [release](https://github.com/Truesilverking/TGym/releases/tag/v1.15.107), signing, matching Release/Pages APKs, 51 deployed PWA files and actual-public regression/swipe checks pass with preserved synthetic profiles. Personal and rejected artwork are excluded; update-topic broadcasts were skipped. Physical Pixel/iPhone, native iOS and physical frame-rate acceptance remain unverified. See [audit](SWIPE-AUDIT-1.15.107.md) and [evidence](SWIPE-EVIDENCE-1.15.107.json). Protected main retains independent review.

Historical published release: **1.15.105 / Android 141**, runtime source `1504530fd32982b51b3a0c30c93d7d993c84f9a2`. Swipe navigation changes pages immediately with a short entry, recognizes recent intent, aborts multitouch and keeps blank Stats/card space swipeable down to the bottom while preserving controls, filters and workout data. Exact-source checks pass 3,051 frontend tests, 52 Android instrumented tests and 10 compiled browser contexts / 276 checks with byte-equal synthetic profiles. The [release](https://github.com/Truesilverking/TGym/releases/tag/v1.15.105), official signing, matching Release/Pages APKs, 77 deployed PWA files and 81 shared runtime assets are verified; four actual-public regression cases and six public swipe contexts / 83 checks pass with preserved synthetic state and no observed runtime errors. Edge offline cold-open passes; Windows WebKit offline cold-open retains its documented engine limit. Update-topic broadcasts were explicitly skipped. Pixel/original-app installation were waived; physical iPhone/native iOS and physical frame-rate acceptance are not claimed. See [audit](SWIPE-AUDIT-1.15.105.md) and [evidence](SWIPE-EVIDENCE-1.15.105.json). Protected `main` retains independent review.

Historical published release: **1.15.104 / Android 140**, runtime source `962e26262e1c1083900e35bd5acfe9782e774d4f`. Retained swipe navigation, a main-screen expandable dock, safe dock-free Workout Back navigation, shared Today/Nutrition calendars, simplified Stats headers, modern app lock, external timer alerts and original anatomical media preserve workout identities and stored precision. Exact-source CI passes 2,955 frontend tests and 52 Android instrumented tests; focused compiled checks pass 24 cases/126 checks. The [release](https://github.com/Truesilverking/TGym/releases/tag/v1.15.104), public APK/signing, 77 deployed PWA files and four actual-public Edge/WebKit cases are verified. Release/Pages APK SHA-256: `4de52615821b696a65b5f577e32f00c5c60f8f591807c97ca4ebc0e868678569`. Update-topic notifications were explicitly skipped. Final physical repeat/original-phone installation were waived and remain unperformed; physical iPhone acceptance is unclaimed, and Windows WebKit offline cold-open retains its engine boundary. See [audit](EXPERIENCE-AUDIT-1.15.104.md) and [evidence](EXPERIENCE-EVIDENCE-1.15.104.json). Protected `main` retains independent review.

Historical published release: **1.15.103 / Android 139**, runtime source `309ff599d2d13940e8e33c811b5bc2e81f44a186`. Whole-unit weight presentation and the Android control layout preserve precise legacy data; the pending code audit and Safari media-cache corrections are included. Exact-source CI, 43 instrumented Android tests, physical Pixel QA, normal PWA updating, public artifact integrity and actual public Edge/WebKit checks pass. See [audit](WEIGHT-ANDROID-AUDIT-1.15.103.md) and [evidence](WEIGHT-ANDROID-EVIDENCE-1.15.103.json) for coverage and device limits. Protected `main` retains independent review.


Historical published release: **1.15.102 / Android 138**, runtime source `a6145c753ce56f8c8a5847b150bdef2937f345a1`. Exact-source Tests, PWA, Android (43 instrumented tests), signed-candidate and release workflows passed. Official APK/AAB signatures, public GitHub/Pages APK hashes, metadata and all 49 deployed PWA/metadata files passed. Compiled weight, Settings/tour, normal 100-to-102 update and server-outage checks used the actual release Pages files, preserving synthetic profiles and embedded media in Edge and WebKit. See [correction and release audit](BUGFIX-AUDIT-1.15.102.md) and [structured evidence](BUGFIX-EVIDENCE-1.15.102.json), including Windows/Linux build-format differences and physical-device limits. FCM accepted the normal release notifications; phone receipt and physical iPhone acceptance remain unverified. QA 102 is prepared but not installed because ADB has no connected Pixel. Development stays on `Dev`; protected `main` retains independent review.

Historical published baseline: **1.15.100 / Android 136**, runtime source `cc4d7893f402db575008e4206176921c222bd597`. Exact-source CI, official signed artifacts, public APK/Pages hashes and 62 deployed PWA files passed. Six compiled synthetic browser cases verified shared weight entry. See [release audit](RELEASE-AUDIT-1.15.100.md) and [structured evidence](RELEASE-EVIDENCE-1.15.100.json). That audit does not establish a new physical-phone installation, installed desktop-PWA update, 99-to-100 preservation test, iPhone acceptance or push receipt.

Historical published baseline: **1.15.99 / Android 135**, runtime source `85681b6f3a81458790ede41a7c1d2d71edafa80d`. Exact-source CI, official signed artifacts, public APK/Pages hashes, normal isolated PWA 93-to-99 update/offline preservation and FCM service acceptance passed. See [release audit](RELEASE-AUDIT-1.15.99.md) and [structured evidence](RELEASE-EVIDENCE-1.15.99.json). The previous public baseline was 1.15.93 / 129, source `f9850f6ce0448764cef6df6e0c2a357bfc95f214`. Pixel QA is distinct from production signing/installation; actual desktop-PWA updating, physical iPhone acceptance and phone receipt remain separate boundaries.

Historical published baseline: **1.15.93 / Android 129**, runtime source `f9850f6ce0448764cef6df6e0c2a357bfc95f214`. Exact-source checks, signed artifacts, public update availability, isolated PWA 77-to-93 preservation and notification service acceptance passed. See [RELEASE-AUDIT-1.15.93.md](RELEASE-AUDIT-1.15.93.md) and [structured evidence](RELEASE-EVIDENCE-1.15.93.json). The previous public baseline was 1.15.77 / 113, source `b3ef639e0be8ba3ae4430b2320314d9e44a566fa`; physical phone receipt/production installation and iPhone acceptance remain separate, unverified boundaries.

Development uses `Dev`; `main` retains its required independent review and status checks. A release tag may reference the fully validated `Dev` commit while its integration PR awaits that review. Do not disable branch protection or send an additional resend notification to complete a normal release.

Historical 1.15.76 / Android 112, runtime source `eb2813487803bec1dc47b92988965873805dfd82`: the annual Streak calendar uses twelve real mini months, authoritative distinct active-date totals and shared week/month/year styles, preserving streak/history/timezone rules and existing exports. All four exact-source workflows passed before tagging: 2130 frontend tests, API 16, MCP 37, catalogue 6 and Android/emulator 11/0/0. Release `39443765992` passed; official signing continuity, identical GitHub/Pages APKs, 50 byte-identical production PWA compiled assets and 75→76/no-repeat updater checks are verified. FCM accepted both update topics without reruns. See `STREAK-CALENDAR-AUDIT-1.15.76.md`, `RELEASE-AUDIT-1.15.76.md` and `AUDIT-EVIDENCE-1.15.76.json` for screenshots, matrices and boundaries. Physical phone receipt/installation and iPhone acceptance remain pending.

Historical 1.15.75 / Android 111, runtime source `339d543766c1c534e59000d18937fc83c394ac5b`. Exact-source Tests, PWA, Android/emulator (11/0/0) and signed-candidate workflows passed before tagging. Release `39328305167` passed; GitHub/Pages APKs are byte-identical, official signing continuity is verified, and both updaters offer 75 from 74 without re-offering 75. Partial uses requested `#0087C2` with black text (5.24:1) across existing screen/report surfaces. Finish excludes optional warmups from required-work completion; actual pending work still requires confirmation. Existing daily Partial, activity, duration, history and statistics rules are preserved. Public PWA's 50 compiled assets exactly match the accepted production build; the environment difference from pages.yml validation is documented explicitly. See `PARTIAL-ROUTINE-AUDIT-1.15.75.md`, `RELEASE-AUDIT-1.15.75.md` and `AUDIT-EVIDENCE-1.15.75.json`. FCM service acceptance is confirmed; physical phone receipt/installation and physical iPhone acceptance remain pending.

Historical 1.15.74 / Android 110, runtime source `e06c725e200d2cff28b02dada58f4ed1a809d03c`, set shared Not Trained to requested `#ED1C24` with black text and border `#8f1015`, retaining 73's gray Pending and recording-start marker. See `RELEASE-AUDIT-1.15.74.md` and `AUDIT-EVIDENCE-1.15.74.json`.

Historical 1.15.73 / Android 109, runtime source `38751265d383c55d2094ac53fe2a4e0954d4f247`, introduced Pending `#696969`, the external effective recording-start marker and removal of the visible pre-tracking category. See `RELEASE-AUDIT-1.15.73.md`, `CALENDAR-TRACKING-AUDIT-1.15.73.md` and `AUDIT-EVIDENCE-1.15.73.json`.

Historical 1.15.72 / Android 108, runtime source `65434627d9d045c243c7b7e4ee0190d29f8c39be`, unified four screen/export state definitions and introduced white Rest. See `RELEASE-AUDIT-1.15.72.md`, `CALENDAR-COLORS-AUDIT-1.15.72.md` and `AUDIT-EVIDENCE-1.15.72.json` for that release.

Historical 1.15.71 / Android 107, runtime source `946aba662e713c5bd0ef06a85401685e9210b6dc`, introduced the preceding report redesign and comprehensive app audit. See `RELEASE-AUDIT-1.15.71.md`, `APP-AUDIT-2026-10-19.md`, `REPORT-DESIGN-AUDIT-1.15.71.md` and `AUDIT-EVIDENCE-1.15.71.json` for that scope and its device/integration boundaries.

The production version comes from frontend/package.json and must match Android versionName.
Android versionCode must increase. Historical release 1.15.70 / 106, runtime source `0ba497819052a17c71c67f2080fe3c451c20110b`. See RELEASE-AUDIT-1.15.70.md for exact-source CI, signed/public artifacts, public PWA update/offline retention, complete-year exports and FCM service acceptance; COMPLETE-YEAR-REPORT-AUDIT-1.15.70.md records design and regression evidence. Official catalog distribution remains deferred by the owner's explicit choice; local draft tooling and its proposal are documented in OFFICIAL-CATALOG-PROPOSAL.md. Historical import66 evidence is in ROUTINE-IMPORT-FLOW-AUDIT-1.15.66.md; quota65 evidence remains in RELEASE-AUDIT-1.15.65.md and ROUTINE-IMPORT-QUOTA-AUDIT-1.15.65.md. Historical version64 evidence is in RELEASE-AUDIT-1.15.64.md and ROUTINE-TRANSFER-AUDIT-1.15.64.md. Earlier versions retain their own evidence.
Routine transfer 1.15.64 adds format 2 with format 1 compatibility. Its tag followed all required local, native, exact-source signed-candidate, received-file round-trip and PWA offline checks. Independent public downloads confirm matching signatures, manifests, shell metadata and all 66 candidate/public runtime assets. Both GitHub/PWA updaters offer 64 from 63 and no update from 64; physical iPhone/native iOS and editing inside Excel Android remain untested.
The owner's actual Windows PWA62 failed one normal Update, then the protected hard reload loaded64. Confirmed close/reopen, normal offline-preparation Retry and up-to-date checks passed; all three official full backups are completely equal. See RELEASE-AUDIT-1.15.64.md for the exact observations and separate offline-profile boundary.
Run frontend/scripts/check-version.mjs before tagging.

Routine import correction 1.15.65 / Android 101 is published and validated against the original locally held JSON and an anonymous equivalent that reproduces the published-64 WebKit quota error. Its schema 4/resource representation migrates only after committed, freshly verified IndexedDB resource reads and a successful primary profile replacement; no prior source is deleted. Physical iPhone acceptance is unavailable because the screenshot belongs to a third party. Exact-source CI, signed artifacts, publication, public PWA and update-retention checks passed; see ROUTINE-IMPORT-QUOTA-AUDIT-1.15.65.md and RELEASE-AUDIT-1.15.65.md.

Desktop update correction 1.15.63 / Android 99 was published after its exact-source checks, verified signed candidate and corrected-source browser acceptance passed. The owner's installed Windows PWA then loaded63 and reported up to date, with completely equal official portable-profile exports. The tag suppresses the update-delivery notification step; credential validate-only checks and package/PWA publication still run.

## Single publication

Only release.yml deploys production Pages. pages.yml validates the PWA without deploying.
This prevents main pushes overwriting updates/latest.json or the production PWA with the demo.
All artifacts originate from the tagged commit; dist/build.json includes version and commit.

Validate exact-commit branch CI (Tests, Validate PWA, Validate Android) before creating v{version}.
The tag builds signed APK/AAB, verifies their signatures, publishes checksums and latest.json,
deploys the PWA, checks the actual public manifest and APK, then sends FCM.
FCM credentials are tested without sending a notification before publication.
Failures are not ignored. A failed notification does not mean an APK release was not created;
inspect the exact failing step before retrying to avoid duplicate notifications.

For a publication without update notifications, use an annotated version tag whose message
contains the exact line `[skip-update-notifications]`. Only the final FCM send is skipped;
credential validation, artifact checks and publication still run. Normal annotated tags and
lightweight tags retain the existing FCM send, even when a commit message contains the marker.
The policy reads the original remote tag in an isolated ref, since Actions checkout can replace
its local tag with the commit; a missing tag or a different source commit stops publication.

Required secrets: ANDROID_KEYSTORE_BASE64, ANDROID_STORE_PASSWORD, ANDROID_KEY_ALIAS,
ANDROID_KEY_PASSWORD, GOOGLE_SERVICES_JSON_BASE64, FIREBASE_SERVICE_ACCOUNT,
FIREBASE_PROJECT_ID. Never replace the signing key to fix a build.

## Android update behavior

The official manifest supplies the download and checksum, never a push URL.
The native installer downloads to private cache, verifies SHA-256, package name,
versionCode and equality of the signing certificate with the installed application.
It then invokes Android's installer. Android's install permission and confirmation
remain mandatory. A failed verification never launches the APK.
A full local snapshot is saved as tgym-pre-update.json before download/installation.

Foreground FCM uses data directly; a notification tap uses notification.data.
Both trigger a forced manifest check, bypassing the four-hour automatic throttle.
Startup, foreground and reconnect checks work independently of push permissions.
FCM acceptance by the service does not prove delivery to a particular phone.
Verify reception on a phone and N -> N+1 installation with preserved data separately.
Devices on older versions do not gain the new installer until they install this version.

## PWA

The service worker caches the build's shell/assets, names its cache by version/commit,
and deletes only old TGym caches. Update activates a waiting worker and reloads once.
PWA builds never use the APK installer.

Starting with 1.15.63, the portable pre-update safety copy commits to the existing
IndexedDB `tgym-profile` / `snapshots` store under `pre-update`; `current` remains
the normal independent profile mirror. The legacy `tgym_pre_update_backup`
localStorage key is the compatible fallback. If neither store commits, the update
stops with a recoverable storage message before activating the worker.

A large profile with uploaded GIFs can already fit in localStorage while its
second complete safety copy does not. An installation running the old handler
can need an initial hard reload to obtain this correction. Export and verify an
official full backup first, then use Ctrl+Shift+R in the existing Windows PWA;
do not clear site data or reinstall to work around this quota condition. Compare
a new full backup after updating. See DESKTOP-UPDATE-AUDIT-1.15.63.md for the
real installation, exact-artifact reproduction and separate isolated QA evidence.

## Locale compatibility

Language dictionaries explicitly inherit the source-language fallback for untranslated
keys. Existing translations override those keys. This preserves existing English fallback
behavior and provides complete key coverage; it does not claim all languages are translated.
The reviewed Portuguese inheritance fingerprint still checks only authored Portuguese.

## Cloud

Cloud and manual export use createBackup. Local saves do not depend on Drive.
Restore preserves the device's current Drive connection and saves local undo first.
Google OAuth still requires the Android package/certificate to be registered in Google Cloud.
Real Drive consent and cross-device restore require testing with an authorized Google account.
