import { loggedWorkouts } from './daily-plan.js'
import { isoOf } from './format.js'
import { hasWorkoutActivity } from './session-activity.js'
import { statisticsState, validDate } from './training-history.js'

// These are equivalents of the existing activity-day streak, not calendar periods.
export const STREAK_CONFIG = Object.freeze({
  daysPerWeek: 7,
  daysPerMonth: 30,
  firstMilestoneWeeks: 2,
  milestoneMultiplier: 2,
})

const countOf = value => Number.isSafeInteger(value) && value >= 0 ? value : 0
const idOf = value => typeof value === 'string' && value ? value : Number.isSafeInteger(value) ? value : null
const identityOf = value => typeof value + ':' + value
const unique = values => [...new Set(values)]
const datesOf = values => unique((Array.isArray(values) ? values : []).filter(validDate)).sort()
const idsOf = values => unique((Array.isArray(values) ? values : []).map(idOf).filter(id => id !== null))
  .sort((a, b) => identityOf(a) < identityOf(b) ? -1 : identityOf(a) > identityOf(b) ? 1 : 0)

export function streakMilestonesThrough(value) {
  const days = countOf(value), result = []
  let weeks = STREAK_CONFIG.firstMilestoneWeeks
  while (Number.isSafeInteger(weeks * STREAK_CONFIG.daysPerWeek) && weeks * STREAK_CONFIG.daysPerWeek <= days) {
    result.push({ weeks, days: weeks * STREAK_CONFIG.daysPerWeek })
    weeks *= STREAK_CONFIG.milestoneMultiplier
  }
  return result
}

export function streakPeriod(value) {
  const days = countOf(value)
  const unit = days >= STREAK_CONFIG.daysPerMonth ? 'month' : days >= STREAK_CONFIG.daysPerWeek ? 'week' : 'day'
  const divisor = unit === 'month' ? STREAK_CONFIG.daysPerMonth : unit === 'week' ? STREAK_CONFIG.daysPerWeek : 1
  return { unit, value: Math.floor(days / divisor), remainder: days % divisor, days }
}

const thresholdOf = value => streakMilestonesThrough(countOf(value)).at(-1)?.days || 0

function mergeEpisodes(a, b) {
  const dates = datesOf([...a.dates, ...b.dates])
  return {
    id: a.id,
    from: [a.from, b.from, dates[0]].filter(validDate).sort()[0],
    through: [a.through, b.through, dates.at(-1)].filter(validDate).sort().at(-1),
    dates,
    workoutIds: idsOf([...a.workoutIds, ...b.workoutIds]),
    consumedThrough: Math.max(a.consumedThrough, b.consumedThrough),
    observedCount: Math.max(a.observedCount, b.observedCount),
  }
}

// Backup data is untrusted. The old global streakCelebrations array is deliberately
// absent here: its numeric entries describe the previous day-based celebrations.
export function normalizeStreakMilestoneLedger(value) {
  const episodes = []
  if (value?.version !== 1 || !Array.isArray(value.episodes)) return { version: 1, episodes }
  for (const raw of value.episodes) {
    if (!raw || typeof raw.id !== 'string' || !raw.id) continue
    const dates = datesOf(raw.dates), workoutIds = idsOf(raw.workoutIds)
    const from = [raw.from, dates[0]].filter(validDate).sort()[0]
    const through = [raw.through, dates.at(-1)].filter(validDate).sort().at(-1)
    if (!from || !through || from > through) continue
    const episode = { id: raw.id, from, through, dates, workoutIds,
      consumedThrough: thresholdOf(raw.consumedThrough), observedCount: countOf(raw.observedCount) }
    const duplicate = episodes.findIndex(e => e.id === episode.id)
    if (duplicate >= 0) episodes[duplicate] = mergeEpisodes(episodes[duplicate], episode)
    else episodes.push(episode)
  }
  return { version: 1, episodes }
}

function activityWorkouts(state, now) {
  const safe = { ...state, workouts: Array.isArray(state?.workouts) ? state.workouts : [] }
  return loggedWorkouts(statisticsState(safe, isoOf(now))).filter(hasWorkoutActivity)
}

function currentRun(streak, state, now) {
  const rows = Array.isArray(streak?.rows) ? streak.rows : []
  let boundary = -1
  rows.forEach((r, i) => { if (r?.status !== 'completed' && r?.status !== 'pending') boundary = i })
  const dates = datesOf(rows.slice(boundary + 1).filter(r => r?.status === 'completed').map(r => r.iso))
  const allCompleted = datesOf(rows.filter(r => r?.status === 'completed').map(r => r.iso))
  const workouts = activityWorkouts(state, now).filter(w => dates.includes(w.d))
  const recordedDates = new Set(workouts.map(w => w.d))
  const valid = Number.isSafeInteger(streak?.current) && streak.current === dates.length && dates.every(d => recordedDates.has(d))
  return { dates, allCompleted, workouts, workoutIds: idsOf(workouts.map(w => w.id)),
    count: valid ? dates.length : 0, valid, from: dates[0], through: dates.at(-1),
    breakDate: rows[boundary]?.iso }
}

const overlaps = (episode, run) => run.workoutIds.some(id => episode.workoutIds.includes(id)) ||
  (run.from <= episode.through && run.through >= episode.from) ||
  // Removing every old record must not invent a break on an unscheduled/rest day.
  (run.from > episode.through && (!run.breakDate || run.breakDate <= episode.through))

function newEpisodeId(ledger, run) {
  const base = 'streak:' + run.from + ':' + encodeURIComponent(identityOf(run.workoutIds[0] ?? run.from))
  let id = base, suffix = 1
  while (ledger.episodes.some(e => e.id === id)) id = base + ':' + suffix++
  return id
}

function reconcile(ledger, run, consumeGrowth) {
  if (!run.valid || !run.count) return null
  const matches = ledger.episodes.filter(e => overlaps(e, run))
  let episode = matches[0]
  if (episode) {
    for (const match of matches.slice(1)) episode = mergeEpisodes(episode, match)
    ledger.episodes = ledger.episodes.filter(e => !matches.includes(e))
    if (consumeGrowth && thresholdOf(run.count) > thresholdOf(episode.observedCount)) {
      episode.consumedThrough = Math.max(episode.consumedThrough, thresholdOf(run.count))
    }
    episode = mergeEpisodes(episode, { ...episode, from: run.from, through: run.through,
      dates: run.dates, workoutIds: run.workoutIds })
  } else {
    // A legacy profile's first observation sets a baseline without a celebration.
    episode = { id: newEpisodeId(ledger, run), from: run.from, through: run.through,
      dates: [...run.dates], workoutIds: [...run.workoutIds], consumedThrough: 0, observedCount: 0 }
  }
  // A deletion followed by restoration is an observation of the same counter.
  episode.observedCount = Math.max(episode.observedCount, run.count)
  ledger.episodes.push(episode)
  return episode
}

/**
 * Pure evaluation. The caller persists the returned ledger through useStore.update.
 * beforeState/beforeStreak must describe the state immediately before this same
 * successful, explicit Finish save and use the same clock as afterStreak.
 */
export function evaluateStreakMilestones(afterStreak, state, options = {}) {
  const now = options.now instanceof Date && Number.isFinite(options.now.getTime()) ? options.now : new Date()
  const ledger = normalizeStreakMilestoneLedger(state?.streakMilestoneLedger)
  const before = options.beforeStreak && options.beforeState ? currentRun(options.beforeStreak, options.beforeState, now) : null
  if (before) reconcile(ledger, before, true)
  const seenIds = new Set(ledger.episodes.flatMap(e => e.workoutIds))
  const after = currentRun(afterStreak, state, now)
  const completedWorkoutId = idOf(options.completedWorkoutId)
  const completed = after.workouts.find(w => idOf(w.id) === completedWorkoutId)
  const newDates = before ? after.dates.filter(d => !before.allCompleted.includes(d)) : []
  const alreadyRecorded = before && activityWorkouts(options.beforeState, now).some(w => idOf(w.id) === completedWorkoutId)
  const eligible = options.explicitCompletion === true && options.silent !== true && completedWorkoutId !== null && before?.valid && after.valid && completed &&
    !seenIds.has(completedWorkoutId) && !alreadyRecorded && after.count > before.count &&
    newDates.length === 1 && newDates[0] === completed.d
  const episode = reconcile(ledger, after, !eligible && options.silent !== true)
  let claim = null
  if (eligible && episode) {
    const milestone = streakMilestonesThrough(after.count).filter(m => m.days > episode.consumedThrough).at(-1)
    if (milestone) {
      // Advancing through the highest pending threshold acknowledges all lower ones.
      episode.consumedThrough = milestone.days
      claim = { episodeId: episode.id, workoutId: completedWorkoutId, weeks: milestone.weeks, days: milestone.days,
        nextWeeks: milestone.weeks * STREAK_CONFIG.milestoneMultiplier }
    }
  }
  return { ledger, claim, episodeId: episode?.id || null }
}

// Recheck an open summary against live history. Read-only reconciliation cannot
// revive a claim whose workout disappeared, whose count fell, or whose run changed.
export function isCurrentStreakMilestone(claim, streak, state, now = new Date()) {
  if (!claim || idOf(claim.workoutId) === null || thresholdOf(claim.days) !== claim.days || claim.days < STREAK_CONFIG.firstMilestoneWeeks * STREAK_CONFIG.daysPerWeek) return false
  const result = evaluateStreakMilestones(streak, state, { now })
  const episode = result.ledger.episodes.find(e => e.id === result.episodeId)
  return !!episode && episode.id === claim.episodeId && episode.consumedThrough === claim.days &&
    countOf(streak?.current) >= claim.days && currentRun(streak, state, now).workouts.some(w => idOf(w.id) === claim.workoutId)
}
