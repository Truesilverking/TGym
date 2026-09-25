import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { dailyPlan, routineIds, skipDailyRoutine } from '../lib/daily-plan.js'
import { todayISO, DAYN, fmtDate } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'

export function ScheduleEditor({ day, iso, close }) {
  const S = useStore(s=>s.S), update = useStore(s=>s.update), nav = useNavigate()
  const weekday = iso ? new Date(iso+'T12:00:00').getDay() : day
  const ids = routineIds(iso ? S.dayPlan?.[iso] ?? S.week?.[weekday] : S.week?.[day])
  const save = next => update(s=>{s[iso?'dayPlan':'week'] ||= {};s[iso?'dayPlan':'week'][iso || day]=next;s.scheduleStarted ||= todayISO()})
  const move = (index,delta) => {const next=[...ids];[next[index],next[index+delta]]=[next[index+delta],next[index]];save(next)}
  return <div className="schedule-editor">
    <h3>{iso ? fmtDate(iso,true) : t(DAYN[day])}</h3>
    <p className="muted small">{t('Arrange your routines in training order. Each routine is a separate session.')}</p>
    <ol className="daily-plan-list">{ids.map((id,index)=>{
      const routine=S.routines.find(r=>r.id===id)
      return <li key={id}><span className="daily-plan-index">{index+1}</span><button className="daily-plan-name" onClick={()=>{close();nav('/plan/r/'+id)}}>{routine?.name || id}<small>{t('Edit')}</small></button>
        <div className="daily-plan-controls"><button className="iconbtn" disabled={!index} aria-label={t('Move up')} onClick={()=>move(index,-1)}><Icon name="arrowUp"/></button><button className="iconbtn" disabled={index===ids.length-1} aria-label={t('Move down')} onClick={()=>move(index,1)}><Icon name="arrowDown"/></button><button className="iconbtn" aria-label={t('Remove routine')} onClick={()=>save(ids.filter(x=>x!==id))}><Icon name="xmark"/></button></div></li>
    })}</ol>
    {!ids.length && <p className="muted">{t('Rest day')}</p>}
    <div className="schedule-add">{S.routines.filter(r=>!ids.includes(r.id)).map(r=><Button key={r.id} icon="plus" onClick={()=>save([...ids,r.id])}>{r.name}</Button>)}</div>
    {S.reminder?.on && <label className="schedule-reminder">{t('Workout reminder')}<input aria-label={t('Workout reminder')} type="time" value={S.reminder.dayTimes?.[weekday] || S.reminder.time || '08:00'} onChange={e=>update(s=>{s.reminder.dayTimes={...s.reminder.dayTimes,[weekday]:e.target.value}})}/></label>}
    {iso && S.dayPlan?.[iso] !== undefined && <Button onClick={()=>update(s=>{delete s.dayPlan[iso]})}>{t('Back to weekly plan')}</Button>}
    <Button variant="primary" onClick={close}>{t('Done')}</Button>
  </div>
}

export default function DailyPlan({ date=todayISO(), onStart, compact=false }) {
  const S=useStore(s=>s.S),update=useStore(s=>s.update),plan=dailyPlan(S,date)
  if (!plan.total || compact && plan.total===1) return null
  return <section className="daily-plan card" aria-label={t('Daily training plan')}>
    <div className="daily-plan-heading"><h2>{t('Daily training plan')}</h2><span>{t('{0}/{1} completed',plan.completed,plan.total)}</span></div>
    <div className="daily-plan-track" role="progressbar" aria-label={t('Daily training plan')} aria-valuenow={plan.completed} aria-valuemax={plan.total} aria-valuemin={0}>{plan.items.map(item=><i key={item.id} className={item.status}/>)}</div>
    <ol className="daily-plan-list">{plan.items.map(item=><li key={item.id} className={item.status}>
      <span className="daily-plan-index">{item.status==='completed'?<Icon name="check"/>:item.index+1}</span>
      <div className="daily-plan-name">{item.routine.name}<small>{t(item.status==='completed'?'Completed':item.status==='skipped'?'Skipped':'Pending')}</small></div>
      {item.status==='pending' && !S.active && onStart && <div className="daily-plan-controls"><Button size="sm" onClick={()=>onStart(item.id)}>{t('Start')}</Button><button className="iconbtn" aria-label={t('Skip today')} onClick={()=>update(s=>skipDailyRoutine(s,date,item.id))}><Icon name="chevronRight"/></button></div>}
      {item.status==='skipped' && <Button size="sm" onClick={()=>update(s=>{s.daySkipped[date]=routineIds(s.daySkipped[date]).filter(id=>id!==item.id)})}>{t('Undo')}</Button>}
    </li>)}</ol>
  </section>
}
