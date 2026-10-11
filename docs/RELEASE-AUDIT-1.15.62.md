# TGym 1.15.62 / Android98 release audit

Branch: `fix/routine-exchange-native-1.15.62`, based on published 1.15.61 runtime and its publication documentation. [Version 1.15.62 is published](https://github.com/Truesilverking/TGym/releases/tag/v1.15.62), including the [production PWA](https://truesilverking.github.io/TGym/). This is the native acceptance follow-up requested by the user, with a Back-off mismatch reproduced on their actual Pixel and corrected without reinterpreting unmarked legacy routines. See [native audit](ROUTINE-EXCHANGE-NATIVE-AUDIT-1.15.62.md) and [format](ROUTINE-EXCHANGE.md). Commit/push/publication are within the original requested scope; unrelated `cv-studio/` and `output/` data remain excluded.

## Local and native acceptance

Microsoft Excel desktop opened the actual published workbook and blank template without repair. Actual dropdown, Unicode note/alias, comma-decimal, table-row extension, Save and reopen passed; parsing those saved bytes verified exactly the intended changes and complete preserved identities/configuration. The physical Pixel10/Android17 QA app opened native JSON pickers, imported confirmed synthetic routines, exported through Android's share chooser, and opened XLSX in Excel Android and PDF in Files offline. Production TGym1.15.60 was not changed. The 1.15.61 physical start test reproduced export/runtime Back-off divergence; the pending synthetic workout was discarded without creating history.

The new actual-store/import/start/editor/active-refresh and PDF targeted tests pass. Independent Edge visual checks at320px dark EN and390px light ES verify selector/Save behavior with no horizontal overflow or page errors. Representative and expanded PDFs reopen/render as2/4 nonempty pages; all6 rendered pages and narrow editor layouts were visually inspected. No Progress Report or native update validation changes are included.

Final local checks passed: frontend1837 tests/170 files with four workers; API11; MCP37 and the plain-Node import graph;12 locales/1801 keys;1165 source strings;108,000 fatigue comparisons and14,076 history-edit comparisons. Web, standalone PWA and mobile asset builds passed. SDK35/JDK21 Android debug compilation/lint passed (386 tasks, no failure). Existing large-chunk and dependency warnings remain. Frozen-lock installation passed with the pinned ExcelJS patch; Node/browser Unicode ZIP inspection and exact field round-trips passed.

Local Node24.15.0, pnpm10.34.5 and JDK21.0.12.1 were used; exact-source CI uses Node22 and pnpm10. Frontend has no lint/typecheck scripts, so those checks are not claimed. Android lint/compilation and Windows mobile assets are separate from native iOS compilation, which requires macOS/Xcode. Windows mobile synchronization explicitly skipped CocoaPods/Xcode.

Corrected physical Pixel acceptance passed on the isolated QA package with exact candidate assets. Marked Same/+2 and unmarked inherited cases execute correctly under both app preferences, including pending active refresh. Legacy+4/editor Save/Follow app setting passed. The real Excel Android saved file passed native picker/preview/import; actual JSON/XLSX exports passed complete-profile reimports; the four-page PDF and blank template opened offline in external native apps. Independent file comparisons and visual review passed. Windows Excel also edited/saved/reopened the new rules and opened the actual Pixel62 export with correct `General` numbers and the native `inherit` dropdown. See the native audit for precise coverage and file/viewer boundaries.

The original QA profile was restored and checked after two offline launches: five routines, one historical record, zero custom definitions, no active workout and every original persisted field/key except timestamp. The native mirror matches. Enumerated temporary files were cleaned, original observed Wi-Fi/data enabled flags and screen/stay-on settings restored, and QA62 retained. MAIN remains1.15.60/code96: APK hash/update metadata unchanged, never opened or updated. MAIN private bytes and initial per-SIM flags were not available for comparison; no such comparison is claimed.

## Exact-source CI and signed candidate

Runtime source: `daebdfdf73f8e55d1a4dbc04e471a5feac19bd87`, pushed to `fix/routine-exchange-native-1.15.62`. All jobs passed in these runs:

| Workflow | Run |
| --- | --- |
| Tests | [38108014970](https://github.com/Truesilverking/TGym/actions/runs/38108014970) |
| PWA validation | [38108016109](https://github.com/Truesilverking/TGym/actions/runs/38108016109) |
| Android validation | [38108016975](https://github.com/Truesilverking/TGym/actions/runs/38108016975) |
| Signed Android candidate | [38108017785](https://github.com/Truesilverking/TGym/actions/runs/38108017785) |

Downloaded logs agree with 1837 frontend tests/170 files and37 MCP tests. Android's downloaded report/logs agree on11 tests, zero failures and zero ignored tests on Android15/API35. PWA artifact11690450982 reopened with valid CRC and matching version/source metadata.

Signed candidate artifact11690426374 reopened with valid CRC/checksums. Independent APK/AAB signature, package, SDK23/35/35, non-debuggable APK and certificate-continuity checks pass. Certificate SHA-256 remains `8ee233c984615e2b3f6f083dc0c47d148bb8956ff7caca97be0b9a0d260e6082`; all61 embedded web assets and both `build.json` files match the exact runtime source.

Candidate APK SHA-256: `44ab696144088d7ce3262f4b7d1d248f1348cf41dc44de0caae94cb169fa49a4`. Candidate AAB SHA-256: `11c7269335b6e3421bcf1ef50a7e4da570c6fe836657aaaa1cd404eb4866217e`. Public compilation produces separate artifacts whose hashes must be verified after publication.

## Publication and public verification

After all four source CI gates, independent signed-candidate checks, corrected physical acceptance and QA restoration passed, annotated tag `v1.15.62` was pushed. Fetching the remote tag into an isolated ref confirms type `tag`, peeled runtime source and exact standalone `[skip-update-notifications]` marker. The release remains quiet; no handset notification receipt is claimed.

[Release workflow38109088290](https://github.com/Truesilverking/TGym/actions/runs/38109088290) completed successfully at the exact runtime source. The actual annotated tag object is `58ea3f26424e4d181835076e1b9b7bab846035f1`. Source policy and downloaded logs confirm notifications enabled:false and the delivery step Notify update topic skipped. FCM credential validation used `--validate`/`validate_only:true` and passed; this is distinct from delivery and handset receipt.

Published APK SHA-256: `2257c69e071b79b2a0e55639ccc362d50b5df3e42d691b5fa278bedfb5a39de1` (8996937 bytes). Published AAB SHA-256: `11c7269335b6e3421bcf1ef50a7e4da570c6fe836657aaaa1cd404eb4866217e` (8045677 bytes). Public checksums, release manifest and Pages manifest match. The Pages APK and GitHub Release APK are byte-identical. Independent signatures, unchanged package, SDK, non-debuggable status, signing continuity and APK/AAB embedded metadata/assets pass. All1116 APK and1120 AAB ZIP entry payloads match the signed candidate; only the APK container hash differs, while the AAB is byte-identical.

Live PWA `build.json` points to1.15.62 and the runtime source. All57 precached files were downloaded and reproduce the exact source-template content digest for cache `tgym-app-1.15.62-daebdfdf73f8e55d1a4dbc04e471a5feac19bd87-62812997d141`; HTML asset references are available. The production updater offers1.15.62 from1.15.61 for both GitHub and PWA distributions and does not offer the current version again (4/4 checks).

An isolated persistent Edge profile cached production1.15.61 before publication with three synthetic routines, one historical session and one custom definition. It reopened61 offline and completed the ordinary Check for updates → Update path to62. Routines/order/schedule/history/custom definitions/aliases/unit/language/theme/Back-off preference remained equal, and the pre-update backup exists. It reports up to date, reopens62 offline and downloads actual JSON/XLSX/PDF files with zero page errors. The user's original browser profile was not manipulated.

Actual public offline downloads reopened and passed complete equivalence: three routines, five exercise instances and sixteen Series rows, including every configuration/rule/catalogue/schedule/identity relationship, all four Excel tables, zero formulas, effective runtime targets and validated reimport/reexport. Historical and active data remain unchanged in the import draft. The two-page downloaded PDF opened/rendered with zero out-of-bounds elements and no empty pages; both embedded page images match the reference from the validated JSON and registered custom catalogue pixel-for-pixel. Both actual rendered pages were visually reviewed for accents, long names/notes, units, supersets, pagination and clipping. No clipped text, overlaps or orphaned titles were found.

Evidence remains ignored under `.tools/routine62`, including `ci-evidence-verified.json`, `candidate-artifacts-verified.json`, `android-instrumentation-verified.json`, `nativeExcel/native-windows-62-proof.json`, `physical/physical-acceptance-verified.json`, `release-policy-verified.json`, `public-artifacts-verified.json`, `candidate-public-payload.json`, `updater-verified.json`, `pwa-before.json`, `pwa-after.json`, `offline-files-verified.json`, `offline-pdf-verified.json`, `offline-pdf-visual-review.json` and reopened artifacts/rendered pages. Restoration evidence is `.tools/routine61/physical/restoration-verified.json`. Private backups, signing material, credentials and synthetic QA binaries are not committed.

Physical iPhone remains pending and native iOS compilation requires macOS/Xcode. Browser/WebKit/mobile-width and Android emulator evidence remain separate from the actual Pixel/Excel acceptance.
