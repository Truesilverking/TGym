# TGym 1.15.101: Dev audit and Pixel QA

The audited runtime is `c9e0fed2d4ee39cdb4693d0fe17dfc046b6db906`, Android versionCode **137**. The corrections are on `Dev`; TGym QA was installed and checked on the physical Pixel 10. This is a QA delivery, with no new production release, tag, Pages deployment or notification send.

## Corrected behavior

| Area | Reproduced problems and resulting behavior |
| --- | --- |
| Profile preservation | Nutrition-only logs, custom foods and edited goals now count as existing data. Older server snapshots cannot replace a newer clean nutrition profile through the empty-profile bootstrap, and native recovery does not restart onboarding for it. |
| Nutrition | Preserve fractional per-serving macros; round the final sum consistently with other displayed numbers. Validate numeric drafts, avoid water string concatenation/nonfinite writes, retain unspecified goals and custom-food identities, and save a custom food plus its meal in one transaction. Failed saves retain the form and previous profile; repeated submission commits once. |
| Dates and units | Follow local midnight without moving intentionally selected historical dates. Use canonical schedule/rest/pause rules for cycling. Convert inches and stamped kg/lb measurements correctly in calculator previews; exclude unsuitable/future/duplicate records from adaptive estimates. |
| Imported optional data | Malformed optional nutrition fields render safely. Deleting a visible food works even when an imported collection contains null rows. Only boolean `true` enables training-day cycling. |
| Training calculations | Correct plate combinations missed by greedy loading and bound unreasonable inputs. Use the shared strength/set helpers, historical exercise snapshots, session filtering and local calendar boundaries in personal records, plateau detection, muscle volume and weekly reports. |
| Sharing, photos and voice | Replace the missing share-image dependency; use the shared duration/volume/file adapters, units, warmup rules, cancellation and awaited error handling. Photo operations report success after IndexedDB commits, retain identity and reject failures. Voice follows the selected language and stops on exit. |
| Authentication and restore | Report failed initial synchronization/upload accurately, block repeated passkey actions, honor guest restrictions and confirm destructive welcome-screen restores with an Undo snapshot. |
| Presentation | Reject inherited/unsupported language codes and inherited dictionary properties; keep HTML and Settings language consistent with the fallback. Complete the new Spanish strings, disable pseudo-element animations with reduced motion and fit the Spanish Home heading at 320 px. |
| Pointer input | After a successful food save, the continuing double-click cannot activate the exposed Start button. A subsequent single click and keyboard activation remain available immediately. |
| Dependencies | Update Capacitor to 7.6.9, DOMPurify to 3.4.17, the ExcelJS UUID dependency, Vite/Vitest/Happy DOM and related tooling; update MCP SDK/Zod and validate real stdio schema calls. Runtime and development dependency audits reported zero known vulnerabilities on 2026-10-26. |

The dependency updates address the published [Capacitor advisory](https://github.com/advisories/GHSA-rvm3-566m-v7fv) and [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), along with the other findings returned by the package-manager audits. A clean audit describes that advisory snapshot; it is not a guarantee against future disclosures.

## Validation

| Check | Result |
| --- | --- |
| Exact-runtime GitHub Actions | [Tests run 40371871790](https://github.com/Truesilverking/TGym/actions/runs/40371871790): frontend **2642/2642**, 234 files; API, MCP and catalog jobs all passed. |
| API / MCP | API 16 tests; MCP 38 tests, including a real child-process stdio handshake, tool schemas, valid/invalid calls and preservation of a synthetic profile file. Node-loadability/import-graph check passed. |
| Catalog and fatigue | Catalog 6 tests; 108000 monotonic comparisons and 14076 history-deletion comparisons passed. |
| Localization | Strict source coverage: 1361 strings present; Spanish pack: 2151 keys. |
| Builds | Web, standalone PWA, mobile asset synchronization and QA APK compilation passed. Frozen APK assets and embedded build metadata match the recorded runtime. |
| Android checks | Debug lint: 0 errors, 20 warnings. The one existing example unit test passed; this does not constitute new emulator/instrumentation coverage. |
| Compiled navigation | Four isolated Edge/WebKit, viewport/language/theme configurations; 44 route visits, no page/render errors or horizontal overflow, and unrelated stored fields preserved. Three active-session reduced-motion checks passed. The narrow Spanish heading was inspected visually. |
| Compiled nutrition | Both engines passed invalid-draft, primary-write failure, retained-draft, retry/single-commit, decimal-serving, unrelated-data, portable-backup checksum/restore and online-reload checks. Final trusted double-click/next-single-click/keyboard regressions passed in both engines. |
| Offline browser boundary | Edge offline reload and new-page reopen passed. WebKit offline navigation returned an internal browser/tool error despite an active controlled worker and cached shell; its online recovery retained the exact profile. WebKit offline acceptance remains unverified. |
| Physical Pixel QA | Final package `app.framegym.mobile.qa`, visible app/launcher labels `TGym QA`, version 1.15.101/code 137, signing identity preserved and installed APK hash verified. Twelve route/screenshot checks, metric-height calculator preview, cold reopen and WebView/native agreement passed with no page errors. |
| Data preservation | Fresh verified QA sandbox backups precede installation. The native profile was byte-identical immediately after installation; all existing user fields were preserved after navigation and cold reopen, apart from normal `_ts` metadata. Real device profiles/backups/screenshots remain outside Git. |

The 44-route and nutrition persistence baselines were compiled from `10bc9af`; the only later runtime change is the scoped food-save click guard, which has separate trusted Edge/WebKit evidence and exact-runtime CI. Final physical verification and installed assets use `c9e0fed`.

## Limits

This audit fixes reproduced failures and records its coverage; it does not establish the absence of every possible defect. Readiness, plateau, volume targets, weekly summary, progress photos, hands-free and share-card modules still lack production-screen wiring in the inherited Dev code. Their library/component regressions passed, but no new product flows were added and simulated photo/share adapters do not establish real native integration acceptance. Real cloud consent/synchronization and physical iPhone acceptance were not exercised.

Public structured results are in [BUGFIX-EVIDENCE-1.15.101.json](BUGFIX-EVIDENCE-1.15.101.json). Private backup and device evidence is retained in the ignored local QA directories.
