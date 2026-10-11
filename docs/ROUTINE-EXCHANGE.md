# Routine exchange v2

TGym 1.15.64 writes `tgym_routine_exchange: 2`. Excel and JSON use the same prescription boundary. Format 1 and legacy `framegym_plan: 1` / `opengym_plan: 1` remain readable with an explicit compatibility review. See [transfer audit](ROUTINE-TRANSFER-AUDIT-1.15.64.md) and [release verification](RELEASE-AUDIT-1.15.64.md). Existing stored routines, completed workouts, storage keys and package IDs require no migration.

From Plan's existing share action or Settings → Load Routine → Import / Export routines, select one, several or all routines, choose JSON, Excel or PDF, prepare, review the file and download. The downloadable blank Excel template uses the complete current built-in and local custom catalogue. Normal exports include definitions/resources only for custom exercises used by the selected routines. The common `saveReportFile` adapter downloads in browsers/PWAs and uses the native system share sheet on phones. Preparation, cancellation and retry remain in the existing flow. All builders work from local data; portable embedded media needs no server.

## Identity, prescriptions and destination preferences

IDs are identities. Exact original names are retained separately from aliases. Same-name catalogue exercises have different `original name [ID]` selectors. An exercise instance, rather than its catalogue ID, owns its series; repeating an exercise in another routine or twice within a routine retains separate configuration.

Version 2 captures complete source preference context in `rules`: Back-off mode, strict repetitions, rest settings, effort and deload. Export materializes effective rest, strict-rep and automatic Back-off values on the selected routine prescriptions. Imported Back-off exceptions are marked explicitly. `loadingStep` records the source load grid separately from progression `inc`; editing/saving the imported exercise preserves this grid and the captured warm-up/superset rests. Old unmarked local routines continue to follow the app's global Back-off preference.

The importer never changes destination global units, naming mode, rest, Back-off, effort or deload preferences. Kg/lb differences require explicit conversion; preview shows converted prescriptions before confirmation. Load grids and weight increments convert as weights, while timed progression increments remain seconds. Version 1 inheritance is resolved using supplied source context, or documented defaults if that context is absent, and requires acknowledgement. Different effort scales or enabled deload require explicit review: execution uses the destination's effort interpretation, deload calendar, pauses and personal history. Transfer does not promise identical progression derived from different personal workout histories.

Routine exchange contains prescriptions only. It excludes completed workouts, recorded set results, active/resumable sessions, source historical exercise weights and private account credentials. Import creates no completed workout. Routine IDs referenced only by historical/deleted routines are reserved; new imports receive distinct IDs so they cannot appear previously completed. Recorded results and historical IDs are retained. The existing store captures additive `sessionOrigin` for name-only legacy rows using the pre-import routines; this preserves their original meaning instead of associating them with a newly imported same-name routine.

A conflicting custom ID with a different definition requires a separate copy or an explicit mapping to a selected destination exercise. It cannot overwrite a definition used by other routines/history. An exact unique custom definition can be reused across different IDs. Unknown or ambiguous catalogue matches require an explicit correspondence; aliases never silently select a different exercise. Repeated routine content is detected after identity resolution and unit conversion even when source IDs, routine names or superset labels differ. Keep, copy and permitted replacement are reviewed explicitly; replacement requires confirmation and preserves history. Historical/session references and relevant live state changes invalidate the review.

## Excel

`Instrucciones!B2` is version 2; `B3` is kg/lb. The existing visible sheet/header prefixes are retained:

| Sheet | Content |
| --- | --- |
| Instrucciones | Steps, required fields, units, permitted values, version, editing and compatibility guidance |
| Rutinas | Stable ID, name/order, weekly/date schedule, progression, notes and routine rest/configuration |
| Ejercicios de rutina | Unique instance, routine reference, catalogue dropdown, exercise order, alias metadata, supersets, notes, mode, side semantics, progression and supported advanced settings |
| Series | One row per Warm-up, Working, Top or Back-off prescription: fixed/ranged reps and RIR, load/unit, rest, associated Top, reduction/mode, time/cardio targets |
| Catálogo | Complete real built-in/local custom IDs and exact original names, separate aliases, unique selectors and library notes |

The native exercise dropdown uses `INDIRECT("TGymCatalogue[Selector]")`, so expanding the catalogue table expands its choices. No exercise identity depends on a macro or an unevaluated formula. Tables filter and expand; panels/identity columns are frozen. Instructions explain editable, required and technical columns. Data tables contain no merged cells. Adding a custom catalogue row by name alone cannot reconstruct its full definition or GIF: create the exercise in TGym first and obtain a new template, or provide explicit correspondence on import.

`Semana (JSON)` maps weekday number (`0` Sunday through `6` Saturday) to an ordered position; `Fechas (JSON)` maps ISO date to position. Series reference their exercise instance. Back-off references `instance:Top`; Top and Back-off coexist in order. `same` copies both Top rep bounds; `increased` adds two visible reps, preserving unilateral semantics. `inherit` follows the source preference captured in the file, which becomes an explicit imported prescription. Supported positive `legacy:N` offsets and independent `Back-off automático=false` ranges remain compatible. Untouched format 1 data retains its legacy intent until reviewed import.

The current model shares prescriptions within each Working, Top or Back-off group and shares Top/Back-off rest. Unsupported independent per-row prescriptions are rejected rather than approximated. Warm-up rows use the existing automatic ramp. Rest-pause exports the actual activation Warm-up and one total-reps Working row; dropsets retain their technique configuration. Legacy `setRestSec`/tempo metadata is preserved where supported without pretending the runtime executes an unsupported row-specific rule.

Optional columns appended to the original prefixes retain progression, rest, bodyweight, strict reps, AMRAP, intensifier JSON and `Configuración (JSON)`. Advanced configuration cannot duplicate represented fields or identities. Leave optional values blank to preserve absence; absent values are not converted to zero. Numeric Excel cells are preferred. Ungrouped decimal text such as `22.5` or `22,5` is accepted; ambiguous `1,234`/`1.234` must be entered as a numeric cell, `1234` for an integer or `1.2340` for a decimal. Grouping, mixed separators, currency and exponents in text are rejected.

The very-hidden `_TGym` sheet preserves chunked custom definitions/media, original configuration and editable-row baselines. Visible edits win; removed rows remain removed. Restore the sheet or export again from the source if metadata is missing. Version 2 rejects missing definitions for used custom exercises; version 1 warns about unrecoverable data and requires acknowledgement. Visible/hidden versions must agree. Formula/rich-text/link cells are rejected; names and notes are written as literal text, including leading `=`, accents and Unicode. Physical worksheet/row/field provenance remains outside the portable payload.

## JSON and media

The versioned envelope contains `unit`, `routines`, `routineOrder`, `week`, `dayPlan`, `catalog`, `rules` and captured presentation `exerciseNameMode`. Supported prescription fields retain IDs, notes, guide slots, intensity techniques, supersets, warm-ups, progression and independent Back-off ranges. Custom `definition` is stored once in the catalogue; aliases/library notes apply only to accepted routines' exercises. Unsupported nonprivate configuration fails export with a corrective message instead of being silently omitted.

Embedded raster data images/GIFs transfer to any compatible updated TGym device and work offline. Media is validated for MIME, base64 and image container structure. Temporary `blob:`, local `file:` paths, malformed media, SVG and unsupported formats are rejected with instructions to upload a supported image/GIF and export again. Public safe HTTPS media is retained, but needs connectivity; local, credential-bearing or temporary URLs are not portable. PDF presents the routine and does not embed an animated exercise library.

## Validation, persistence and limits

The complete file is checked before persistence: version, structure, types, bounds, units, schedules, superset continuity, references, catalogue definitions and media. Preview lists routines, exercises and concrete series, with actionable sheet/row/field errors, mappings, conflicts and compatibility adaptations. Cancel changes nothing. Confirmation validates the current state again and builds one complete draft before the single normal `useStore.update` transaction. Optional schedule import preserves unrelated assignments. Destination global preferences and history remain intact.

A primary storage quota failure leaves the profile unchanged and permits retry. After the complete profile is committed locally, a failed native/PWA mirror is reported separately; retry flushes the existing complete import and does not import duplicate routines. No silent partial routine commit is allowed.

Files/normalized JSON are limited to 15 MiB, with 500 routines, 1,000 exercises per routine and 20,000 rows per sheet. Embedded individual media is limited to 5 MiB. XLSX preflight rejects declared expanded content above 128 MiB; ExcelJS checks ZIP CRC32 in both Node and browser readers. These limits bound supported app-generated exchange files; they are not a claim of universal hostile-archive isolation. Excel's 32,767-character cell limit is checked before writing; larger notes require JSON. Hidden metadata chunks respect Unicode boundaries.

## PDF and verification boundaries

PDF follows Routine → Exercise → Series with titles, schedule, units, ranges, Top/Back-off associations, rests and notes. Shared prescription helpers supply the same loading grid, Rest-pause and automatic Back-off rules as execution. A4 tables wrap long text and repeat headers during pagination; browser canvas font measurement is used before the existing PDF adapter. Progress Report is separate and unchanged. Arbitrary PDF import is not supported.

Regression tests verify content, rules, identity/instance relationships, corruption, legacy compatibility, repeated imports, quota rollback, mirror retry and runtime/editor behavior. The acceptance audit records actual downloaded files, Microsoft Excel, browser engines and physical phone tests separately. WebKit iPhone emulation does not establish physical iPhone or native iOS acceptance; those require an actual iPhone/macOS environment.
