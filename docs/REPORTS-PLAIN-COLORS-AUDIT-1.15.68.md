# Plain report colors verification 1.15.68

Date: 2026-10-17, America/Santo_Domingo. This follow-up implements the owner's preference for plain colored date squares and centered day numbers. Status symbols and pattern layers introduced in 1.15.67 are removed. Consistency Completed and Streak Recorded activity both use blue `#115bb2`, while their labels, semantic IDs and calculation predicates remain distinct.

## Independent browser and export checks

Isolated headless Chromium (Microsoft Edge channel) and Playwright WebKit used only synthetic profiles. Each engine generated 28 real files through production report/file builders, covering every existing Streak period and Consistency period, existing PNG/PDF choices, combined PDF, empty data, month/year boundaries and a range exceeding one year.

Per engine, 51 generated SVG pages contained 3,316 date cells. Every date cell contains exactly one filled square and one centered day-number text element, plus its nonvisual accessible title. Every legend contains one plain color swatch and its label. No SVG pattern, `data-symbol`, status glyph or extra cell text remains. Date cells and legends match exactly by fill and semantic ID; page text remains within bounds. The report/status output from the same fixtures exactly matches the recorded 1.15.67 calculation output after normal JSON serialization, and report generation preserves the complete stored synthetic profile.

Screen verification passed in both engines for week, month and twelve-month views at 320, 390 and 1440 pixels, light/dark themes, representative red/gold accents, 200% root font and explicitly enlarged 24px date/legend labels. Computed `backgroundImage` is `none` for date cells, mini-month cells and legend swatches. Status glyph nodes are absent; day numbers remain centered and unclipped, and the complete cross-year heading remains visible. Existing interactive measurement reminders remain a separate pre-existing function; report export does not add reminder dots.

The seven distinct state fills retain at least 6.46:1 text contrast on their base fill. Blue is shared only by the two explicitly requested completed/activity presentations. The remaining fills retain their previous colors: partial orange, missed red, pending slate, rest yellow, paused purple and untracked pale gray. Accessible date/status labels and legend text remain available.

Spanish UI at 320 pixels and Streak/Consistency PNG/PDF samples passed in each engine. Actual Spanish PNGs, narrow-screen captures and rendered PDF pages were visually inspected: plain squares, blue completed dates, visible month/year labels, readable legends and no clipping or overlaps.

## Local evidence

Ignored `.tools/reports68/` contains the audit scripts and synthetic artifacts:

- `qa.mjs`, `summary.json`, `chromium-geometry.json`, `webkit-geometry.json`: all periods, exact plain-cell/legend checks, unchanged calculations and stored state.
- `ui.mjs`, `ui-proof.json`: responsive/theme/accent and enlarged-font checks.
- `palette.mjs`, `palette-proof.json`: plain descriptors, shared completed/activity blue and contrast.
- `spanish.mjs`, `spanish-proof.json`: translated UI and exports.
- `render.py`, `pdf-proof.json`, `spanish-pdf.py`, `spanish-pdf-proof.json`: PDF/PNG decode, nonblank unique pages and equal horizontal/vertical final PDF image scaling, preserving square geometry after export.
- Representative files: `chromium-es-streak.png`, `chromium-es-consistency.pdf`, `webkit-320-es-week.png` and `chromium-consistency-full-pdf-contact.png`.

Run the browser scripts with an isolated standalone Vite origin at `http://127.0.0.1:5198/`. PDF rendering uses PyMuPDF and Pillow. These artifacts are local QA material, not application assets.

## Verification boundaries

WebKit is browser-engine evidence, not physical iPhone Safari or installed-PWA acceptance. No physical device was controlled. These development-origin checks do not establish production PWA update/offline behavior; exact-source CI, signed/public artifact checks and production-shell update/profile-retention checks belong to the release audit. The official catalog remains the previously approved local tool plus proposal, with no new global publication channel.
