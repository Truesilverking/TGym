# TGym offline and stability audit - 2026-09-27

## Candidate and acceptance status

Same checkout and branch `feature/dashboard-visual-polish`, based on `70898676ff89844d3f8a98ce79444e0932c2215d`. The published version remains **1.15.39 / Android75**. This audit is a local candidate, not a release. No credentials, signing files, production backups or user training data were inspected or changed.

**The requested real-iPhone acceptance is still open.** The user confirmed only a Pixel is available. Desktop origin-offline checks and Android native instrumentation cannot certify Safari/Home Screen airplane-mode, iOS suspension/eviction, keyboard or PDF Files behavior. No universal compatibility claim or new publication is made.

## Findings and fixes

1. Shell precaching omitted install icons/manifest/help pages and assumed flat assets. It now includes the complete local shell and nested build assets; its identity hashes their contents and the worker/configuration, including local builds with the same version.
2. Fresh network HTML could mix with an installed older shell, and activation removed chunks needed by open tabs. Root navigation now uses the installed shell and activation retains one previous build. API/update/download routes remain outside the asset cache.
3. Cache quota/read errors could discard an otherwise successful network response. Storage and network error paths are separated. Failed installation does not activate or delete the old shell.
4. Registration errors and incomplete cache state were invisible. `OfflineStatus` checks all shell entries, displays preparation/offline/error states and supports retry. Repair verifies the deployed worker identity before repopulating the current cache; a different deployment uses the existing PWA activation helper. Route changes preserve this status component.
5. Optional exercise media previously produced broken images. The shared media component now uses an accessible fallback and retries on reconnect. Recently viewed images have an independent 40-entry cache; the full remote catalog is deliberately not an essential startup dependency.
6. Local save/mirror failures were silent. Primary failure preserves the previous saved/in-memory state and raises a visible warning. Mirror failure keeps the primary copy and warns about exporting a backup. IndexedDB transactions time out and rapid mirror requests coalesce to the latest snapshot.
7. API sync intent could be lost if the page closed before its debounce, and reconnect did not retry it. The dirty marker is written before profile persistence, and reconnect reuses the existing serialized upload queue. Existing conflict/identity and active-session rules are retained.
8. API and Drive requests could remain pending indefinitely. Timeouts include the response body (API15s, Drive30s); malformed API JSON cannot be mistaken for successful persistence. Drive timeouts do not blindly retry writes.
9. Four catalog names contained a stray Cyrillic character before the degree sign; names were corrected without changing IDs or history.
10. Body PDF facts used full-width rows and pushed one weight card to a nearly empty page. Facts now use two columns, retaining every fact and the same font size. The representative selected report fits one page.
11. The Android workout instrumentation hardcoded the production package for permission/activity commands. It now uses the target context package, so a QA suffix tests the QA app.
12. Known vulnerable dependencies were patched without changing app APIs: scoped asset-tool overrides for tar7.5.21, sharp0.35.4, uuid11.1.1; MCP lock updates for fast-uri3.1.8, hono4.13.9, qs6.16.0 and Vitest4.1.11/nanoid3.3.19. No new runtime dependency was added. The image resize/SVG pipeline and UUID/project loading were smoke-tested. Tooling requires the existing modern Node environment (CI22, local24).

Relevant upstream advisories include [tar](https://github.com/advisories/GHSA-23hp-3jrh-7fpw), [fast-uri](https://github.com/advisories/GHSA-f65p-4m7j-42xc), [Hono](https://github.com/advisories/GHSA-crvj-82cr-hjcx), [qs](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g), [Vitest](https://github.com/advisories/GHSA-82fw-gwwq-j7x9). The initial registry audit needed Windows system CAs; it was rerun with system trust, without disabling TLS.

## Data and offline contract

Storage schema and keys are unchanged: `gym_state_v1`, IndexedDB `tgym-profile/snapshots/current`, native file mirror and portable backups remain compatible. No destructive migration is required. Normal mutations still use `useStore.update`. Routine/session/exercise IDs, timer deadlines, dated measurements, incomplete values and historical associations retain the existing calculations.

| Resource/action | Strategy |
| --- | --- |
| Local UI, exercise metadata/instructions, fonts, locales, body geometry, PDF code | Installed versioned shell and build assets |
| Workout/routine/history/measurements/InBody/settings/custom uploaded images | Local profile; PWA IndexedDB secondary copy |
| Viewed optional exercise images/animations | Bounded stale-while-revalidate cache and placeholder fallback |
| API/account/pairing/Drive/OAuth/update metadata/APK download | Network, explicit failure/timeout; no stale shell response |
| PWA update | Complete install before activation; retain previous hashed chunks; never clear profile storage |

Remote authentication, backend/Drive synchronization, new releases/downloads, remote notification delivery and never-cached catalog media need Internet. Local workout calculations, editing and PDF generation do not require those services. A first-ever uncached visit cannot start offline. Browser site-data deletion, OS eviction or uninstall can still require a portable/cloud backup; an IndexedDB mirror shares the browser storage origin. [WebKit storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/) does not guarantee retention in every circumstance.

## Verification and limits

| Environment | Actual evidence |
| --- | --- |
| Opera/Chromium desktop, production standalone build, isolated synthetic localhost profile | Complete59-resource precache; server stopped; reload and new-tab reopen; navigation/statistics/body model; offline measurement36cm saved/reopened; new routine2x8; workout/rest restored after reload; completion/history33 to34; PDF downloads opened/rendered |
| PWA lifecycle in that browser | Two successive candidate cache identities installed/activated; oldest cache removed, previous retained;34 workouts/measurements retained. Deliberately missing locale detected and restored through Retry, cache back to59 |
| Responsive desktop iframe |96 section/width/theme combinations: all8 sections at320/360/375/390/430 and844x390, dark/light, reduced motion enabled. No horizontal overflow. Representative body and controls visually inspected; this is not mobile Safari emulation |
| Pixel10, Android17/API37 |10 native instrumentation tests passed with the device unlocked, using separate `app.framegym.mobile.qa`; safe-area bounds/recreation/theme, workout/rest notification lifecycle, sounds and health import contracts |
| Native Android release | Clean `assembleRelease :app:lintRelease` succeeded after final Capacitor synchronization. Unsigned local release APK;0 lint errors,22 pre-existing warnings |
| Real Android installed PWA/browser airplane-mode, actual virtual keyboard | Not exercised in this run |
| iPhone Safari/Home Screen PWA, native iOS | Unverified: no iPhone/macOS/Xcode available |

Origin-offline tests stop the local server; the computer retains its general Internet connection. They prove cached app-shell/local-data behavior, not airplane-mode delivery behavior or access to uncached third-party media. Real Drive account traffic/pairing was not exercised against private accounts; retry/conflict/timeouts have automated coverage.

The first Pixel pass had safe-area failures while the device was locked and the hardcoded-package test failure. After unlock and test correction, the instrumentation log reports10/10. Gradle's UTP result collection still returned failure (`Failed to receive the UTP test results`) even with10/10; direct `adb shell am instrument -w` independently reports `OK (10 tests)` and exits successfully. This tooling failure is disclosed, not presented as a passed Gradle connected-test command.

Final automated checks: **frontend1172 tests/120 files**, **API10**, **MCP37 plus plain-Node loadability**; locales12/1655 keys, source strings, version check, fatigue108000 comparisons plus14076 history-edit comparisons. Web/PWA/mobile builds passed. There are **no frontend lint/typecheck scripts**. Full dependency audits including development dependencies report **zero known advisories** in frontend/API/MCP after the scoped updates.

Vite still reports the existing large main chunk and ineffective dynamic imports (backup/PDF/calendar/sheets). Android's22 warnings concern dependency age, resources/icons, one obsolete SDK check and Firebase token-refresh lint. No new runtime crash was observed in the covered flows; these warnings and untested physical platforms are not hidden or converted into guarantees.

Final browser downloads after the layout correction were opened and all pages rendered successfully: the selected Body Progress PDF is 1 page (258,852 bytes), and the complete 34-workout report is 24 pages (7,824,807 bytes). Both were generated with the local origin server stopped. These PDFs use the existing raster dashboard export; visual inspection, rather than extracted text, verified their contents. No blank page or clipped component was observed. The final unsigned APK contains all 61 synchronized web assets byte-for-byte. Final `git diff --check` passed; candidate paths and added-content checks found no build artifacts, signing material or credential patterns.

Evidence is local and ignored: `.tools/browser-audit/offline-delivery-*.log`, `offline-pixel-direct.log`, dependency audit JSON, downloaded/rendered PDFs and synthetic fixture servers. No generated build, PDF, screenshot, APK, SDK path or secret belongs in the commit.

## Remaining acceptance

On a real iPhone, install from Safari, load online, close, enable airplane mode, reopen from Home Screen, edit a routine/workout/measurement, close/reopen, export a PDF, reconnect, update and confirm all data remain. Also check the actual keyboard, safe areas, portrait/landscape and long suspension. The user has no iPhone, so this criterion remains unverified rather than marked complete. The current task requested an audit/fixes; no new release was published.

## Modified files

- `docs/ARCHITECTURE.md`
- `docs/OFFLINE-AUDIT-2026-09-27.md`
- `frontend/android/app/src/androidTest/java/app/framegym/mobile/WorkoutNotificationTest.java`
- `frontend/pnpm-lock.yaml`
- `frontend/pnpm-workspace.yaml`
- `frontend/public/sw.js`
- `frontend/scripts/pwa-metadata.mjs`
- `frontend/src/App.jsx`
- `frontend/src/components/Media.jsx`
- `frontend/src/components/Media.test.jsx`
- `frontend/src/components/OfflineStatus.jsx`
- `frontend/src/components/OfflineStatus.test.jsx`
- `frontend/src/index.css`
- `frontend/src/lib/api.js`
- `frontend/src/lib/api.test.js`
- `frontend/src/lib/cloud-sync.js`
- `frontend/src/lib/cloud-sync.test.js`
- `frontend/src/lib/exercises-data.js`
- `frontend/src/lib/progress-export.js`
- `frontend/src/lib/progress-report.test.js`
- `frontend/src/lib/pwa-metadata.test.js`
- `frontend/src/lib/service-worker.test.js`
- `frontend/src/lib/web-state.js`
- `frontend/src/lib/web-state.test.js`
- `frontend/src/locales/de.js`
- `frontend/src/locales/es.js`
- `frontend/src/locales/fr.js`
- `frontend/src/locales/hi.js`
- `frontend/src/locales/it.js`
- `frontend/src/locales/ko.js`
- `frontend/src/locales/pl.js`
- `frontend/src/locales/pt-BR.js`
- `frontend/src/locales/pt.js`
- `frontend/src/locales/ru.js`
- `frontend/src/locales/tr.js`
- `frontend/src/locales/zh.js`
- `frontend/src/main.jsx`
- `frontend/src/store/useStore.js`
- `frontend/src/store/useStore.pwa.test.js`
- `frontend/src/store/useStore.session.test.js`
- `mcp/package-lock.json`

## Publication authorization follow-up

The user subsequently connected a physical iPhone, but this Windows session exposes no iOS control interface. No real iPhone test was performed. The user then explicitly authorized publication despite this limitation ("publica el update entonces"). Version 1.15.40 / Android code 76 will carry these corrections; physical iOS, installed Android PWA airplane-mode and keyboard coverage remain unverified. This authorization supersedes the earlier publication gate, not the recorded test limitations.
