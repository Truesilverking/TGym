import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { bindUI } from './components/ui.jsx'
import { ACCENTS } from './lib/format.js'
import { setLang, useLang } from './lib/i18n.js'
import { setNav } from './lib/nav.js'
import { initBackButton } from './lib/back.js'
import { useWakeLock } from './lib/wakelock.js'
import { startFlow } from './sheets.jsx'
import Icon from './components/Icon.jsx'
import TabBar from './components/TabBar.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import Modals from './components/Modals.jsx'
import Toast from './components/Toast.jsx'
import RestTimer from './components/RestTimer.jsx'
import Login from './views/Login.jsx'
import MobileOnboarding from './views/MobileOnboarding.jsx'
import Home from './views/Home.jsx'
import Plan from './views/Plan.jsx'
import RoutineEdit from './views/RoutineEdit.jsx'
import Workout from './views/Workout.jsx'
import Stats from './views/Stats.jsx'
import History from './views/History.jsx'
import Library from './views/Library.jsx'
import Settings from './views/Settings.jsx'
import Admin from './views/Admin.jsx'
import AppLock from './components/AppLock.jsx'
import AppUpdate from './components/AppUpdate.jsx'
import { backupToGoogleDrive, cloudBackupDue } from './lib/cloud-sync.js'
import { MOBILE, syncReminder } from './lib/mobile.js'
import { inactivityState, lastWorkoutActivity } from './lib/workout-time.js'
import { doFinishWorkout, inactivityWarningSheet } from './sheets.jsx'
import { syncWorkoutNotification } from './lib/workout-notification.js'

bindUI(useUI)   // lets the shared controls open sheets without importing the store at module scope

// theme === 'system' follows the OS/browser preference instead of a fixed choice.
const resolveTheme = theme => theme === 'light' || theme === 'dark'
  ? theme
  : (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

function applyPrefs(theme, accent, reduceMotion = false) {
  const de = document.documentElement
  de.dataset.theme = resolveTheme(theme)
  de.dataset.accent = ACCENTS[accent] ? accent : 'lime'
  de.dataset.reduceMotion = reduceMotion ? 'true' : 'false'
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.content = de.dataset.theme === 'light' ? '#f2f2f7' : '#000000'
}

function Shell() {
  const navigate = useNavigate()
  const loc = useLocation()
  const { S, user, ready } = useStore()
  const isGuest = useStore(s => s.isGuest())
  const needsMobileOnboarding = useStore(s => s.needsMobileOnboarding)
  const langV = useLang()   // re-renders the whole shell when the language (pack) changes
  const restEndsAt=useUI(s=>s.timer?.endsAt)
  useEffect(()=>{
    if(ready) void syncWorkoutNotification(S.active,restEndsAt?{endsAt:restEndsAt}:null)
  },[ready,S.active,restEndsAt,langV])
  useEffect(()=>{
    if(!MOBILE || !ready)return
    let disposed=false,listener
    const open=event=>{if(!disposed && event?.url==='tgym://workout')navigate(useStore.getState().S.active?'/workout':'/home')}
    import('@capacitor/app').then(async({App})=>{
      const handle=await App.addListener('appUrlOpen',open)
      if(disposed)void handle.remove();else listener=handle
      open(await App.getLaunchUrl())
    }).catch(()=>{})
    return ()=>{disposed=true;void listener?.remove()}
  },[ready,navigate])
  useEffect(()=>{
    if (!ready) return
    let warning=null, warned=null
    const check=()=>{
      const active=useStore.getState().S.active
      const status=inactivityState(active)
      if (status==='finish') {
        warning?.close(); warning=null
        doFinishWorkout({reason:'inactivity',end:lastWorkoutActivity(active)})
      } else if (status==='warning' && document.visibilityState!=='hidden') {
        const key=`${active.id}:${lastWorkoutActivity(active)}`
        if(warned!==key){warning?.close();warned=key;warning=inactivityWarningSheet()}
      } else if(status==='none'){warning?.close();warning=null}
    }
    check()
    const timer=setInterval(check,10000)
    document.addEventListener('visibilitychange',check)
    return ()=>{clearInterval(timer);document.removeEventListener('visibilitychange',check);warning?.close()}
  },[ready])
  useEffect(() => {
    if (!MOBILE) return
    let disposed = false, listener
    import('@capacitor/local-notifications').then(async ({ LocalNotifications }) => {
      const handle = await LocalNotifications.addListener('localNotificationActionPerformed', async event => {
        const extra = event.notification?.extra
        if (disposed) return
        if (extra?.type === 'workout') {
          const state = useStore.getState().S
          if (state.active) navigate('/workout')
          else if (state.routines.some(r=>r.id===extra.routineId) && !state.workouts.some(w=>w.d===extra.date)) startFlow(extra.routineId)
          else navigate('/home')
          return
        }
        if (extra?.type !== 'measurement') return
        const sheets = await import('./sheets.jsx')
        if (!disposed) sheets.openMeasurementEntry(extra.metrics?.[0] || 'weight')
      })
      if (disposed) void handle.remove(); else listener = handle
    }).catch(() => {})
    return () => { disposed = true; void listener?.remove() }
  }, [])
  useEffect(() => {
    if (!MOBILE || !ready) return
    const sync = () => { if (document.visibilityState !== 'hidden') void syncReminder(useStore.getState().S) }
    sync()
    document.addEventListener('visibilitychange',sync)
    const timer = setInterval(sync,60000)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange',sync) }
  }, [ready])
  useEffect(() => { setNav(navigate) }, [navigate])
  useEffect(() => { applyPrefs(S.theme, S.accent, S.reduceMotion) }, [S.theme, S.accent, S.reduceMotion])
  // 'system' needs to react live if the OS theme flips while the app is open, not just on
  // the next mount — a fixed 'dark'/'light' choice never re-fires this since matchMedia
  // isn't consulted for those.
  useEffect(() => {
    if (S.theme !== 'system' || !window.matchMedia) return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyPrefs(S.theme, S.accent, S.reduceMotion)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [S.theme, S.accent, S.reduceMotion])
  useEffect(() => { setLang(S.lang || 'en') }, [S.lang])
  useEffect(() => { document.documentElement.lang = S.lang || 'en' }, [langV, S.lang])
  // every tab/route change starts at the top of the page
  useEffect(() => { window.scrollTo(0, 0) }, [loc.pathname])
  // bound to the workout, not to the route — checking Stats mid-session keeps the screen on
  useWakeLock(!!S.active && S.keepAwake !== false)

  // A PWA cannot wake itself while it is fully closed. Run the weekly check on launch and
  // foreground instead. Google normally renews prior consent silently; if the browser cannot,
  // Settings shows one explicit reconnect action rather than repeatedly opening a prompt.
  useEffect(() => {
    if (!ready) return
    let running = false, gone = false
    const syncIfDue = async () => {
      const current = useStore.getState().S
      if (running || document.visibilityState === 'hidden' || navigator.onLine === false || !cloudBackupDue(current)) return
      running = true
      useStore.getState().update(s => { s.cloudSync = { ...(s.cloudSync || {}), lastAttemptAt: Date.now() } }, false)
      try {
        const result = await backupToGoogleDrive(current, { interactive: false })
        if (!gone) useStore.getState().update(s => { s.cloudSync = { ...(s.cloudSync || {}), dirtyAt: s.cloudSync?.dirtyAt === current.cloudSync?.dirtyAt ? null : s.cloudSync?.dirtyAt, authorizedOnce: true, lastBackupAt: result.at, lastFileId: result.fileId, lastModifiedTime: result.modifiedTime, needsAuth: false, lastError: result.warning || null } }, false)
      } catch (error) {
        const authCodes = new Set(['auth_required', 'configuration_required', 'access_denied', 'popup_failed_to_open', 'popup_closed', 'auth_failed'])
        if (!gone) useStore.getState().update(s => { s.cloudSync = { ...(s.cloudSync || {}), needsAuth: authCodes.has(error?.code), lastError: error?.message || 'Google Drive error' } }, false)
      } finally { running = false }
    }
    syncIfDue()
    const visible = () => { if (document.visibilityState === 'visible') syncIfDue() }
    document.addEventListener('visibilitychange', visible)
    window.addEventListener('online', syncIfDue)
    const timer = setInterval(syncIfDue, 30000)
    return () => { gone = true; clearInterval(timer); window.removeEventListener('online', syncIfDue); document.removeEventListener('visibilitychange', visible) }
  }, [ready])

  const authed = user || isGuest
  if (!ready && !authed) return (
    <div id="app">
      <div style={{ paddingTop: '44vh', display: 'flex', justifyContent: 'center', fontSize: 34, color: 'var(--label-3)' }}>
        <Icon name="dumbbell" />
      </div>
    </div>
  )

  return (
    <>
      {/* keyed on the route: a view that throws is contained, and switching tabs
          re-mounts the boundary, so the tab bar is always a way out */}
      <div id="app" className="vfade" key={loc.pathname}>
        <ErrorBoundary>
          {!authed ? <Login /> : needsMobileOnboarding ? <MobileOnboarding /> : (
            <Routes>
              <Route path="/home" element={<Home />} />
              <Route path="/plan" element={<Plan />} />
              <Route path="/plan/r/:id" element={<RoutineEdit />} />
              <Route path="/workout" element={<Workout />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/history" element={<History />} />
              <Route path="/library" element={<Library />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/admin" element={user?.admin ? <Admin /> : <Navigate to="/home" replace />} />
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Routes>
          )}
        </ErrorBoundary>
      </div>
      <TabBar onStart={startFlow} />
      <RestTimer />
      <AppUpdate />
      <Modals />
      <Toast />
    </>
  )
}

export default function App() {
  const boot = useStore(s => s.boot)
  useEffect(() => { boot() }, [boot])
  // Android system back — sheet, then page, then press-again-to-exit (see lib/back.js)
  useEffect(() => {
    let stop = null, gone = false
    initBackButton().then(fn => { if (gone) fn(); else stop = fn })
    return () => { gone = true; stop?.() }
  }, [])
  return <HashRouter><AppLock><Shell /></AppLock></HashRouter>
}
