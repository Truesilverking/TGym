# TGym 1.15.36 / Android code 72

## Scope

Progress Report now uses the exact `iconbtn` and `Icon` structure in the Stats header beside History, including shared size, spacing, focus/hover states and route navigation. The separate card is removed. Metric cards pair dates with baseline/current values; highlights use a compact list; unrelated empty sections and zero-workout tiles are omitted for body-only reports. PDF personal records use 12 readable rows per page, preserving all records, dates, units and prior values. Bodyweight rep records retain the per-side unit. No persistence schema or workout timer changes.

## Validation

- Frontend: 1120 tests / 115 files passed; targeted report/file/view/calendar tests: 55 passed. API:10, MCP:37 and plain Node import graph passed.
- All 12 locales / 1624 keys synchronized; 1049 source strings covered; version check passed. No frontend lint or typecheck scripts exist.
- Web, PWA and mobile build/sync passed. SDK35/JDK21 assembleDebug and lintDebug passed:0 errors,20 existing warnings.
- Actual browser navigation from Stats into Progress Report passed. Header actions measured identically at36x36px at320px. ES light and EN dark report widths320/360/375/390/430/1024 and dark landscape844x390 had no horizontal overflow. Visual inspection covered header, metric cards and highlights. No new animation; shared reduced-motion behavior retained.
- Actual browser-generated and downloaded PDFs opened with strict pypdf and rendered with PyMuPDF: full33-workout/72-record fixture25pages,7664903bytes; single-reading1page88223bytes; empty1page70434bytes. Full report previously28pages; no records removed. Selected-period, failure/retry/cancel and stale-file regressions remain covered. Per-side bodyweight record8→10 remains8→10 reps/side without changing persisted data.
- Browser PDF blob preview remains blocked by browser policy; it was not bypassed. Downloaded files were opened locally. No connected ADB device and no iPhone available: physical mobile share/save and notification receipt/install remain unverified. Native byte/share behavior has automated coverage.
- Existing non-fatal build chunk/import warnings remain. Initial test command used the repo root rather than frontend and was corrected; initial Gradle log destination was corrected before execution. No test/build failures remain.

## Publication

Pending exact-source CI, tag, release and public artifact/updater verification.

Local synthetic artifacts: ignored `.tools/browser-audit/progress-36/`. No private workout data, credentials or binaries committed.
