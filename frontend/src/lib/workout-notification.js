import { Capacitor, registerPlugin } from '@capacitor/core'
import { workoutElapsedMs, inactivityDeadline } from './workout-time.js'
import { isWarmupRow } from './workout-model.js'
import { t, getLang } from './i18n-core.js'
const native = registerPlugin('WorkoutNotification')
export function workoutNotificationState(active, rest, now=Date.now()) {
  if (!active || active.end != null) return {active:false}
  const paused=active.timerPausedAt != null
  rest=rest ?? active.restTimer
  const entry=(active.entries || [])[active.cur || 0]
  const rows=entry?.sets || []
  const pending=rows.findIndex(s=>!s.done)
  const index=pending >= 0 ? pending : rows.length - 1
  // Match the screen: warm-up and work phases each start at set 1.
  const setNumber=index < 0 ? 0 : rows.slice(0,index+1).filter(s=>isWarmupRow(s)===isWarmupRow(rows[index])).length
  const es=getLang()==='es'
  return {active:true,paused,observedAt:now,
    elapsedMs:workoutElapsedMs(active,now),workoutLabel:es?'ENTRENO':t('Workout').toUpperCase(),restLabel:es?'DESCANSO':t('Rest').toUpperCase(),
    setNumber,setLabel:setNumber ? `${es?'SERIE':t('Set').toUpperCase()} ${setNumber}` : '',
    restEndsAt:rest?.endsAt > now ? rest.endsAt : 0,
    autoFinishAt:active.routineCompletedAt!=null?inactivityDeadline(active):0}
}
let queue=Promise.resolve()
let permissionRequested=false
let revision=0
export function syncWorkoutNotification(active,rest) {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform()!=='android') return Promise.resolve(false)
  const ticket=++revision
  const state=workoutNotificationState(active,rest)
  state.accentColor=getComputedStyle(document.documentElement).getPropertyValue('--acc').trim()
  queue=queue.catch(()=>false).then(async()=>{
    if(ticket!==revision) return false
    if(state.active && !permissionRequested && document.visibilityState!=='hidden') {
      permissionRequested=true
      const {LocalNotifications}=await import('@capacitor/local-notifications')
      const permission=await LocalNotifications.checkPermissions()
      if(permission.display==='prompt' || permission.display==='prompt-with-rationale') await LocalNotifications.requestPermissions()
    }
    return ticket===revision ? native.sync(state) : false
  }).catch(()=>false)
  return queue
}

export async function clearWorkoutNotification() {
  await syncWorkoutNotification(null, null)
  // Remove a legacy completion notice left by an older PWA version as well.
  if (!Capacitor.isNativePlatform()) {
    try { const reg=await navigator.serviceWorker?.getRegistration(); const notices=await reg?.getNotifications({tag:'workout-complete'}); notices?.forEach(n=>n.close()) } catch { /* Optional notification capability. */ }
  }
}
