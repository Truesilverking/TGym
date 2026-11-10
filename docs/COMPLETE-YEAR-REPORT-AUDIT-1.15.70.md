# Complete-year report audit — 1.15.70

## Scope and result

Independent local QA passed for the new **Complete years** selection in Streak Report and Consistency Report. Selecting 2024–2026 produces three landscape A4 pages per report, one complete January–December calendar per year. The existing Year, Full report, date-based Custom Range and all other period/format contracts remain unchanged against released 1.15.69 (`d1d31bf2b394fa65150724c4f8453b638678f7d7`). Publication, CI and production PWA update acceptance are separate release checks; this document does not claim them.

All fixtures are synthetic. No personal profile, workout, credentials or real-device state was inspected or modified. Browser contexts used separate seeded profiles.

## Layout and calculation checks

- Both engines checked 166 actual generated SVG pages and 60,644 date cells each: **332 pages and 121,288 cells total**. All 13 configured locale settings were covered: en, de, es, fr, it, pt, pt-BR, pl, tr, ru, zh, ko and hi. Existing untranslated strings retain their English fallback.
- Every page has 12 whole months in four columns and three rows, the correct weekday alignment, every annual date exactly once, and 365 or 366 dates as appropriate. The 26×26 cells remain square, with a centered day number and plain fixed color. Dates before tracking, paused days, future dates and all other existing states remain visible. Cell fill and semantic ID match the corresponding legend exactly; legend fills are distinct within each report. No added status glyphs or patterns appear.
- Measured text boxes remain inside the page/month/summary cards, with no pairwise text overlap. Six-week months fit their cards. Month titles, weekday labels and annual boundaries remain outside the squares. The initially observed Spanish summary fragments (`completado` + `s`, `Cumplimient` + `o`) were corrected before the final matrix and examples; single-letter metric fragments are checked explicitly.
- At the actual final landscape A4 scale, day numbers and legends are **9.69 pt**. Metric numbers are approximately 11.85 pt, metric/weekday labels 8.62 pt, and the smallest supporting note/footer is 8.08 pt. These supporting sizes are stated separately rather than claiming that every label is at least 9 pt.
- Annual state/status arrays and summary values match the released 1.15.69 builders for multi-year activity, leap year 2024, an empty 2024–2026 range, pretracking years 2022–2023, future year 2027 and an active 2026 session. All 11 corresponding annual Streak datasets match exactly. Annual grouping retains the existing Streak evaluation date and earlier streak continuity; it introduces no January reset or new compliance rule. Input fixtures remain unchanged.
- Legacy regression checked **156 period/format contracts** across six fixtures: 150 valid choices retain byte-identical SVG output, and the six existing invalid Full-PNG requests retain their errors. Existing Full/Year calculation data also remain identical.

Evidence: `.tools/reports70/{baseline69.json,regression-proof.json,range-data-proof.json,years-qa-proof.json,chromium-annual-geometry.json,webkit-annual-geometry.json}`. Baseline source was safely extracted from the exact released69 Git archive, independently of the working source.

## Actual PDFs and user flow

The production builders generated and the final checker examined **92 PDFs / 268 pages**, including the two Spanish examples. Each annual page has real landscape A4 dimensions (approximately 841.89×595.28 pt); existing Full pages retain portrait A4 dimensions. Every final page image uses uniform horizontal/vertical scaling, fits within its page and is nonblank. Both page order and annual content remain distinct.

API combined exports contain exactly their standalone page images: six landscape pages for both annual reports, three landscape plus two portrait pages for annual Streak + legacy Full Consistency, and two portrait plus three landscape pages for legacy Full Streak + annual Consistency. This verifies both orientation transitions.

Actual Spanish UI flows passed in Chromium/Edge and WebKit with 320px Streak and 390px Consistency viewports and 20px root text. The numeric year controls remain inside the viewport; years selection forces PDF; reversed and over-limit ranges block Export. The opened preview blob is byte-identical to the file saved through Share / save. The UI combined annual file contains six pages, and the UI annual→Full mixed file contains five pages in the correct orientations. UI bundles contain exactly their own standalone annual images. Persisted profile snapshots before and after these flows are equal, with no page errors.

One strict cross-context image-byte assertion initially failed in WebKit. Investigation confirmed identical SVG from the fixture and boot-normalized store; a fresh reference raster matched the saved UI raster exactly. Changing root font size 16→20→16 did not change that reference. The earlier multilingual rendering context differed around text edges on 1,253–1,463 of 5,656,000 pixels per page (at most 0.026%), maximum channel difference 21/255 and mean channel difference below 0.00064. Every sampled day fill matched exactly. Final checks retain exact state/SVG and own-context bundle equality, and explicitly bound this observed WebKit cross-context raster variation. They do not claim cross-context JPEG-byte equality. Chromium images are byte-identical across the API and UI contexts. No product source change was made to accommodate the assertion.

Evidence: `.tools/reports70/{ui-proof.json,final-pdf-proof.json,initial-strict-pdf-check-failure.json,webkit-api-ui-pixel-investigation.json,webkit-normalized-reference-proof.json}` and the `*-ui-*.png` screenshots. The preview link/blob was verified; native browser PDF viewer behavior was not directly automated. Final PDF rendering was inspected independently with PyMuPDF/Pillow, including all six Spanish example pages and Hindi, Chinese, Russian and empty-period sample pages. No missing-glyph boxes, clipping or overlaps were observed. The report PDFs contain rasterized pages, so their accessible SVG labels do not imply a tagged, screen-reader-accessible PDF.

## Bounds and resource measurements

Years accept integers or strict four-digit strings from 1000 through 9999, inclusive, with start ≤ end and at most 25 years per report. Future years are allowed. Twelve invalid input cases were rejected; PNG is rejected before reading the state. Both report kinds were checked at boundary years 1000 and 9999 with exactly 365 dates and no year 10000 overflow.

At the 25-year cap, both SVG sets were generated successfully: Streak 4,323,906 UTF-8 bytes / 8,647,712 UTF-16 bytes; Consistency 4,332,521 / 8,664,750 bytes. Each 2× annual canvas is 2828×2000 pixels, approximately 22.6MB of RGBA pixel storage, reused page by page. This is a measured component bound, not a claim about total browser memory or safe capacity on every phone. A 25-page PDF and physical-device capacity were not tested; the actual PDF matrix uses shorter ranges.

## Spanish review examples

The PDF skill marker was invoked successfully exactly once immediately before the first generation of these two deliverables. They use synthetic activity across 2024–2026, including partial completion, pauses, missed days, pretracking dates and current-year future dates. Each PDF has three landscape pages.

- [Streak example](../.tools/reports70/TGym-Reporte-de-racha-por-anos-2024-2026.pdf)
- [Consistency example](../.tools/reports70/TGym-Reporte-de-consistencia-por-anos-2024-2026.pdf)

Rendered review pages are `.tools/reports70/example-{streak,consistency}-{2024,2025,2026}.png`.

## Verification boundaries

Chromium/Edge and WebKit are isolated desktop engine tests. They do not prove a physical iPhone/Safari/PWA, native share sheet, second-device delivery, low-memory phone behavior, printing hardware or receipt of an update notification. No physical device was connected for this audit. Root release checks own the full test/build suites, native lint/build, exact-source CI, signed artifacts, publication and production PWA update/offline preservation; those results belong in the release audit rather than being inferred here.
