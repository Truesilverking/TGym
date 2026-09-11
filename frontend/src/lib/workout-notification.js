import { Capacitor, registerPlugin } from '@capacitor/core'
import { workoutElapsedMs, lastWorkoutActivity, INACTIVITY_AUTO_FINISH_MINUTES } from './workout-time.js'
import { t } from './i18n-core.js'
const native = registerPlugin('WorkoutNotification')
export function workoutNotificationState(active, rest, now=Date.now()) {
  if (!active || active.end != null) return {active:false}
  const paused=active.timerPausedAt != null
  return {active:true,name:active.name || t('Workout'),paused,observedAt:now,
    elapsedMs:workoutElapsedMs(active,now),workoutLabel:t(paused?'Workout complete!':'Workout'),restLabel:t('Rest'),
    restEndsAt:rest?.endsAt > now ? rest.endsAt : 0,
    autoFinishAt:paused?0:lastWorkoutActivity(active)+INACTIVITY_AUTO_FINISH_MINUTES*60000}
}
let queue=Promise.resolve()
let permissionRequested=false
export function syncWorkoutNotification(active,rest) {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform()!=='android') return Promise.resolve(false)
  const state=workoutNotificationState(active,rest)
  queue=queue.catch(()=>false).then(async()=>{
    if(state.active && !permissionRequested && document.visibilityState!=='hidden') {
      permissionRequested=true
      const {LocalNotifications}=await import('@capacitor/local-notifications')
      const permission=await LocalNotifications.checkPermissions()
      if(permission.display==='prompt' || permission.display==='prompt-with-rationale') await LocalNotifications.requestPermissions()
    }
    return native.sync(state)
  }).catch(()=>false)
  return queue
}
