# TGym 1.15.113 History detail and calendar audit

Client date: 2026-11-03. Runtime source: `b491f31d648e7c813038c6adb06b454c38f475c0`. Android versionCode: **149**.

## User flow

The historical workout list shows each exercise's existing thumbnail, title and PR badge. Its saved sets are in a separate read-only overlay opened by a complete two-second hold or immediate keyboard/assistive activation. Existing media is centered above the exercise title and saved warm-up, Top, Back-off or working sections. Saved order and original set positions are retained, including pending rows, individual RIR/RPE values, drop-set reductions, rest-pause bursts, unilateral confirmations, timed results and cardio measurements. Missing media has an accessible placeholder; deleted exercises retain saved names. Current routine prescriptions do not reclassify old rows.

The Workout calendar in History replaces its segmented Week/Month/Year and zoom strip with the Streak-style arrow selector. The chosen period and distinct active-date total sit between Previous and Next. Its week/month/year, wider year-range view, leap days and cross-year labels remain available. Today, Nutrition and Streak keep their existing controls and profile layout.

## Defects found and corrected

- A real WebKit browser trace showed native dragging of an exercise image after a small initial movement, with no later pointerup/pointercancel. The pending hold could then open an unwanted overlay. Row drag-start now cancels the hold and prevents that native image drag; a drag elsewhere cancels without globally preventing dragging or scrolling. Movement, scrolling, early release, cancellation, multitouch and unmount also cancel pending opening.
- History editing could start from a stale mounted draft or overwrite a record changed by another source. Edit now captures the latest record and verifies that revision before saving. Primary quota failures retain the visible draft and unchanged records. Success waits for the durable mirror; rejected mirrors show a retryable error, and retry preserves a single workout. Fields are disabled while saving. Focused failure tests use synthetic records and injected storage/mirror failures.
- Weight conversion treated every record as if it used the current profile unit, so an already-lb historical session could be converted again during a kg-to-lb profile change. Conversion now respects saved session, entry, set, drop and body-weight units. Matching-unit values retain their original precision. Historical volume, strength-series and CSV presentation use the corresponding saved unit stamps without rewriting records merely for display. Stats bodyweight, BMI, best loads and estimated 1RM, together with its HTML/PDF source models, now share a read-only full-precision mass projection into the displayed profile unit. Matching-unit branches retain their references and bytes; measurements, InBody records and live-session data retain their original references. Raw state remains the source for editing and export entry points. Generated HTML and PDF-source SVG tests check projected values and immutable inputs. Separate actual UI PDF downloads are bound to their Blob/SVG sources and rendered for visual inspection as recorded below.

## Verification

- Final-source frontend CI: **3,154 tests / 265 files**, checked against the downloaded successful job log. API: **24 tests** over unchanged API source. MCP: **38 tests / 2 files**, plus the complete plain-Node import graph; the exact tested working bytes are retained. Committed UTF-8 text matches after only CRLF-to-LF normalization, with both raw SHA-256 values recorded separately.
- Local web/mobile and Capacitor sync, Android app debug APK, test-APK compilation and lint all have actual exit code **0**. Lint XML is byte-identical to the saved 1.15.112 baseline: **0 errors / 22 warnings**, zero new or resolved issues.
- Downloaded Android emulator HTML: **53 tests / 0 failures / 0 skipped**, with artifact digest and ZIP CRC verified. Artifact ID **13267226813**, SHA-256 `e41a6a6e164cd0f6f6e987b3b48773256ff53ae5a7952896b629d72c0fe87b28`. Local test-APK compilation is separate from execution of these CI emulator tests.
- Compiled browser audit: **6 principal Edge/WebKit contexts + 2 isolated Settings/unit contexts**, **96 check groups**, zero observed runtime errors.
- Actual-public browser audit: **2 principal contexts + 1 isolated Settings/unit context**, **33 check groups**, zero observed runtime errors. Chromium mobile cases add trusted CDP touch events; WebKit uses trusted pointer/mouse and keyboard. Source manifests and protected synthetic records are verified.
- Stats PDF downloads: **2 compiled downloads / 4 pages** and **1 actual-public download / 2 pages**. Generated Blob bytes match each downloaded PDF. Source SVG labels and page counts, PDF bytes, rendered page-image hashes and recorded visual inspection are bound to the exact browser/source proof. Every rendered page was visually inspected with no observed clipping or overlap; projected masses and BMI values are correct. The source PDFs were not edited. Calendar and Streak exports remain separate at zero new runs.
- Public Start/Resume/updater: **4 contexts / 23 checks**, zero observed runtime errors. Edge inactive-profile offline cold-open and both-engine no-self-reoffer checks pass; Windows WebKit offline cold-open is not claimed.

## Publication

All five required exact-source CI gates passed before tagging. [Release workflow](https://github.com/Truesilverking/TGym/actions/runs/41708889118) passed, and the update-topic notification step was skipped. [Published TGym 1.15.113](https://github.com/Truesilverking/TGym/releases/tag/v1.15.113) retains the official signing identity. Release/Pages APK SHA-256: `c0fa27f6c4146310158b094ca10f845ef1077e4fe1162bb06775168560990b4f`. AAB SHA-256: `67c2891ca3e64b34a8a7e03f1a1c7608fb8fcf7d7958743430e05f8b5750ae19`. All **51** actual public PWA files and **55** shared candidate/runtime assets match their verified builds. Candidate/public scans of **92** known forbidden artwork hashes have zero matches and zero GIF files. Main remains separate for independent review.

## Coverage limits

The audit covers the changed History/calendar flows, complete automated suites and recorded shared-data regressions; it is not a claim that every possible app defect has been eliminated. No phone was accessed for this correction. Fresh Pixel/iPhone acceptance, phone installation, native iOS compilation, phone notification receipt and physical frame-rate acceptance remain unverified. Browser-engine checks are not physical iPhone testing. Historical-unit report projections have automated calculation coverage and the recorded Stats PDF UI downloads/render inspections. No new calendar, Streak or PNG export verification is claimed. Personal exercise artwork remains outside the release.

[Machine-readable evidence](HISTORY-DETAIL-EVIDENCE-1.15.113.json).
