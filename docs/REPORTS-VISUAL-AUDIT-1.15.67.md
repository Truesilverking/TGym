# Report calendar visual verification 1.15.67

Date: 2026-10-17, America/Santo_Domingo. All profiles and workouts in this audit are synthetic. No personal browser profile was read or modified.

## Scope and semantics

`calendar-visual.js` supplies labels, semantic IDs, opaque fills, contrasting text, borders, symbols and patterns to the shared SVG renderer and the screen calendar. `completed` in Streak means **Recorded activity**, represented by the `activity` semantic. Consistency keeps **Completed** and **Partially completed** separate because its schedule rules differ. `untracked` is **Not tracking yet**; there is no status ID named Tracking Day. The shared `rest`, `paused`, `pending`, `missed` and `untracked` meanings retain matching representations across the two exports.

The synthetic fixture spans December 2026 / January 2027 with tracking beginning December 27, a one-of-two scheduled completion, missed training, rest, a programmed pause, completed activity, pending today and future dates. Empty-profile and longer-than-one-year ranges are also exercised. These fixtures use the production calculation functions without changing their rules.

## Palette

| Meaning | Fill | Symbol | Pattern | Text contrast on base fill |
| --- | --- | --- | --- | --- |
| Consistency completed | `#006b57` | Check | Solid | 6.48:1 |
| Streak recorded activity | `#115bb2` | Star | Solid | 6.64:1 |
| Partially completed | `#e49b32` | Half circle | Diagonal | 6.46:1 |
| Not completed | `#ac2040` | Cross | Crosshatch | 6.92:1 |
| Pending | `#475569` | Ellipsis | Dots | 7.58:1 |
| Rest day | `#f2d36c` | Minus | Horizontal | 10.23:1 |
| Training paused | `#6b3e91` | Pause | Vertical | 7.71:1 |
| Not tracking yet | `#d7dee8` | Open circle | Grid | 11.08:1 |

All eight fills and symbols are unique. The closest base-fill pair is partial/rest at CIE76 distance 26.80; this numeric check supplements visual inspection and does not claim that every viewer perceives color identically. Symbols, patterns and accessible labels remain necessary.

## Browser and exported-file evidence

Headless desktop Chromium (Microsoft Edge channel) and Playwright WebKit both passed:

- All nine existing Streak periods; all four Consistency periods; their existing PNG/PDF choices; empty data; a custom range across years and a custom range exceeding one year; the combined Streak/Consistency dashboard PDF. Each engine generated 28 actual files through the production report/file builders.
- 51 SVG pages and 3,316 day cells per engine. Every date cell is square, day numbers are centered and contain only the day number, text and cells remain inside page bounds, and every cell exactly matches its legend's semantic ID, fill, pattern and symbol. Accessible date/status text is present.
- Week screen layouts at widths 320, 390 and 1440 with both themes and all eight supported accents (`red`, `lime`, `sky`, `orange`, `violet`, `pink`, `teal`, `gold`). Month layouts, 200% root font and explicit 24px day/legend labels also pass without horizontal overflow or clipped day numbers.
- Twelve visible mini-month calendars at widths 320, 390 and 1440 in both themes: 365 square numbered cells, 84 weekday headings, exact legend colors/patterns and accessible date/status labels. Small-screen month cells remain at least 35.7 CSS pixels in the tested layout.
- Existing UI Export Calendar and Home Consistency Report entry points generated and downloaded PDF files successfully in each engine. No browser page errors occurred. Report generation left the stored synthetic profile unchanged.
- Spanish UI at 320 pixels and a separate four-file Streak/Consistency PNG/PDF sample in each engine also pass. The full cross-year period remains visible and no translated export text leaves the page. The eight Spanish files decode; their PDF image placements preserve square geometry.

The first narrow-week screenshot exposed an ellipsized period heading. The final UI uses a wrapping complete range including both years (`28 Dec 2026 - 3 Jan 2027` in the tested English locale); the repeated final screen matrix passed after this correction.

MuPDF decoded the generated PDFs and rendered their pages. All pages were nonblank and unique within their file; each PDF report image uses equal horizontal and vertical scaling, preserving the measured square geometry in the final file. Generated PNGs also decode successfully. Actual rendered month, cross-year Streak, full Consistency and year/contact-sheet samples were inspected for clipping, overlaps and readable legends.

## Reproduction and artifacts

The local audit scripts and generated files are in ignored `.tools/reports67/`:

```powershell
pnpm.cmd --dir frontend run dev --mode standalone --host 127.0.0.1 --port 5197 --strictPort
node .tools/reports67/qa.mjs
node .tools/reports67/ui.mjs
node .tools/reports67/palette.mjs
node .tools/reports67/spanish.mjs
python .tools/reports67/render.py
python .tools/reports67/spanish-pdf.py
```

The rendering command requires a Python environment with PyMuPDF and Pillow. `summary.json`, `chromium-geometry.json`, `webkit-geometry.json`, `ui-proof.json`, `palette-proof.json`, `pdf-proof.json` and the two `spanish-*-proof.json` files record the checks. Representative artifacts include `chromium-es-streak.png`, `chromium-es-consistency.pdf`, `chromium-streak-custom-pdf.pdf`, `chromium-consistency-month-pdf.pdf`, `chromium-consistency-full-pdf-contact.png`, `webkit-320-es-week.png` and `chromium-320-24pxlabels-month.png`. These files contain synthetic data and are not bundled into the app.

## Limits

This browser work verifies desktop Chromium and the WebKit engine in isolated local contexts. It does not prove physical iPhone/Safari/PWA or another physical device. The development origin has no production service-worker offline guarantee; production PWA update/profile-retention checks are recorded separately in the release audit. No device was attached for the requested second-device exercise-catalog publication/update/offline journey. The official catalog distribution channel remains a proposal, with its explicit prerequisites and pending acceptance documented in `OFFICIAL-CATALOG-PROPOSAL.md`.
