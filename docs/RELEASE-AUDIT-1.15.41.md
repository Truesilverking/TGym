# TGym 1.15.41 / Android code77

Published from `e999554a4c3370c4cac00a82050623222df64491` on `feature/dashboard-visual-polish`.

- Scope and data-flow review: [workout/routine UX audit](WORKOUT-UX-AUDIT-2026-09-28.md). Phase headings, minimum new RIR, persistent routine presentation order, integrated pause/resume, next scheduled Home routine and visible annual untracked cells.
- [Tests](https://github.com/Truesilverking/TGym/actions/runs/36485064883): success on the exact runtime commit (frontend/API/MCP, builds, locales/source strings, fatigue and Node loadability).
- [Android build and emulator](https://github.com/Truesilverking/TGym/actions/runs/36485064866): success, including background workout notification instrumentation.
- [Release workflow](https://github.com/Truesilverking/TGym/actions/runs/36485924462): success, including signed APK/AAB, PWA deployment, public metadata verification and update-topic notification submission.
- [Stable release](https://github.com/Truesilverking/TGym/releases/tag/v1.15.41): public, not a draft/prerelease; APK, AAB, checksums and manifest available. The annotated tag resolves to the runtime commit above.
- Independent GitHub and Pages APK downloads match SHA-256 `51cfb8e376b92a3e6195e7c397d87d089e2f7d2a10efead479f4329494e30a53`. APK signature verified; certificate remains `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082`. Package app.framegym.mobile, version1.15.41/code77 verified with aapt.
- Live update manifest and PWA build metadata match the version/runtime commit. The actual app-update module detects1.15.41 from1.15.40 in Android/GitHub and PWA modes;1.15.41 does not offer itself again.
- Local frontend1195/123files, final targeted41, API10, MCP37 plus Node loadability, locale/source validation, fatigue108000 and history-edit14076 comparisons passed. Final web/PWA/mobile builds and local Android assembleRelease/lintRelease passed (zero errors/22 existing lint warnings). No frontend lint/typecheck scripts exist.
- Browser evidence:60 isolated responsive/theme cases plus annual calendar, RIR/pause/order reopen and origin-offline persistence checks. This is desktop-browser responsive evidence, not physical iOS validation.
- FCM submission accepted; actual notification receipt and installation on the user's device are not confirmed. Physical iPhone PWA/long-press/keyboard and current physical Android gesture behavior remain unverified. No universal device compatibility claim. Existing build/lint warnings remain documented.
- No credentials, signing material, private backups or binaries committed. Independent verification artifacts remain ignored under `.tools/release-1.15.41/`.
