import {isoOf,todayISO} from './format.js'
import {measurementReminders} from './measurement-reminders.js'
import {dailyPlan} from './daily-plan.js'
import {isTrainingPaused,openTrainingPause} from './training-pause.js'
import {deloadStatus} from './training-plan.js'

export const IN_APP_REMINDER_MODES=['both','today','previous','off']
export function inAppReminderMode(S){return IN_APP_REMINDER_MODES.includes(S?.inAppReminderMode)?S.inAppReminderMode:'both'}
export function inAppReminderItems(S,today=todayISO()){
 const mode=inAppReminderMode(S)
 if(mode==='off')return []
 const tomorrow=new Date(today+'T12:00:00');tomorrow.setDate(tomorrow.getDate()+1)
 const dates=mode==='today'?[today]:mode==='previous'?[isoOf(tomorrow)]:[today,isoOf(tomorrow)]
 const hidden=new Set(Array.isArray(S.inAppReminderDismissed)?S.inAppReminderDismissed:[]),items=[]
 const add=item=>{if(!hidden.has(item.id))items.push(item)}
 for(const reminder of measurementReminders(S,today))if(dates.includes(reminder.due))add({id:`measurement:${reminder.metric}:${reminder.due}:${today}`,kind:'measurement',metric:reminder.metric,label:reminder.label,date:reminder.due,today:reminder.due===today})
 for(const date of dates){
  if(S.reminder?.on&&!isTrainingPaused(S,date)){
   const pending=dailyPlan(S,date).pending
   if(pending.length)add({id:`workout:${date}:${today}`,kind:'workout',date,today:date===today,names:pending.map(item=>item.routine.name)})
  }
 }
 if(S.deload?.on&&!openTrainingPause(S)){
  const status=deloadStatus(S,today),start=status.active?status.start:status.nextStart
  if(start&&dates.includes(start)&&!isTrainingPaused(S,start))add({id:`deload:${start}:${today}`,kind:'deload',date:start,today:start===today})
 }
 return items.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id))
}
export function dismissInAppReminder(S,id){
 const ids=Array.isArray(S.inAppReminderDismissed)?S.inAppReminderDismissed:[]
 S.inAppReminderDismissed=[...new Set([...ids,id])].slice(-200)
}
