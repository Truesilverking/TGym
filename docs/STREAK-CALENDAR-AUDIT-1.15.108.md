# Streak calendar 1.15.108 / Android 144

The calendar opens with its color key collapsed. The native disclosure supports pointer and keyboard activation, remains open while navigating within the sheet and starts closed when reopened. Other calendars and exported report legends retain their existing presentation.

The local display name and current streak sit above the selected period; the avatar sits beside the week, month or year selector. The integrated card uses larger square dates, readable annual date numbers and two annual columns on narrow screens. Long display names reserve three visible lines with their complete text available to assistive technology and in the title. The current streak and the selected period's distinct active-date count remain separate.

The unexplained Next milestone tile is replaced by Total training days, derived from the existing authoritative streak rows. Duplicate same-day sessions, future activity and unfinished sessions cannot inflate it. Best/current streak rules, rest, pauses, Partial, local dates, workout identities and history are unchanged.

The existing saved profile visibility preference controls both the screen and optional Streak PNG/PDF identity header. Hidden profiles do not appear in exported reports. Only the chosen local name and bounded embedded raster photo are included; cloud identity is excluded. Screen and report avatars retain initials underneath the photo as a fallback. All report formats reuse the shared layout with reserved header space; Consistency output is unchanged.

Validation includes focused component/report tests, the full frontend suite, API/MCP/catalogue checks, locale/source/version checks, fatigue probes and web/PWA/mobile asset builds. Compiled Edge/WebKit checks cover 320/390/1440 px, English/Spanish, light/dark themes, long names, disclosure keyboard operation, profile visibility/reload, date boundaries, exports and preservation of synthetic data. Exact-source CI, signed artifacts and public deployment evidence are recorded with the release verification.

The user authorized GitHub publication and waived the Pixel test because the device is unavailable. Browser automation and emulator evidence do not establish physical Pixel/iPhone acceptance or native sharing. Production-phone installation is not performed; protected main retains independent review. The release tag suppresses update-topic notifications.

<!-- published-verification:1.15.108:start -->
## Published verification

Published runtime: `fa039d9d6db301db9396d842dce44b80e57c3309`, Android versionCode 144. [GitHub release](https://github.com/Truesilverking/TGym/releases/tag/v1.15.108).

- The complete frontend suite passes 3,079 tests across 259 files. API tests pass 24; MCP passes 38 tests across 2 files; the catalogue suite passes 6. Local Android assembleDebug and app lintDebug complete successfully (35s). All five exact-source branch/candidate gates pass. The downloaded Android emulator report records 52 tests, 0 failures and 0 skipped (55.901s).
- Compiled Edge/WebKit checks pass 6 contexts with 6 actual PNG exports and 6 actual PDF exports. The actual public deployment independently passes 6 calendar contexts and 12 exports, plus 4 navigation/updater/workout regression contexts. English/Spanish, light/dark themes, 320/390/1440 px, profile visibility/reload, the collapsed key, date boundaries and preserved synthetic training are covered. No observed runtime errors occur in these runs.
- Official package/signature, nondebuggable state and exact APK/AAB source metadata pass. GitHub Release and Pages APKs are byte-identical. All 51 published PWA/metadata files and 55 candidate-shared runtime assets match. The current updater does not offer this same version again; Edge offline cold-open passes with its synthetic profile preserved.
- The exact-source signed candidate APK/AAB scan checks 389 forbidden image hashes supplied by metadata, finds no forbidden matches, GIF files or rejected filenames, and confirms unchanged media/fonts/sounds against the verified public baseline. No new static binary assets or embedded raster images were introduced. Public-to-candidate runtime parity is verified separately by the public artifact audit. No live profile or personal image bytes were read for this scan.
- The annotated release tag suppresses update-topic broadcasts; the successful release workflow confirms the notification step was skipped. Protected main retains independent review.

Release APK SHA-256: `7d3a870b3668989ce2c042376438061d481d25b36072fa973a0379de8af84903`.

Release AAB SHA-256: `a3080fe9dcd1014280888bc41d0e1c6ae7991e86993c69ba060ab49689be7c54`.

The user waived physical Pixel validation. Physical iPhone, native iOS compilation, native sharing, phone installation and Windows WebKit offline cold-open are unverified. Browser/emulator results are not physical-device acceptance. Only generated avatars and synthetic profiles were used for browser checks; raw profiles and personal media are excluded from this evidence.

See [structured evidence](STREAK-CALENDAR-EVIDENCE-1.15.108.json).
<!-- published-verification:1.15.108:end -->
