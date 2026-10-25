# TGym releases and verification

Current published release: **1.15.100 / Android 136**, runtime source `cc4d7893f402db575008e4206176921c222bd597`. Exact-source CI, official signed artifacts, public APK/Pages hashes and 62 deployed PWA files passed. Six compiled synthetic browser cases verified shared weight entry. See [release audit](RELEASE-AUDIT-1.15.100.md) and [structured evidence](RELEASE-EVIDENCE-1.15.100.json). This release audit does not establish a new physical-phone installation, installed desktop-PWA update, 99-to-100 preservation test, iPhone acceptance or push receipt. Development stays on `Dev`; protected `main` integration retains independent review.

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
