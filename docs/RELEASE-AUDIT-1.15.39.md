# TGym 1.15.39 / Android code 75

Published from `d4424a8635222a49b310e66b992cdb9f6c1c5289` on `feature/dashboard-visual-polish`.

- Scope and local/browser/PDF evidence: [body model audit](BODY-MODEL-AUDIT-2026-09-27.md). This publication follows the user's subsequent explicit update request; it supersedes that audit's source-only publication scope.
- [Tests](https://github.com/Truesilverking/TGym/actions/runs/36345347787): success.
- [Android build and emulator](https://github.com/Truesilverking/TGym/actions/runs/36345347777): success.
- [Release](https://github.com/Truesilverking/TGym/actions/runs/36345359056): success, including APK/AAB signing, PWA deployment, live metadata verification and notification-topic submission.
- [Public stable release](https://github.com/Truesilverking/TGym/releases/tag/v1.15.39): APK, AAB, checksums and manifest available. Tag points to the runtime commit above.
- Independently downloaded GitHub and Pages APKs have identical SHA-256: `af98a5105199e955098f6a0be02eace5565b828297cce32e17e35e5c2dac5fec`.
- APK signature verified; certificate unchanged from 1.15.38: `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082`. Package `app.framegym.mobile`, version1.15.39/code75 confirmed with aapt.
- Live Android manifest and PWA build metadata match the runtime commit. Actual app-update module detects1.15.39 from1.15.38 in GitHub/Android and PWA modes;1.15.39 does not offer itself again.
- FCM submission succeeded. Physical notification receipt, installation and iOS behavior are not claimed as verified.
- No credentials, signing material, private data or binaries committed. Ignored verification artifacts: `.tools/release-1.15.39/`.
