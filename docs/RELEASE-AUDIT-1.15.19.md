# TGym 1.15.19 release audit

Reviewed changes from `56e1c8b` through `286bad7` against Prompt 1, Prompt 2 and the independent audit request. Commit authorship alone does not identify which assistant wrote every line: some commits include work from several sessions.

## Findings and corrections

| Area | Result |
| --- | --- |
| Workout timer | Shared clock freezes required work completion; Continue/Add Exercise/Add Set/Uncheck exclude decision pauses. Restore, native mirror ordering, inactivity and finish behavior have regression coverage. |
| Duration integration | Fixed remaining raw start/end subtraction in MCP and Admin live presence. History, Stats and notifications use the shared clock. |
| Routine Duration | Stable routine IDs, legacy groups, mean/median/sample count and period selection. Reject invalid timestamps, future ends, active/cancelled and duplicate sessions; do not discard a valid session merely for being long. |
| Consistency | Shared scheduled-routine matching; completed/(completed+missed), excluding pending days. Filters active/cancelled/duplicate IDs. Removed unsolicited weekly progress with a conflicting denominator and hardcoded Spanish text. |
| Calendar/Home/Stats | Shared expandable Week/Month calendar; next uncompleted scheduled workout; compact names, accessible status, conditional deload legend, centered export, shared consistency card. |
| Reports | Dedicated square-cell SVG reports; PNG 2x; proportionally fitted PDF pages. Report date now drives both cells and summary. Layout structure tested; actual browser PDF/PNG review not completed. |
| Persistence/backup/cloud | Existing portable schema and storage IDs retained. Paused clock fields remain part of persisted training state. No OAuth credentials or signing files changed. |
| Native updater | Existing package/hash/newer-version/installed-signer validation retained. Foreground and reconnection checks bypass automatic throttling. FCM data is a prompt to check official metadata, never an arbitrary APK URL. |
| PWA separation | Web checks its own deployed `build.json`; metadata bypasses service-worker cache. Native release pipeline migrates only updater code in the previously published PWA source, retaining its version and UI. Already open/offline clients require the migrated service worker/app to activate; no PWA push is sent. |
| Publication verification | Compare remote version, versionCode, commit, APK URL, certificate fingerprint and exact APK/AAB/checksum/manifest bytes against locally verified CI artifacts before FCM. Verify APK package/version and signing continuity before publishing. |

## Verification

- Frontend: 759 tests in 73 files passed.
- API: 6 tests passed; MCP: 37 tests passed and bare-Node import graph passed.
- Locale checks: 12 locales, 1298 keys; 889 source strings present.
- `build`, `build:pwa`, `build:mobile` passed; final Capacitor sync completed.
- No lint/typecheck scripts exist. Existing large-chunk and ineffective dynamic-import warnings remain.
- Local Android compilation failed because the verified User SDK path is absent in this tool process, including fresh `--no-daemon`. No SDK was downloaded. Native compilation and instrumentation must pass in GitHub Actions before release.
- iOS native compilation is not available on Windows.

## Explicit limits and release gate

The user explicitly removed Computer Use validation from the publication gate after browser automation failures. The 320/360/375/390/430 Dark/Light/reduced-motion visual matrix is **not** claimed as passed. Physical-device process-kill behavior and notification receipt are not claimed as tested. CI Android instrumentation tests notification background behavior, not every physical-device lifecycle.

Candidate version is 1.15.19 / Android code 54, following remotely verified 1.15.18 / code 53. Signing material stays in existing CI secrets. The existing `tgym_updates` subscription is Android-native; browser web-push uses the separate optional API. Do not claim delivery to a device from an accepted FCM request.

Publication status and exact remote run/commit evidence will be recorded after CI finishes.
