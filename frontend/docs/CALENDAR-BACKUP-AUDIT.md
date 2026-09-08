# Calendar export and backup implementation audit

Status: implementation complete locally, 2026-09-08. Automated tests and web/mobile builds pass; a real two-device Drive test and physical Android/iOS visual test still require devices/accounts.

## Calendar: implement first

- Shared calendar: `src/sheets.jsx`, exported `ZoomCalendar`, used by history and consistency sheets.
- View levels are week, month, months (12 mini calendars), and years.
- Day state, month layout, and period statistics currently live inside this component. Extract reusable presentation and period data without introducing a separate export calendar.
- Preserve the current user's navigation state. Export must render an offscreen instance with an explicit period.
- Existing `src/lib/mobile.js` binary sharing should be reused for PNG/PDF.
- Calendar export is implemented with an offscreen shared `ZoomCalendar`, PNG/PDF output, translated labels, summaries, and mobile sharing. Playwright visual capture was attempted but the bundled Chromium executable is not installed.

## Backup: implement after calendar

- Existing import parser is `src/lib/json-import.js`; it recognizes legacy full states and routine bundles. It currently accepts arrays of workouts and routines without versioned envelope validation.
- Native dated backups in `src/lib/mobile.js` serialize `framegym_backup: 1` plus state. Audit all manual/cloud callers before replacing this with one snapshot function.
- `src/lib/cloud-sync.js` already uses Drive appDataFolder, native Android authorization, and state merge. Extend these rather than creating parallel engines.
- Drive uses the existing private `appDataFolder`, dirty changes with a five-minute retry/debounce window, one current snapshot plus ten daily restore points, selectable history, and local-first conflict handling.
- `src/components/RestoreSheet.jsx` already owns backup, restore and sync actions. Consolidate UI there.
- `saveMerged` now records an undo snapshot and replaces local state before the cloud write; failed cloud writes do not discard the local result.
- Audit persistence beyond the main store before defining the full-backup schema. Do not export tokens, PIN or other credentials.
- Real two-device Drive verification and Android share/restore verification are still pending; mocks alone do not satisfy acceptance.

## Settings: implement last

- Mobile/standalone currently show a separate Your data section above settings.
- Mobile/standalone now show the informational row first in Data with the requested exact title and cloud-aware subtitle; account UI remains on web.
- Keep account/sign-in UI for applicable builds. Avoid duplicating export/import/restore controls.

## Release gate

Complete calendar, then backup, then settings. Run required tests/builds and device/visual checks. Publish only verified changes. Remove automation `evaluar-personalizaci-n-de-opengym` only after the requested work and publication are complete.
