# TGym 1.18.0 daily weight through Health Connect

Published release: **1.18.0 / Android 157**, runtime source `3710141cc5ec50fab03297166605cab87f211607`. Android can import Withings weight through Health Connect without a TGym server or Withings developer credentials. A valid weight already stored today is reused across workouts without adding another sample. The signed release, public update metadata and package parity passed verification. See [release](https://github.com/Truesilverking/TGym/releases/tag/v1.18.0), [evidence](HEALTH-WEIGHT-EVIDENCE-1.18.0.json) and [setup](SMART-SCALE.md).

## Behaviour and preservation

- Android 14+ requests read-only Weight permission explicitly and separately from exercise access. Only weight from the official Withings app origin is imported; TGym does not request health writes or background health access.
- Manual and optional foreground sync read complete snapshots from the last 30 days, bounded to 5,000 records and 20 pages. Provider identity, original measurement time and native modification time are retained. Canonical kilograms convert to the profile's display unit; daily values follow the existing sample-average convention.
- Reimports and revisions remain idempotent. Conservative cross-source matching requires the same Withings measurement second and canonical weight within 0.005 kg, preserving original identity and provenance. Only one weight source is active. Manual entries, unrelated measurements, profile, routines, training history and existing active/completed workout weight snapshots are preserved.
- Disconnect retains measurements. Portable backups retain readings but disable device-specific access and automatic sync preferences. Source changes, permission revocation, persistence failures and stale in-flight results have regression coverage.
- Starting another workout reuses a valid weight already recorded today. When today's value is missing and automatic Health Connect sync is enabled, a cancellable check waits up to five seconds before the manual check-in. Cancellation or navigation prevents a late import from unexpectedly starting a workout. Yesterday's value and future-dated readings are not borrowed for today.
- The exercise load question and workout design published in 1.17.0 remain covered: pending increases wait for a choice, declining keeps the current loads, and accepting updates dependent automatic sets while preserving recorded and manual rows.

## Setup

1. In Withings, allow **Weight** sharing with Health Connect.
2. In updated TGym, open **Health & wearables**, then **Daily weight**.
3. Select **Allow weight access** and grant TGym permission to read Weight.
4. Select **Sync now**; optionally keep **Sync automatically on app open** enabled.

Withings must deliver the reading to Health Connect before TGym can import it. A linked account or granted TGym permission does not establish that a weight reading exists; an empty read shows guidance. Automatic import runs while TGym is open or returns to the foreground, with a 15-minute cooldown. Closed-app import is not promised.

## Verified scope

Verification passed 3,446 frontend tests in 284 files, 62 CI Android emulator tests without failures/skips, and local Android compilation/lint (0 errors, 22 warnings). Exact-source CI also passed API, MCP/loadability, catalogue and PWA checks. All nine HealthWeights native regressions are present and passed. Signed candidate and public APK/AAB metadata, package identity, official signing continuity, bundled source, native plugin presence and private and rejected artwork scans passed. Health permissions contain only the existing exercise read permission and the new Weight read permission.

Compiled workout/browser acceptance passed 8 local contexts / 120 groups and 8 actual-public contexts / 120 groups, using isolated synthetic profiles at 320, 390, 430 and 1280 CSS pixels across Chromium/WebKit, EN/ES, light/dark and reduced-motion cases, with zero runtime errors. Load decisions, dependent automatic sets, daily reuse, reload and protected profile/history checks pass. Representative screenshots were visually reviewed.

The separate compiled Health Connect interface matrix passed 6 contexts / 37 groups with zero runtime errors. Controlled Android bridge responses cover explicit permission, a synthetic 80.5 kg import, idempotence, reuse in two routines, empty reads, denied/revoked permission, reload and cancelled start with a late import. Its saved screenshots were visually reviewed. This matrix did not access an Android Health Connect datastore or real permission dialog.

Public verification checked all 51 PWA files, exact update/build metadata and identical Release/Pages APK bytes. The updater offers 1.18.0 to 1.17.0 and does not repeat the offer to 1.18.0 in both Android and PWA distributions. The annotated release tag suppressed update broadcasts.

APK SHA-256: `dbd69e62ff69c5e2ec7856301bd6279ac2b37907df839f4c6512cbfa1e004186`.
AAB SHA-256: `8cea746342242d767517cc994a46c0ca55d98e4b0ae97380534051cc3410da27`.
Certificate SHA-256: `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082`.

## Limits

No physical phone was accessed or installed. Phone receipt/installation, actual Health Connect permission grant and live Withings-to-Health-Connect-to-TGym weight delivery remain unverified. Synthetic browser and native regression checks do not establish a live scale import. Native iOS, OS-installed PWA, offline cold-open and prior service-worker upgrade were not verified for this release. Protected main was not merged as part of publication.
