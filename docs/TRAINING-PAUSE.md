# Training breaks

A pause is a portable `trainingPauses` record `{id,start,end}`. Dates use the local calendar; start is inclusive and end is exclusive. Null end means paused until explicitly resumed. No old data migration is needed; missing arrays mean no breaks. Closed zero-day records are retained to prevent stale cloud backups from reopening cancelled pauses.

The Home button pauses from today, or tomorrow if today has a recorded workout. An active session must be finished/discarded first. Resume restores training today. Starting a session from any entry point while paused requires resuming first. Past absences are never forgiven retroactively.

Shared schedule lookups suppress paused dates without deleting weekly assignments or dated overrides. Paused days do not advance/break streaks or enter consistency denominators. There is no catch-up backlog. Calendar, export, heatmap and MCP distinguish pause from rest; measurements and real elapsed recovery time remain unaffected.

The deload cycle counts calendar days excluding pauses since its original Monday anchor. Each closed break shifts later dates by its actual length, including when the break interrupts an active deload. An open pause has no predicted return date. The cycle is not rounded to another Monday on resume; weekly routine assignments remain on their normal weekdays. Saved workout deload flags remain authoritative.

Native and server training reminders respect pauses. Native schedules are cancelled/refreshed immediately on pause/resume; body-measurement reminders retain their own independent settings. JSON/local storage and the native file mirror retain pause history; explicit saves await the native write. A failed native save can be retried without toggling the pause again. Cloud merges retain closed pauses over stale open copies.

Validation: pause/deload/streak/calendar/reminder/backup/merge tests; component controls, active-session guard, native restore and save-retry tests; browser pause, reload, blocked start, resume; web/PWA/mobile builds, Android debug/lint, API and MCP tests. No real-device process termination test was performed.
