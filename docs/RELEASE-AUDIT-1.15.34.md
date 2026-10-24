# TGym 1.15.34 / Android code70

## Scope

Progress Report was implemented first, followed by the workout clock/recovery changes. See `PROGRESS-REPORT.md` for comparison methodology and `WORKOUT-CLOCK.md` for session states, recovery thresholds and correction. Existing identifiers, backups, per-side semantics and updater validation are preserved.

## Verification before publication

- Final CI frontend suite passed (1,103 tests across114 files); local full1,099 baseline and all later affected regression tests passed. Coverage includes same-day reading preservation/deletion, current-day afternoon duration and invalid/missing-load comparisons.
- API10 tests; MCP37 tests and plain-Node import graph passed.
- Fatigue probes:108,000 monotonic and14,076 randomized history-deletion comparisons passed.
- Twelve locales have1,623 matching keys. Frontend has no lint/typecheck scripts.
- Web/PWA/mobile builds passed. Capacitor synchronized Android/iOS web assets. Android assembleDebug and lintDebug passed using the existing SDK35 and JDK21; lint reported zero errors and20 warnings. iOS native compilation requires macOS/Xcode.
- Synthetic browser UI: report in EN/dark and ES/light; no horizontal overflow at320/360/375/390/430/1024. Custom-range filtering verified using real keyboard input, HTML download confirmed, a populated Full Report vector page visually inspected. Component tests verify period changes and selected-range export. Final report corrections distinguish percentage points, missing load and best timed performance.
- Browser session flows: completed old session restored with54 minutes, incomplete abandoned6h30 session restored with1h5m, History correction saved60 minutes, manual pause persisted through reload, Continue excluded waiting, last-set completion froze the timer and Continue retained the frozen value. The browser check exposed damaged Spanish accents, which were corrected before publication.
- Requested clock cases A–L have deterministic timestamp tests, plus persistence/native-mirror/backup and multi-routine integration tests. Incomplete sessions do not expire from30-minute touch inactivity; old native warning scheduling was removed.

## Limits and resolved failures

The first full run found an obsolete30-minute assertion, and the first integrated build found an obsolete native-warning import; both were corrected. Browser date `fill` changed DOM without a React event, so real keyboard input and component assertions were used. Browser connection loss was recovered using the reconnected Edge session. At the time of local validation, ADB detected no Pixel; physical-device validation of these new features is not claimed. No physical iPhone is available. Android emulator CI passed before tagging. Automatic stale recovery is a documented inference with user correction, not certainty about unrecorded physical activity.

## Publication

Published [v1.15.34](https://github.com/Truesilverking/TGym/releases/tag/v1.15.34), Android code70, source/tag `2189998de7f5e3736d15e347c5b606e5d2f55801`.

- [Tests36245754254](https://github.com/Truesilverking/TGym/actions/runs/36245754254): SUCCESS (frontend/API/MCP).
- [Android36245754322](https://github.com/Truesilverking/TGym/actions/runs/36245754322): SUCCESS, including emulator instrumentation.
- [Release36246009539](https://github.com/Truesilverking/TGym/actions/runs/36246009539): SUCCESS, signed APK/AAB, Pages, published metadata/artifact verification and FCM submission.
- Independent GitHub and Pages APK downloads have identical SHA-256 `d6c11567fbd697d3332ba3c39cf64b2d5fb2d0a3dbd98386f9ab66683921fdde`.
- `apksigner` verified installed-release signing identity unchanged: `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082`. Package `app.framegym.mobile`, version1.15.34/code70 verified with `aapt`.
- PWA build metadata matches the exact version/source. Independent local evidence is `.tools/release-1.15.34/verified.json` (ignored).

FCM submission success does not prove phone receipt or installation. ADB had no connected Pixel during this task; physical iOS remains unavailable. Browser viewport restored and synthetic QA servers stopped. No personal workout data was used or changed.
