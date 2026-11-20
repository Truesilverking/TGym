import {fmtDate,isoOf,todayISO} from './format.js'
import {t} from './i18n-core.js'

// Presentation only. A date override is an explicit calendar appointment;
// otherwise the reminder follows the recurring weekly training schedule.
export function workoutReminderDateLabel(S,date,today=todayISO(),formatDate=value=>fmtDate(value,true),scheduledDate=date){
 if(S.dayPlan?.[scheduledDate]===undefined){
  if(date===today)return t('Today')
  const tomorrow=new Date(today+'T12:00:00')
  tomorrow.setDate(tomorrow.getDate()+1)
  if(date===isoOf(tomorrow))return t('Tomorrow')
 }
 return formatDate(date)
}
