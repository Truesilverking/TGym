# TGym 1.15.30 release audit

## Scope

- Completed sets become compact read-only summaries of actual load, reps and RIR/RPE, with a check and an explicit Undo Completed action. Undo retains values and unlocks editing. Pending/current rows remain expanded; invalid drafts block completion, including timed completion. Explicit completion cancels a matching work timer so a delayed callback cannot overwrite locked results. Warmup, top/backoff, per-side, cardio, timed and intensity rows keep their existing data semantics. Decimal results are not rounded to the old one-decimal summary format.
- Current-row scrolling happens only if needed for the selected exercise, respects reduced motion, and does not scroll after the final set. The flex summary wraps on small screens using existing theme variables and 44px undo targets.
- Android keeps one ongoing decorated native notification (3100), containing only workout time, optional active rest countdown and phase-relative current set. Rest takes visual priority and disappears when expired. Native chronometers tick without minute refreshes. Updates coalesce stale JS payloads; finish clears both live and legacy completion notifications instead of posting another notice. Inactivity stops the service independently of the WebView.
- Rest deadlines now persist with the active workout, survive serialized restore and preserve elapsed workout time. Editing rest after background suspension uses the deadline rather than stale display seconds.

## Persistence

Optional active.restTimer = {endsAt,total}; no schema/key/database change or destructive migration. Existing records require no conversion. Only start/edit/stop saves, never per-second persistence. History drops this temporary field; continuing an auto-ended session cannot resurrect its old rest. Existing localStorage/native mirror paths remain in use. Read-only collapse derives from the saved done flag, without a second persisted completion state.

## Platforms and limits

Android RemoteViews/DecoratedCustomViewStyle retain system notification decoration; native chronometers support the workout/countdown. See https://developer.android.com/develop/ui/views/notifications/custom-notification.

The published iPhone surface is the PWA. Its in-app workout/rest timers and completed summaries use the same state; the existing supported web rest-alert mechanism remains. A suspended standalone/offline PWA cannot guarantee background timer alerts. Live Activities/Dynamic Island are not web APIs. The repository has a single iOS Capacitor App target (iOS 14 baseline), no WidgetKit extension, no ActivityKit integration, and no iOS signing/release pipeline. Implementing/publishing that additional native target is not viable through this Android/PWA update; no simulated API or uncompiled extension is included. Native iOS compilation/device validation remains unperformed. References: https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities and https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/.

Browser access remains blocked by saved permissions. The user's existing instruction authorizes release with subsequent visual review together via installed-app screenshots. EN/ES component assertions and responsive CSS review do not establish physical-device appearance or process-kill behavior. Physical phone lockscreen and iPhone/mobile/desktop visual checks remain pending.

## Verification

- Frontend: 969 tests across 101 files pass, including readonly/undo, actual values, per-side accounting, serialized restore, invalid drafts, Spanish, deadline edits and stale notification update coalescing.
- API: 10 tests pass. MCP: 37 tests pass; Node-loadable import graph passes.
- Web, PWA and mobile asset/sync builds pass; Android debug/instrumentation packages compile and lint passes. Existing warnings remain (dependency/resources/tooling); no frontend lint/typecheck scripts exist. iOS asset sync is not native compilation.
- Locale/source checks: 12 locales, 1532 keys; 1013 source strings covered. Version consistency: 1.15.30 / Android 65. Frozen lockfile install passes.
- Native instrumentation covers compact/expanded clocks, current set, hidden finished rest, background deadline/sound, pause/resume and inactivity removal. CI emulator execution is required before tagging.

## Publication gate

Previous public version verified as 1.15.29 / 64. Push candidate to feature/dashboard-visual-polish; require Tests and Validate Android success for the exact commit before creating v1.15.30. Use the existing release workflow, then verify release APK hash/package/signature, Pages manifest/build, remote commit/tag, and FCM acceptance. FCM acceptance cannot confirm receipt on the user's phone.
