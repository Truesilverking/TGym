import { isoOf, todayISO } from './format.js'
import { isWarmupRow } from './workout-model.js'

const DAY = 86400000
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))
const atNoon = iso => new Date(iso + 'T12:00:00')
const effectiveRoutineId = (S, iso) => {
  const ov = (S.dayPlan || {})[iso]
  if (ov === 'rest') return null
  if (ov && (S.routines || []).some(r => r.id === ov)) return ov
  return (S.week || {})[atNoon(iso).getDay()] || null
}
const matchWorkout = (S, iso, routineId) => {
  const routine = (S.routines || []).find(r => r.id === routineId)
  return (S.workouts || []).some(w => w.d === iso && (w.routineId === routineId || (!w.routineId && routine && w.name === routine.name)))
}

/** A gym-safe streak: only scheduled training days advance it; rest days neither add nor break. */
export function trainingStreak(S, now = new Date()) {
  const safe = { ...S, routines: S.routines || [], workouts: S.workouts || [], week: S.week || {}, dayPlan: S.dayPlan || {} }
  const endIso = isoOf(now)
  const firstWorkout = safe.workouts.map(w => w.d).filter(Boolean).sort()[0]
  const startIso = safe.scheduleStarted || firstWorkout || endIso
  const rows = []
  for (let i = 730; i >= 0; i--) {
    const d = new Date(now); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - i)
    const iso = isoOf(d)
    if (iso < startIso) continue
    const routineId = effectiveRoutineId(safe, iso)
    const workouts = safe.workouts.filter(w => w.d === iso)
    if (!routineId) {
      if (workouts.length) rows.push({ iso, status: 'extra', planned: false })
      continue
    }
    const completed = matchWorkout(safe, iso, routineId)
    // Today is still available to complete. It must not erase yesterday's streak at noon.
    const status = completed ? 'completed' : iso === endIso ? 'pending' : 'missed'
    rows.push({ iso, routineId, status, planned: true })
  }
  let current = 0, best = 0, run = 0
  rows.filter(r => r.planned).forEach(r => {
    if (r.status === 'completed') { run++; best = Math.max(best, run) }
    else if (r.status === 'missed') run = 0
  })
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i]
    if (!r.planned || r.status === 'pending') continue
    if (r.status !== 'completed') break
    current++
  }
  const completed = rows.filter(r => r.status === 'completed')
  const milestones = [7, 14, 30, 50, 100, 180, 365]
  return {
    current, best, rows, milestones,
    lastCompleted: completed.at(-1)?.iso || null,
    nextMilestone: milestones.find(n => n > current) || Math.ceil((current + 1) / 100) * 100,
  }
}

export function streakTier(value) {
  const n = Math.max(0, Number(value) || 0)
  if (n >= 100) return 'legend'
  if (n >= 50) return 'purple'
  if (n >= 30) return 'blue'
  if (n >= 14) return 'redgold'
  if (n >= 7) return 'orange'
  return 'yellow'
}

// A predictable recovery week: six normal weeks, then one week with a clear
// reduction in both load and volume. All values remain editable in Settings.
export const defaultDeload = () => ({ on: false, normalWeeks: 6, deloadWeeks: 1, loadPct: 80, setPct: 60, targetRir: 4, startDate: todayISO() })

function mondayOf(iso) {
  const d = atNoon(iso), shift = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - shift)
  return d
}

export function deloadStatus(S, iso = todayISO()) {
  const c = { ...defaultDeload(), ...(S.deload || {}) }
  if (!c.on || !c.startDate) return { active: false, daysUntil: null, config: c }
  const start = mondayOf(c.startDate), day = atNoon(iso)
  const weeks = Math.floor((mondayOf(iso) - start) / (7 * DAY))
  if (weeks < 0) return { active: false, daysUntil: Math.max(0, Math.ceil((start - day) / DAY)), config: c }
  const normal = clamp(Math.round(c.normalWeeks) || 6, 1, 24)
  const deload = clamp(Math.round(c.deloadWeeks) || 1, 1, 4)
  const cycle = normal + deload, phase = ((weeks % cycle) + cycle) % cycle
  const active = phase >= normal
  const nextWeek = active ? cycle - phase + normal : normal - phase
  const nextStart = new Date(mondayOf(iso)); nextStart.setDate(nextStart.getDate() + nextWeek * 7)
  return { active, week: phase + 1, cycle, daysUntil: active ? 0 : Math.max(0, Math.ceil((nextStart - day) / DAY)), nextStart: isoOf(nextStart), config: c }
}

const snap = (value, step) => Math.max(step || 0, Math.round(value / (step || 1)) * (step || 1))
const copyRow = row => ({ ...row, done: false })

/** Shape the work block after automatic progression has picked the session's top weight. */
export function applyTrainingPlan(rows, cfg, step = 2.5, deload = null) {
  let warm = rows.filter(isWarmupRow)
  let work = rows.filter(s => !isWarmupRow(s))
  if (!work.length) return rows
  if (cfg.setScheme === 'topback') {
    // The athlete chooses the number in the routine editor. The high guard only protects
    // against a corrupt imported file accidentally allocating an unbounded array.
    const topN = clamp(Math.round(cfg.topSets) || 1, 1, 99)
    const backN = clamp(Math.round(cfg.backoffSets) || 2, 1, 99)
    const topSeed = work[0]
    const topWeight = Number(topSeed.w) || Number(cfg.weight) || 0
    const pct = clamp(Number(cfg.backoffPct) || 10, 1, 50)
    const backWeight = topWeight > 0 ? snap(topWeight * (1 - pct / 100), step) : 0
    const topReps = Math.max(1, Math.round(cfg.topRepsMax || cfg.reps || topSeed.r || 1))
    const offset = backoffRepOffsetFor(cfg)
    const backReps = cfg.autoBackoffReps === false ? Math.max(1, Math.round(cfg.backoffRepsMax || cfg.reps || topReps)) : topReps + offset
    work = [
      ...Array.from({ length: topN }, () => ({ ...copyRow(topSeed), w: topWeight, r: topReps, role: 'top' })),
      ...Array.from({ length: backN }, () => ({ ...copyRow(topSeed), w: backWeight, r: backReps, role: 'backoff' })),
    ]
  }
  if (deload?.active) {
    const c = deload.config
    const pct = clamp(Number(c.setPct) || 60, 20, 100) / 100
    // Preserve both groups in a Top + Back-off prescription. Reducing a four-set 2+2 plan by
    // simply slicing it could leave two Top sets and no Back-off work at all.
    if (cfg.setScheme === 'topback') {
      const top = work.filter(s => s.role === 'top')
      const backoff = work.filter(s => s.role === 'backoff')
      const keep = group => group.slice(0, Math.max(1, Math.round(group.length * pct)))
      work = [...keep(top), ...keep(backoff)]
    } else {
      work = work.slice(0, Math.max(1, Math.round(work.length * pct)))
    }
    work = work.map(s => ({ ...s, w: s.w > 0 ? snap(s.w * clamp(Number(c.loadPct) || 90, 50, 100) / 100, step) : s.w, deload: true }))
    warm = warm.map(s => ({ ...s, w: s.w > 0 ? snap(s.w * clamp(Number(c.loadPct) || 90, 50, 100) / 100, step) : s.w, deload: true }))
  }
  return [...warm, ...work]
}

/** A session-only target for a scheduled deload. The saved routine remains untouched. */
export function deloadTargetFor(cfg, deload) {
  if (!deload?.active) return { ...cfg }
  const rir = clamp(Number(deload.config?.targetRir) || 4, 0, 10)
  const target = { ...cfg, deload: true, targetRir: rir, targetRirMin: rir, targetRirMax: rir }
  // Advanced intensifiers deliberately raise effort and fatigue, so they are omitted for the
  // deload session while remaining configured in the routine for the following week.
  delete target.intensifier
  if (target.setScheme === 'topback') {
    target.topRir = rir; target.backoffRir = rir
    target.topRirMin = rir; target.topRirMax = rir
    target.backoffRirMin = rir; target.backoffRirMax = rir
  }
  return target
}

export function repBounds(cfg, role = null) {
  if (role === 'top') return { min: Math.max(1, Number(cfg.topRepsMin) || Number(cfg.repsMin) || Number(cfg.reps) || 1), max: Math.max(1, Number(cfg.topRepsMax) || Number(cfg.reps) || 1) }
  if (role === 'backoff') {
    if (cfg.autoBackoffReps !== false && cfg.setScheme === 'topback') { const top = repBounds(cfg, 'top'), offset = backoffRepOffsetFor(cfg); return { min: top.min + offset, max: top.max + offset } }
    return { min: Math.max(1, Number(cfg.backoffRepsMin) || Number(cfg.repsMin) || Number(cfg.reps) || 1), max: Math.max(1, Number(cfg.backoffRepsMax) || Number(cfg.reps) || 1) }
  }
  if (cfg.repRange === false) {
    const exact = Math.max(1, Number(cfg.reps) || 1)
    return { min: exact, max: exact }
  }
  return { min: Math.max(1, Number(cfg.repsMin) || Number(cfg.reps) || 1), max: Math.max(1, Number(cfg.reps) || 1) }
}

export function backoffRepOffsetFor(cfg = {}) {
  if (cfg.backoffRepOffset != null && Number.isFinite(Number(cfg.backoffRepOffset))) return clamp(Math.round(Number(cfg.backoffRepOffset)), 0, 5)
  const derived = Number(cfg.backoffRepsMax) - Number(cfg.topRepsMax)
  return Number.isFinite(derived) && derived >= 0 && derived <= 5 ? Math.round(derived) : 2
}

export const repRangeEnabled = cfg => cfg?.repRange === true || (cfg?.repRange !== false && Number(cfg?.repsMin) > 0 && Number(cfg?.repsMin) < Number(cfg?.reps))

export const strictRepsFor = (S, cfg) => cfg.strictReps == null ? !!S.strictReps : !!cfg.strictReps
export function clampReps(S, cfg, set, value) {
  const n = Math.max(0, Math.round(Number(value) || 0))
  if (isWarmupRow(set)) return n
  if (!strictRepsFor(S, cfg)) return n
  const b = repBounds(cfg, set?.role)
  return clamp(n, b.min, b.max)
}

const rirHalf = value => Math.round(clamp(Number(value), 0, 10) * 2) / 2
export const targetRirRangeFor = (cfg = {}, role = null) => {
  const prefix = role === 'top' ? 'top' : role === 'backoff' ? 'backoff' : 'target'
  const legacy = cfg[`${prefix}Rir`] ?? (role ? cfg.targetRir : undefined)
  let min = cfg[`${prefix}RirMin`], max = cfg[`${prefix}RirMax`]
  if (min == null && max == null && role) { min = cfg.targetRirMin; max = cfg.targetRirMax }
  if (min == null && max == null && legacy != null && legacy !== '') min = max = legacy
  if (min == null && max == null) return null
  min = rirHalf(min ?? max); max = rirHalf(max ?? min)
  if (min > max) max = min
  return { min, max }
}

// Kept for old callers and third-party imports. A scalar target is the upper edge of the range.
export const targetRirFor = (cfg, role) => targetRirRangeFor(cfg, role)?.max ?? null

/** Simple, auditable advice. The athlete supplies RIR; TGym only compares it to the target. */
export function rirAdvice(sets, cfg) {
  const rated = (sets || []).filter(s => s.done && !isWarmupRow(s) && s.rir != null && targetRirRangeFor(cfg, s.role))
  if (!rated.length) return { kind: 'missing', delta: null, count: 0 }
  const timestamped = rated.filter(s => Number.isFinite(Number(s.doneAt)))
  const last = timestamped.length
    ? timestamped.reduce((latest, row) => Number(row.doneAt) >= Number(latest.doneAt) ? row : latest)
    : rated.at(-1)
  const range = targetRirRangeFor(cfg, last.role)
  const actual = Number(last.rir)
  const delta = actual > range.max ? actual - range.max : actual < range.min ? actual - range.min : 0
  if (actual > range.max) return { kind: 'increase', delta, count: rated.length }
  if (actual < range.min) return { kind: 'reduce', delta, count: rated.length }
  return { kind: 'maintain', delta, count: rated.length }
}
