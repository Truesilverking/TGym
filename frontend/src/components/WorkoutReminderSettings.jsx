import { useStore, DEF } from '../store/useStore.js'
import { routineIds } from '../lib/daily-plan.js'
import { localTZ, DAYN } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { MOBILE } from '../lib/mobile.js'
import ReminderPanel, { ReminderStatus, useReminderActions } from './ReminderPanel.jsx'
import Icon from './Icon.jsx'
import { Row, Switch } from './ui.jsx'

export default function WorkoutReminderSettings({ serverReady = false }) {
  const S = useStore(s=>s.S), {commit,busy,error} = useReminderActions('workout')
  const r = {...DEF.reminder,...S.reminder}
  const patch = (changes, interactive=false) => commit(s=>{s.reminder={...DEF.reminder,...s.reminder,...changes,tz:localTZ()}},interactive)
  const days = Object.keys(S.week || {}).filter(day=>routineIds(S.week[day]).some(id=>(S.routines||[]).some(r=>r.id===id))).map(Number).sort((a,b)=>(a||7)-(b||7))
  const hasSchedule = days.length || Object.values(S.dayPlan || {}).some(value=>routineIds(value).some(id=>(S.routines||[]).some(r=>r.id===id)))
  const timeField = (label,value,change) => <label className="reminder-time">{label}<input className="field" type="time" value={value} onChange={e=>{if(/^([01]\d|2[0-3]):[0-5]\d$/.test(e.target.value))change(e.target.value)}}/></label>
  return <ReminderPanel title={t('Workout day reminder')} description={t('Uses your training calendar. Completed workouts and training breaks are respected.')} icon="calendar" checked={!!r.on} busy={busy} onToggle={v=>patch({on:v},v)} summary={r.on ? t('Reminds you at this time on days that have a routine planned.') : t('Turn it on when you want reminders for your planned workouts.')}>
    <div className="reminder-days" aria-label={t('Training days')}>{days.map(day=><span key={day}><Icon name="check"/>{t(DAYN[day])}</span>)}</div>
    {!hasSchedule && <p className="small muted">{t('Add a workout to your schedule')}</p>}
    <div className="reminder-times">
      {timeField(t('Reminder time'),r.time,v=>patch({time:v}))}
      {MOBILE && timeField(t('Next workout reminder'),r.nextTime||'19:00',v=>patch({nextTime:v}))}
    </div>
    {MOBILE && <>
      <p className="small muted">{t('The next-workout reminder is sent in advance at this time.')}</p>
      <details className="reminder-details"><summary>{t('Times by training day')}</summary><div className="reminder-times">{days.map(day=><div key={day}>{timeField(t(DAYN[day]),r.dayTimes?.[day]||r.time,v=>patch({dayTimes:{...(useStore.getState().S.reminder?.dayTimes||{}),[day]:v}}))}</div>)}</div></details>
      <Row icon="moon" title={t('Quiet hours')}><Switch checked={!!r.quietOn} onChange={v=>patch({quietOn:v})}/></Row>
      {r.quietOn && <div className="reminder-times">{timeField(t('Quiet period')+' · '+t('Start'),r.quietStart||'22:00',v=>patch({quietStart:v}))}{timeField(t('Quiet period')+' · '+t('End'),r.quietEnd||'07:00',v=>patch({quietEnd:v}))}</div>}
    </>}
    {serverReady && !MOBILE ? error ? <p className="reminder-feedback" role="alert">{error}</p> : <p className="reminder-feedback" role="status">{r.on ? t('Timezone: {0} (auto-detected, updates if you travel).',r.tz||localTZ()) : t('Off')}</p> : <ReminderStatus kind="workout" enabled={r.on} error={error} onRetry={()=>patch({},true)}/>}
  </ReminderPanel>
}
