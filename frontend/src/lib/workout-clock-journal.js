import { lastWorkoutInteraction, recordWorkoutInteraction } from './workout-time.js'

export const CLOCK_JOURNAL_KEY = 'gym_workout_clock_v1'
export const validClockJournal = value => !!value && typeof value === 'object' && !Array.isArray(value)
  && typeof value.id === 'string' && value.id.length > 0 && value.id.length <= 256
  && typeof value.at === 'number' && Number.isFinite(value.at) && value.at > 0
  && typeof value._ts === 'number' && Number.isFinite(value._ts) && value._ts > 0

export function readClockJournal(storage) {
  try {
    const value = JSON.parse((storage ?? globalThis.localStorage).getItem(CLOCK_JOURNAL_KEY))
    return validClockJournal(value) ? value : null
  } catch { return null }
}

export function writeClockJournal(journal, storage = globalThis.localStorage) {
  if (!validClockJournal(journal)) throw new Error('Invalid workout clock journal')
  const { id, at, _ts } = journal
  storage.setItem(CLOCK_JOURNAL_KEY, JSON.stringify({ id, at, _ts }))
}

export function overlayClockJournal(S, journal, now = Date.now()) {
  const active = S?.active
  if (!validClockJournal(journal) || !active || active.id !== journal.id || active.end != null
    || journal._ts < Number(S._ts || 0) || journal._ts > now || journal.at < Number(active.start || 0) || journal.at > now
    || journal.at <= lastWorkoutInteraction(active, now)) return S
  return { ...S, active:recordWorkoutInteraction(active, journal.at) }
}
