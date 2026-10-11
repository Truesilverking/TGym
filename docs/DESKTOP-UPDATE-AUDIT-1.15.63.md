# Desktop/PWA update correction 1.15.63

## Reproduction and cause

The owner's existing Windows Edge PWA displayed TGym 1.15.60. Its real Check for updates action offered 1.15.62; pressing Update returned the generic failure without completing the update. An official full-backup download was saved locally and its portable-envelope CRC verified before recovery. The profile contains six routines, fourteen custom exercises and five uploaded animations; its compact portable state is 4,762,671 characters.

The previous updater writes a second complete portable profile to localStorage before touching the service worker. That function is identical in published 1.15.60 and 1.15.62. A real isolated Edge browser running the exact published 1.15.62 artifact reproduced `QuotaExceededError` for a similarly sized synthetic profile: the current profile fits but the additional safety copy does not. The real Update dialog stops immediately, preserves the primary profile and does not activate the worker. The owner's generic error was observed through the installed UI; the exception was captured in the separate exact-artifact reproduction. This reproduces a failure condition consistent with the previously unclassified installed-profile failure documented in `RELEASE-AUDIT-1.15.60.md`; a small isolated profile passing an update did not exercise this condition. The earlier historical exception itself was not captured.

## Correction and compatibility

`AppUpdate` now waits for a committed portable backup in the existing IndexedDB database `tgym-profile`, store `snapshots`, separate key `pre-update`. Writes and reads reuse the bounded storage helpers. The current mirror under `current` and the primary `gym_state_v1` profile are unchanged. If IndexedDB is unavailable or fails, the existing `tgym_pre_update_backup` localStorage key remains a fallback. If both stores fail, the update stops with a specific recoverable message; it never silently skips the safety copy. Recovery verifies envelope checksums and selects the newest valid copy, including a newer fallback after a temporarily failed IndexedDB write.

There is no workout, routine or exercise migration. Uploaded GIF data, stable IDs and naming preferences remain in the existing portable envelope. The native `tgym-pre-update.json` filesystem path and Android package/signature/download validation are unchanged. Service-worker activation and Progress Report are outside this storage correction.

## Existing installation recovery

Old installed JavaScript cannot acquire this fix by successfully executing its already broken Update handler. After the verified export, a hard reload recovered the owner's actual installation from 1.15.60 to the then-published 1.15.62 without clearing site data or reinstalling. A second official full-backup download was checksum-validated and every portable profile field compared equal, including every embedded GIF byte. Applying the corrected publication to this existing installation and its post-update verification remain pending at this source checkpoint.

## Verification checkpoint

Regression coverage exercises the actual mounted Update dialog and checks that a full localStorage profile does not prevent an IndexedDB backup, that worker activation follows durable commit, that fallback retains compatibility, and that failures preserve history, the primary profile, the mirror and prior backups. Storage tests cover bounded open/read/write waits, retry, late-open cleanup and newest-valid recovery. Spanish and common English fallback keep the locale keysets aligned.

Local checks passed: frozen pnpm 10 installation; frontend 1,853 tests in 170 files; API 11 tests; MCP 37 tests and the plain-Node import graph; version/code validation; 12 synchronized locale dictionaries with 1,802 keys; web, PWA and mobile builds; Android debug compilation and lint. The fatigue probes passed 108,000 monotonic comparisons and 14,076 history-edit comparisons. The mobile build only synchronizes Capacitor assets; the separate Gradle run supplies Android compilation evidence. There are no frontend lint/typecheck scripts, and none are claimed.

In real isolated Edge 155, corrected-source QA builds labeled 1.15.62 and 1.15.63 passed the visible Check for updates → Update → worker activation → reload flow with native localStorage quota exhaustion. Every portable profile field and the current mirror stayed equal, and the committed IndexedDB safety copy passed its envelope CRC. Closing and reopening the persistent browser offline retained the version, profile and safety copy; all five synthetic GIFs decoded. These older QA version labels are a synthetic update test, not evidence that the old published handler contains this fix.

Exact-source CI, signed candidate/public artifact validation and the corrected owner's installed-PWA acceptance remain pending at this source checkpoint. Physical iPhone and native iOS compilation are not covered by this Windows task. Private exported profiles, screenshots and synthetic binaries remain ignored local evidence and are not committed.
