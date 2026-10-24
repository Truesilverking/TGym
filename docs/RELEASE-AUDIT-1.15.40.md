# TGym 1.15.40 / Android code 76

Published from `f7fd0ce2c4ddec13e845f7489d6f3d9f505ab58a` on `feature/dashboard-visual-polish`.

- Scope: [offline audit](OFFLINE-AUDIT-2026-09-27.md). The user explicitly authorized publication without waiting for physical iPhone validation. iOS device behavior is not claimed as verified.
- [Tests](https://github.com/Truesilverking/TGym/actions/runs/36354454276): success (frontend/API/MCP, build, locales/source strings, fatigue and Node loadability).
- [Android build and emulator](https://github.com/Truesilverking/TGym/actions/runs/36354454155): success.
- [Release](https://github.com/Truesilverking/TGym/actions/runs/36354862495): success, including signed APK/AAB, PWA deployment, live metadata verification and update-topic notification submission.
- [Stable release](https://github.com/Truesilverking/TGym/releases/tag/v1.15.40): APK, AAB, checksums and manifest publicly available; tag resolves to the runtime commit above.
- Independent GitHub and Pages APK downloads match SHA-256 `cc845e137226fb147c7b936e810749833250a908fbc1629649a15bc3a6139d75`.
- APK signature verified; signing certificate remains `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082`. Package `app.framegym.mobile`, version 1.15.40/code76 verified with aapt.
- Live update manifest and PWA build metadata match the runtime commit. The actual app-update module detects 1.15.40 from 1.15.39 in Android/GitHub and PWA modes; the current version does not offer itself again.
- Local baseline: frontend1172/120 files, API10, MCP37, Pixel native instrumentation10; web/PWA/mobile builds, Android release/lint, browser-origin offline persistence/cache repair/updates and actual PDF downloads. Versioned PWA/mobile/Android builds passed again before publication.
- Notification submission succeeded. Actual phone receipt, iPhone Home Screen update installation, real iOS offline/keyboard/tour and physical Android PWA airplane mode remain unverified. Known baseline build/lint warnings and earlier UTP collection failure are documented in the audit.
- No credentials, signing material, private data or binaries committed. Verification artifacts are ignored under `.tools/release-1.15.40/`.
