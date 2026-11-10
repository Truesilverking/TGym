# TGym 1.16.2 original flame restoration

Current published release: **1.16.2 / Android 155**, runtime source `776e8cbeacfcfa43d2e05c01e3361ff68f96b5d6`. The original yellow-orange Streak flame is restored and enlarged in the header, calendar and reports without changing its silhouette. Active movement and TGym/OS reduced-motion controls remain enabled; the Training header reserves room for multi-digit counts. The compact twelve-month annual calendar, stored training/profile data and date calculations are preserved. Verification passes 3,313 frontend tests, 53 CI Android emulator tests, local Android compilation/lint (0 errors, 22 warnings), and 6 local plus 6 actual-public browser contexts / 55 groups each with no runtime errors. Actual PNG/PDF exports use the original vector and rendered pages were visually reviewed. The [release](https://github.com/Truesilverking/TGym/releases/tag/v1.16.2), official signing, Release/Pages APK parity, 51 public PWA files and exclusion of the discarded raster flames pass. Firebase accepted the normal update broadcast; receipt and installation on a physical phone remain unverified. See [structured evidence](STREAK-FLAME-EVIDENCE-1.16.2.json). Protected main retains independent review.

## Behavior

The flame path is byte-identical to v1.16.0. A tighter shared SVG viewBox and larger containers make it more visible in the app and reports. The Training header uses intrinsic button width so a three-digit count fits beside the larger flame. This changes presentation only; streak calculations, stored history, identity and backups are unchanged. The twelve-month overview retains its compact grid and collapsed calendar key.

## Verification and limits

Exact-source push/PR Tests, PWA, Android/emulator and signed-candidate workflows pass. Frontend: 3,313 tests / 275 files; API: 37; MCP: 39 plus plain-Node loadability; catalogue: 6. Android emulator: 53 tests, zero failures/skips. Local Android lint: zero errors, 22 warnings.

Each local/public browser run covers six contexts with original-vector/gradient checks, enlarged visible bounds, all twelve months, week/month/year navigation, leap dates, inactive gray state, real Settings animation toggling, OS motion preferences and protected synthetic-state preservation. Actual PNG/PDF downloads and one rendered PDF page per run pass visual review. The narrow three-digit layout stress uses a temporary rendered count only and does not claim calculation or physical-device verification.

Official APK/AAB signing, source/version/package metadata, private and rejected artwork scans and original-vector inclusion pass. Release/Pages APK SHA-256: `68f44a3aa7a9e4eac215bc3ec3d1b03c0719811ecdc06f9c1eacc204a631b78f`. All 51 deployed PWA files match the release artifact. The five discarded raster flame candidates are absent from the shipped runtime.

No physical Pixel/iPhone test, phone installation, original-profile access, OS-installed PWA acceptance or native iOS build was performed. Firebase service acceptance is separate from phone receipt.
