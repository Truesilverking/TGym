# TGym 1.15.13 — verification and Google Drive

## Changes
- Drive: explicit connect action (does not overwrite a backup), native authorization error reporting, single expired-token recovery, non-interactive automatic backups, recoverable web identity loading, and partial snapshot warnings after a successful primary save.
- RIR: new effective sets start at the upper bound of their own target range. The original prescription and actual per-set RIR remain separate. Warm-ups stay unrated. Advice uses the last completed rated effective set, not an average. Backups preserve both values.
- Measurement reminders: optional per-metric intervals, local-calendar dates, grouped local notifications, snooze/skip, automatic recalculation from actual measurements, backup/restore, and independent calendar/export indicators. These do not count as training.
- Export Calendar: compact icon-first button, shared line and vertical center, English/Spanish text. Existing export sheet retained.

## Google Cloud setup (2026-09-10)
Project: tgym-38ff3. Android package: app.framegym.mobile.
Android OAuth client: TGym Android GitHub.
Release certificate SHA-1: a4811ea390fd3d9ab0de1253c1d95177e9e43970.
Drive API enabled. OAuth is in production for external Google accounts. The PWA OAuth client is restricted to https://truesilverking.github.io; the app selects it automatically only on that origin. Only drive.appdata is requested by the app; no general Drive access.
Branding/privacy documents: /TGym/about.html and /TGym/privacy.html.
Google configuration changes may take minutes to hours to propagate.

## Verification
Local validation: 680 frontend tests passed; web and mobile build scripts completed; 12 locale packs are synchronized. GitHub release CI additionally compiles and signs the native Android APK/AAB, checks the published APK and live update manifest, and sends the FCM release notification.
Browser checks at 320, 360, 375, 390 and 430 px confirmed Export Calendar icon-first, zero vertical-center difference and no horizontal page overflow. Clicking the real component opened the sheet and generated a PNG.

## Phone acceptance check (cannot be replaced by unit tests)
1. Install the signed release over the previous TGym installation; keep a separate full backup.
2. Open Settings → Load Routine → Google Drive; connect and approve the requested private-app-data permission.
3. Save a backup and verify its date/status; list backup history. Restoring replaces local data only after confirmation.
4. Automatic backups run when the app is active and due; this is not an Android background service that guarantees execution while the app is closed. Web token expiry may require reconnecting.
5. Backups live in Drive's hidden app-data folder, not a normal visible Drive folder. Disabling automatic backup does not delete existing copies or revoke access.
6. A successful FCM send means Firebase accepted the message; actual delivery still depends on the phone's network, notification permission and OS restrictions.

References: https://developer.android.com/identity/authorization and https://developers.google.com/workspace/drive/api/guides/appdata.
