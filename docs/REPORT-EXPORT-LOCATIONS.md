# Report export entry locations

The 1.15.54 change relocates entry points without changing report data, filters, builders or save behavior:

| Entry | Location | Existing flow |
| --- | --- | --- |
| Export Calendar | Calendar/streak sheet only | Streak dialog, all existing date/format options. |
| Consistency Report | Home → Consistency section | Explicit consistency dialog, existing period/format options. |
| Export Reports | Settings → Data only | Existing one/many/all selector; independent files and filters. |

`ConsistencyCard` accepts an optional export action; only Home supplies it. Stats continues to display its existing Consistency summary/Times control without a report action. Calendar removes both displaced buttons, and Stats removes the global shortcut. Settings uses its existing Data row design, with the separate-file explanation. The same Consistency file remains explicitly selectable inside the global selector; this is necessary to preserve multi-report downloads, not a duplicated standalone shortcut.

Existing Stats HTML export/print, Progress and History navigation, Times, backup and restore controls stay available. No new route, screen, translation, data mutation or content-generation logic is added. Component tests verify exact locations, correct dialog type and unchanged profile, including the optional action and preserved existing controls. Actual browser downloads and publication evidence are recorded in the release audit after verification.
