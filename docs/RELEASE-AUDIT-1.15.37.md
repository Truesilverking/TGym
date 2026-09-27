# TGym 1.15.37 / Android code73

## Scope and data flow

Progress Report has eight independent sections and routine-first analysis on screen and in the downloadable PDF. Routine summaries precede their recorded exercises and PRs. Stable routine/exercise identities preserve associations through edits/deletions and prevent cross-routine comparisons. Legacy groups remain separate; invalid timings and duplicate sessions are excluded appropriately. No persisted data, schema, backups or updater validation changed; no migration is required. Twelve locale packs include the new explanatory text.

PDF layout uses complete-row page breaks, repeated section context, wrapped titles/subtitles, compact summary tiles, two-column metrics and dated records. It retains metrics/charts/values/dates and reuses the selected report snapshot. Missing chart space is removed for single readings. The original PDF-only optimization reduced the fixture25→21pages; the subsequent requested routine summaries and eight-section structure add useful information, yielding25pages for the final Spanish full fixture.

## Verification

- Frontend1130tests/115files passed, including report identity/renames/deletion, exact routine adherence, mean/median, missing exercise identity, duplicate legacy sessions, context/page bounds, long labels, navigation, PDF failure/retry/cancellation, native sharing and stale snapshots. Targeted report/file/calendar/view suite64passed before the final body-only overview test; final complete suite includes that additional passing regression.
- API10, MCP37 and plain Node import graph passed.12locales1628keys synchronized;1049source strings covered; version1.15.37/code73 verified. No frontend lint/typecheck scripts exist.
- Web,PWA,mobile assets/Capacitor sync builds passed. Final SDK35/JDK21 assembleDebug/lintDebug passed;0errors20existingwarnings. Large-chunk/import build warnings remain non-fatal.
- Real Opera browser navigated all eight sections; routine→exercise hierarchy and aggregates checked. ESlight/ENdark mobile320/360/375/390/430 and1024,landscape844x390 had no horizontal overflow in exercised views; long routine labels wrap. Existing theme/accent/reduced-motion behavior is reused with no new animation.
- Actual downloaded PDFs parsed strictly and every page rendered with PyMuPDF. Reviewed individual pages/contact sheets: Spanish33workouts/3routines/72records25pages; English330sessions/72records23pages; three workouts15pages (down from17after removing empty chart space); long renamed routine labels25pages; single reading1page; empty1page. All are synthetic. No private training data used.
- Opera initially failed downloads while minimized; after the user opened it, actual saved files were verified. Browser blob preview was not used to bypass prior policy restrictions; files opened locally. Physical Android/iOS share-save, installation and notification receipt are not claimed. Native adapter coverage and native build/emulator evidence are separate.

## Publication

Pending exact-source CI and release verification. Publication authorized by the user; release only after successful checks.

Ignored reproducible QA artifacts: `.tools/browser-audit/progress-routines/`. No credentials, signing material or binary artifacts committed.
