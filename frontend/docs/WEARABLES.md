# TGym health and wearables contract

TGym will integrate system health stores first: Health Connect on Android and HealthKit on iOS. Manufacturer adapters may later add data that the system store does not expose. No client secrets, passwords, private APIs, scraping, or medical diagnosis belong in the app.

## Normalized metrics

Daily snapshots accept activity (`steps`, `distanceMeters`, energy in kcal, exercise/active minutes), heart rate in bpm, timestamped heart-rate samples, HRV in milliseconds with an explicit `rmssd`, `sdnn`, or `other` method, sleep timestamps and minutes, respiratory rate, SpO2 percent, skin temperature or delta in Celsius, wearable workouts, and namespaced vendor metrics. All unavailable fields are `null`, never zero. Timestamps are ISO strings and every snapshot retains its IANA timezone.

## Provenance and deduplication

`sources` and `sourcesByMetric` preserve provider/device provenance. System platforms have priority for ordinary activity totals. A direct vendor adapter may fill missing metrics or explicitly higher-resolution samples, but TGym never adds duplicate steps, calories, or workout duration. Workouts deduplicate by source plus source ID, or by start/end/activity when no ID exists. TGym may suggest a temporal match with its own session but must ask before merging.

## Privacy and permissions

Connection is explicit opt-in. TGym explains and requests only the selected data types, supports disconnecting and deleting imported summaries, excludes health data from analytics and production logs, and sends nothing to a TGym server without separate consent.

## Storage and backups

The main backup may contain normalized `healthSummary` snapshots used for trends. High-volume `rawHealthSamples` remain separate and should be regenerated from Health Connect or HealthKit while permission remains available. Missing raw samples must not change a summary to zero.

## Recovery

`getRecoveryInputs(date)` is the future boundary for sleep, resting heart rate, typed HRV and recent training load. The existing Recovery feature remains unchanged. With insufficient inputs TGym reports insufficient data; it does not manufacture a precise score.

## Adapter boundary and next step

Platform code belongs in `src/lib/health/adapters`, not Stats components. The current adapters intentionally report unavailable: no permission is requested and no data is displayed. A future release must select maintained native Health Connect and HealthKit plugins, add platform declarations, implement explicit permission screens, normalize returned records, and test on physical devices before enabling the connection control.
