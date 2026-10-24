# TGym 1.15.33 release audit

Published 2026-09-26, Android versionCode 69. Source/tag: `86807aeed8921a79cabd22ab0833317a10f3bbc1` / `v1.15.33`. The remote branch and tag were checked against the local source. Release: https://github.com/Truesilverking/TGym/releases/tag/v1.15.33

This release includes the per-side UI correction (8 per side displays 8 while keeping legacy data compatible), mobile viewport/safe-area/keyboard corrections, and a native Firebase availability guard for builds without optional push configuration. Earlier post-release fixes on this branch are included. Detailed viewport causes, first/second audit findings and physical limits are in `VIEWPORT-AUDIT-2026-09-26.md`.

## Verification

- Local frontend: 1,057 tests / 110 files; web, standalone PWA and mobile builds passed. Twelve locales have matching 1,542-key sets. No frontend lint/typecheck scripts exist.
- [Tests](https://github.com/Truesilverking/TGym/actions/runs/36223397098): success on exact release source; frontend, API and MCP jobs passed.
- [Validate Android](https://github.com/Truesilverking/TGym/actions/runs/36223397095): success on exact release source; native build, lint and emulator instrumentation passed.
- [TGym release](https://github.com/Truesilverking/TGym/actions/runs/36223716023): success; signed APK/AAB, existing signer comparison, package/version validation, GitHub assets, Pages deployment, published-byte/metadata verification and FCM notification submission passed.
- Physical Pixel: isolated TGym QA package, synthetic state, eight portrait/landscape × Dark/Light × gesture/three-button flows with real keyboard; per-side 8, timer clearance and reload passed. Both final `SafeAreaTest` instrumentation tests passed. Original phone navigation/rotation settings restored; main TGym data untouched.
- Working changes were reviewed for accidental files and common secret patterns before commit. SDK paths, local tools, screenshots, test profiles, signing material and credentials were excluded.

## Published artifacts

| Artifact | SHA-256 |
| --- | --- |
| APK | `67a22a81f7864a5400d384a9c6d7cdc3c2b2200c635d05c283b62d542ede7a58` |
| AAB | `ae2a23dcba864e0a4b54273921195ef4bd77672f04a03fbcec78570943031823` |

The public release includes APK, AAB, `checksums.txt` and `latest.json`. Version name and code advance beyond both public 1.15.31/code 66 and the Pixel's earlier 1.15.32/code 67 candidate, allowing the existing updater comparison to recognize this release.

Independent post-publication downloads from GitHub and Pages produced identical APK bytes matching the manifest SHA-256. Local `apksigner verify --print-certs` passed and matched both the current manifest and previous published signer: `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082`. `aapt` confirmed package `app.framegym.mobile`, version 1.15.33/code 69. Pages `build.json` matched the exact release source/version. Ignored local evidence: `.tools/release-1.15.33/verified.json`.

## Limits

FCM acceptance proves submission, not phone delivery or installation. The main phone app was not replaced during QA. Physical Android Chrome/installed-PWA testing was blocked by automatic approval review of the ADB Chrome command. No iPhone was available; Windows WebKit/simulated safe areas are not physical Safari/iOS validation. Android lint retained 20 documented warnings and no errors. These checks support the tested flows; they do not promise that every device and function is free of defects.
