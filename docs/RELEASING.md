# TGym releases and verification

The production version comes from frontend/package.json and must match Android versionName.
Android versionCode must increase. Current published release: 1.15.70 / 106, runtime source `0ba497819052a17c71c67f2080fe3c451c20110b`. See RELEASE-AUDIT-1.15.70.md for exact-source CI, signed/public artifacts, public PWA update/offline retention, complete-year exports and FCM service acceptance; COMPLETE-YEAR-REPORT-AUDIT-1.15.70.md records design and regression evidence. Official catalog distribution remains deferred by the owner's explicit choice; local draft tooling and its proposal are documented in OFFICIAL-CATALOG-PROPOSAL.md. Historical import66 evidence is in ROUTINE-IMPORT-FLOW-AUDIT-1.15.66.md; quota65 evidence remains in RELEASE-AUDIT-1.15.65.md and ROUTINE-IMPORT-QUOTA-AUDIT-1.15.65.md. Historical version64 evidence is in RELEASE-AUDIT-1.15.64.md and ROUTINE-TRANSFER-AUDIT-1.15.64.md. Earlier versions retain their own evidence.
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
