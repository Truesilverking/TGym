# Critical & High Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve all 8 Critical and High severity findings from the repository audit in TGym, covering data loss risks, cloud sync race conditions, unilateral 1RM calculations, historical rep edits, pairing dead ends, and MCP/API scale issues.

**Architecture:** Apply minimal, targeted fixes across `frontend/src/views/Settings.jsx`, `frontend/src/components/RestoreSheet.jsx`, `frontend/src/lib/onerm.js`, `frontend/src/sheets.jsx`, `mcp/src/state.js`, `mcp/src/tools.js`, and `api/server.js`. Each fix preserves backward compatibility, adheres to established store conventions (`useStore`), and adds unit test coverage.

**Tech Stack:** React 19, Vite, Vitest, Node.js (test runner), Model Context Protocol SDK.

**Spec:** Repository audit report findings 1 through 8.

## Global Constraints

- Never break backward compatibility for existing workout entries or legacy fields.
- Use `useStore.update` / `replaceState` for persisted state changes.
- Maintain `Dev` branch stability; do not create unnecessary branch proliferation.
- Do not introduce new dependencies.

## Review Focus

1. Accidental data loss during "Reset demo data" tap in Settings.
2. Local state corruption when Google Drive upload fails during two-way sync.
3. Rep counting inaccuracies on unilateral exercises (`side: true`) in 1RM formulas and history editing.
4. Parity between frontend calculations and MCP tools (filtering warmups and cancelled workouts).
5. File write atomicity and event-loop blocking in the self-hosted API server.

---

### Task 1: Remove unprotected "Reset demo data" button in production Settings

**Files:**
- Modify: `frontend/src/views/Settings.jsx:406-412`
- Test: `frontend/src/views/Settings.security.test.jsx`

- [ ] Write unit test in `Settings.security.test.jsx` verifying that `Reset demo data` is not rendered in the Data section for non-demo users.
- [ ] Remove duplicate `Reset demo data` row in `Settings.jsx` (lines 406-412).
- [ ] Run `npx vitest run src/views/Settings.security.test.jsx` and ensure it passes.

---

### Task 2: Fix Google Drive merge write order and server-sync dirty flag

**Files:**
- Modify: `frontend/src/components/RestoreSheet.jsx:45-52`
- Test: `frontend/src/components/RestoreSheet.flow.test.jsx`

- [ ] Write unit test in `RestoreSheet.flow.test.jsx` ensuring that if `backupToGoogleDrive` fails during merge, local state is untouched and undo snapshot is not consumed.
- [ ] In `RestoreSheet.jsx` (`saveMerged`), await `backupToGoogleDrive` before calling `replaceState`, and pass `push = true` so server sync dirty flag is set.
- [ ] Run `npx vitest run src/components/RestoreSheet.flow.test.jsx` and ensure it passes.

---

### Task 3: Correct unilateral 1RM calculations for legacy per-side exercises

**Files:**
- Modify: `frontend/src/lib/onerm.js:46-54`
- Test: `frontend/src/lib/onerm.test.js`

- [ ] Write unit test in `onerm.test.js` covering legacy per-side entries (`side: true` without `repsPerSide`).
- [ ] Update `bestSetOf` in `onerm.js` to divide `s.r` by 2 when `target.side && !target.repsPerSide`.
- [ ] Run `npx vitest run src/lib/onerm.test.js` and ensure it passes.

---

### Task 4: Fix history workout editor reps conversion for unilateral exercises

**Files:**
- Modify: `frontend/src/sheets.jsx:1400`
- Test: `frontend/src/views/Workout.test.jsx`

- [ ] Update `NumberField` in `WorkoutDetail` (`sheets.jsx:1400`) to pass reps through `displayReps` and `storedReps`.
- [ ] Run `npx vitest run src/views/Workout.test.jsx` and ensure it passes.

---

### Task 5: Remove dead web mobile-pairing sheet and unused destructuring

**Files:**
- Modify: `frontend/src/views/Settings.jsx:116, 229-230, 565-582`
- Test: `frontend/src/views/Settings.ux.test.jsx`

- [ ] Remove unused `PairSheet` and "Pair the mobile app" row from `Settings.jsx`.
- [ ] Remove unused `disconnectServer` destructuring on line 116.
- [ ] Run `npx vitest run src/views/Settings.ux.test.jsx` and ensure it passes.

---

### Task 6: Parity for MCP tools on warmups, cancelled workouts, and aliases

**Files:**
- Modify: `mcp/src/tools.js:49-68, 188, 333, 370`
- Test: `mcp/test/tools.test.js`

- [ ] Update `prTable` to reuse `bestSetOf` (skipping warmups and non-rep sets).
- [ ] Use `loggedWorkouts(S)` in `listWorkouts`, `trainedAtAll`, and `muscleBalance`.
- [ ] Support user aliases (`S.exerciseAliases[ex.id]`) in exercise display names.
- [ ] Add unit test in `mcp/test/tools.test.js` testing warmups, cancelled sessions, and aliases.
- [ ] Run `npm test` in `mcp/` and ensure all tests pass.

---

### Task 7: Register custom exercises in MCP state into `EXIDX`

**Files:**
- Modify: `mcp/src/state.js`
- Test: `mcp/test/tools.test.js`

- [ ] Import `registerCustom` from `../../frontend/src/lib/exercises.js` in `mcp/src/state.js`.
- [ ] Call `registerCustom(_state?.customEx || [])` during `init()`, `getState()`, and `_seedStateForTests()`.
- [ ] Add unit test in `mcp/test/tools.test.js` validating custom exercise lookup.
- [ ] Run `npm test` and `npm run check:node-loadable` in `mcp/`.

---

### Task 8: Secure API server `atomicWrite` and cache 10-second reminder state reads

**Files:**
- Modify: `api/server.js:54-63, 732`
- Test: `api/http-audit.test.js`

- [ ] Use unique temporary filenames in `atomicWrite` using process PID and sequence counter.
- [ ] Implement mtime-based state caching for `readState` to prevent synchronous parsing spikes.
- [ ] Invalidate cache in `PUT /api/data`.
- [ ] Run `npm test` in `api/` and ensure all 16 tests pass.
