# TGym 1.15.27 audio audit

Prepared version: 1.15.27 / Android versionCode 62. Scope: playback, previews, sound preferences and notification mute propagation.

## Findings and corrections

- Android previews previously used the notification stream and ringer policy, instead of a gesture-started media preview. Previews now use Web Audio independently of saved notification choices.
- Web initialization happened after awaiting the native bridge; resume/decoding failures were swallowed. Initialization now runs synchronously in trusted gestures, handles suspended/interrupted/closed contexts, bounds resume waiting, logs useful failures and reports preview errors.
- Preview and selection were coupled in Settings, with no stop/playing state. Every candidate now has independent Preview/Stop; selecting another cancels the previous playback and pending decode.
- Added bounded volume and explicit mute, preserving legacy Sounds on/off. Both preview and automatic events obey these settings. Native WAV gain is derived without changing stored original audio.
- Browser push previously ignored local audio preferences. The service worker now persists only sound/quiet-hour switches in a separate durable cache and uses them for notification silence. Browser notification tones remain OS-managed.
- All four audible presets are generated PCM WAV, not external files: 24 preset/event combinations. Silence is intentional and has no preview.
- Custom clips retain the existing bounded portable storage (three clips, five seconds, 2 MB input limit). Missing/invalid/deleted selections fall back to Classic. No storage keys were renamed and no user records were removed. New fields have backward-compatible defaults.

## Local automated evidence

- Frontend: 96 files, 923 tests passed, including rest/countdown/completion triggers, timed-work cues, all event selections, preview cancellation, mute/gain, blocked/interrupted contexts, persistence and service-worker notification policy.
- API: 7 tests passed. MCP: 37 tests passed and Node import graph check passed.
- Web, standalone PWA and mobile/Capacitor builds passed. Version and locale checks passed (12 packs / 1507 keys).
- Android debug app and instrumentation APK compiled; Android lint passed (401 Gradle tasks). Emulator execution is a separate CI gate.
- PCM audit passed for all 24 clips: valid mono 16 kHz WAV, 0.10–0.90 seconds, RMS 0.062–0.093, nonzero unclipped signal. CI mobile build regenerates the Android test-only fixture from the real presets.
- There are no frontend lint/type-check scripts in this repository. Existing bundle-size/dynamic-import warnings remain unrelated.

## Interactive Chromium evidence

Used a synthetic local profile, never a personal profile. Reviewed mobile 390 x 844 and desktop 1280 x 900 layouts, Spanish and English.

- Played all 24 clips through actual AudioContext/decodeAudioData/buffer sources, waiting for actual completion and checking advancing context time: 24/24 passed.
- Auditioned a candidate without changing the selected sound; verified playing/Stop, selection changes, disabled zero-volume controls, mute/unmute and saved volume.
- Registered and activated the production service worker; updated from the prior loaded version to 1.15.27 using the app's update dialog. Selected tone and volume survived.
- Stopped the local server, closed the app tab and reopened it. Cached PWA loaded and previews worked offline with preserved preferences.
- Imported a short WAV while offline; previewed it before selection, selected it, reloaded, and previewed the persisted clip. Deleting it restored Classic and removed the saved custom entry.
- No audio-related console errors/warnings were observed in these flows.

## Platform limits and distribution gate

The Chromium service-worker/update/offline flow was verified, but an OS-installed standalone PWA window, physical speaker audibility, a physical Android phone and iOS/Safari were not available for verification. Android emulator decoding/completion does not establish physical-device audibility. These are explicit remaining validation gaps, not claimed passes. Do not describe notification delivery to an individual phone as proven by FCM acceptance.

## Changed files

- `.gitignore`
- `frontend/package.json`
- `frontend/android/app/build.gradle`
- `frontend/android/app/src/main/java/app/framegym/mobile/SoundPreferences.java`
- `frontend/android/app/src/androidTest/java/app/framegym/mobile/SoundPreferencesTest.java`
- `frontend/scripts/check-sounds.mjs`
- `frontend/public/sw.js`
- `frontend/src/App.jsx`
- `frontend/src/main.jsx`
- `frontend/src/components/SoundSettings.jsx`
- `frontend/src/components/SoundSettings.css`
- `frontend/src/components/SoundSettings.test.jsx`
- `frontend/src/lib/sound.js`
- `frontend/src/lib/sound.test.js`
- `frontend/src/lib/sound-preferences.js`
- `frontend/src/lib/sound-preferences.test.js`
- `frontend/src/lib/native-sound.js`
- `frontend/src/lib/web-audio-preferences.js`
- `frontend/src/lib/mobile.js`
- `frontend/src/lib/service-worker.test.js`
- `frontend/src/lib/state-merge.js`
- `frontend/src/lib/english-fallback.js`
- `frontend/src/locales/es.js`
- `frontend/src/store/useStore.js`
- `frontend/src/store/useStore.pwa.test.js`
- `frontend/src/store/useUI.js`
- `frontend/src/store/audio-events.test.js`
- `docs/RELEASE-AUDIT-1.15.27.md`
