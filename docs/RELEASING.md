# TGym releases and verification

The production version comes from frontend/package.json and must match Android versionName.
Android versionCode must increase. Current candidate: 1.15.12 / 47.
Run frontend/scripts/check-version.mjs before tagging.

## Single publication

Only release.yml deploys production Pages. pages.yml validates the PWA without deploying.
This prevents main pushes overwriting updates/latest.json or the production PWA with the demo.
All artifacts originate from the tagged commit; dist/build.json includes version and commit.

Validate main CI (Tests, Validate PWA, Validate Android) before creating v{version}.
The tag builds signed APK/AAB, verifies their signatures, publishes checksums and latest.json,
deploys the PWA, checks the actual public manifest and APK, then sends FCM.
FCM credentials are tested without sending a notification before publication.
Failures are not ignored. A failed notification does not mean an APK release was not created;
inspect the exact failing step before retrying to avoid duplicate notifications.

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
