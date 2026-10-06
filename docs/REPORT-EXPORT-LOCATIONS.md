# Report export entry locations

The 1.15.54 change relocates entry points without changing report data, filters, builders or save behavior:

| Entry | Location | Existing flow |
| --- | --- | --- |
| Export Calendar | Calendar/streak sheet only | Streak dialog, all existing date/format options. |
| Consistency Report | Home → Consistency header, download icon immediately after Times | Explicit consistency dialog, existing period/format options. |
| Export Reports | Settings → Data only | Existing one/many/all selector; independent files and filters. |

`ConsistencyCard` accepts an optional export action; only Home supplies it. Stats continues to display its existing Consistency summary/Times control without a report action. Calendar removes both displaced buttons, and Stats removes the global shortcut. Settings uses its existing Data row design, with the separate-file explanation. The same Consistency file remains explicitly selectable inside the global selector; this is necessary to preserve multi-report downloads, not a duplicated standalone shortcut.

The 1.15.55 visual adjustment removes the bottom text button and places one icon-only download control immediately after Times in the same header action group. It reuses the Times button style, existing download glyph, theme color and unchanged `onExport` callback. The localized report name is only an accessible label/tooltip, never visible card text. Metrics, report content and calculations are unchanged; regression tests compare metric markup with/without the export action and verify the exact existing dialog wiring.

Existing Stats HTML export/print, Progress and History navigation, Times, backup and restore controls stay available. No new route, screen, translation, data mutation or content-generation logic is added. Component tests verify exact locations, correct dialog type and unchanged profile, including the optional action and preserved existing controls. Actual browser downloads and publication evidence are recorded in the release audit after verification.

Verification completed: all 1,439 frontend tests passed, including four added location/action regressions and strengthened calendar assertions. Actual Edge/Chromium and WebKit flows in English/Spanish generated 44 nonempty independent files; 16 PDFs / 106 pages passed strict parsing, drawn-image decoding and per-file duplicate-page checks; PNGs decoded. Direct Calendar/Consistency/Stats, Settings Download Selected/Download All, visible locations, theme consistency, no overflow/page errors and unchanged synthetic profiles were checked. The deployed release also passed the same English Edge flow with 11 downloads. See [RELEASE-AUDIT-1.15.54.md](RELEASE-AUDIT-1.15.54.md) for builds, artifact/update integrity, PWA persistence and notification limits.
