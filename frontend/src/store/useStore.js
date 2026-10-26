import { refreshActiveBackoffReps } from '../lib/training-plan.js'
import { bindExerciseNameState } from '../lib/exercise-name-state.js'
import { create } from 'zustand'
import { migrateState, STATE_SCHEMA } from '../lib/state-migrations.js'
import { loadWebState, saveWebState } from '../lib/web-state.js'
import { compactProfile, hasProfileResources, hydrateProfile, isQuotaError, retainProfileResources, stageProfileResources, storageFailure } from '../lib/profile-resources.js'
import { DEFAULT_SOUNDS } from '../lib/sound-preferences.js'
import { api, setRemoteAuth } from '../lib/api.js'
import { localTZ } from '../lib/format.js'
import { registerCustom } from '../lib/exercises.js'
import { DEMO, DEMO_SEEDED, STANDALONE } from '../lib/demo.js'
import { guestAllowed } from '../lib/guest.js'
import { MOBILE, nativeLoad, nativeSave, nativeClockJournalAvailable, nativeSaveClockJournal, syncReminder, writeAutoBackup } from '../lib/mobile.js'
import { CLOCK_JOURNAL_KEY, readClockJournal, writeClockJournal, overlayClockJournal } from '../lib/workout-clock-journal.js'
import { loadRemote, chooseLocal, forgetRemote, connect } from '../lib/remote.js'
import { shouldRestoreNative } from '../lib/native-state.js'
import { portableState, backupChecksum } from '../lib/backup.js'
import { sessionTiming, recordWorkoutInteraction, inactivityDeadline } from '../lib/workout-time.js'
import { reconcileWorkoutEdit, reconcileWorkoutClock } from '../lib/workout-lifecycle.js'
import { sessionOrigin } from '../lib/session-activity.js'
import { rebaseEmptyApiProfile } from '../lib/api-bootstrap.js'

const KEY = 'gym_state_v1'
export const DEF = {
  storageVersion: STATE_SCHEMA, hasCompletedOnboarding: false, hasCompletedAppTour: false, healthConnection: {},
  inAppReminderMode:'both', inAppReminderDismissed:[], streakCalendarShowProfile:false, notificationSoundOn:true,
  unit: 'kg', restSec: 90, restPauseSec: 15, restAdvanced: { warmup: 45, supersetMove: 0, supersetRound: 120 }, sound: true, vibration: true, reduceMotion: false, keepAwake: true, lang: 'es',
  sounds: { ...DEFAULT_SOUNDS }, customSounds: [], soundVolume: 1, soundMuted: false,
  theme: 'dark', accent: 'red', body: 'male', targetW: null, heightCm: null,
  bodyweight: [], measurements: [], inbody: [], measurementUnit: 'cm', measurementReminders: { time: '08:00', notifications: false, items: {} }, routines: [], routineOrder: [], week: {}, dayPlan: {}, scheduleStarted: null, trainingPauses: [], trainingStartDate: null, trainingHistory: null,
  exWeights: {}, workouts: [], active: null, customEx: [], gifSize: 'full',
  // effort: which per-set effort scale is logged — 'none' | 'rir' | 'rpe'. null, not 'none', so
  // that a profile which never chose (loaded state is overlaid on DEF, on every path: local,
  // server pull, backup import) still falls back to the `showRir` boolean this replaced and
  // keeps the column it had. See effortOf.
  reminder: { on: false, time: '08:00', dayTimes: {}, quietStart: '22:00', quietEnd: '07:00', quietOn: false, tz: null }, effort: null, strictReps: false, backoffRepsMode: 'increased',
  deload: { on: false, normalWeeks: 6, deloadWeeks: 1, loadPct: 80, setPct: 60, targetRir: 4, startDate: null }, autoBackup: false, streakCelebrations: [], streakMilestoneLedger: { version: 1, episodes: [] },
  cloudSync: { on: false, provider: 'google-drive', clientId: '', authorizedOnce: false, lastBackupAt: null, lastAttemptAt: null, lastFileId: null, needsAuth: false, lastError: null },
  // Equipment profiles (issue: filter Library/picker/routines by what you actually own —
  // e.g. "Home" vs "Gym" — building on the session-only equipment filter from issue #6).
  equipProfiles: [], activeEquipId: null, equipFilterOn: false,
  // Standing per-exercise notes, keyed by exercise id: the gym-specific facts that are true
  // every time you do the movement ("seat 4, pin 7"). Distinct from a routine's `note`, which
  // belongs to one exercise in one plan, and from a session note, which belongs to one day.
  exNotes: {}, exerciseAliases: {}, exerciseNameMode: 'aliases', exerciseGoals: {}, avoidedExercises: {},
  nutrition: {
    goals: { calories: 2200, protein: 140, carbs: 220, fat: 60, water: 2500 },
    logs: {},
    customFoods: [],
  },
}
const clone = o => JSON.parse(JSON.stringify(o))

let storageError = null
let initialStorageCause = null
function loadState() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const base = Object.assign(clone(DEF), migrateState(JSON.parse(raw), { onboarded: localStorage.getItem('framegym_onboarded_v1') === '1' }))
      const S = MOBILE ? overlayClockJournal(base,readClockJournal()) : base
      const active = sessionTiming(reconcileWorkoutClock(S.active))
      if (active !== S.active && !hasProfileResources(S)) {
        S.active = active
        // Preserve freshness until boot has compared the native mirror.
        localStorage.setItem(KEY, JSON.stringify(S))
      }
      return S
    }
  } catch (e) { storageError = e.message; initialStorageCause = e }
  return clone(DEF)
}

const hasData = st => !!(st.trainingStartDate || (st.workouts || []).length || (st.routines || []).length || (st.bodyweight || []).length || (st.measurements || []).length || (st.inbody || []).length || (st.trainingPauses || []).length)

export const useStore = create((set, get) => {
  let pushTm = null
  let pushQueue = Promise.resolve()
  let saveTm = null, clockMirrorDeadline = null
  let nativeSerializedState = null, nativeSerializedText, remindersPending = false
  let journalDerivedState = null
  let bootstrap = null
  let atomicSaving = false
  let pendingInteraction = null, interactionFrame = null, interactionTask = null, interactionMaxTask = null
  let registeredCustomEx, retainedResourceCollections
  // Normal edits replace collections. Clock metadata keeps their identity, so
  // registry/resource maintenance can wait for a real collection change.
  const registerProfileCustom = S => {
    if (registeredCustomEx === S.customEx) return
    registerCustom(S.customEx)
    registeredCustomEx = S.customEx
  }
  const retainCurrentResources = S => {
    const collections = [S.customEx, S.inbody, S.customSounds]
    if (retainedResourceCollections?.every((collection,index) => collection === collections[index])) return
    retainProfileResources(S)
    retainedResourceCollections = collections
  }
  const clearInteraction = () => {
    if (interactionFrame != null) cancelAnimationFrame(interactionFrame)
    if (interactionTask != null) clearTimeout(interactionTask)
    if (interactionMaxTask != null) clearTimeout(interactionMaxTask)
    interactionFrame = interactionTask = interactionMaxTask = null; pendingInteraction = null
  }
  const withPendingInteraction = active => pendingInteraction && active?.id === pendingInteraction.id
    ? recordWorkoutInteraction(active, Math.max(pendingInteraction.at, Number(active.lastUserInteractionAt)||0)) : active
  const flushInteraction = () => {
    const pending = pendingInteraction
    if (!pending) return
    if (get().S.active?.id !== pending.id) { clearInteraction(); return }
    get().recordInteraction(pending.at)
  }

  const journalInteraction = () => {
    const pending=pendingInteraction, S=get().S
    if (!pending || S.active?.id!==pending.id) { clearInteraction(); return }
    if(storageError || get().storageError)throw new Error(storageError || get().storageError)
    const journal={id:pending.id,at:Math.max(pending.at,Number(S.active.lastUserInteractionAt)||0),_ts:Date.now()}
    try { writeClockJournal(journal) }
    catch (cause) {
      set({storageWarning:'primary'})
      throw storageFailure(cause,{stage:'clock-journal-write',backend:'localStorage',key:CLOCK_JOURNAL_KEY,operation:'setItem'})
    }
    // Keep complete-profile freshness and its confirmed serialization separate.
    // The quiet path still folds pending input through the normal full persist.
    const next={...S,active:recordWorkoutInteraction(S.active,journal.at)}
    journalDerivedState=next
    set({S:next})
    void nativeSaveClockJournal(journal).then(ok=>{
      if(ok===false && get().S===next && get().storageWarning!=='primary')set({storageWarning:'mirror'})
    })
  }

  // Mobile build: mirror the state into a file in the app's data directory (survives WebView
  // storage eviction) and keep the native reminder schedule in step with the weekly plan.
  const saveNativeSnapshot = S => {
    clockMirrorDeadline = null
    // A hard-bound journal is the durable clock overlay, not a new complete
    // profile serialization. Pending base mirrors keep their exact cached bytes.
    const base=S===journalDerivedState && nativeSerializedState?nativeSerializedState:S
    // Boot/recovery can seed the mirror without persist(). Capture that exact
    // immutable snapshot here, as nativeSave otherwise would at the same call.
    if(base!==nativeSerializedState) {
      nativeSerializedText=JSON.stringify(base);nativeSerializedState=base
    }
    return nativeSave(base,nativeSerializedText)
  }
  const syncPendingReminders = S => {
    if (!remindersPending) return
    remindersPending = false
    void syncReminder(S)
  }
  const nativePersist = (checkReminders, delay = 800) => {
    remindersPending ||= checkReminders
    // Ordinary edits retain their existing priority. Only an all-clock pending
    // snapshot can wait for a gesture, bounded from its first confirmed commit.
    const now = performance.now()
    if (remindersPending) clockMirrorDeadline = null
    else clockMirrorDeadline ??= now + 2000
    const wait = remindersPending ? 800 : Math.min(delay, Math.max(0, clockMirrorDeadline - now))
    clearTimeout(saveTm)
    saveTm = setTimeout(() => { saveTm = null; const S=get().S; saveNativeSnapshot(S); syncPendingReminders(S) }, wait)
  }

  const mirrorWeb = async S => {
    let ok=false
    try {ok=await saveWebState(compactProfile(S))} catch {}
    if(get().S===S&&get().storageWarning!=='primary')set({storageWarning:ok?null:'mirror'})
    return ok
  }

  const preparePersistence = S => {
    if (storageError || get().storageError) throw new Error(storageError || get().storageError)
    if (hasProfileResources(S)) throw storageFailure(new Error('Saved profile resources have not been loaded'), {stage:'resource-hydration',backend:'localStorage',key:KEY})
    S = migrateState(S, { onboarded: !!get().S.hasCompletedOnboarding, toured: !!get().S.hasCompletedAppTour, cloneInput:false })
    S.active = sessionTiming(reconcileWorkoutClock(S.active))
    if (S.cloudSync?.on && backupChecksum(portableState(S)) !== backupChecksum(portableState(get().S))) {
      S.cloudSync = { ...S.cloudSync, dirtyAt: Date.now() }
    }
    S._ts = Date.now()
    return S
  }
  const persist = (draft, push = true, prepared = false, clockOnly = false) => {
    const S = prepared ? draft : preparePersistence(draft)
    const clockChanged = S.active?.timerPausedAt !== get().S.active?.timerPausedAt || S.active?.timerContinuedAt !== get().S.active?.timerContinuedAt
    const serialized = JSON.stringify(STANDALONE ? compactProfile(S) : S)
    let previous = null, dirty = null, dirtyWritten = false, failedKey = KEY, operation = 'getItem', attemptedValue = null
    // Mark before writing the profile: a suspended page cannot lose its sync intent.
    try {
      previous = localStorage.getItem(KEY)
      if (push && get().user) {
        failedKey = 'gym_dirty'; dirty = localStorage.getItem('gym_dirty')
        operation = 'setItem'; attemptedValue = '1'
        localStorage.setItem('gym_dirty', '1'); dirtyWritten = true
      }
      failedKey = KEY; operation = 'setItem'; attemptedValue = serialized
      localStorage.setItem(KEY, serialized)
    }
    catch(cause){
      let rollbackError = null
      if (dirtyWritten) try { if (dirty == null) localStorage.removeItem('gym_dirty'); else localStorage.setItem('gym_dirty', dirty) } catch (error) { rollbackError = error.name }
      let localStorageBytes = null
      try { localStorageBytes = Array.from({length:localStorage.length},(_,i)=>localStorage.key(i)).reduce((sum,key)=>sum+2*(key.length+(localStorage.getItem(key)||'').length),0) } catch { /* A denied store cannot be measured. */ }
      set({storageWarning:'primary'})
      throw storageFailure(cause, {stage:'profile-write',backend:'localStorage',key:failedKey,operation,attemptedBytes:(attemptedValue?.length||0)*2,attemptedUtf8Bytes:attemptedValue==null?0:new TextEncoder().encode(attemptedValue).length,previousBytes:((failedKey===KEY?previous:dirty)?.length||0)*2,localStorageBytes,rollbackError})
    }
    // Mobile's primary representation is the full state. Reuse only its confirmed
    // serialization, never the compact PWA core or a failed/older draft.
    if (MOBILE && !STANDALONE) { nativeSerializedState=S; nativeSerializedText=serialized }
    journalDerivedState=null
    registerProfileCustom(S)
    retainCurrentResources(S)
    set({ S, storageWarning:null })
    if (pendingInteraction && (S.active?.id !== pendingInteraction.id || Number(S.active?.lastUserInteractionAt) >= pendingInteraction.at)) clearInteraction()
    if (STANDALONE) void mirrorWeb(S)
    if (MOBILE) {
      remindersPending ||= !clockOnly
      if (clockChanged) {
        clearTimeout(saveTm)
        saveTm = null
        saveNativeSnapshot(S)
        syncPendingReminders(S)
      } else nativePersist(!clockOnly)
    }
    if (push && get().user) {
      clearTimeout(pushTm)
      pushTm = setTimeout(() => get().pushState(), 1500)
    }
  }

  const updateDraft = (mut, userActivity) => {
    const S = clone(get().S)
    S.active = withPendingInteraction(S.active)
    mut(S)
    // Editing a session cannot change the origin captured before this edit.
    if (S.active && S.active.id === get().S.active?.id) S.active.sessionOrigin = {...sessionOrigin(get().S.active,get().S.routines)}
    const previousWorkouts = new Map((get().S.workouts || []).map(w=>[w.id,w]))
    const routinesChanged = JSON.stringify(S.routines) !== JSON.stringify(get().S.routines)
    for (const w of S.workouts || []) {
      const previous = w.id != null && previousWorkouts.get(w.id)
      if (previous && (previous.sessionOrigin || previous.routineId !== w.routineId || previous.name !== w.name || !previous.routineId && routinesChanged)) w.sessionOrigin = {...sessionOrigin(previous,get().S.routines)}
    }
    if (S.backoffRepsMode !== get().S.backoffRepsMode) S.active = refreshActiveBackoffReps(S.active, S)
    if (S.unit === get().S.unit) S.active = reconcileWorkoutEdit(get().S.active, S.active, Date.now(), userActivity)
    return S
  }

  // A setting changed right before switching away/closing the tab must not get lost mid-debounce
  // (e.g. setting the reminder time then immediately backgrounding to test it). On mobile the
  // same applies to the file mirror — backgrounding is often the last thing before the OS
  // kills the app.
  const flushOnBackground = () => {
    flushInteraction()
    const S = get().S
    const active = sessionTiming(reconcileWorkoutClock(S.active))
    if (active !== S.active) persist({ ...S, active },true,false,true)
    if (MOBILE && saveTm) {
      clearTimeout(saveTm)
      saveTm = null
      saveNativeSnapshot(get().S)
      syncPendingReminders(get().S)
    }
    if (pushTm) {
      clearTimeout(pushTm)
      pushTm = null
      get().pushState()
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushOnBackground()
  })
  window.addEventListener('pagehide', flushOnBackground)
  window.addEventListener('online', () => {
    try {if (get().user && localStorage.getItem('gym_dirty') === '1') void get().pushState()}
    catch {set({storageWarning:'primary'})}
  })

  // Everything a sign-out leaves behind on this device, whichever way it was triggered.
  const clearLocalSession = uploaded => {
    get().setUser(null)
    localStorage.removeItem('gym_guest')
    clearTimeout(pushTm)
    pushTm = null
    // The API intentionally excludes active workouts. Also retain any edits made
    // while logout was pending: neither copy is covered by the successful upload.
    if (get().S.active || (uploaded && backupChecksum(portableState(get().S)) !== backupChecksum(portableState(uploaded)))) {
      localStorage.setItem('gym_dirty', '1')
      return false
    }
    localStorage.removeItem('gym_dirty')
    localStorage.removeItem(KEY)
    persist(clone(DEF), false)
    return true
  }

  return {
    S: (() => { const s = loadState(); if (!hasProfileResources(s)) registerProfileCustom(s); return s })(),
    user: (() => { try { return JSON.parse(localStorage.getItem('gym_user')) || null } catch { return null } })(),
    storageError,
    storageDiagnostics: initialStorageCause,
    storageWarning: null,
    serverSyncError: null,
    ready: false,
    needsMobileOnboarding: false,   // mobile build only — set true by boot() on a genuine first launch
    async flushPersistence() {
      flushInteraction()
      if (!MOBILE) { if (STANDALONE) await mirrorWeb(get().S); return }
      clearTimeout(saveTm)
      saveTm = null
      if (await saveNativeSnapshot(get().S) === false) throw new Error('Native storage unavailable')
      remindersPending = false
      void syncReminder(get().S)
    },
    async completeOnboarding() {
      get().update(s => { s.hasCompletedOnboarding = true }, false)
      localStorage.setItem('framegym_onboarded_v1', '1')
      await get().flushPersistence()
      try { await navigator.storage?.persist?.() } catch { /* optional browser permission */ }
      set({ needsMobileOnboarding: false })
    },

    // Mutate a draft of S via producer fn, then persist + schedule sync.
    update(mut, push = true, userActivity = true) {
      persist(updateDraft(mut, userActivity), push)
    },
    async updateAtomic(mut, push = true, userActivity = true) {
      if (atomicSaving) throw Object.assign(new Error('A profile save is already in progress'), {code:'profile_save_busy'})
      atomicSaving = true
      const before = get().S
      try {
        const S = preparePersistence(updateDraft(mut, userActivity))
        try { persist(S, push, true); return }
        catch (error) {
          // The demonstrated iPhone failure is the synchronous string-store
          // limit, despite available IndexedDB capacity. Keep the primary core
          // and synchronous edit contract; stage only necessary large resources.
          if (!STANDALONE || !isQuotaError(error) || error.diagnostics?.key !== KEY || error.diagnostics?.operation !== 'setItem') throw error
          let staged
          try { staged = await stageProfileResources(S) }
          catch (cause) { cause.initialStorageFailure=error; cause.diagnostics = {...cause.diagnostics,originalAttemptedBytes:error.diagnostics?.attemptedBytes,initialStorageError:error.cause?.name}; throw cause }
          if (!staged) throw error
          if (get().S !== before) throw Object.assign(new Error('Your profile changed while saving. Review the import again.'), {code:'profile_changed_during_save'})
          try { persist(S, push, true) }
          catch (cause) { cause.initialStorageFailure=error; cause.diagnostics = {...cause.diagnostics,resourceBytes:staged.resourceBytes,resourceCount:staged.resourceCount,originalAttemptedBytes:error.diagnostics?.attemptedBytes}; throw cause }
        }
      } finally { if (get().S === before) retainProfileResources(before); atomicSaving = false }
    },
    async retryStorage() {
      set({ready:false,storageError:null,storageDiagnostics:null})
      try {
        const raw = localStorage.getItem(KEY)
        if (!raw) throw new Error('The saved profile is unavailable. Keep the recovery file before restoring data.')
        const saved = await hydrateProfile(Object.assign(clone(DEF), migrateState(JSON.parse(raw))))
        // Parsing and every resource read must complete before the protected
        // source becomes editable again. Retrying never writes the raw source.
        storageError = null; initialStorageCause = null
        registerProfileCustom(saved)
        set({S:saved})
        await get().boot()
      } catch (error) { set({ready:false,storageError:error.message,storageDiagnostics:error}) }
    },
    reconcileActiveClock(now = Date.now()) {
      const before = get().S.active
      const pending = withPendingInteraction(before)
      const active = reconcileWorkoutClock(pending, now)
      if (active !== pending) get().update(s => { if (s.active?.id === before?.id) s.active = active }, true, false)
      return active === pending ? pending : get().S.active
    },
    recordInteraction(now = Date.now(), { defer = false, quietMs = 800 } = {}) {
      // Reconcile before extending the deadline: returning after suspension cannot
      // silently erase the interval in which this session should have been paused.
      get().reconcileActiveClock(now)
      if (!get().S.active) { clearInteraction(); return }
      if (defer) {
        // Marked gestures can finish painting before this quiet timer expires.
        // The independent hard/deadline timer below still bounds persistence.
        const quietDelay = Number.isFinite(quietMs) ? Math.min(1800,Math.max(800,quietMs)) : 800
        const active = get().S.active
        const remaining = active.timerPausedAt == null ? inactivityDeadline(active,now)-now : Infinity
        if (MOBILE && saveTm != null && !remindersPending && quietDelay > 800 && remaining > quietDelay + 800) nativePersist(false, quietDelay)
        pendingInteraction = {id:get().S.active.id,at:Math.max(now,pendingInteraction?.id===get().S.active.id?pendingInteraction.at:0),quietMs:quietDelay}
        if (interactionMaxTask == null) {
          const active = get().S.active
          // Continuous input must not starve persistence or leave Android's last
          // published inactivity deadline stale. This bound never waits for RAF.
          // Flush earlier when that old deadline is close, allowing bridge time.
          const remaining = active.timerPausedAt == null ? inactivityDeadline(active,now)-now : Infinity
          interactionMaxTask = setTimeout(() => {
            interactionMaxTask = null
            try {
              if(MOBILE && pendingInteraction?.quietMs>800 && pendingInteraction.at<=Date.now() && nativeClockJournalAvailable())journalInteraction()
              else flushInteraction()
            } catch { /* Retain pending input for retry. */ }
          }, Math.min(2000,Math.max(0,remaining-250)))
        }
        // Pointerdown precedes click. Coalesce successive navigation taps before
        // painting/persisting metadata; a frame alone can run while a finger is
        // still down. The captured time is used immediately by clock checks and
        // ordinary edits, and pagehide flushes it before suspension.
        if(interactionFrame!=null)cancelAnimationFrame(interactionFrame)
        if(interactionTask!=null)clearTimeout(interactionTask)
        interactionFrame=null
        interactionTask=setTimeout(()=>{
          interactionTask=null
          interactionFrame=requestAnimationFrame(()=>{
            interactionFrame=null
            interactionTask=setTimeout(()=>{interactionTask=null;try{flushInteraction()}catch{/* Keep pending input and the existing storage warning for retry. */}},0)
          })
        },quietDelay)
        return
      }
      // An input timestamp edits only the active clock. Retain unrelated array
      // identities so charts, exercise indexes and native sound resources do not
      // rebuild after every tap. Normal persisted edits still use updateDraft.
      const S=get().S
      persist({...S,active:recordWorkoutInteraction(S.active,Math.max(now,Number(S.active.lastUserInteractionAt)||0))},true,false,true)
    },
    replaceState(S, push = false) { clearInteraction(); persist(clone(S), push) },

    // Fires after the moments where losing local data would actually hurt — a workout just
    // logged, a routine just edited — not on every keystroke. No-op off mobile or with the
    // setting off; the private file mirror (nativePersist, above) already covers every change.
    autoBackupNow() {
      const S = get().S
      if (MOBILE && S.autoBackup) writeAutoBackup(S)
    },

    isGuest: () => localStorage.getItem('gym_guest') === '1',
    setGuest(v) { if (v) localStorage.setItem('gym_guest', '1'); else localStorage.removeItem('gym_guest'); set({}) },

    // Public config from /api/config (invite_only, allow_guest). null until the first successful
    // fetch — the login screen and boot both read it, so it is fetched once and cached here
    // rather than by each screen that happens to need it.
    config: null,
    async loadConfig() {
      if (get().config) return get().config
      try { const c = await api('/api/config'); set({ config: c }); return c }
      catch { return null }
    },

    setUser(u) {
      if (u?.id !== get().user?.id) { bootstrap = null; set({ serverSyncError: null }) }
      if (u) { localStorage.setItem('gym_user', JSON.stringify(u)); localStorage.removeItem('gym_guest') }
      else localStorage.removeItem('gym_user')
      set({ user: u })
    },

    async pushState({ strict = false } = {}) {
      if (!get().user) return
      const userId = get().user.id
      clearTimeout(pushTm)
      pushTm = null
      // Cached authentication can reconnect before boot starts its first GET.
      // An empty profile has no proven server baseline to replace yet.
      if (!hasData(get().S) && bootstrap?.userId !== userId) {
        if (await get().pullState() === false || get().user?.id !== userId) {
          if (strict) throw new Error('Server synchronization failed. Your local data was kept.')
          return false
        }
      }
      const initial = bootstrap?.userId === userId && !bootstrap.ready ? bootstrap : null
      if (initial) {
        if (initial.pending) await initial.gate
        else await get().pullState()
        if (get().user?.id !== userId || !bootstrap?.ready) {
          if (strict) throw new Error('Server synchronization failed. Your local data was kept.')
          return false
        }
      }
      if (get().user?.id !== userId) {
        if (strict) throw new Error('Session changed while saving')
        return false
      }
      // Capture only after the first read has supplied the complete remote profile.
      const snapshot = get().S
      // Preserve request order. An older autosave must finish before the final
      // sign-out upload, otherwise it could overwrite data after local cleanup.
      const upload = pushQueue.then(async () => {
        if (get().user?.id !== userId) {
          if (strict) throw new Error('Session changed while saving')
          return
        }
        try {
          await api('/api/data', { method: 'PUT', body: JSON.stringify({ state: snapshot }) })
          if (get().user?.id !== userId) {
            if (strict) throw new Error('Session changed while saving')
            return false
          }
          if (get().S === snapshot) localStorage.removeItem('gym_dirty')
          else {
            localStorage.setItem('gym_dirty', '1')
            if (strict) throw new Error('Local data changed while saving')
            return false
          }
          set({ serverSyncError: null })
          return true
        } catch (e) {
          if (get().user?.id === userId) { localStorage.setItem('gym_dirty', '1'); set({ serverSyncError: e.message || 'Server synchronization failed. Your local data was kept.' }) }
          if (strict) throw e
          return false
        }
      })
      // A failed request must not prevent a later retry from reaching the API.
      pushQueue = upload.catch(() => {})
      return upload
    },
    async pullState() {
      const requestedState = get().S
      const userId = get().user?.id
      const previous = bootstrap?.userId === userId && !bootstrap.ready ? bootstrap : null
      if (previous?.pending) { await previous.gate; return previous.ready }
      let initial = null
      if (previous || !hasData(requestedState)) {
        let release
        const gate = new Promise(resolve => { release = resolve })
        initial = bootstrap = { userId, before:previous?.before || clone(localStorage.getItem('gym_dirty') === '1' ? DEF : requestedState), gate, release, pending:true, ready:false }
      }
      let upload = false, success = false
      try {
        const { state } = await api('/api/data')
        // A response belongs to the account and local revision that requested it.
        // Preference-only profiles still contain edits worth protecting.
        if (get().user?.id !== userId) return false
        const S = get().S
        const dirty = localStorage.getItem('gym_dirty') === '1'
        if (initial) {
          if (state) {
            const next = rebaseEmptyApiProfile(initial.before, S, state, DEF)
            upload = dirty || backupChecksum(portableState(S)) !== backupChecksum(portableState(initial.before))
            persist(next, false)
          } else upload = hasData(S) || dirty || !!S._ts
        } else if (state && S === requestedState && !dirty && (state._ts || 0) >= (S._ts || 0)) {
          const active = S.active
          const next = Object.assign(clone(DEF), state)
          if (active) next.active = active
          persist(next, false)
        } else if (hasData(S) || dirty || S._ts || S !== requestedState) upload = true
        success = true
        set({ serverSyncError: null })
      } catch (e) {
        if (get().user?.id === userId) set({ serverSyncError: e.message || 'Server synchronization failed. Your local data was kept.' })
      } finally {
        if (initial) { initial.ready = success; initial.pending = false; initial.release() }
      }
      if (!success) return false
      if (upload && await get().pushState() === false) return false
      return true
    },

    async signOut() {
      // Never discard the only copy when the upload failed or a newer edit is pending.
      const uploaded = get().S
      await get().pushState({ strict: true })
      await api('/api/logout', { method: 'POST', body: '{}' })
      return clearLocalSession(uploaded)
    },

    // Mobile-only ("connect to my server" onboarding, see App.jsx's needsMobileOnboarding).
    // Picking local — even before there's any data — persists the choice so onboarding never
    // asks again.
    async chooseLocalMode() {
      await chooseLocal()
      set({ needsMobileOnboarding: false })
    },
    // Redeems the pairing code shown in the browser (Settings → "Pair the mobile app") and
    // switches this device over to that account, same as signing in on the web does.
    async connectToServer(url, code) {
      const user = await connect(url, code)   // throws on a bad URL/expired code — caller shows it
      get().setUser(user)
      if (await get().pullState() === false) throw new Error('Server synchronization failed. Your local data was kept.')
      syncReminder(get().S)
      set({ needsMobileOnboarding: false })
    },
    // Leaves remote mode and drops cleanly back to local-only, without losing whatever was last
    // synced (signOut() already pushes before it clears).
    async disconnectServer() {
      await get().signOut()
      await forgetRemote()
      get().setGuest(true)
      set({ ready: true })
    },

    // "Sign out everywhere": the server bumps this profile's session version, which kills every
    // session it has on any device — this browser included, so the app has to end up exactly
    // where a normal signOut leaves it. Unlike signOut the request is NOT swallowed: if it fails
    // the sessions elsewhere are all still valid, and wiping this device's copy of the data
    // would sign the user out of the one place the bump didn't reach. Caller reports the error.
    async signOutAll() {
      const uploaded = get().S
      await get().pushState({ strict: true })
      await api('/api/logout/all', { method: 'POST', body: '{}' })
      return clearLocalSession(uploaded)
    },

    // Demo build only: drop the seeded example profile back in (Settings → "Reset demo data").
    // Dynamic import so the generator never ships in a self-hosted bundle.
    async resetDemo() {
      const { buildDemoState } = await import('../lib/demoSeed.js')
      localStorage.removeItem('gym_dirty')
      persist(Object.assign(clone(DEF), buildDemoState()), false)
    },

    // Boot: ask the server who we are, then pull.
    async boot() {
      if (storageError) { set({ ready: false, storageError, storageDiagnostics:initialStorageCause }); return }
      // Mobile build: no backend by default — restore from the file mirror (the durable copy;
      // localStorage may have been evicted since the last run) and go straight in. Unless this
      // device was paired to a server ("connect to my server" mode, lib/remote.js), in which
      // case it behaves exactly like the signed-in web flow below, straight from here.
      if (MOBILE) {
        const remote = await loadRemote()
        if (remote?.mode === 'remote') {
          setRemoteAuth(remote.base, remote.token)
          try {
            const me = await api('/api/me')   // also catches a token revoked elsewhere (sign out everywhere)
            get().setUser(me.user)
            await get().pullState()
          } catch (e) {
            if (e.status === 401) { await forgetRemote(); get().setGuest(true) }
            else get().setUser(remote.user)   // offline — keep going from the last-synced local copy
          }
          syncReminder(get().S)
          set({ ready: true })
          return
        }
        const saved = await nativeLoad()
        const S = get().S
        const restore=shouldRestoreNative(S,saved)
        const chosen=restore?Object.assign(clone(DEF),saved):S
        const restored=overlayClockJournal(chosen,readClockJournal())
        if (restore || restored!==S) {
          try { persist(restored, false) } catch (error) { set({ready:false,storageError:error.message,storageDiagnostics:error});return }
        } else if (S._ts || hasData(S)) {
          saveNativeSnapshot(S)   // first run after an update from a file-less version: seed the mirror
        }
        get().setGuest(true)
        syncReminder(get().S)
        // Only a genuinely first launch — nothing chosen yet and nothing to lose either — offers
        // the choice. Picking local (even with no data yet) persists that choice below and this
        // never asks again.
        set({ ready: true, needsMobileOnboarding: !get().S.hasCompletedOnboarding && !localStorage.getItem('framegym_onboarded_v1') && !hasData(get().S) })
        return
      }
      // TGym's free PWA build has no backend: each installation is a private local profile
      // and JSON files are the explicit transfer mechanism.
      if (STANDALONE) {
        try {
          const local = await hydrateProfile(get().S)
          if (local !== get().S) { registerProfileCustom(local); set({S:local}) }
          const snapshot = await loadWebState()
          if (snapshot && (!get().S._ts || (snapshot._ts || 0) > get().S._ts)) {
            const saved = await hydrateProfile(snapshot)
            persist(Object.assign(clone(DEF), saved), false)
          }
          else if (get().S._ts) await mirrorWeb(get().S)
        } catch (error) { set({ ready: false, storageError: error.message, storageDiagnostics:error }); return }
        get().setGuest(true)
        set({ ready: true, needsMobileOnboarding: !get().S.hasCompletedOnboarding && !localStorage.getItem('framegym_onboarded_v1') && !hasData(get().S) })
        return
      }
      // Demo build (GitHub Pages): no backend at all — seed once, stay in guest mode.
      if (DEMO) {
        if (!localStorage.getItem(DEMO_SEEDED)) {
          localStorage.setItem(DEMO_SEEDED, '1')
          await get().resetDemo()
        }
        get().setGuest(true)
        set({ ready: true })
        return
      }
      // Guests never authenticate, so an instance that turned guest mode off has no request to
      // refuse — the only way the switch reaches someone already inside is here, on their next
      // boot. Ending the session needs a positive `allow_guest: false`; see lib/guest.js for why
      // an unreachable server must not be allowed to lock anyone out (#42).
      const cfg = await get().loadConfig()
      if (!guestAllowed(cfg)) get().setGuest(false)
      try {
        const me = await api('/api/me')
        get().setUser(me.user)
        await get().pullState()
        // Re-stamp the reminder's timezone on every load — keeps it correct if you're travelling,
        // without needing to revisit Settings.
        const tz = localTZ()
        if (get().S.reminder?.on && get().S.reminder.tz !== tz) {
          get().update(s => { s.reminder = { ...s.reminder, tz } })
        }
      } catch (e) {
        if (e.status === 401) get().setUser(null)
      }
      set({ ready: true })
    }
  }
})

bindExerciseNameState(() => useStore.getState().S)

export { hasData }
