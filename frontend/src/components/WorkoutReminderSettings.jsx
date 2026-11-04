import { useStore, DEF } from '../store/useStore.js'
import { routineIds } from '../lib/daily-plan.js'
import { localTZ, DAYN, DAYS } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { MOBILE } from '../lib/mobile.js'
import ReminderPanel, { ReminderStatus, useReminderActions } from './ReminderPanel.jsx'
import { Row, Switch } from './ui.jsx'
import ReminderTimeField from './ReminderTimeField.jsx'

export default function WorkoutReminderSettings({ serverReady = false }) {
  const S = useStore(s=>s.S), {commit,busy,error} = useReminderActions('workout')
  const r = {...DEF.reminder,...S.reminder}
  const patch = (changes, interactive=false) => commit(s=>{s.reminder={...DEF.reminder,...s.reminder,...changes,tz:localTZ()}},interactive)
  const timeZone=MOBILE || !serverReady ? localTZ() : r.tz||localTZ()
  const days = Object.keys(S.week || {}).filter(day=>routineIds(S.week[day]).some(id=>(S.routines||[]).some(r=>r.id===id))).map(Number).sort((a,b)=>(a||7)-(b||7))
  const hasSchedule = days.length || Object.values(S.dayPlan || {}).some(value=>routineIds(value).some(id=>(S.routines||[]).some(r=>r.id===id)))
  const timeField = (label,value,change) => <ReminderTimeField label={label} value={value} onChange={change} timeZone={timeZone}/>
  return <ReminderPanel title={t('Workout day reminder')} description={t('Reminds you at this time on days that have a routine planned.')} icon="calendar" checked={!!r.on} busy={busy} onToggle={v=>patch({on:v},v)}>
    {!!days.length && <div className="reminder-days" role="list" aria-label={t('Training days')}>{[1,2,3,4,5,6,0].map(day=><span role="listitem" key={day} className={days.includes(day)?'scheduled':''} title={t(DAYN[day])} aria-label={t(DAYN[day])+(days.includes(day)?' · '+t('Scheduled'):'')}>{t(DAYS[day])}</span>)}</div>}
    {!hasSchedule && <p className="small muted">{t('Add a workout to your schedule')}</p>}
    <div className="reminder-times">
      {timeField(t('Reminder time'),r.time??'08:00',v=>patch({time:v}))}
    </div>
    <p className="reminder-time-zone">{t('Time zone')}: {timeZone}</p>
    {MOBILE && <>
      <details className="reminder-details"><summary>{t('Advanced')}</summary>
        <div className="reminder-times">{timeField(t('Next workout reminder'),r.nextTime??'19:00',v=>patch({nextTime:v}))}</div>
        <p className="reminder-note">{t('The next-workout reminder is sent in advance at this time.')}</p>
        {!!days.length && <><h4>{t('Times by training day')}</h4><div className="reminder-times">{days.map(day=><div key={day}>{timeField(t(DAYN[day]),r.dayTimes?.[day]??r.time??'08:00',v=>patch({dayTimes:{...(useStore.getState().S.reminder?.dayTimes||{}),[day]:v}}))}</div>)}</div></>}
        <Row icon="moon" title={t('Quiet hours')}><Switch checked={!!r.quietOn} disabled={busy} onChange={v=>patch({quietOn:v})}/></Row>
        {r.quietOn && <div className="reminder-times">{timeField(t('Quiet period')+' · '+t('Start'),r.quietStart??'22:00',v=>patch({quietStart:v}))}{timeField(t('Quiet period')+' · '+t('End'),r.quietEnd??'07:00',v=>patch({quietEnd:v}))}</div>}
        <p className="reminder-note">{t('Uses your training calendar. Completed workouts and training breaks are respected.')}</p>
      </details>
    </>}
    {serverReady && !MOBILE ? error && <p className="reminder-feedback" role="alert">{error}</p> : <ReminderStatus kind="workout" enabled={r.on} error={error} onRetry={()=>patch({},true)}/>}
  </ReminderPanel>
}
