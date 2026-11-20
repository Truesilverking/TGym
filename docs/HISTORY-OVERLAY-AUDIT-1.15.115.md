# TGym 1.15.115 History exercise overlay audit

Runtime source: `24232e34d8ea20e51768fa38033bd5e1e776189d`. Android versionCode: **151**. Publication: 2026-11-03T23:08:49Z.

## Problem and changes

A native Android input test on Pixel QA reproduced the 1.15.114 failure: holding an exercise image started native image dragging after about **609 ms**, cancelling the intended **2,000 ms** hold. Attached-WebView CDP touch passed the same flow, so those earlier checks did not establish Android OS input acceptance. Thumbnail CSS now makes the History row own the image's input point and disables native image dragging. The rule is scoped to the saved-exercise thumbnail.

The **44 CSS pixel** expand control also opens recorded sets with a direct tap, including a tap on its SVG. Ordinary exercise-text taps keep the compact list. Holding for two seconds and keyboard activation remain available. When the release handler decides an input, its timestamps recover an overdue valid hold and prevent that handler from classifying a queued short release as a completed hold. This is a bounded release-handler correction. An experimental **1.88-second CDP touch** on a busy main thread can still open when the timer executes before queued pointerup; that condition has not been established with Android OS input and is not claimed fixed. Scrolling, pointer cancellation, multitouch and excess movement continue to cancel pending holds.

A separate reproduction found that a partially clipped row could open a shorter detail sheet, then release a compatibility mouse click onto the new backdrop and close the sheet immediately. A backdrop dismissal now requires a gesture started and released on that backdrop; compatibility mousedown cannot arm it. A subsequent fresh backdrop tap still closes normally, and closing the detail returns to the saved-workout sheet.

Rendering saved drop-set and rest-pause extras now ignores null, primitive and array entries while retaining valid object rows. Empty extras lists are omitted. This is presentation-only defensive handling: raw saved records remain unchanged, and these malformed synthetic cases have not been established as the cause of the user's failure.

## Local verification

- Final-source frontend CI: **3,247 tests / 266 files**, verified against the downloaded successful job log. Local API: **24 tests**; local MCP: **38 tests**, plus the plain-Node import graph. Those backend input blobs are identical to the final source. All five required exact-source CI gates pass; backend test counts are not separately inferred from the frontend log.
- QA Gradle compilation and artifact validation pass. Android lint reports **0 errors / 22 warnings**. The completed source-bound CI emulator artifact records **53 tests / 0 failures / 0 skipped**, with digest and ZIP CRC verified. Artifact **13278562643**, SHA-256 `e55a5b88798386dcb62d5484e610e16c342926fff6cb9c601549156ed90379db`. Emulator acceptance remains separate from Pixel acceptance.
- Compiled PWA: **4 contexts / 40 check groups** across Chromium/Edge and WebKit at **320/390 CSS pixels**, with **0 observed page errors**. Icon/SVG taps, ordinary taps, timed holds, scroll cancellation, decoded image targeting, clipped rows at both edges, release, fresh backdrop dismissal and parent restoration pass. The entire synthetic persisted state string remains byte-identical in these inactive-session UI cases.
- PWA upgrade: **2 contexts / 9 check groups**, with **0 observed page errors**. The actual app Update UI migrates 1.15.114 to 1.15.115, activates the new worker, validates a portable pre-update backup and preserves the synthetic profile, history and paused session. Overlay interaction changes only the permitted save/activity timestamp fields: `_ts`, `active.lastUserInteractionAt` and `active.lastActivityAt`.
- Edge cold-opens the upgraded shell offline and opens/closes recorded sets through both the expand control and a hold. WebKit passes those interactions offline on its already loaded shell. Windows WebKit offline cold navigation raises an engine internal error also reproduced by a separate minimal cache-only control; cold-open acceptance is therefore unverified there.

## Physical Pixel QA

The isolated `app.framegym.mobile.qa` package runs the exact source above. QA APK SHA-256: `614d56cfd649961cb5e0c78c6b1f05f2df5087747fdf4c47f2a622e5d0ffbfc9`; QA signer SHA-256: `d53b550b85266358a3d803b7a9611b880488f3eb3e68ad121c63e3c04825f5cc`. Installed APK bytes and the backup were verified. This QA identity is separate from official release signing.

**Four Android OS input cases** pass: one exercise-name hold, two image holds and one expand-icon tap. The final OS image traces report **zero drag starts**. **Two attached-WebView CDP cases** are recorded separately; CDP is not treated as Android OS input. A successful cold reopen loads History with **zero observed JavaScript page errors** and **zero fatal errors in the current QA process**.

Durable and WebView profile fields, history, routines and active entries are preserved; the cold-reopen comparison excludes only ordinary save metadata `_ts`. The pre-update backup matches. No production app access, profile reset or persisted training edit was performed. The temporary USB awake setting was restored to its previous value, **0**.

The first cold-reopen attempt stopped before restarting because the harness compared a normal save timestamp as profile data. The next harness checked immediately after launch and interpreted transient keyguard metadata as a need for authentication; fresh metadata **0.5 seconds later** showed QA unlocked. A bounded readiness poll enabled the final successful cold reopen without requesting new authentication. Earlier stopped attempts are not counted as successful cold reopens or observed application crashes. Synthetic harness failures are retained separately and are not counted as app defects.

## Publication

All five required source-bound CI gates passed before tagging. [Release workflow](https://github.com/Truesilverking/TGym/actions/runs/41736021345) and [published TGym 1.15.115](https://github.com/Truesilverking/TGym/releases/tag/v1.15.115) pass. Official signing identity: `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082`. Matching Release/Pages APK SHA-256: `0a3a2146753d7e771121ee207afcca225d0488d30ba5553890dfbfedb31577eb`; AAB SHA-256: `b4e57255bdbf72c665bac761b03ae8e65ebf12d52f84eacdbb94f56a8d239de9`. **51** public PWA files and **55** shared runtime assets match verified builds. Candidate and public scans of **92** known forbidden artwork hashes report zero matches. The update-topic broadcast step was skipped. Protected main retains independent review.

Actual-public browser verification passes **4 contexts / 45 check groups**, with **zero observed page errors**, exact worker/source metadata and byte-identical synthetic records. Public Edge offline cold-open/reload and overlay checks pass. Windows WebKit passes loaded-shell offline overlay interaction on the public origin; public offline cold-open remains unverified after its recorded engine error. The local-build cold-open limitation remains separate. Public current-worker revalidation is separate from the local114→115 migration test.

## Limits

This is bounded verification of the recorded changes. It does not claim that all possible app errors have been eliminated. Standalone PWA display mode is browser-emulated; no OS PWA installation is claimed. Chromium CDP does not exercise Android's host long-press detector, and WebKit hold coverage uses trusted mouse input. Physical iPhone acceptance, native iOS compilation, production Android installation and report-export regression checks remain unverified. Local-build Windows WebKit offline cold-open remains unverified. Windows WebKit passes loaded-shell offline overlay interaction on the public origin; public offline cold-open remains unverified after its recorded engine error. The local-build cold-open limitation remains separate. The browser fixtures use a decoded synthetic image and a placeholder; no GIF design, exercise accuracy or new artwork claim is made. Private profile contents, screenshots and raw traces are excluded from these public drafts.

[Machine-readable evidence](HISTORY-OVERLAY-EVIDENCE-1.15.115.json).
