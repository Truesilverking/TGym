import { workoutElapsedMs } from './workout-time.js'
import { MOBILE } from './mobile.js'
import { useStore } from '../store/useStore.js'

export const SPOTIFREE_BUS_CHANNEL = 'tgym_sync_bus'
export const SPOTIFREE_STORAGE_KEY_REST = 'tgym_active_rest'

// This bridge reaches compatible receivers on this origin/partition only.
// It cannot control a player on another website or in a separate native app.
let busChannel = null
let restActive = false
let stopObservingPreferences = null
const finishedWorkouts = new Set()
const number = value => { try { return Number(value) } catch { return NaN } }

export function isSpotifreeSyncEnabled() {
  try {
    const state = useStore.getState?.()?.S
    return !!state && state.enableSpotifreeSync !== false
  } catch { return false }
}

export function getSpotifreeChannel() {
  observePreferences()
  if (!isSpotifreeSyncEnabled()) return null
  if (!busChannel && typeof globalThis.BroadcastChannel === 'function') {
    try { busChannel = new globalThis.BroadcastChannel(SPOTIFREE_BUS_CHANNEL) } catch {}
  }
  return busChannel
}

function closeChannel() {
  try { busChannel?.close() } catch {}
  busChannel = null
}

function post(message) {
  try { getSpotifreeChannel()?.postMessage(message) } catch {}
  finally { closeChannel() }
}

export function clearSpotifreeRest() {
  restActive = false
  try { globalThis.localStorage?.removeItem(SPOTIFREE_STORAGE_KEY_REST) } catch {}
  closeChannel()
}

// Install only when the bridge is used. Importing a launch button must not
// require a fully initialized/subscribable store or perform storage writes.
function observePreferences() {
  if (stopObservingPreferences || typeof useStore.subscribe !== 'function') return
  stopObservingPreferences = useStore.subscribe((state, previous) => {
    if (state.S?.enableSpotifreeSync === false && previous?.S?.enableSpotifreeSync !== false) clearSpotifreeRest()
  })
}

/** Prepare an optional same-origin rest event; no external player is controlled. */
export function emitRestStart(seconds, endsAt, total, exerciseName = '') {
  observePreferences()
  if (!isSpotifreeSyncEnabled()) { clearSpotifreeRest(); return }
  const sec = Math.ceil(number(seconds))
  const now = Date.now()
  const end = endsAt == null ? now + sec * 1000 : number(endsAt)
  const tot = total == null ? sec : number(total)
  if (!Number.isFinite(sec) || sec <= 0 || !Number.isFinite(end) || end <= now || !Number.isFinite(tot) || tot <= 0) return
  const name = typeof exerciseName === 'string' ? exerciseName : ''
  restActive = true
  post({ type: 'REST_START', seconds: sec, endsAt: end, total: tot, exerciseName: name })
  try {
    globalThis.localStorage?.setItem(SPOTIFREE_STORAGE_KEY_REST,
      JSON.stringify({ endsAt: end, total: tot, exerciseName: name, startedAt: now }))
  } catch {}
}

/** End an announced rest once; idle stops must not signal a completed rest. */
export function emitRestEnd() {
  let stored = false
  try {
    const rest = JSON.parse(globalThis.localStorage?.getItem(SPOTIFREE_STORAGE_KEY_REST) || 'null')
    stored = Number.isFinite(rest?.endsAt) && rest.endsAt > Date.now() && Number.isFinite(rest.total) && rest.total > 0
  } catch {}
  if (isSpotifreeSyncEnabled() && (restActive || stored)) post({ type: 'REST_END' })
  clearSpotifreeRest()
}

/** Emit only a completed saved session, using the shared authoritative clock. */
export function emitWorkoutFinish(workout) {
  if (!isSpotifreeSyncEnabled() || !workout || typeof workout.id !== 'string' || !workout.id ||
    typeof workout.d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(workout.d) ||
    !Number.isFinite(workout.start) || !Number.isFinite(workout.end) || workout.end < workout.start) return
  const duration = workoutElapsedMs(workout)
  if (!Number.isFinite(duration)) return
  const key = workout.id + ':' + workout.d
  if (finishedWorkouts.has(key)) return
  finishedWorkouts.add(key)
  if (finishedWorkouts.size > 100) finishedWorkouts.delete(finishedWorkouts.values().next().value)
  post({ type: 'WORKOUT_FINISH', workout: { id: workout.id, d: workout.d, duration } })
}

/** Request a launch after a user click; this does not confirm app/playback success. */
export async function launchSpotifree(playlistId = null) {
  if (typeof window === 'undefined') return false
  if (playlistId != null && (typeof playlistId !== 'string' || !/^[\w-]{1,128}$/.test(playlistId))) return false
  const uri = playlistId ? 'spotifree://playlist/' + encodeURIComponent(playlistId) : 'spotifree://'
  const webFallbackUrl = 'https://spotifree.app'
  const launcher = globalThis.Capacitor?.Plugins?.AppLauncher
  if (MOBILE && launcher?.canOpenUrl && launcher?.openUrl) {
    try {
      if ((await launcher.canOpenUrl({ url: uri }))?.value) {
        const result = await launcher.openUrl({ url: uri })
        if (result?.completed === true) return true
      }
    } catch {}
  }
  try {
    if (MOBILE) {
      const { Browser } = await import('@capacitor/browser')
      await Browser.open({ url: webFallbackUrl })
    } else {
      // Delayed fallback popups lose user activation. Keep training on this page.
      window.open(webFallbackUrl, '_blank', 'noopener,noreferrer')
    }
    return true
  } catch { return false }
}
