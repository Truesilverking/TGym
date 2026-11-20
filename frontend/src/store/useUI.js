import { emitRestStart, emitRestEnd, clearSpotifreeRest } from '../lib/spotifree-sync.js'
import { create } from 'zustand'
import { uid } from '../lib/format.js'
import { playAppSound, vibrate } from '../lib/sound.js'
import { createTimerPushClient } from '../lib/server-timer-push.js'
import { t } from '../lib/i18n.js'
import { useStore } from './useStore.js'
import { resumeWorkoutClock, recordWorkoutActivity } from '../lib/workout-time.js'
import {syncWorkoutNotification} from '../lib/workout-notification.js'
import { notifyTimerFinished, requestTimerNotificationPermission } from '../lib/browser-notifications.js'

// Optional server alerts require the existing authenticated push subscription.
// Static/guest/native timers make no server requests and retain local deadlines.
const pushTimer = createTimerPushClient(()=>useStore.getState().user)
const pushRestTimer = (sec, endsAt) => { void pushTimer('rest',sec,endsAt) }
const cancelPushRestTimer = () => { void pushTimer('rest') }
const timerNumber = value => { try { return Number(value) } catch { return NaN } }

const signalTimerFinished = (prefs, event, occurrence) => {
  const notice = notifyTimerFinished(prefs, event, occurrence)
  if (notice === false) { void playAppSound(prefs, event, { occurrence }); return }
  void Promise.resolve(notice).then(shown => { if (!shown) return playAppSound(prefs, event, { occurrence }) })
}

// Persist deadlines, not ticking seconds. This optional field is backward compatible.
const saveRest = timer => {
  const store=useStore.getState()
  if (!store.S.active || (!timer && !store.S.active.restTimer)) return
  store.update(s => {
    if (!s.active) return
    if (timer) s.active.restTimer={endsAt:timer.endsAt,total:timer.total,exerciseName:timer.exerciseName || ''}
    else if (s.active.restTimer) {
      const end = s.active.restTimer.endsAt
      if (Number.isFinite(end)) s.active.lastRestEndedAt=Math.min(Date.now(),end)
      delete s.active.restTimer
    }
  }, true, false)
}

let toastTm = null
let timerInt = null
let timerTick = null
let workInt = null
let workTick = null
let workDone = null

export const useUI = create((set, get) => ({
  sheets: [],          // { id, render:(close)=>JSX, kind:'sheet'|'center', locked }
  toastMsg: '',
  timer: null,         // rest countdown between sets — { left, total, endsAt }
  work: null,          // work countdown DURING a timed set (issue #16) — { left, total, endsAt, label }

  openSheet(render, { kind = 'sheet', locked = false, onClose } = {}) {
    const id = uid()
    set(s => ({ sheets: [...s.sheets, { id, render, kind, locked, onClose }] }))
    const close = () => get().closeSheet(id)
    return { id, close, lock: v => set(s => ({ sheets: s.sheets.map(x => x.id === id ? { ...x, locked: v } : x) })) }
  },
  closeSheet(id) {
    const sheet = get().sheets.find(x => x.id === id)
    set(s => ({ sheets: s.sheets.filter(x => x.id !== id) }))
    sheet?.onClose?.()
  },
  closeAll() {
    const sheets = get().sheets
    set({ sheets: [] })
    sheets.forEach(sheet => sheet.onClose?.())
  },

  toast(msg) {
    set({ toastMsg: msg })
    clearTimeout(toastTm)
    toastTm = setTimeout(() => set({ toastMsg: '' }), 2200)
  },

  startRest(sec, restored = null, exerciseName = '') {
    sec = timerNumber(sec)
    if (!Number.isFinite(sec)) return
    get().stopRest(!(sec > 0))
    // Rest timer set to Off. Stopping and returning rather than starting a zero-length timer
    // keeps every caller honest: the four places that start a rest do not each need to know.
    if (!(sec > 0)) return
    const endsAt = timerNumber(restored?.endsAt ?? Date.now() + sec * 1000)
    const total = timerNumber(restored?.total ?? sec)
    if (!Number.isFinite(endsAt) || endsAt <= Date.now() || !Number.isFinite(total) || total <= 0) { clearSpotifreeRest(); return }
    const exName = exerciseName || restored?.exerciseName || ''
    const timer = { left: sec, total, endsAt, exerciseName: exName }
    saveRest(timer)
    set({ timer })
    void syncWorkoutNotification(useStore.getState().S.active,timer,{interactive:!restored})
    if (!restored) void requestTimerNotificationPermission()
    pushRestTimer(sec,endsAt)
    emitRestStart(sec, endsAt, timer.total, exName)
    timerTick = () => {
      const tm = get().timer
      if (!tm) return
      const left = Math.max(0, Math.ceil((tm.endsAt - Date.now()) / 1000))
      if (left === tm.left) return
      const prefs = useStore.getState().S
      if (left <= 0) {
        signalTimerFinished(prefs, 'rest', tm.endsAt)
        get().toast(t('Rest over — next set!')); get().stopRest(); return
      }
      if (left <= 3) void playAppSound(prefs, 'countdown')
      set({ timer: { ...tm, left } })
    }
    timerInt = setInterval(timerTick, 1000)
    document.addEventListener('visibilitychange', timerTick)
  },
  addRest(sec) {
    sec = timerNumber(sec)
    if (!Number.isFinite(sec)) return
    const tm = get().timer
    if (!tm) return
    const left = Math.ceil((tm.endsAt - Date.now()) / 1000) + sec
    // taking off more than is left means "I'm ready now" — same as skipping, and it keeps a
    // negative duration out of both the progress bar and the server-side push schedule
    if (left <= 0) { get().stopRest(); return }
    if (!Number.isFinite(left) || !Number.isFinite(tm.total + sec) || !Number.isFinite(tm.endsAt + sec * 1000)) return
    set({ timer: { ...tm, left, total: tm.total + sec, endsAt: tm.endsAt + sec * 1000 } })
    saveRest(get().timer)
    void syncWorkoutNotification(useStore.getState().S.active,get().timer)
    pushRestTimer(left,tm.endsAt+sec*1000)
    emitRestStart(left, tm.endsAt + sec * 1000, tm.total + sec, tm.exerciseName || '')
  },
  stopRest(announceEnd = true) {
    if (timerInt) clearInterval(timerInt); timerInt = null
    if (timerTick) document.removeEventListener('visibilitychange', timerTick); timerTick = null
    if (get().timer) cancelPushRestTimer()
    saveRest(null)
    set({ timer: null })
    void syncWorkoutNotification(useStore.getState().S.active,null)
    if (announceEnd) emitRestEnd()
  },
  restoreRest() {
    if (get().timer) return
    const saved=useStore.getState().S.active?.restTimer
    if (!saved) { clearSpotifreeRest(); return }
    if (!Number.isFinite(saved.endsAt) || saved.endsAt <= Date.now()) { saveRest(null); clearSpotifreeRest(); return }
    get().startRest(Math.ceil((saved.endsAt-Date.now())/1000), saved, saved.exerciseName || '')
  },

  /* ---- work timer (issue #16) ----
     Times the set itself, not the recovery after it. Kept separate from the rest timer on
     purpose: the two mean opposite things, they must never run together, and a work set is
     something you are watching. A connected, opted-in PWA can also receive a distinct
     work-timer push if its page is suspended; this never completes a set on the server.
     `onDone(elapsedSec, { timedOut })` is called both at zero and on an early
     finish; the elapsed time is what actually gets logged, so stopping at 0:38 of a 0:45
     hold records 0:38 rather than crediting the full target. A natural finish already
     plays its work alert; callers must not replace it with the set-completed cue. */
  startWork(sec, label, onDone, userInitiated = true, getLabel = null) {
    sec = timerNumber(sec)
    if (!Number.isFinite(sec) || !Number.isFinite(Date.now() + Math.max(1, Math.round(sec) || 1) * 1000)) return
    get().stopWork()
    get().stopRest()
    const total = Math.max(1, Math.round(sec) || 1)
    const endsAt = Date.now() + total * 1000
    useStore.getState().update(s=>{ if(s.active) { if(userInitiated) { s.active=resumeWorkoutClock(s.active); s.active=recordWorkoutActivity(s.active) }; s.active.workEndsAt=endsAt } })
    workDone = onDone
    // The optional reader keeps exercise presentation live when names/preferences change.
    // It is ephemeral UI state; the timer deadline and completion callback stay untouched.
    set({ work: { left: total, total, endsAt, label, getLabel } })
    void pushTimer('work',total,endsAt)
    void syncWorkoutNotification(useStore.getState().S.active,null,{interactive:userInitiated})
    if (userInitiated) void requestTimerNotificationPermission()
    workTick = () => {
      const wk = get().work
      if (!wk) return
      if (!useStore.getState().S.active) { get().stopWork(); return }
      const left = Math.max(0, Math.ceil((wk.endsAt - Date.now()) / 1000))
      if (left === wk.left) return
      const prefs = useStore.getState().S
      if (left <= 0) {
        signalTimerFinished(prefs, 'work', wk.endsAt)
        const done = workDone
        get().stopWork()
        if (done) done(wk.total, { timedOut: true, completedAt: wk.endsAt })
        return
      }
      if (left <= 3) void playAppSound(prefs, 'countdown')
      set({ work: { ...wk, left } })
    }
    workInt = setInterval(workTick, 1000)
    document.addEventListener('visibilitychange', workTick)
  },
  // Ended the hold early — log what was actually held.
  finishWorkEarly() {
    const wk = get().work
    if (!wk) return
    // The WebView may suspend ticks. The deadline remains authoritative even if
    // the user finishes before the first resumed render updates `left`.
    const elapsed = Math.min(wk.total, Math.max(1, Math.round(wk.total - (wk.endsAt - Date.now()) / 1000)))
    const done = workDone
    vibrate(30)
    get().stopWork()
    if (done) done(elapsed, { timedOut: false })
  },
  // Abandon without logging anything.
  stopWork() {
    if (get().work) void pushTimer('work')
    if (get().work) useStore.getState().update(s=>{ if(s.active) { s.active.lastWorkEndedAt=Math.min(Date.now(),get().work.endsAt); delete s.active.workEndsAt } })
    if (workInt) clearInterval(workInt); workInt = null
    if (workTick) document.removeEventListener('visibilitychange', workTick); workTick = null
    workDone = null
    set({ work: null })
    void syncWorkoutNotification(useStore.getState().S.active,get().timer)
  }
}))
