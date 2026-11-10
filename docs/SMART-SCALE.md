# Smart scale / Withings

TGym can read Withings weight, body fat percentage, fat mass and available height records through an optional TGym API server. The Android app and standalone PWA keep their existing local profile; the scale connection does not upload or replace the training profile. The provider connection requests only `user.metrics` and does not write data to Withings.

## Server setup

1. Register an OAuth application in the [Withings Partner Hub](https://oauth.withings.com/).
2. Register the exact public HTTPS callback `https://your-server/api/withings/callback`.
3. Set `WITHINGS_CLIENT_ID`, `WITHINGS_CLIENT_SECRET` and `WITHINGS_REDIRECT_URI` on the API server, then restart it. The supplied Compose configuration loads these from `.env`; they must never be frontend `VITE_*` variables.
4. Sign in to the server's TGym web application and open Settings → Health. Select **Connect Withings**, authorize the requested measurement access and return to TGym.
5. For another Android/PWA device, select **Create pairing code** in the signed-in server's Health section. On the other device, open Health → Smart scale → API connection, enter that server's HTTPS origin and the one-time code. The code expires in five minutes.
6. Select **Sync now**. Automatic sync can then be enabled or disabled in Health.

The provider OAuth client secret and access/refresh tokens remain on the server. The server encrypts the token vault as `withings.enc` with AES-256-GCM using a key derived from its existing session secret. Back up the data directory and preserve its secret. An unreadable vault blocks only the scale integration and is never silently overwritten. The device's server pairing token is stored separately from the training profile and portable backup.

## What is imported

| Withings measurement | TGym destination |
| --- | --- |
| Weight, type 1, kg | Body Weight, converted to the current display unit; daily samples use the app's existing daily average convention |
| Body fat ratio, type 6, % | Body composition / InBody history, `bodyFatPct` |
| Fat mass, type 8, kg | Body composition / InBody history, `bodyFatMass` in canonical kg |
| Height, type 4, metres | Height history when no manual/same-day/newer height would be overwritten |

Generic muscle mass, fat-free mass, bone mass and vendor-specific visceral-fat scores are not relabeled as TGym's skeletal muscle, minerals or visceral-fat level. Missing measurements remain missing. Weight and fat-mass values in body composition retain the existing canonical kg convention, independently of exercise/bodyweight display units.

Stable provider IDs prevent duplicate imports and reconcile revised dates/readings. Manual samples, tape measurements, routines, workouts and active sessions remain intact. The import uses `updateAtomic`: a primary storage failure preserves the previous profile and cursor for retry. The native/PWA mirror flush must complete before a manual sync reports success. An unavailable mirror may leave the successful primary write pending mirror retry; repeated imports remain idempotent.

Automatic sync runs while TGym is open, after return to the foreground or restored connectivity, at most once per 15 minutes. It requires an enabled connection and network access. It is not a background service, does not wake a closed PWA and does not provide instant push delivery from a scale. Withings receives device readings after its device/app has synchronized with the Withings service. Disconnect stops future imports and removes the server-side provider authorization; previously imported readings remain in TGym. Forget server also removes this device's private pairing configuration.

## Verification boundaries

Automated tests cover OAuth state expiry/replay, authorization isolation, encrypted token reload/rotation, bounded pagination, rejected access/refresh tokens, HTTP authentication/CSRF, units, daily manual samples, revised provider IDs, disconnect races, primary quota rollback/retry and the PWA authorization-window gesture. Provider responses and credentials in these tests are synthetic. A live Withings account authorization requires the owner's configured API credentials and consent; automated tests do not establish a successful live scale connection.

Official contracts: [OAuth authorization](https://developer.withings.com/developer-guide/v3/integration-guide/public-health-data-api/get-access/oauth-authorization-url/), [OAuth tokens and Measure Getmeas](https://developer.withings.com/api-reference/).
