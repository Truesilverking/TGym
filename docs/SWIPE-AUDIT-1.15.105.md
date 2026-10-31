# TGym 1.15.105 swipe audit

Published release: **1.15.105 / Android 141**, runtime source `1504530fd32982b51b3a0c30c93d7d993c84f9a2`, is committed and pushed to Dev. Local checks, builds, final compiled-browser acceptance, exact-source CI and the signed candidate pass. The [Release](https://github.com/Truesilverking/TGym/releases/tag/v1.15.105) and [public PWA](https://truesilverking.github.io/TGym/) are verified against the deployed artifacts. Actual-public checks pass: four regression cases and six gesture contexts / 83 checks, with protected synthetic state preserved and no observed runtime errors.

## Problem and resulting behavior

Swiping between modules and Stats could feel delayed, ignore a fresh gesture or misread the final finger movement. Short Stats pages also left blank space near the bottom outside the navigation surface. The outgoing page first left by a full viewport, then the next page entered separately. A fresh gesture during that sequence was discarded. Flick velocity averaged the entire contact, including time spent holding still.

The implementation changes routes immediately on an accepted release and introduces the destination with a short offset of at most 56px and a 180ms entry. Drag transforms are coalesced into one animation-frame write, with resistance and smooth snapback. There are no cloned pages or duplicate active effects. A new contact can interrupt entry or snapback and begin immediately.

The navigation surface fills the available viewport, including empty Stats/card space down to the bottom. Floating controls retain their normal target priority; Workout, Settings and routine editors do not receive this extension. Padding and a compensating margin preserve existing bottom clearance. Measurements follow viewport changes, banners and ancestor animation so a shifted header does not leave a stale gap.

Recognition favors vertical scrolling for ambiguous starts, uses recent velocity, rejects prolonged stationary holds, stale release velocity and deliberate reversals, and aborts on a second contact. A deliberate new contact does not wait through a post-scroll cooldown; actual scrolling while a gesture is pending still cancels it. Selected text blocks navigation only inside its selected rectangles, allowing gestures in unrelated blank space. Forms, native dialogs, charts, tappable body maps and genuinely overflowing horizontal containers retain their own input. Stats exercise rows receive an explicit swipe exclusion. Existing route order, neighboring-module behavior, retained filters, workout data and reduced-motion preference remain authoritative.

## Confirmed defects on the published baseline

- **Edge touch, multitouch:** a second contact did not cancel the first contact's pending page gesture, allowing the primary contact to navigate. The new recognizer aborts both pending and locked gestures when another contact appears.
- **Mouse, export dialog:** dragging the Progress Report export-dialog heading changed `/progress` to `/home` and closed the dialog without choosing an export action. Native dialogs and modal roles now block page gestures. A separate CDP touch attempt did not reproduce this case; the confirmed scope is mouse input.
- Library's native horizontal chip scrolling was checked independently and works with the existing CSS. That suspected conflict was discarded, rather than documented as an app defect.

## Validation status

| Layer | Current result |
| --- | --- |
| SwipeNavigation component integration | **104 passed** |
| Pure gesture recognizer | **21 passed**, coordinator-confirmed |
| ModuleDeck retention | **6 passed**, coordinator-confirmed |
| Complete frontend suite | **3,051 passed / 256 files** on the committed source |
| API / MCP / catalog | **24 / 38 / 6 passed**; plain-Node graph passed |
| Localization | **2,187** synchronized keys; **1,383** source strings covered |
| Final compiled browser matrix | **10 contexts / 276 checks passed**, no observed runtime errors; all 10 synthetic profiles byte-equal |
| Web/PWA/mobile build and synchronization | Passed |
| Exact-source CI / signed candidate | All five required runs passed; Android **52/0/0**, official signed candidate verified |
| Release/public artifacts | Verified: matching Release/Pages APK, 77 deployed PWA files and 81 shared runtime assets |
| Actual-public browser checks | Four regression cases and six gesture contexts / **83 checks passed**, no observed runtime errors; all six gesture profiles byte-equal |

Component regressions cover immediate routing, bounded entry and no-frame fallback, coalesced drag writes, snapback, recent velocity and reversal, irreversible vertical/diagonal rejection, repeated gestures, multitouch before/after lock, selection, controls, horizontal scrolling, empty-space navigation, banner insertion/removal and observer cleanup, animation/viewport measurements, modal opening during a gesture, pointer capture, compatibility clicks, keyboard input, reduced motion and stale callbacks after navigation/resize/blur. Tests assert unchanged profile state and no navigation-only persistence writes.

## Browser method and limits

The isolated browser harness uses synthetic profiles and separate baseline/candidate output. It records routes, raw input/frame traces, native scroll offsets, animation phases and protected-state comparisons. The accepted final matrix covers ten contexts across 320/390/430px and 844x390 landscape, including normal/reduced motion and empty Stats pages. All workers are ready before input. Earlier blocked-worker/media-denial diagnostic failures remain archived separately; normal WebKit media requests returned HTTP 200 after correcting the network harness, with unchanged product source. Failed raw runs are not relabeled as passing.

Edge uses trusted CDP touch drags, including browser pan/pointer-cancel arbitration. Windows WebKit uses trusted mouse drags; supplemental synthetic PointerEvents are labeled separately. Its public Playwright interface does not supply native touch drags. Neither an iPhone user agent nor a mobile viewport establishes physical Android/iPhone or native iOS acceptance, and headless timing is not a physical-device frame-rate measurement.

No Pixel access is used; the user waived further physical-device testing. Actual-public browser checks pass; Windows WebKit offline cold-open remains unclaimed because of its known engine limitation. Java sources are unchanged from the previous release; fresh exact-source Android CI independently passes all 52 instrumented tests. Protected `main` keeps its independent-review requirement.


The final [Tests push](https://github.com/Truesilverking/TGym/actions/runs/41174226898), [Tests PR](https://github.com/Truesilverking/TGym/actions/runs/41174232145), [PWA](https://github.com/Truesilverking/TGym/actions/runs/41174226952), [Android](https://github.com/Truesilverking/TGym/actions/runs/41174226939) and [candidate](https://github.com/Truesilverking/TGym/actions/runs/41174227044) runs succeed. The production candidate is non-debuggable, retains official signing continuity and has 83 verified assets. Its APK SHA-256 is `5f72b93c365f9966ac075125854941cb98cccab461cc416c0049b8c2d9d00b3b`; AAB SHA-256 is `ecc3aee756c32f49ff203080465d8694e307ef1469e6b273a8e52af7e6d9b879`. The annotated tag object is `3078b2daf7c12577658198259afde2aad8dffae2`, points to the exact source above and contains the update-notification suppression marker. Public artifact identity is independently verified.


The [release workflow](https://github.com/Truesilverking/TGym/actions/runs/41174962029) succeeds. Release 429756753 was published at 2026-10-31T06:07:52Z. GitHub/Pages APKs are byte-identical: SHA-256 `f923d81faa049cf52fef3cab5e3df8e0686bc61e29ff9e5c90ba4b4f1e9f31c7`. AAB SHA-256 `ecc3aee756c32f49ff203080465d8694e307ef1469e6b273a8e52af7e6d9b879` equals the accepted candidate. Official signing continuity, non-debuggable state, source/version metadata, all 77 deployed PWA files and 81 shared candidate/runtime assets are verified. The update-topic notification step was explicitly skipped. Actual-public browser checks independently pass on that deployed source.


Four actual-public Edge/WebKit regression cases verify Home/Nutrition/Stats/Settings, no update self-reoffer, published 512px GIF playback and safe dock-free Workout Back navigation. Main profile strings remain exact; Workout preserves manual pause, precise loads and the draft except store/interaction timestamps. Six additional actual-public gesture contexts pass all 83 checks (Edge 41 / WebKit 42), with zero observed runtime errors and six byte-equal profiles. Workers are ready and static media returns HTTP 200. Edge offline cold-open passes; the known Windows WebKit offline engine boundary is not claimed as passing. Initial harness-only failures remain separately archived; final accepted results use the real UI without a product-source change.
