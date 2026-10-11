# TGym 1.15.62 / Android98 release audit

Branch: `fix/routine-exchange-native-1.15.62`, based on published 1.15.61 runtime and its publication documentation. This is the native acceptance follow-up requested by the user, with a Back-off mismatch reproduced on their actual Pixel and corrected without reinterpreting unmarked legacy routines. See [native audit](ROUTINE-EXCHANGE-NATIVE-AUDIT-1.15.62.md) and [format](ROUTINE-EXCHANGE.md). Commit/push/publication are within the original requested scope; unrelated `cv-studio/` and `output/` data remain excluded.

## Verified before final checks

Microsoft Excel desktop opened the actual published workbook and blank template without repair. Actual dropdown, Unicode note/alias, comma-decimal, table-row extension, Save and reopen passed; parsing those saved bytes verified exactly the intended changes and complete preserved identities/configuration. The physical Pixel10/Android17 QA app opened native JSON pickers, imported confirmed synthetic routines, exported through Android's share chooser, and opened XLSX in Excel Android and PDF in Files offline. Production TGym1.15.60 was not changed. The 1.15.61 physical start test reproduced export/runtime Back-off divergence; the pending synthetic workout was discarded without creating history.

The new actual-store/import/start/editor/active-refresh and PDF targeted tests pass. Independent Edge visual checks at320px dark EN and390px light ES verify selector/Save behavior with no horizontal overflow or page errors. Representative and expanded PDFs reopen/render as2/4 nonempty pages; all6 rendered pages and narrow editor layouts were visually inspected. No Progress Report or native update validation changes are included.

Final local checks passed: frontend1837 tests/170 files with four workers; API11; MCP37 and the plain-Node import graph;12 locales/1801 keys;1165 source strings;108,000 fatigue comparisons and14,076 history-edit comparisons. Web, standalone PWA and mobile asset builds passed. SDK35/JDK21 Android debug compilation/lint passed (386 tasks, no failure). Existing large-chunk and dependency warnings remain. Frozen-lock installation passed with the pinned ExcelJS patch; Node/browser Unicode ZIP inspection and exact field round-trips passed.

Local Node24.15.0, pnpm10.34.5 and JDK21.0.12.1 were used; exact-source CI uses Node22 and pnpm10. Frontend has no lint/typecheck scripts, so those checks are not claimed. Android lint/compilation and Windows mobile assets are separate from native iOS compilation, which requires macOS/Xcode. Windows mobile synchronization explicitly skipped CocoaPods/Xcode.

## Remaining gates

Before tagging: exact-source branch CI, independently verified signed candidate and corrected physical Pixel acceptance. Retained-profile public PWA update and public package/signature/hash/manifest/source checks follow publication. Final QA profile/settings restoration must be verified. Physical iPhone remains pending. Initial Windows Excel native acceptance passed; after its window helper returned an unrelated VS Code surface during recovery, further1.15.62 desktop input stopped until a fresh correct Excel observation is available. This does not negate the saved-file/native-picker evidence above.

The live release remains1.15.61 until publication is evidenced. No1.15.62 tag/publication is claimed by this initial audit; append exact commit, run IDs, artifacts, restoration and remaining platform boundaries after they run.
