# Releasing TGym

GitHub is the distribution source. Configure `VITE_GITHUB_OWNER` and `VITE_GITHUB_REPO` in official builds; never commit private signing material.

## Release procedure

1. Increment `package.json.version`, Android `versionName`, and Android `versionCode`. The code must exceed every published code.
2. Run `node scripts/check-version.mjs`, the test suite, and all builds.
3. Commit, then tag the exact commit with `v<package version>` and push the tag.
4. The workflow checks version equality, builds and signs Android, creates SHA-256 checksums, publishes the GitHub Release, writes `updates/latest.json`, deploys the PWA to Pages, and optionally sends the FCM topic notification.

## Required GitHub secrets

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_STORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
- `FIREBASE_SERVICE_ACCOUNT` and `FIREBASE_PROJECT_ID` when update push is enabled
- `GOOGLE_SERVICES_JSON_BASE64` containing the Android Firebase configuration when update push is enabled

Keep the same Android signing key for every release. Losing or changing it prevents direct APK upgrades.

## Firebase and Apple

Android's `google-services.json` is project configuration; configure FCM for package `app.framegym.mobile`. Devices must be subscribed to `tgym_updates` by the native notification setup. iOS uses APNs through Firebase or its configured App Store/TestFlight channel; GitHub does not install an IPA.

## Pages and rollback

Enable GitHub Pages with **GitHub Actions** as its source. To roll back, publish a new higher patch version/versionCode containing the reverted code. Do not move an existing release tag or lower Android's versionCode. Mark a bad release as a prerelease and remove its download links only after the replacement exists.
