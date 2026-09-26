# Mobile viewport audit — 2026-09-26

Status: corrected and validated locally for release 1.15.33/code 69; publication evidence will be recorded separately. Physical Pixel native acceptance passed; physical Android PWA and iOS remain unverified. The existing per-side repetition correction is preserved: 8 per side displays 8, with legacy storage compatibility.

## Cause and correction

`frontend/src/index.css` used a `100vh` body, a 560px mobile content cap, fixed bottom clearances and only top/bottom safe areas. `frontend/public/manifest.json` locked portrait. Dialogs did not follow a visual-only keyboard resize. The Android WebView correctly reserved native system insets, but its parent surface did not follow the application's theme.

- `frontend/index.html` retains `viewport-fit=cover` and zoom support, and requests `interactive-widget=resizes-content` where supported. The manifest retains standalone display and permits orientation changes.
- `frontend/src/lib/viewport.js`, installed by `ThemePreferences` in `frontend/src/App.jsx`, measures the visual viewport and actual fixed navigation/timer bounds. CSS uses dynamic viewport height and all four safe-area insets. Keyboard resizing gives forms the visible area; timer state continues independently.
- `frontend/src/index.css` covers the full available mobile width, paints opaque surfaces, protects the top safe area during scrolling, and positions dialogs, timers, toasts and undo controls within usable bounds. `frontend/src/components/AppTour.css` uses the same measured clearance. `frontend/src/views/Workout.jsx` no longer adds an unrelated 40px bottom spacer.
- `frontend/src/lib/system-appearance.js` calls Android's `SystemAppearancePlugin.java` when the theme changes. The plugin paints the native reserved areas and selects readable system icons. Capacitor retains ownership of native insets; system controls are not hidden. `AndroidManifest.xml` explicitly requests `adjustResize`.
- No workout schema, storage key, progression calculation or update validation was changed.

The second audit caught a timer overlap when safe-area padding changed without a content-box resize. Observing the navigation's border box corrected it; the complete second matrix passed after that change.

## Evidence for current local source

| Check | Result |
| --- | --- |
| Frontend full suite | 1,057 tests, 110 files passed, including the Firebase availability regression |
| Viewport/theme targeted tests | 6 passed, included in full suite |
| Web / PWA / mobile builds | All passed; final mobile build synchronized Capacitor after the last layout edit |
| Local Android | `assembleDebug`, `:app:lintDebug`, `:app:assembleDebugAndroidTest` passed with JDK 21 / SDK 35 |
| Android lint | 0 errors, 20 warnings: Firebase token refresh (1), dependency updates (5), obsolete SDK check (1), unused resources (8), icon sizing/duplicates/location (5). None points to the new appearance plugin. Warnings remain open; this is not a warning-free build. |
| First responsive matrix | 40 Chromium/WebKit configurations, 200 route checks passed |
| Second audit | 12 Chromium/WebKit flows passed after the overlap correction |
| Physical Pixel | Eight native WebView flows passed: gesture/three-button navigation, portrait/landscape, Dark/Light, real IME, visible focused field, timer clearance, per-side 8 display. Timer/reps reload passed. Original rotation and gesture-navigation settings restored. |
| Physical Android instrumentation | Both `SafeAreaTest` tests passed on the final candidate, covering exact bounds/recreation and themed reserved surfaces. |
| API / MCP | Previous applicable baseline: API 10, MCP 37 and Node loadability passed. Not rerun for this UI/native-only change. |
| Git whitespace | `git diff --check` passed |

The first matrix covers 320, 360, 375, 390 and 430px portrait widths and their landscape counterparts, Dark/Light, reduced motion and English across Home, routine, workout, Stats and Settings. Checks include horizontal overflow, full available width, navigation clearance, safe padding, dialog bounds and legacy per-side edit/reload preservation.

The second matrix covers Spanish, both themes, 320×568, 430×932 and 844×390, asymmetric landscape safe areas, persisted rest deadlines and reload, modal inputs, simulated visual-viewport keyboard resize/offset, focus visibility and restoration. It reported no page errors or axe WCAG 2 A/AA and 2.1 AA violations in the exercised flow. Representative final screenshots were inspected.

Local evidence is intentionally ignored: `.tools/browser-audit/viewport-audit.mjs`, `viewport-second-audit.mjs`, their JSON/screenshots in `artifacts/`, and root `audit-viewport-*.log`. These contain synthetic browser profiles, not the user's workouts. They are local evidence, not a new CI job.

## SDK and isolated device candidate

With explicit user authorization, official command-line tools, Android platform 35 and Build-Tools 35.0.0 were added to the existing configured SDK. No second SDK or Android Studio was installed. TLS stayed enabled. The native package installer exited abnormally after extraction; successful real Gradle compilation and APK tooling subsequently verified the installed components. A PowerShell execution-policy failure was resolved by invoking `pnpm.cmd`, without changing system policy.

The final debug candidate is separately identified as **TGym QA**, package `app.framegym.mobile.viewportqa`, version 1.15.33/code 69. Its ignored Gradle init/manifest overlay is in `.tools/viewport-qa/`; the production package identifier is unchanged. It was installed alongside the main application, using synthetic state only. The user's main TGym application/data were not replaced or modified by this audit.

Physical launch exposed an existing fatal native registration exception in builds without Firebase configuration. `UpdatePushPlugin.availability()` now checks native Firebase initialization before `update-push.js` requests registration. Missing configuration skips push initialization; configured production builds retain registration, topic subscription and update validation. A regression test checks that missing configuration never invokes native registration. The rebuilt candidate passed the physical flows without this crash.

## Outstanding acceptance gates

1. Pixel native checks are complete for the tested flows. Automatic approval review blocked the command to open Chrome through ADB, so physical Android browser/installed-PWA acceptance remains unverified. Desktop Chromium/WebKit results do not replace it.
2. Only a Pixel is available. Windows WebKit 26.6 testing uses simulated safe-area insets and keyboard geometry; it is not Safari on iPhone, a real notch/Dynamic Island or an installed iOS PWA. Physical iOS acceptance remains unverified. Native iOS compilation requires macOS/Xcode; Capacitor sync is not that compilation.
3. Publication is explicitly authorized by the user after the available Pixel validation. Verify exact remote commit, applicable Actions, signed release identity/hash and published update metadata; notification acceptance alone does not prove phone delivery.
4. The main Pixel previously had candidate 1.15.32/code 67. Release 1.15.33/code 69 advances both version name and code so this installation can detect the update as well as public 1.15.31/code 66.

Platform references: [WebKit safe areas](https://webkit.org/blog/7929/designing-websites-for-iphone-x/), [Chrome keyboard viewport behavior](https://developer.chrome.com/blog/viewport-resize-behavior), [Android edge-to-edge](https://developer.android.com/develop/ui/views/layout/edge-to-edge).
