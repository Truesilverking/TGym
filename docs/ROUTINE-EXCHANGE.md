# Routine exchange v1

Plan's existing share/upload action opens Import / Export routines. Select one, several or all routines, choose PDF, XLSX or JSON, review the count and format, then prepare and download. Preparation shows progress, can be canceled, ignores late results and prevents duplicate presses. A prepared file remains available after a save error for retry. Files use the common `saveReportFile` adapter: Download saves directly in browsers and installed PWAs, while native Android/iOS opens the system share sheet. All builders read local state and bundled dependencies; no API or remote catalog is required.

Imports accept JSON and `.xlsx`, never arbitrary PDFs. Before confirmation, TGym parses the complete file, lists routines/exercises and concrete errors, requires unknown exercise mappings and a choice for every existing ID/name, custom-definition, alias, library-note or unit conflict. Confirm recomputes validation against the live state and constructs a complete draft before a single `useStore.update`, preserving the normal localStorage/PWA/native/server persistence path. Relevant live plan/catalog/schedule/preferences changes invalidate prior conflict decisions; clock updates do not. Errors create no partial routines. Applying imported schedule/default rules is an explicit checkbox. Schedule application removes the imported routines' prior assignments before adding the reviewed schedule and preserves unrelated routines on the same day. Imported routine ordering replaces those routines' previous relative order. Workout results/history and the active workout snapshot are outside the exchange payload.

## JSON

`tgym_routine_exchange: 1` declares the version. The envelope includes `unit`, `routines`, `routineOrder`, `week`, `dayPlan`, `catalog` and `rules`, plus a captured `exerciseNameMode` for PDF presentation. Routine/exercise objects retain their supported existing fields, including IDs, notes, guide slots, intensity techniques, supersets, warmups, progression and independent/manual Back-off ranges. Exercise IDs remain identities; names/aliases do not select another exercise. The catalog comes from the runtime `CATALOGUE` overlay and all local custom exercises, with exact original names, separate aliases and library notes. `aliasPresent` distinguishes explicitly blank aliases from exercises without a source alias, preventing unrelated nicknames from being cleared. A custom `definition` preserves the original custom object without adding transport properties to stored custom exercises.

`rules` captures existing default Back-off preference, strict reps, effort and rest settings where present. It is applied only when requested in preview. Changing the global Back-off preference uses the existing store behavior, which refreshes pending automatic Back-off targets in an active session while retaining manually recorded results.

Legacy `framegym_plan: 1` / `opengym_plan: 1` files convert additively in preview. Unknown exercise IDs remain visible for explicit mapping. Unsupported versions produce a conversion error and are not guessed. JSON validation rejects unsafe object keys, malformed types/ranges, invalid ordered schedules, duplicate IDs/order and invalid supersets. Kg/lb differences require explicit conversion; timed progression increments remain seconds.

## Excel

`Instrucciones!B2` contains version 1 and `B3` the workbook unit. Required visible sheets and their stable headers are:

| Sheet | Purpose |
| --- | --- |
| Instrucciones | Required/optional fields, units, enumerations, supported editing rules and import steps |
| Rutinas | ID, name, order, weekly/date scheduling positions as JSON, routine notes |
| Ejercicios de rutina | Unique instance, owning routine ID, catalog selector, order, superset, notes, mode, side semantics, progression |
| Series | One row per prescribed Warm-up/Working/Top/Back-off set, ranges, load/unit, RIR, rest, Top association, reduction and Back-off rules, time/cardio targets |
| Catálogo | Exact stable ID/original name, separate alias, custom flag, unique selector and library note |

The exercise selector displays `original name [ID]`; the user selects it from a native Excel list and never copies the exercise ID. Same-name exercises have distinct selectors. Named range `TGymExercises` references the selector column in Catálogo. Native Excel validation also covers set types, units, modes, booleans and progression. Lists extend through row 10001; copy a validated row to extend further. Blank template downloads include the complete real/local catalog and instructions, with no invented routines or workout results.

`Semana (JSON)` stores day-number to ordered position (`0` Sunday through `6` Saturday); `Fechas (JSON)` stores ISO date to position. Each exercise's instance ID connects its series. A Back-off association is `instance:Top`; Top and Back-off groups must coexist in order. `same` and `increased` preserve Same reps and Top +2 to both bounds, respecting unilateral storage semantics. Existing `legacy:N` offsets and `autoBackoffReps:false` retain exceptions/independent ranges.

TGym prescriptions support shared values within each Working, Top or Back-off group, and shared rest between Top/Back-off. Unsupported independent per-row load/reps/RIR/time/tempo/rest combinations are rejected with exact sheet/row/column feedback. Warmups keep the existing automatic ramp and support their shared warmup rest; fixed independent warmup targets are not invented. The legacy `setRestSec` array travels unchanged in JSON/preservation metadata; the current runtime rest resolver does not activate it, so the importer does not pretend varying row rests are supported.

A very-hidden `_TGym` sheet holds chunked original payload and editable-row baselines. Unchanged rows retain exact existing fields, absent-vs-explicit settings and advanced configuration. Edited cells override original values; removed rows remove their visible objects. Metadata cannot restore removed routines/exercises or override an edit. Without metadata, required sheets and editable columns are still parsed, but advanced configuration that was not supplied cannot be recovered. Formulas/rich text/links in import cells are rejected. Import files must be nonempty and at most 15 MB, with a maximum of 20000 rows per sheet, 500 routines and 1000 exercises per routine.

## PDF and checks

PDF renders Routine → Exercise → Set, including every prescription, rest, note, original/alias, schedule and Top/Back-off association. Long names/notes wrap using browser canvas font measurements and paginate into A4 SVG pages before the existing raster/PDF adapter. It does not include recorded training results. Node tests use a conservative Unicode width fallback.

Automated tests cover real serialized XLSX/JSON equivalence, ordered multi-routine schedules, custom definitions, duplicate names, aliases, advanced fields, warmups, independent Back-off rules, edited columns, unsupported variation, mapping, all conflict choices, wrong versions/types/ranges, empty/malformed files, unit conversion, paginated PDF content, preparation/cancel/retry and the atomic UI commit. Actual file opening, rendered visual inspection and offline browser/device evidence are recorded in the task acceptance audit; unit tests alone do not establish Excel/iPhone application behavior.
