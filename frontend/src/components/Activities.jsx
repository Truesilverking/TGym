import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { isoOf, fmtNum, fmtDate } from '../lib/format.js'
import { ACTIVITY_TYPES, activityType, createActivityWorkout, hybridSummary, mergeImportedActivities, planActivity, activityPace } from '../lib/activities.js'
import { workoutElapsedMs } from '../lib/workout-time.js'
import { healthConnectAdapter } from '../lib/health/adapters/health-connect.js'
import { Button, TextField, TextArea, NumberField, Segmented } from './ui.jsx'
import './Activities.css'

export const openHealthActivities = () => useUI.getState().openSheet(() => <HealthActivities />)
export const openActivityEditor = (options={}) => useUI.getState().openSheet(close => <ActivityEditor {...options} close={close} />)
const localTime = ms => { const d=new Date(ms);return `${isoOf(d)}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` }
const fields=[['distanceKm','Distance (km)',0,2000],['averageHeartRate','Average heart rate (bpm)',25,250],['calories','Energy (kcal)',0,30000],['steps','Steps',0,300000],['elevationM','Elevation gain (m)',0,20000],['hrZone','Heart rate zone',1,5],['rpe','Perceived effort (1–10)',1,10]]
export function ActivityMetrics({workout}) {
  const a=workout.activity
  if (!a) return null
  const pace=activityPace({...a,minutes:workoutElapsedMs(workout)/60000})
  return <div className="activity-metrics">{fields.filter(([k])=>a[k]!=null).map(([k,label])=><span key={k}><small>{t(label)}</small><b>{fmtNum(a[k])}</b></span>)}{pace && <span><small>{t('Speed (km/h)')}</small><b>{fmtNum(60/pace)}</b></span>}{pace && <span><small>{t('Pace (min/km)')}</small><b>{Math.floor(Math.round(pace*60)/60)}:{String(Math.round(pace*60)%60).padStart(2,'0')}</b></span>}<span><small>{t('Source')}</small><b>{a.source==='manual'?t('Manual'): 'Health Connect'}</b></span></div>
}
export function ActivityEditor({close, existing, routineId: initialRoutine, planning=false}) {
  const S=useStore(s=>s.S), [mode,setMode]=useState(planning || initialRoutine ? 'plan':'log')
  const [type,setType]=useState(existing?.activity?.type || 'running'), [minutes,setMinutes]=useState(existing ? workoutElapsedMs(existing)/60000 : 30)
  const [start,setStart]=useState(localTime(existing?.start || Date.now()-30*60000)), [date,setDate]=useState(isoOf(new Date())), [repeat,setRepeat]=useState(false), [days,setDays]=useState([])
  const [routineId,setRoutineId]=useState(initialRoutine || ''), [values,setValues]=useState(existing?.activity || {}), [note,setNote]=useState(existing?.note || ''), [error,setError]=useState(''),[busy,setBusy]=useState(false),[committed,setCommitted]=useState(false)
  const kind=activityType(type)
  const save=async e=>{e.preventDefault();setBusy(true);setError('');try {
    if(!committed) { useStore.getState().update(s=>{
      if(mode==='plan') { planActivity(s,{type,minutes,name:t(kind.label),routineId,date:repeat?'':date,weekdays:days});return }
      const w=createActivityWorkout(s,{...values,type,minutes,name:existing?.name || t(kind.label),start:new Date(start).getTime(),note,id:existing?.id,routineId:existing?.routineId})
      const index=existing ? s.workouts.findIndex(w=>w.id===existing.id) : -1
      if(existing && index<0) throw new Error('Activity no longer exists')
      if(index>=0) s.workouts[index]=w;else s.workouts.push(w)
    });setCommitted(true) }
    await useStore.getState().flushPersistence(); close()
  } catch(e){setError(t(['Invalid activity value','Invalid activity date or duration','Choose a date or weekdays','Routine no longer exists','Activity no longer exists','Activity already belongs to this routine'].includes(e.message) ? e.message : 'Could not save. Check available storage and try again.'))}finally{setBusy(false)}}
  return <form className="activity-form" onSubmit={e=>{if(e.nativeEvent.submitter?.dataset.activitySave==='true')void save(e);else e.preventDefault()}}><h3>{t(existing?'Edit activity':'Activities')}</h3>
    {!existing && !initialRoutine && <Segmented value={mode} onChange={setMode} options={[{value:'log',label:t('Log activity')},{value:'plan',label:t('Plan activity')}]} />}
    <fieldset disabled={busy || committed}><legend>{t('Activity details')}</legend><label>{t('Activity type')}<select className="field" value={type} onChange={e=>setType(e.target.value)}>{ACTIVITY_TYPES.map(a=><option key={a.id} value={a.id}>{t(a.label)}</option>)}</select></label>
    <label>{t('Duration (min)')}<NumberField nullable value={minutes} onChange={setMinutes} aria-label={t('Duration (min)')} /></label>
    {mode==='log'?<label>{t('Start time')}<TextField type="datetime-local" required value={start} onChange={e=>setStart(e.target.value)} /></label>:<>
      <label>{t('Add to existing routine')}<select className="field" value={routineId} onChange={e=>setRoutineId(e.target.value)}><option value="">{t('Create activity routine')}</option>{S.routines.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
      {!routineId && <><Segmented value={repeat} onChange={setRepeat} options={[{value:false,label:t('Specific date')},{value:true,label:t('Weekly')}]} />{repeat?<div className="activity-week">{['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((day,i)=><Button type="button" key={day} aria-pressed={days.includes(i)} variant={days.includes(i)?'tinted':undefined} onClick={()=>setDays(ds=>ds.includes(i)?ds.filter(d=>d!==i):[...ds,i])}>{t(day)}</Button>)}</div>:<label>{t('Date')}<TextField type="date" required min={isoOf(new Date())} value={date} onChange={e=>setDate(e.target.value)} /></label>}</>}
      <p className="dim small">{t('Activity routines use your calendar, reminders and streak rules. Adding an activity to a routine creates a hybrid session.')}</p>
    </>}</fieldset>
    {mode==='log' && <fieldset disabled={busy || committed}><legend>{t('Optional measurements')}</legend><p className="dim small">{t('Leave unavailable measurements empty.')}</p><div className="activity-fields">{fields.filter(([k])=>k==='distanceKm'?kind.distance:k==='steps'?kind.steps:k==='elevationM'?kind.elevation:true).map(([k,label,min,max])=><label key={k}>{t(label)}<NumberField nullable value={values[k]??null} onChange={v=>setValues(a=>({...a,[k]:v}))} aria-label={t(label)} placeholder={`${min}–${max}`} /></label>)}</div><label>{t('Notes')}<TextArea maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} /></label></fieldset>}
    {error && <p role="alert" className="activity-error">{error}</p>}<Button type="submit" data-activity-save="true" variant="primary" disabled={busy}>{t(busy?'Saving…':committed?'Retry saving':'Save')}</Button>
  </form>
}
export function HybridSummary({S}) {
  const [period,setPeriod]=useState('30'), cutoff=period==='all'?'':isoOf(new Date(Date.now()-Number(period)*86400000)), data=hybridSummary(S.workouts.filter(w=>!cutoff || w.d>=cutoff))
  return <section className="card hybrid-summary"><div className="row between"><h2>{t('Training overview')}</h2><Button size="sm" onClick={openHealthActivities}>{t('Activities')}</Button></div><Segmented value={period} onChange={setPeriod} options={[{value:'30',label:t('30 days')},{value:'90',label:t('90 days')},{value:'all',label:t('All')}]} /><div className="activity-metrics">{[['Strength sessions',data.strength],['Runs',data.running],['Other cardio',data.cardio],['Recovery sessions',data.recovery],['Active days',data.days],['Total time (min)',Math.round(data.minutes)],['Distance (km)',fmtNum(data.distanceKm)]].map(([label,value])=><span key={label}><small>{t(label)}</small><b>{value}</b></span>)}</div>{data.ratedActivities>0 && <p className="dim small">{t('Activity effort load (minutes × RPE)')}: {Math.round(data.load)} · {t('{0} rated activities',data.ratedActivities)}</p>}<p className="dim small">{t('Hybrid sessions may appear in several categories. Total time and active days are counted once. Activity effort is separate from strength volume.')}</p></section>
}
export function HealthActivities() {
  const S=useStore(s=>s.S), [status,setStatus]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('')
  const refresh=()=>healthConnectAdapter.status().then(setStatus).catch(()=>setStatus({available:false,granted:false}))
  useEffect(()=>{refresh();const resume=()=>{if(!document.hidden)refresh()};document.addEventListener('visibilitychange',resume);return()=>document.removeEventListener('visibilitychange',resume)},[])
  const run=async action=>{setBusy(true);setError('');setMessage('');try{await action()}catch{setError(t('Health data could not be read. Check permissions and try again.'))}finally{await refresh();setBusy(false)}}
  const sync=()=>run(async()=>{const current=await healthConnectAdapter.status();if(!current.granted)throw Error('permissions');const {records}=await healthConnectAdapter.read();let result;useStore.getState().update(s=>{result=mergeImportedActivities(s,records);s.healthConnection={enabled:true,lastSync:Date.now()}});await useStore.getState().flushPersistence();setMessage(t('Added {0} · updated {1} · unchanged {2}',result.added,result.updated,result.skipped))})
  const connected=!!S.healthConnection?.enabled && !!status?.granted
  const rows=[...S.workouts].filter(w=>w.activity).sort((a,b)=>b.start-a.start)
  return <div className="health-activities"><h3>{t('Health & wearables')}</h3><p className="dim">{t('Plan and record activities alongside your strength training.')}</p><div className="activity-actions"><Button variant="primary" onClick={()=>openActivityEditor()}>{t('Log activity')}</Button><Button onClick={()=>openActivityEditor({planning:true})}>{t('Plan activity')}</Button></div>
    <section className="card"><div className="row between"><b>Health Connect</b><span className="dim small">{t(!status?'Checking…':connected?'Connected':status.available?'Not connected':'Unavailable on this device')}</span></div>
      <p className="dim small">{t('Read exercise sessions from the last 30 days on Android 14 or newer. Imports include type, duration and source. Other measurements can be entered manually. No location routes or write permissions are requested. Imported records stay in your history and backups after disconnecting.')}</p>
      {status?.available && <><div className="activity-actions">{connected?<><Button disabled={busy} onClick={sync}>{t('Sync now')}</Button><Button disabled={busy} onClick={()=>run(async()=>{useStore.getState().update(s=>{s.healthConnection={...s.healthConnection,enabled:false}});await useStore.getState().flushPersistence()})}>{t('Disconnect')}</Button></>:<Button disabled={busy} onClick={()=>run(async()=>{const result=await healthConnectAdapter.connect();if(!result.granted)throw Error('denied');useStore.getState().update(s=>{s.healthConnection={...s.healthConnection,enabled:true}});await useStore.getState().flushPersistence()})}>{t('Allow exercise access')}</Button>}<Button disabled={busy} onClick={()=>run(()=>healthConnectAdapter.settings())}>{t('Manage permissions')}</Button></div><p className="dim small">{t('Disconnect stops TGym sync. Revoke system access in Manage permissions.')}</p></>}
      {S.healthConnection?.lastSync && <p className="small dim">{t('Last sync')}: {new Date(S.healthConnection.lastSync).toLocaleString()}</p>}
      {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    </section><p className="dim small">{t('Apple Health, Garmin, Fitbit and WHOOP direct connections are not available in this build. You can record activities manually; compatible Android apps can share exercise sessions through Health Connect.')}</p>
    <h3>{t('Activity history')}</h3>{!rows.length?<p className="empty">{t('No activities yet.')}</p>:rows.map(w=><article className="card activity-history" key={w.id}><div className="row between"><div><b>{t(activityType(w.activity.type).label)}</b><div className="dim small">{fmtDate(w.d)} · {fmtNum(workoutElapsedMs(w)/60000)} min</div></div>{w.activity.source==='manual' && <Button size="sm" onClick={()=>openActivityEditor({existing:w})}>{t('Edit')}</Button>}</div><ActivityMetrics workout={w} />{w.note && <p className="small">{w.note}</p>}</article>)}
  </div>
}
