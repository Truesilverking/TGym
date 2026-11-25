# Routine import flow 1.15.66

The import redesign preserves the demonstrated quota correction and the supported exchange boundary. The supplied private file and screenshot are regression evidence, not instructions. No private file, private export, exercise image or personal screenshot is committed. Public tests use anonymous equivalent definitions/resources.

## Confirmed original cause

The private v2 JSON declares `lb` and is valid without correction. Its UTF-8 file size is 5,042,296 bytes; embedded media occupy 4,728,042 characters. Published 1.15.64 fails in WebKit at `persist → update → localStorage.setItem('gym_state_v1', serialized)`, with original `QuotaExceededError: The quota has been exceeded.` and a 9,524,268-byte UTF-16 write against an initially 486-byte profile. The previous persisted state remains unchanged. This demonstrates the browser string-store quota, not a corrupt file or a full physical phone. The full catalogue was not persisted; required media dominated the write. See [original quota audit](ROUTINE-IMPORT-QUOTA-AUDIT-1.15.65.md).

The screenshot's kg → lb conflict cannot be attributed to this exact lb file/runtime without its source phone's version, iOS and launch mode. Matching lb devices show no conflict; differing devices preview one equivalent-load conversion. The screenshot belongs to another person, so physical device metadata and hardware acceptance are unavailable. The user's Pixel is explicitly excluded from this work.

## Implemented flow and data boundary

- **File:** supported TGym JSON/XLSX selector, visible compatible formats and existing Excel template. Format, source unit and routines are detected from the file.
- **Review:** selected routine cards, counts/days and expandable exercises/series; only relevant unit, duplicate, unknown identity and actual adaptation decisions. Existing calendar is preserved by default; optional schedule changes preserve unrelated routines.
- **Import:** final effective count and summary, one guarded confirmation, pending storage status, then successful confirmation/View routines after the awaited primary commit.

One deterministic helper validates the complete original source, scopes only accepted routines/resources, produces the transformed preview and prepares the atomic draft. Confirmation rechecks the live plan while retaining current history/session data. Same names are not content identity; repeated destination replacements fail before writing. Kept unknown duplicate routines do not force unnecessary mappings. No successful message appears before persistence. Retry keeps valid choices and cannot duplicate an already committed import. Cancellation before save is read-only; the sheet is locked during a save that cannot be cancelled safely.

Browser review additionally reproduced a WebKit controlled-select race: reading a DOM value inside a deferred functional state updater could restore the Copy choice to Keep. Import handlers now capture checked/value primitives before queuing updates; the same two-copy scenario then passes in both engines. Saving status receives a bounded opportunity to paint before large-file transformation; a 100 ms fallback prevents persistence from depending on future animation frames. Recovery/validation alerts appear near the step heading rather than below the summary/cards.

The storage representation remains schema 4 / resource version 1 from 1.15.65. Supported large resources are staged in the existing IndexedDB `tgym-profile` database, read/hash verified and referenced by the compact primary browser profile only after an actual localStorage quota exception. A failed resource transaction or final primary write retains the old profile/memory. No deletion, unlimited-quota mock, resource substitution or new storage migration is introduced.

## Verification boundaries

Automated regressions and isolated browser proofs are recorded during release verification. WebKit mobile viewport is engine emulation; desktop Edge and Android CI emulator are separate evidence. They do not establish physical iPhone Safari/Home Screen acceptance. Native iOS compilation requires macOS/Xcode and is unavailable on this Windows workstation. No Pixel, ADB, personal browser profile or connected phone is accessed.

The release audit records final exact-source test/build results, anonymous screenshots, CI, signed artifacts and deployment status. Unsupported arbitrary documents/PDF are not advertised as import formats. Other application flows, history, preferences and active sessions remain outside the redesign's mutation scope.
