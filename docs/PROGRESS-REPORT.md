# Progress Report

The `/progress` route is available from Statistics. It reads history without changing it. `frontend/src/lib/progress-report.js` supplies the interactive cards, HTML export and additional Full Report PDF pages through `progress-export.js`.

Each metric compares its first and last valid reading within the selected calendar period, bounded by `trainingStartDate`. One reading has insufficient data, not zero change. The absolute change is current minus baseline; relative change is that difference divided by the absolute nonzero baseline. Effort scales, BMI and body-fat percentage omit relative percentages. Body-fat differences use percentage points. Trend is least-squares slope over elapsed days. No aggregate strength percentage or automatic body-composition benefit is invented.

Bodyweight samples, every bilateral/legacy tape measure, all InBody fields and dated height history are supported. New heights append canonical centimetres; existing dated height is retained, while an undated legacy height is not assigned a fictional date. New tape/InBody records carry timestamps. Multiple same-day tape readings append independently; deleting one uses record identity and preserves its same-day neighbours. Existing unit conversion and portable backups remain compatible. BMI uses a height recorded on or before the weight date.

Exercise comparisons use stable routine and exercise IDs, mode, set type, role, bodyweight and per-side semantics. The same exercise in two routines is two comparison groups. A representative actual completed work set supplies load/reps/RIR together. Warmups are excluded. Existing capped 1RM estimates apply only to eligible straight loaded sets. A higher estimate alone is not labelled improved; that requires known comparable load, reps and RIR with no regression and at least one increase. Missing values never establish improvement. Per-side display uses the shared helper; historical volume retains original stored semantics. PRs beat a previous recorded best in the same group, with at most one per session/group; equal sets and duplicate sessions do not add records.

Training includes session and complete Monday–Sunday weekly volume, sets, reps and frequency, including zero weeks. Partial weeks are labelled and excluded from first/last weekly comparisons. Muscle volumes use existing muscle contributions. Duration uses the shared workout clock and valid-session filter. Schedule adherence uses existing multi-routine consistency. Streaks explicitly mean consecutive active days. Additional activities include duration, distance, heart rate, calories, steps, elevation, zone and effort when recorded.

Expandable sections, memoized calculations, downsampled chart points and paginated measurement history keep long histories usable. HTML exports include comparable metrics and charts; Full Report preserves calendar pages and appends paginated progress cards. English uses source keys; Spanish is translated, and other locale keysets retain fallback text for new terms.

Validation: pure data tests cover empty/single/multiple readings, periods, units, legacy history, joint strength/effort comparisons, AMRAP, per-side rows, PR deduplication, multi-routine schedules, activities and exports. Browser testing uses synthetic data only. Responsive checks at320/360/375/390/430/1024 found no horizontal overflow. Spanish light and English dark were inspected. Custom dates were verified with real keyboard changes; the browser tool's date `fill` did not trigger React's change event. HTML download was confirmed on disk. This is browser evidence, not physical iOS certification.

## Download and presentation (1.15.35)

Statistics exposes Progress Report as the same header icon button used by History. The report keeps the selected period and uses the same computed snapshot for the screen and PDF. Generate with **Export Progress Report · PDF**, then **Download** in web/PWA or **Share / save** in Capacitor. Browser downloads use an attached download link; native files use the existing base64 cache-file/share adapter. Files are named `TGym-Progress-Report-YYYY-MM-DD_YYYY-MM-DD.pdf`. A separate web Open link offers a preview where the browser permits blob navigation.

A4 pages contain a compact overview, baseline/current/change cards, trends and dated records. Body-only reports omit the empty workout overview. Empty reports explicitly state that no comparable history exists. Lossless raster charts/text preserve accents and fonts without external assets. HTML fragments remain available in the existing complete statistics export. Calendar Full Report reuses the new page layout.

Generation/save failures preserve the interactive report and allow retry. Buttons guard duplicate generation, share cancellation is not an error, period/data changes invalidate an old download, and object URLs are released. No persisted training data is modified by export. Bodyweight comparison groups are explicitly labelled, and exported completion includes its percent unit.

Browser downloads were saved and opened using strict pypdf parsing plus PyMuPDF rendering with synthetic full/single/empty histories. The final audit records platform limitations separately: native adapter tests are not a physical Android/iOS file-manager test.


## Routine-first dashboard (1.15.37)

Eight independent sections share titles/subtitles between screen and PDF: overview, adherence, duration, routine progress, training volume/performance, body metrics, InBody, and trends. Opening a section mounts only its related content. Routine accordions show aggregates before nested exercises and records. Recorded body values remain visible in the overview when no workouts exist.

The pure builder exposes `routines`, keyed by persisted `routineId`; legacy rows lacking that ID stay in separate name-based groups and are never inferred to belong to a current same-named routine. Routine edits/deletion do not remove historical exercises, because sessions supply recorded exercise entries. Missing exercise IDs use session-local identities instead of merging unrelated entries. Legacy workout deduplication includes routine identity and paused time. No storage keys, persisted records or migrations change.

Routine aggregates include recorded session count, active days, frequency across the selected inclusive period, volume, shared-clock mean/median duration, valid timing sample count, adherence and per-session/weekly trends. Timing excludes invalid/active/canceled/duplicate sessions through `validTimedSessions`. Adherence uses available schedule history and exact routine IDs; ambiguous legacy completion returns an unknown routine rate, not an invented percentage. Existing overall consistency retains its established legacy matching rules. Earlier overwritten schedules cannot be reconstructed and both exports and UI disclose that limitation.

The A4 dashboard uses section headings/subtitles, three-column summary tiles, two-column metric cards and dated routine-specific record lists. Complete rows flow between pages; continuation pages repeat routine/exercise context. Card height follows wrapped titles/details; single readings do not reserve chart space. Body/InBody remain separate. The complete calendar export reuses this layout. All relevant metrics, baseline/current/change values, dates, charts and records are retained.

See `RELEASE-AUDIT-1.15.37.md` for exact validation and publication evidence.
