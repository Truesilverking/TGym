# TGym 1.15.114 touch navigation and offline audit

Runtime source: `f660fe2ebc8dfb4999933ed3df7272446294e6f6`. Android versionCode: **150**. Publication: 2026-11-03T21:56:33Z.

## Changes

Horizontal gestures starting on ordinary tap controls, headings, exercise/muscle text or unused page space can navigate to another module or Stats section. Controls that actually use horizontal movement retain ownership, including native horizontal chips, chart scrubbing, rulers and Routine row gestures. Module cover motion and Stats content depth motion preserve the stationary Stats header.

History saved-exercise details still open after a complete **2,000 ms** hold. Touch movement tolerance is **14 CSS pixels**, with **8** retained for mouse and pen. Native scrolling, pointer cancellation, multitouch, release and unmount still cancel the pending hold; movement is not globally prevented. History calendar month/week headings omit the secondary year. Full-year accessible labels, cross-year weeks and the twelve-month year view remain available.

The PWA audit found a real offline cache miss when the server sent **Vary: Origin**: precache requests and later module/CSS requests could carry different headers. Exact build/precache URLs now use canonical header-free cache lookup keys. Query-bearing variants keep their separate request identity. API, update, build metadata and download endpoints continue bypassing shell caching. Old-worker migration remains separate from current-worker revalidation; both were exercised without resetting protected synthetic records.

## Verification

- Exact-source frontend CI: **3,209 tests / 265 files**, verified against the successful downloaded CI log. API: **24** tests; MCP: **38** tests plus the plain-Node import graph. API, MCP and catalog checks also pass in the exact-source CI run, with successful job logs verified. Earlier local API/MCP checks remain valid because their input trees did not change in the SW-only correction.
- Web, PWA, mobile synchronization and QA Gradle compilation have exit code **0**. Android lint is **0 errors / 22 warnings**, byte-identical in issue messages and locations to 1.15.113, with no new or resolved issues.
- Completed CI Android emulator artifact: **53 tests / 0 failures / 0 skipped**, with artifact digest and ZIP CRC verified. This is separate from phone acceptance. Artifact **13273950410**, SHA-256 `73c7e8ad6add714c7c79232811711c7de2478a1ba15fef6878d64ad7d7de2ef5`.
- Compiled Edge/WebKit coverage: **6 principal contexts / 170 check groups**, **2 PWA contexts / 13 groups**, **2 prior-version upgrade contexts / 7 groups**, and **4 real native-overflow CDP cases**. Protected synthetic data is preserved and observed page errors are zero.
- Actual-public coverage: **2 principal contexts / 57 check groups**, plus **2 PWA contexts**, with zero observed page errors and protected synthetic data preserved.
- PWA standalone display mode is **browser-emulated**; no OS PWA installation is claimed. Edge offline cold-open, reload and saved exercise interaction pass. Windows WebKit offline navigation remains unverified: a separate minimal cache-only control reproduces its engine error with and without routing.
- A WebKit launcher exited **0** after the UI assertions, while an owned orphan process kept its pipes open. Recovery was restricted to that owned process; the normal aggregation completed with unmodified assertions. This was a tooling cleanup issue, not an observed app failure.

## Physical Pixel QA

The isolated **app.framegym.mobile.qa** package on the Pixel runs this exact source. QA APK SHA-256: `86f57558fe74dbfd4599439109029015fca4aa38a3ca2fe6df71bb3fbe97c5b2`; QA signing identity: `d53b550b85266358a3d803b7a9611b880488f3eb3e68ad121c63e3c04825f5cc`. This identity is separate from the official public-release signer.

**13 UI checks** cover the History month/week/year calendar and accessible labels, a two-second saved-exercise hold with 10-pixel touch drift, Today/Routine/Nutrition navigation, native Library chip scrolling, content-only Stats motion with a stationary header, Routine row ownership, chart scrubbing and an unsaved ruler draft. **6 cold-reopen checks** cover package/signature/source binding, process reopen with preserved data, and Start/Resume absent inside the existing workout and Settings but visible on Today.

Existing profile, history, routines, active identity and active entries are preserved. No temporary workout, profile reset or persisted training edit was performed. The original app was not accessed. The temporary awake setting was restored. Native diagnostics are scoped to the reopened QA process: **0 fatal / 0 ANR markers**, with no system logs read. Error-severity lines are not automatically treated as app defects. No observed JavaScript page errors occurred in these attached checks.

## Publication

All five required source-bound CI gates passed before tagging. [Release workflow](https://github.com/Truesilverking/TGym/actions/runs/41725214799) and [published TGym 1.15.114](https://github.com/Truesilverking/TGym/releases/tag/v1.15.114) pass. Official signing identity: `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082`. Matching Release/Pages APK SHA-256: `bf0c6de09f8715c5cfd2821c9c828fcd690d829dc4be6b4c1352b3bdb1a9f179`; AAB SHA-256: `05165975aed55ba4e52c7f0eb4e9acc825a47ee2303c8cbc40e60540bf5c84a6`. **51** public PWA files and **55** shared runtime assets match the verified builds. Private and rejected artwork remains excluded. The update-topic broadcast step was skipped. Protected main remains separate for independent review.

## Limits

This is bounded verification of the recorded changes and regressions; it does not claim that every possible app defect has been eliminated. Trusted CDP input on the actual Pixel QA WebView is separate from human-finger and exhaustive frame-rate acceptance. Physical iPhone testing, native iOS compilation, OS-installed PWA behavior and Windows WebKit offline cold-open remain unverified. Browser WebKit coverage is not physical iPhone acceptance. Report implementations are unchanged; no report, calendar, Streak or PNG export was repeated for this release.

[Machine-readable evidence](TOUCH-OFFLINE-EVIDENCE-1.15.114.json).
