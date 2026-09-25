import { exOr } from './exercises.js'
import { exerciseNameFor } from './i18n.js'
import { effectiveWorkoutComplete } from './workout-lifecycle.js'
import { isWarmupRow } from './workout-model.js'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { workoutElapsedMs, lastWorkoutActivity, INACTIVITY_AUTO_FINISH_MINUTES } from './workout-time.js'
import { t } from './i18n-core.js'
const native = registerPlugin('WorkoutNotification')
export function workoutNotificationState(active, rest, now=Date.now()) {
  if (!active || active.end != null) return {active:false}
  const paused=active.timerPausedAt != null
  const complete=effectiveWorkoutComplete(active)
  const entries=active.entries || [], entry=entries[active.cur || 0]
  const sets=entries.flatMap(e=>(e.sets || []).filter(s=>!isWarmupRow(s))), done=sets.filter(s=>s.done).length
  const current=entry?.sets?.findIndex(s=>!s.done) ?? -1
  const exercise=entry ? exerciseNameFor(exOr(entry.id)) : ''
  return {active:true,name:active.name || t('Workout'),paused,observedAt:now,
    elapsedMs:workoutElapsedMs(active,now),workoutLabel:t(paused ? complete ? 'Workout complete!' : 'Workout paused' : 'Workout active'),restLabel:t('Rest'),restDoneLabel:t('Done'),
    exercise,context:exercise ? exercise + (current>=0 ? ' · '+t('Set {0} of {1}',current+1,entry.sets.length) : '') : '',
    completedSets:done,totalSets:sets.length,progressLabel:t('{0} sets',done+'/'+sets.length),openLabel:t(paused?'Resume':'Open workout'),
    dailyLabel:active.dailyPlanTotal>1 && active.dailyPlanIndex>=0 ? t('Workout {0} of {1}',active.dailyPlanIndex+1,active.dailyPlanTotal) : '',
    restEndsAt:rest?.endsAt > now ? rest.endsAt : 0,
    autoFinishAt:paused?0:lastWorkoutActivity(active)+INACTIVITY_AUTO_FINISH_MINUTES*60000}
}
let queue=Promise.resolve()
let permissionRequested=false
export function syncWorkoutNotification(active,rest) {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform()!=='android') return Promise.resolve(false)
  const state=workoutNotificationState(active,rest)
  state.accentColor=getComputedStyle(document.documentElement).getPropertyValue('--acc').trim()
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

export async function publishWorkoutCompletion(workout) {
  const title=t('Workout complete!'), body=workout.name || t('Workout')
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform()==='android') {
    queue=queue.catch(()=>false).then(()=>native.sync({active:false,completed:true,name:body,workoutLabel:title,elapsedMs:workoutElapsedMs(workout),progressLabel:t('{0} sets',(workout.entries || []).flatMap(e=>e.sets || []).filter(s=>s.done).length),accentColor:getComputedStyle(document.documentElement).getPropertyValue('--acc').trim()})).catch(()=>false)
    return queue
  }
  if (document.visibilityState==='hidden' && typeof Notification!=='undefined' && Notification.permission==='granted') {
    try { const reg=await navigator.serviceWorker?.getRegistration(); await reg?.showNotification(title,{body,tag:'workout-complete',icon:'icon-192.png',silent:true}) } catch { /* Notifications are optional; history is already saved. */ }
  }
}
