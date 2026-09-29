import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { todayISO, fmtDate } from '../lib/format.js'
import { REMINDER_METRICS, reminderCategory, reminderConfig, measurementDates, measurementReminders, reminderInterval, postponeMeasurement } from '../lib/measurement-reminders.js'
import { validMeasurementDate } from '../lib/body-records.js'
import Icon from './Icon.jsx'
import { MOBILE, syncReminder } from '../lib/mobile.js'
import { Button, Row, Stepper, Switch } from './ui.jsx'

export default function MeasurementReminders({ initialMetric = 'weight', onRecord }) {
  const S = useStore(s => s.S), update = useStore(s => s.update)
  const [metric, setMetric] = useState(reminderCategory(initialMetric)), [busy, setBusy] = useState(false)
  const [date,setDate]=useState(todayISO())
  const validDate=validMeasurementDate(date,todayISO())
  const dates=measurementDates(S,metric)
  const config = reminderConfig(S, metric)
  const interval = reminderInterval(config)
  const reminders = measurementReminders(S), current = reminders.find(r => r.metric === metric)
  const patch = changes => update(s => {
    s.measurementReminders ||= { time: '08:00', notifications: false, items: {} }
    s.measurementReminders.items ||= {}
    s.measurementReminders.items[metric] = { anchorDate: todayISO(), ...reminderConfig(s, metric), id: `measurement:${metric}`, ...changes }
  })
  const preset = !config.enabled ? 'off' : interval.unit === 'weeks' && [1, 2].includes(interval.value) ? String(interval.value) : interval.unit === 'months' && interval.value === 1 ? 'month' : 'custom'
  const choosePreset = value => {
    if (value === 'off') { patch({ enabled: false }); return }
    patch({ enabled: true, intervalUnit: value === 'month' ? 'months' : value === 'custom' ? 'days' : 'weeks', intervalValue: value === 'custom' ? 30 : value === 'month' ? 1 : Number(value), overrideUntil: null })
  }
  const notifications = async enabled => {
    if (busy) return
    setBusy(true)
    const next = { ...S, measurementReminders: { ...S.measurementReminders, notifications: enabled } }
    try {
    const allowed = await syncReminder(next, enabled)
    if (!enabled || allowed) update(s => { s.measurementReminders = { time: '08:00', items: {}, ...s.measurementReminders, notifications: enabled } })
    else useUI.getState().toast(t('Enable notifications in your device settings.'))
    } catch {useUI.getState().toast(t('Enable notifications in your device settings.'))} finally {setBusy(false)}
  }
  return <div className="measurement-reminder-dashboard">
    <header><span className="lrow-i"><Icon name="bell"/></span><div><h3>{t('Measurement reminders')}</h3><p className="small muted">{t('Optional tracking reminders. They never affect your training streak.')}</p></div></header>
    <div className="measurement-reminder-categories" role="group" aria-label={t('Measurement')}>{REMINDER_METRICS.map(([key,label])=><button type="button" key={key} className={'chip'+(metric===key?' on':'')} aria-pressed={metric===key} onClick={()=>setMetric(key)}>{t(label)}</button>)}</div>
    <section className="card measurement-reminder-record">
      <div className="row between"><h4>{t(REMINDER_METRICS.find(([key])=>key===metric)?.[1] || 'Measurement')}</h4><span className="tag acc">{t(current?.status || 'Off')}</span></div>
      <p className="small muted">{dates.length ? t('Last recorded')+' · '+fmtDate(dates.at(-1),true) : t('No data yet')}</p>
      <label className="field-label">{t('Date')}<input type="date" aria-label={t('Date')} className="field" value={date} max={todayISO()} onChange={e=>setDate(e.target.value)}/></label>
      {!validDate && <p role="alert" className="small">{t('Check the date and highlighted values.')}</p>}
      <Button variant="primary" disabled={!validDate} onClick={()=>onRecord(metric,date)}>{t('Record measurement')}</Button>
    </section>
    <section className="measurement-reminder-schedule">
      <label className="field-label">{t('Measurement reminder')}<select aria-label={t('Measurement reminder')} className="field" value={preset} onChange={e=>choosePreset(e.target.value)}>{[['off','Off'],['1','Every week'],['2','Every 2 weeks'],['month','Monthly'],['custom','Custom']].map(([value,label])=><option key={value} value={value}>{t(label)}</option>)}</select></label>
      {preset==='custom' && <div className="measurement-reminder-interval"><Stepper label={t('Repeat every')} value={interval.value} min={1} max={{days:365,weeks:52,months:12}[interval.unit]} step={1} onChange={intervalValue=>patch({intervalValue,overrideUntil:null})}/><select aria-label={t('Interval unit')} className="field" value={interval.unit} onChange={e=>patch({intervalUnit:e.target.value,overrideUntil:null})}>{[['days','Days'],['weeks','Weeks'],['months','Months']].map(([key,label])=><option key={key} value={key}>{t(label)}</option>)}</select></div>}
      {current && <><p className="small muted">{t('Next: {0}',fmtDate(current.due,true))}</p><div className="measurement-reminder-actions"><Button size="sm" onClick={()=>update(s=>postponeMeasurement(s,metric))}>{t('Remind me tomorrow')}</Button><Button size="sm" onClick={()=>update(s=>postponeMeasurement(s,metric,true))}>{t('Skip this reminder')}</Button></div></>}
      <div className="list">{MOBILE && <Row title={t('Measurement notifications')}><Switch checked={!!S.measurementReminders?.notifications} disabled={busy} onChange={notifications}/></Row>}<Row className="measurement-reminder-time" title={t('Reminder time')}><input className="field" aria-label={t('Reminder time')} type="time" value={S.measurementReminders?.time || '08:00'} onChange={e=>{if(/^([01]\d|2[0-3]):[0-5]\d$/.test(e.target.value))update(s=>{s.measurementReminders={items:{},...s.measurementReminders,time:e.target.value}})}}/></Row></div>
    </section>
  </div>
}
