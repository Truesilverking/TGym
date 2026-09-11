# Master plan progress

Source: Downloads/TGym_Codex_Plan_Maestro_Orden_Estricto.md (read 2026-09-11).
Baseline: 683b65e, v1.15.13. No publication allowed until phases 1–5 pass.

## Phase 1
Implemented three categories; Body Size uses existing height with an additive recorded-date field (no fabricated date for old heights). Circumference entries remain optional joint sessions. Legacy per-metric configuration remains portable, with one derived group reminder. Explicit group configuration overrides legacy configuration. Old notification IDs are still cancelled. Snooze can move an occurrence to tomorrow even before its original due date.

Verification: 683 tests / 62 files passed; Vite web build, mobile build and Capacitor sync passed; 12 locale packs synchronized, source-string audit passed. Invoked installed Vitest/Vite/Capacitor executables directly: npm is not installed on this host and the runtime pnpm wrapper attempts a dependency reinstall. iOS native compilation was not performed on Windows (Xcode/CocoaPods unavailable).

## Phase 2
Replaced weekday-repeat alerts with pending-today/next-workout notices derived from calendar and saved history. Day overrides/rest days, quiet hours, configurable next-reminder time and stable cancellation IDs are covered. Notification taps resolve the current routine without overwriting an active workout. Launch/foreground refreshes the schedule. 689 tests passed plus web/mobile builds and locale audits.

## Phase 3
Persistence tracks edits to set values and entries, excluding navigation/preferences and unit conversion. Completion ignores warm-ups; adding work/unchecking resumes the clock. Inactivity warning at 20 minutes, save at 30 with last real activity, timed-work exemption, native warning, same-ID resume snapshot, history resume entry point and unit conversion of that snapshot added. 699 tests passed and builds completed. Shared duration readers remain in use. Phone lifecycle acceptance remains untested.

## Phase 4 in progress
Android native foreground service, native chronometers, paused duration, rest visibility, silent channel and deep link implemented. 704 JavaScript tests passed; web/mobile assets built and synced. Local `:app:assembleDebug` completed successfully with JDK 21 and Android SDK 35 under ignored `.tools/android-qa`. SDK license acceptance explicitly authorized by user.

User explicitly deferred all phone tests until they request them (2026-09-11). Do not install or interact with their phone. Report device notification/upgrade acceptance as NOT TESTED, never as passed.

## Phase 5
Added the shared routine muscle preview using the Statistics body map, primary/secondary/other muscle grouping, exercise drill-down, and entry points from Home, Plan, Routine Edit and Calendar. Browser QA covered 320/360/375/390/430px widths without horizontal overflow; Spanish rendering and muscle selection were verified.

## Remaining
Phase 4 device lifecycle acceptance and phase 6 clean-install/release verification remain pending. The user explicitly deferred phone testing, so no APK was installed and no device notification claim is made. No changes have been committed/pushed/published.

## Publication authorization
User explicitly waived device validation and requested GitHub publication on 2026-09-11. Release 1.15.14 (49) proceeds with device lifecycle and live Drive acceptance untested. Local 704 tests, web/mobile builds, locale checks and Android debug compilation passed.
