# Body-weight entry and motion, 1.15.99

The weight editor uses a large editable number and a horizontal ruler in the profile's configured unit. Stronger flicks travel farther and slow progressively to a planned tenth-unit endpoint. The separate goal and workout-load editors retain their existing controls.

## Data and rendering

- Pointer moves are grouped into animation frames. Coasting stays inside the picker rather than rendering the surrounding editor for every moving tenth. Seven reusable groups keep the marks and their layout bounds small; the number reserves its width so its unit does not shift.
- Save reads the committed visible field. Cancel, focus, keyboard input, new gestures, external values, reduced motion and backgrounding stop or discard motion appropriately. Weigh-ins retain sample identities, daily averages, retry protection, local dates and the existing unit conversion.
- Ordinary persisted edits still use the existing store transaction. During a marked Android gesture, the forced two-second activity write uses a small local/native clock journal. Real pressed pointer movement renews the quiet period; animation and hover do not. The existing clock helper restores valid input to the matching open session without changing pause flags, workout rows or full-profile freshness. Quiet and explicit flushes retain the full-profile path.
- Android mirrors the same JSON file through a worker and `AtomicFile`. Small string slices preserve Unicode pairs without first encoding the whole profile on the JavaScript thread. Transaction tokens, ordered chunks, character/byte counts and the committed SHA-256 protect completion and recovery. Legacy byte-count transactions remain supported. iOS keeps its previous native file path.
- The native workout launch link is processed once per ready shell. Later notification events use the current navigation callback. Selecting Home or Settings no longer replays an old notification launch.

No exercise media, catalogue identities, routine IDs, stored training rows, existing profile keys or native package identifiers were replaced.

## Physical QA

The final candidate was installed over TGym QA with its signing identity preserved. The profile file was byte-identical immediately after installation; the complete private backup remains local. Full profile/history/preferences/set preservation and WebView/native agreement passed after gesture cancellation and cold reopening. No test weigh-in was saved, and production was not launched or read.

| Final Pixel test | Maximum RAF interval during motion | Number mismatch samples | Detected coast freezes |
| --- | ---: | ---: | ---: |
| First isolated strong flick | 17.2 ms | 0 | 0 |
| Isolated reverse flick | 16.8 ms | 0 | 0 |
| Twelve flicks, including reversal | 16.9 ms | 0 | 0 |
| 3.5-second drag | 16.9 ms | 0 | 0 |

These are measured callback/committed-DOM observations, not a device-wide FPS guarantee. The readout is intentionally quantized to tenths, so its expected pauses near rest are distinguished from a frozen value.

The earlier 1.15.98 burst trace contained three motion-phase RAF gaps above 50 ms, with a maximum of 216.6 ms. It exposed synchronous full-profile persistence and a large bridge transfer. An intermediate candidate still paused for about 66 ms before starting a native transfer; removing the whole-profile encoding resolved that measured path. Earlier failed trials are retained locally. The isolated-flick order changed between the original baseline and final test; only the corresponding burst scenario is compared.

Twenty-eight isolated native tests passed on the Pixel, covering interrupted/failed atomic writes, stale transactions, Unicode, byte/character counts and the independent activity journal. A cold notification-style launch followed by real Android Home, Settings and Home taps passed; both routes remained selected while the original launch URI was still present. A normal cold launch then cleared that URI and preserved the profile.

## Automated checks and boundaries

The final frozen frontend passed 2,541 tests in 220 files with the normal five-second test timeout. Web, PWA and mobile builds, Android compilation, instrumentation compilation and Android debug lint passed. API, MCP, Node-loadability, catalogue, locales, source-string, version and fatigue checks also passed. There are no frontend lint or typecheck scripts.

An initial concurrent test/build run timed out in two unchanged Excel tests. Both files passed in isolation, and the complete final suite passed with one test worker. No timeout was raised and no Excel implementation was changed.

Five final synthetic browser cases passed functional and motion checks: Spanish mobile, an approximately 5 MB profile with an active session, English mobile in pounds with interruption/Save, narrow-screen bounds/Cancel, and desktop WebKit mouse/keyboard/manual entry. Save matched the visible value; history and unrelated fields were preserved. An initial headless-browser trial observed a 65.7 ms host/browser gap without a JavaScript long task, and its input audit omitted newly supported pointer movement. That failed trial is retained; the corrected complete rerun passed with unchanged application source and unchanged performance thresholds. Publication, exact-source CI, official artifacts and isolated PWA preservation are recorded in the [release audit](RELEASE-AUDIT-1.15.99.md) and [structured evidence](RELEASE-EVIDENCE-1.15.99.json). Physical iPhone acceptance and receipt of a release push notification are separate from the Pixel QA results.

Private phone screenshots, backups, profiles, timings and device identifiers are excluded from Git. Public visual references use synthetic browser profiles only.

## Synthetic visual references

- [Mobile, Spanish](assets/weight-ruler-1.15.99/mobile-es.png)
- [Desktop, configured pounds](assets/weight-ruler-1.15.99/desktop-en-lb.png)
