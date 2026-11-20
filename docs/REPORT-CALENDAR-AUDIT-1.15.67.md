# Report calendar presentation — 1.15.67

This change affects presentation only. `trainingStreak`/`streakOfRows`, `calendarDay`/`calendarPeriod`, `dailyPlan`, tracking boundaries and persisted profiles retain their existing rules. The screenshot referred to in the request was not attached; the current Consistency calendar and the written requirements supplied the reference.

## State identity and palette

There is no `Tracking Day` report state. Streak uses `completed` with **Recorded activity**, while `untracked` is **Not tracking yet**. Tracking activity must never be inferred from the latter.

`calendar-visual.js` owns labels, semantic identities, colors, foregrounds, borders, symbols and patterns. Screen cells/miniatures/legends and `calendar-grid.js` SVG cells/legends consume it. Colors are fixed across themes and accents, with no status-opacity blending.

| Report meaning | Status / semantic identity | Fill | Symbol | Pattern |
| --- | --- | --- | --- | --- |
| Consistency completed | `completed` | `#006b57` | ✓ | Solid |
| Streak recorded activity | `completed` / `activity` | `#115bb2` | ★ | Solid |
| Partially completed | `partial` | `#e49b32` | ◐ | Diagonal |
| Not completed | `missed` | `#ac2040` | × | Cross |
| Pending | `pending` | `#475569` | … | Dots |
| Rest day | `rest` | `#f2d36c` | − | Horizontal |
| Training paused | `paused` | `#6b3e91` | Ⅱ | Vertical |
| Not tracking yet | `untracked` | `#d7dee8` | ○ | Grid |

Streak activity and Consistency completion are deliberately distinct semantics. Streak `completed` means valid recorded activity on that date. Consistency first checks `0 < plan.completed < plan.total` and emits `partial`; otherwise `plan.active` emits `completed`. That includes some extra workouts and does not assert every scheduled routine was completed. Shared missed/pending/rest/paused/untracked meanings retain exactly the same representation in both reports.

Text contrast is at least 6.46:1 in the current palette; regression tests require 4.5:1 and pairwise CIELAB distance greater than 25 within each report. Symbols, patterns, date/status labels and SVG titles complement color. This metric is a regression guard, not a claim that every color-vision condition can distinguish colors unaided.

## Layout and export data flow

The screen uses bounded square grid tracks. The shared SVG specification caps day size, centers only the day number, and places weekday headings, full periods and month/year labels outside the squares. Existing pending, untracked and future dates are retained. Long ranges paginate without shrinking long ISO dates inside cells. Year PDFs retain three pages; detailed Full Report remains the existing format.

`CalendarExport` → `calendar-file.js` → Streak/Consistency page builders → `calendar-grid.js` → `reportPagesFile` is the individual PNG/PDF path. `report-exports.js` reuses the same page builders for selected/combined dashboard PDFs. Native sharing retains the existing base64 file adapter; no format or share transport was added.

## Verification

- Meaningful regression tests cover exact cell/legend fill, pattern, symbol and label correspondence; contrast and palette separation; immutable input; different completion predicates; untracked/future/leap dates; month/year boundaries; centered day numbers and bounded square SVG geometry. PDF legend text remains at least 8 pt after the actual A4 fit.
- Independent Chromium/Edge and WebKit browser checks generated 56 actual PNG/PDF files across every existing Streak period, Consistency week/month/year/full, empty periods, a range longer than one year and combined reports. They checked 102 SVG pages and 6,632 day cells.
- Actual exported PDFs were opened and rendered, with uniform image placement checked separately from the source SVG. Rendered month, week, year, full and combined samples were visually inspected. Local evidence and sample exports live in `.tools/reports67/`; they contain synthetic profiles only.
- Screen checks cover narrow/mobile and desktop widths, both themes, all eight real accents, enlarged text and date boundaries. Final results and release checks are recorded in `RELEASE-AUDIT-1.15.67.md`.

Physical iPhone Safari/installed PWA, a second physical device and native share-sheet acceptance are pending: no physical device was connected. WebKit automation does not establish those results. Existing user profiles were not opened or modified by this QA.

The independent official-catalog work is scoped separately in `OFFICIAL-CATALOG-PROPOSAL.md`; this release does not claim a configured catalog publication/update channel.
