# Working on TGym

Read `docs/ARCHITECTURE.md` before changing an unfamiliar subsystem. The source is authoritative; older upstream documentation may still refer to openGym or FrameGym.

## Structure and commands

- `frontend/`: React + Vite, shared web/PWA/Capacitor application. Run commands here with pnpm 10, matching GitHub Actions: `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm build`, `pnpm build:pwa`, `pnpm build:mobile`.
- Local standalone development: `pnpm run dev --mode standalone --host 127.0.0.1`. This uses a separate browser-local profile, without the optional API.
- `api/`: optional Node API. Install with `npm ci`; run `npm test`.
- `mcp/`: read-only MCP server reusing frontend calculation modules. Install with `npm ci`; run `npm test` and `npm run check:node-loadable`.
- There are no frontend lint or typecheck scripts. Do not claim those checks passed.
- `build:mobile` builds web assets and synchronizes Capacitor; it does not compile an APK. Android compilation runs from `frontend/android/` using the Gradle wrapper, JDK 21 and Android SDK 35. iOS native compilation requires macOS/Xcode.

## Invariants

- Preserve existing user changes. Inspect status/diff before editing; use a feature branch for substantive work. Never force-push or publish a release as a side effect of setup.
- Use `useStore.update` for normal persisted state edits. Keep localStorage, the mobile file mirror and optional server synchronization consistent.
- Keep backward compatibility with existing workout rows, legacy measurement fields and portable backups. Do not rename storage keys or native package identifiers casually.
- Workout duration comes from `lib/workout-time.js`; do not introduce a second elapsed-time calculation. Warmup rows do not determine required work completion or progression.
- Preserve exercise IDs and routine IDs across history and calculations. Display names are not reliable identities.
- Reuse the existing work, rest, superset, progression and deload helpers. Keep cardio/time/repetition modes and intensity techniques distinct.
- Keep locale keysets synchronized; use existing theme variables and reduced-motion behavior.
- Never commit credentials, signing material, OAuth tokens, private backups or local SDK paths. Do not print their contents during diagnostics.
- Run targeted tests after relevant changes, then the complete applicable checks before final delivery. Do not repeatedly run unchanged successful baselines.
- Android update validation (trusted download hosts, SHA-256, package identity, newer version and installed signing identity) must remain intact.

## Review workflow

Explain the affected data flow, make the smallest coherent change, inspect the diff, run appropriate tests and build, then test the user flow. Commit/push only within the user's requested scope. Verify remote commit and relevant Actions when publishing changes.
