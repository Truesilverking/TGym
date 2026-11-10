# UI/UX Normalization & AMOLED Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Normalize TGym's UI/UX geometry, typography, spacing, and clearance across all mobile and web views, eliminate visual overlap and cutoffs, and introduce a pure black (`#000000`) AMOLED theme optimized for OLED mobile displays.

**Architecture:** Extend the design token system in `frontend/src/index.css` and `frontend/src/styles/iron.css` with a dedicated `:root[data-theme="amoled"]` palette and responsive layout adaptations (`body:not(:has(#tabbar))`); standardize radius scales across views (`ProgressReport.css`, `TrainingHome.css`); fix `.workout-clock-control` and `.set-console.eff3` responsive wrapping; and integrate the AMOLED theme into `Settings.jsx`, `App.jsx`, and translations.

**Tech Stack:** React 19, CSS3 (tokens, clamp, color-mix, flexbox, CSS grid), Vitest.

**Spec:** Audited UI/UX issues in TGym:
1. AMOLED true-black theme (`#000000`) with high-contrast chalk labels and hairline borders.
2. Dynamic clearance for `#timer` and bottom content when `#tabbar` is absent (`/workout`).
3. Responsive `.workout-clock-control` geometry avoiding header wrapping on small displays.
4. `.set-console.eff3` 3-column stepper layout stacking on mobile to prevent numerical clipping.
5. `TrainingHome.css` removal of arbitrary `translateX(-4px)` and hardcoded radii.
6. `ProgressReport.css` radius and token normalization.
7. Bottom sheet safe-area clearance (`max(24px, calc(var(--sab) + 16px))`).
8. Tab bar typography scaling to prevent localized text truncation.

## Global Constraints
- Preserve existing theme tokens for `dark` and `light` themes.
- Maintain backward compatibility with `useStore` state shape (`S.theme`).
- Keep English (`english-fallback.js`) and Spanish (`es.js`) translation dictionaries synchronized.
- Ensure all Vitest tests pass without regressions (`pnpm test`).

## Review Focus
1. Switching to AMOLED theme sets `document.documentElement.dataset.theme = 'amoled'` and meta theme-color `#000000`.
2. Active workouts without bottom tab bar position `#timer` at safe-area bottom without 100px floating gap.
3. 3-column set rows (Weight + Reps + RIR) on narrow screens do not clip or truncate stepper numbers.
4. Bodyweight card on Home view renders centered without horizontal skew.
5. All modal bottom sheets allow comfortable tap clearance without overlapping system gesture bars.

---

### Task 1: AMOLED Theme Tokens and Component Styles
**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/styles/iron.css`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/views/Settings.jsx`
- Modify: `frontend/src/lib/english-fallback.js`
- Modify: `frontend/src/locales/es.js`
- Test: `frontend/src/components/ThemePreferences.test.jsx`

**Steps:**
- [x] Add `:root[data-theme="amoled"]` tokens in `frontend/src/index.css` with `--bg: #000000`, `--surface: #0f0f0e`, `--surface-2: #181816`, `--surface-3: #242422`, `--bg-el: #080808`, and micro-contrast hairlines.
- [x] Add AMOLED overrides in `frontend/src/styles/iron.css` (`#root` background `#000000`, `#tabbar` glass finish, `.card` and `.sheet` borders).
- [x] Update `resolveTheme` in `frontend/src/App.jsx` to recognize `'amoled'` and set `meta[name="theme-color"]` to `#000000`.
- [x] Add `'amoled'` option in `frontend/src/views/Settings.jsx` theme picker.
- [x] Synchronize keys `"AMOLED": "AMOLED"` in `english-fallback.js` and `es.js`.
- [x] Update `ThemePreferences.test.jsx` to assert `data-theme="amoled"` applies when `S.theme = 'amoled'`.
- [x] Verify test passes.

### Task 2: Floating Navigation & RestTimer Adaptive Clearance
**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/styles/iron.css`

**Steps:**
- [x] In `frontend/src/index.css`, add adaptive rules for `body:not(:has(#tabbar)) #timer` so it anchors to `max(14px, var(--sab))` when the navigation dock is not mounted (e.g. during active workouts).
- [x] Add adaptive `--bottom-clearance` for `body:not(:has(#tabbar))` to avoid 110px dead space at the bottom of full-screen views.
- [x] Enhance `.sheet` bottom padding to `max(24px, calc(var(--sab) + 16px))` preventing collision with mobile home navigation indicators.
- [x] Add clamp sizing to `#tabbar button span:not(.cir)` to prevent label truncation on narrow screens in Spanish.

### Task 3: Workout Header & Set Console Layout Normalization
**Files:**
- Modify: `frontend/src/views/Workout.jsx`
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/styles/iron.css`

**Steps:**
- [x] In `frontend/src/index.css` and `frontend/src/styles/iron.css`, refine `.workout-clock-control` so pause and Spotifree icon buttons are 36px with 6px gap and aligned with the timer badge.
- [x] Ensure `.set-console.eff3 .set-metric.eff` spans `1 / -1` on screens <= 480px in `frontend/src/styles/iron.css` to prevent numerical clipping in steppers.
- [x] Verify stepper numbers in 3-column rows retain minimum legible width on 360px displays.

### Task 4: View Normalization across Home and ProgressReport
**Files:**
- Modify: `frontend/src/views/TrainingHome.css`
- Modify: `frontend/src/views/ProgressReport.css`

**Steps:**
- [x] In `frontend/src/views/TrainingHome.css`, remove `transform: translateX(-4px)` from `.home-bodyweight-metric` and replace hardcoded radii (10px, 5px) with `var(--r-sm)` and `var(--r-xs)`.
- [x] In `frontend/src/views/ProgressReport.css`, replace scattered radii (14px, 16px, 18px, 20px) with unified design tokens (`--r-card`, `--r-lg`, `--r-xl`, `--r-pill`).

### Task 5: Verification & Full Suite Validation
**Files:**
- Test: All modified files and Vitest suite.

**Steps:**
- [x] Run `cd frontend; pnpm test` to verify all 266 test files pass.
- [x] Run `cd frontend; pnpm build` to verify production bundle compiles cleanly.
- [x] Inspect git diff and verify no regressions.
