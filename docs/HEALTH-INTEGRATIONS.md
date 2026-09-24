# Health and activity integration — TGym 1.15.25

Reviewed 2026-09-23 against the primary documentation linked below.

## Implemented data path
Manual activities work locally/offline in web, PWA and native builds. Each activity is a normal workout with stable ID and additive `activity` metadata. Planned activities are normal routine exercises; weekly/day overrides, pause exclusions, notifications, consistency and history therefore share the existing scheduling path. Newly created activity routines have an additive scheduledFrom boundary so they cannot create historical missed days. A standalone run cannot complete a hybrid strength routine. Strength volume remains separate from distance, duration and minutes × RPE. Imported strength sessions have no invented sets/weights or muscle load.

Android 14+ uses the platform Health Connect API (compile SDK 35), one optional READ_EXERCISE permission and explicit foreground synchronization. The bridge imports completed exercise sessions from the last 30 days, paginates and carries record ID, origin package and last modification time. No GPS, background, historical-extension, health-write, or broad sensor permissions. Type, start/end, duration, title and notes are supported; distance, HR, steps and calories are manual fields in this first adapter and are not fabricated from absent exercise records. No cloud credentials are stored. Permission state is rechecked before every sync and when the UI resumes. Disconnect disables application sync while retaining imported records; system permission revocation is a separate, clearly labeled action.

Import identity is `provider:origin:recordId`. Repeated imports update the existing row, do not sum repeated measurements, and retain manual notes, effort, distance and routine identity when absent from the provider. A near-identical same-type manual/single-activity TGym session (start within 2 min and duration within 1 min/3%) is reconciled. Native strength sessions also reconcile by type/time while retaining all sets, volume and exercise metadata. Multi-exercise hybrid sessions are not guessed to be the same imported session. Different activities remain distinct. This bounded heuristic cannot prove equivalence of arbitrarily edited cross-provider records; provider IDs are authoritative within each source. Upstream deletion does not remove history already stored by the user.

## Provider feasibility

| Provider | API/authentication/permissions | Data and sync | Platform and limits |
| --- | --- | --- | --- |
| Health Connect | Android platform API; user-granted READ_EXERCISE | Implemented: exercise sessions, source, modification timestamps; manual 30-day read with pagination | Native Android 14+ implemented. Android 9–13 would need the Jetpack SDK/provider compatibility path; PWA cannot access it. More metrics require separately disclosed read permissions and aggregate queries. |
| Apple Health | HealthKit entitlement, native authorization per data type; no OAuth | Workouts, activity, HR and other authorized types; anchored queries for incremental sync | Viable in the iOS Capacitor shell after a native Swift plugin, entitlement/rationale and physical-device validation. No browser API. Not connected/implemented in this build. |
| Google Fit | Legacy OAuth REST/Android APIs | Existing clients may migrate; new registrations closed May 2024, service supported through end 2026 | Do not introduce a new dependency on a retiring API. Prefer Health Connect on-device or Google's newer Health API when the deployment has an approved cloud integration. |
| Garmin | Garmin Connect Developer Program; approved application and OAuth2 PKCE | Activity/health APIs, program-dependent access, notifications/backfill | Requires provider approval and a configured HTTPS callback/backend. Cannot silently integrate without a registered application. Native/PWA could use that backend; no direct connector enabled. |
| Fitbit | Legacy registered app/OAuth2 PKCE; migration to Google Health API and Google OAuth scopes required | Exercise logs and health summaries, subscription/polling with provider rate limits; intraday access has additional restrictions | Fitbit announces legacy Web API deprecation in September 2026. A new connector should target Google Health API after registration/consent and migration review, not the retiring endpoints. No client secrets in PWA; no connector enabled. |
| WHOOP | Registered app; OAuth2 authorization code, read:workout and optional recovery/sleep scopes, offline refresh scope | v2 workouts, cycles, recovery/sleep; pagination/webhooks; rate limited | Viable via a configured backend and developer app. No credentials, callback or provider account configured here; no direct connector enabled. |

Adapters are isolated under `frontend/src/lib/health/adapters`. The existing normalized daily-health schema continues to represent absent measurements as null and keeps vendor-specific recovery/HRV metrics separate. Future adapters should emit the activity import contract rather than introducing another calendar or workout clock.

## Persistence and rollout
Schema 2 adds completion flags and activity metadata without renaming any existing keys or arrays. Existing onboarding marker or training history prevents onboarding replay; tour completion and skip both persist, with explicit replay in Settings. Standalone PWA mirrors its profile to IndexedDB independently of service-worker caches; the newer copy is recovered on boot. The service worker removes only versioned app caches. New releases publish current PWA source and matching metadata instead of rebuilding the old pinned UI. Android uses its existing native file mirror. Backups include activity rows. Clearing all browser site data/uninstalling still requires an external backup; no local-only application can promise recovery after that deletion.

## Primary references
- Android reads/history/permissions: https://developer.android.com/health-and-fitness/health-connect/read-data
- Platform API: https://developer.android.com/reference/android/health/connect/HealthConnectManager
- Apple authorization: https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data
- Google migration: https://developer.android.com/health-and-fitness/health-connect/migration/fit
- Garmin program: https://developer.garmin.com/gc-developer-program/overview/
- Garmin OAuth2 PKCE: https://developerportal.garmin.com/sites/default/files/OAuth2PKCE.pdf
- Fitbit authorization: https://dev.fitbit.com/build/reference/web-api/developer-guide/authorization/
- WHOOP OAuth: https://developer.whoop.com/docs/developing/oauth/
- WHOOP API and limits: https://developer.whoop.com/api/ and https://developer.whoop.com/docs/developing/rate-limiting/
