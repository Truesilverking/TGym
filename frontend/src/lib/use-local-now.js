import { useEffect, useReducer } from 'react'
import { isoOf, localTZ } from './format.js'

const clockKey = now => `${isoOf(now)}|${now.getTimezoneOffset()}|${localTZ()}`

// Calendar calculations need a fresh render after a local-day or timezone change,
// including a suspended app returning to the foreground. This clock is UI-only.
export function useLocalNow() {
  const [, invalidate] = useReducer(value => value + 1, 0)
  const now = new Date(), renderedKey = clockKey(now)
  useEffect(() => {
    let disposed = false, midnightTimer, previous = renderedKey
    const scheduleMidnight = () => {
      clearTimeout(midnightTimer)
      if (disposed || document.visibilityState === 'hidden') return
      const instant = new Date(), midnight = new Date(instant)
      midnight.setHours(24,0,0,0)
      midnightTimer = setTimeout(() => {
        refresh(false)
        scheduleMidnight()
      }, Math.max(1,+midnight - +instant + 1))
    }
    const refresh = force => {
      if (disposed || document.visibilityState === 'hidden') return
      const next = clockKey(new Date())
      if (force || next !== previous) {
        previous = next
        invalidate()
        scheduleMidnight()
      }
    }
    const resume = () => refresh(true)
    const visibility = () => {
      if (document.visibilityState === 'hidden') clearTimeout(midnightTimer)
      else resume()
    }
    const poll = setInterval(() => refresh(false),30000)
    document.addEventListener('visibilitychange',visibility)
    window.addEventListener('focus',resume)
    window.addEventListener('pageshow',resume)
    // The local day or timezone may have changed between render and this effect.
    refresh(false)
    scheduleMidnight()
    return () => {
      disposed = true
      clearInterval(poll)
      clearTimeout(midnightTimer)
      document.removeEventListener('visibilitychange',visibility)
      window.removeEventListener('focus',resume)
      window.removeEventListener('pageshow',resume)
    }
  }, [])
  return now
}
