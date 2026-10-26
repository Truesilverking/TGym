import { workoutElapsedMs } from './workout-time.js'
import { MOBILE } from './mobile.js'
import { useStore } from '../store/useStore.js'

export const SPOTIFREE_BUS_CHANNEL = 'tgym_sync_bus'
export const SPOTIFREE_STORAGE_KEY_REST = 'tgym_active_rest'

let busChannel = null

export function getSpotifreeChannel() {
  if (busChannel) return busChannel
  if (typeof globalThis !== 'undefined' && typeof globalThis.BroadcastChannel === 'function') {
    try {
      busChannel = new globalThis.BroadcastChannel(SPOTIFREE_BUS_CHANNEL)
    } catch {
      busChannel = null
    }
  }
  return busChannel
}

export function isSpotifreeSyncEnabled() {
  try {
    const s = useStore.getState?.()?.S
    return s ? s.enableSpotifreeSync !== false : true
  } catch {
    return true
  }
}

/**
 * Emit REST_START event to BroadcastChannel and save active rest in localStorage.
 * Spotifree ducks music volume to 30% when receiving this.
 */
export function emitRestStart(seconds, endsAt, total, exerciseName = '') {
  if (!isSpotifreeSyncEnabled()) return
  const sec = Math.max(0, Math.round(Number(seconds) || 0))
  const end = endsAt != null ? Number(endsAt) : Date.now() + sec * 1000
  const tot = total != null ? Number(total) : sec
  const name = typeof exerciseName === 'string' ? exerciseName : ''

  const message = {
    type: 'REST_START',
    seconds: sec,
    endsAt: end,
    total: tot,
    exerciseName: name,
  }

  try {
    getSpotifreeChannel()?.postMessage(message)
  } catch {}

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(
        SPOTIFREE_STORAGE_KEY_REST,
        JSON.stringify({
          endsAt: end,
          total: tot,
          exerciseName: name,
          startedAt: Date.now(),
        })
      )
    }
  } catch {}
}

/**
 * Emit REST_END event to BroadcastChannel and clear active rest from localStorage.
 * Spotifree plays harmonic chime and restores volume to 100%.
 */
export function emitRestEnd() {
  if (!isSpotifreeSyncEnabled()) return

  try {
    getSpotifreeChannel()?.postMessage({ type: 'REST_END' })
  } catch {}

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SPOTIFREE_STORAGE_KEY_REST)
    }
  } catch {}
}

/**
 * Emit WORKOUT_FINISH event with duration from workout-time.js.
 * Spotifree updates workoutStreakDays upon receiving this.
 */
export function emitWorkoutFinish(workout) {
  if (!isSpotifreeSyncEnabled() || !workout) return
  const duration = workoutElapsedMs(workout)
  const message = {
    type: 'WORKOUT_FINISH',
    workout: {
      id: workout.id,
      d: workout.d,
      duration,
    },
  }

  try {
    getSpotifreeChannel()?.postMessage(message)
  } catch {}
}

/**
 * Launches Spotifree native app or opens web player fallback.
 */
export async function launchSpotifree(playlistId = 'pl-gym-beast-mode') {
  const uri = playlistId ? `spotifree://playlist/${playlistId}` : 'spotifree://'
  const webFallbackUrl = 'https://spotifree.app'

  if (typeof window !== 'undefined') {
    // 1. If running under Capacitor native runtime
    const capacitorLauncher = globalThis.Capacitor?.Plugins?.AppLauncher
    if (capacitorLauncher) {
      try {
        const canOpen = await capacitorLauncher.canOpenUrl({ url: uri })
        if (canOpen?.value) {
          await capacitorLauncher.openUrl({ url: uri })
          return true
        }
      } catch {}
    }

    if (MOBILE) {
      try {
        window.open(uri, '_system')
        return true
      } catch {}
    }

    // 2. Web / PWA browser environment
    try {
      let blurTriggered = false
      const onBlur = () => { blurTriggered = true }
      window.addEventListener('blur', onBlur, { once: true })

      window.location.href = uri

      setTimeout(() => {
        window.removeEventListener('blur', onBlur)
        if (!blurTriggered && typeof document !== 'undefined' && document.hasFocus()) {
          try {
            window.open(webFallbackUrl, '_blank', 'noopener')
          } catch {}
        }
      }, 1500)
      return true
    } catch {
      try {
        window.open(webFallbackUrl, '_blank', 'noopener')
        return true
      } catch {}
    }
  }

  return false
}
