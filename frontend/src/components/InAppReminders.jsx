import {useNavigate} from 'react-router-dom'
import {useStore} from '../store/useStore.js'
import {useUI} from '../store/useUI.js'
import {useLocalNow} from '../lib/use-local-now.js'
import {isoOf,fmtDate} from '../lib/format.js'
import {t} from '../lib/i18n.js'
import {inAppReminderItems,inAppReminderMode,dismissInAppReminder} from '../lib/in-app-reminders.js'
import {workoutReminderDateLabel} from '../lib/workout-reminder-label.js'
import {measurementRemindersSheet} from '../sheets.jsx'
import {ScheduleEditor} from './DailyPlan.jsx'
import Icon from './Icon.jsx'
import './InAppReminders.css'

export function InAppReminderSettings(){
 const S=useStore(s=>s.S),update=useStore(s=>s.update)
 return <div className="inapp-reminder-settings"><label>{t('In-app reminders')}<select className="field" value={inAppReminderMode(S)} onChange={e=>update(s=>{s.inAppReminderMode=e.target.value})}>{[['both','Same day and day before'],['today','Same day only'],['previous','Day before only'],['off','Off']].map(([value,label])=><option key={value} value={value}>{t(label)}</option>)}</select></label><p>{t('Shown in TGym even when device notifications are off. Applies to workout, measurement and deload reminders.')}</p></div>
}

export default function InAppReminders(){
 const S=useStore(s=>s.S),update=useStore(s=>s.update),now=useLocalNow(),nav=useNavigate()
 const today=isoOf(now),items=inAppReminderItems(S,today)
 if(!items.length)return null
 const open=item=>item.kind==='measurement'?measurementRemindersSheet(item.metric):item.kind==='workout'?useUI.getState().openSheet(close=><ScheduleEditor iso={item.date} close={close}/>):nav('/settings')
 return <section className="card inapp-reminders" aria-label={t('In-app reminders')}><h2><Icon name="bell"/>{t('Reminders')}</h2><ul>{items.map(item=><li key={item.id}><button className="inapp-reminder-open" onClick={()=>open(item)}><strong>{t(item.kind==='measurement'?item.label:item.kind==='deload'?'Deload week':'Workout reminder')}</strong><span>{item.kind==='workout'?workoutReminderDateLabel(S,item.date,today):t(item.today?'Due today':'Tomorrow')+' · '+fmtDate(item.date,true)}{item.names?' · '+item.names.join(', '):''}</span></button><button className="iconbtn" aria-label={t('Dismiss reminder')} onClick={()=>update(s=>dismissInAppReminder(s,item.id))}><Icon name="xmark"/></button></li>)}</ul></section>
}
