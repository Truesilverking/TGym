import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { todayISO, fmtDate } from '../lib/format.js'
import { REMINDER_METRICS, measurementReminders, reminderInterval, postponeMeasurement } from '../lib/measurement-reminders.js'
import { MOBILE, syncReminder } from '../lib/mobile.js'
import { Button, Row, Stepper, Switch } from './ui.jsx'

export default function MeasurementReminders({ initialMetric = 'weight', onRecord }) {
  const S = useStore(s => s.S), update = useStore(s => s.update)
  const [metric, setMetric] = useState(initialMetric), [busy, setBusy] = useState(false)
  const config = S.measurementReminders?.items?.[metric] || {}
  const interval = reminderInterval(config)
  const reminders = measurementReminders(S), current = reminders.find(r => r.metric === metric)
  const patch = changes => update(s => {
    s.measurementReminders ||= { time: '08:00', notifications: false, items: {} }
    s.measurementReminders.items ||= {}
    s.measurementReminders.items[metric] = { id: `measurement:${metric}`, anchorDate: todayISO(), intervalValue: metric === 'weight' ? 1 : 2, intervalUnit: 'weeks', ...s.measurementReminders.items[metric], ...changes }
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
    const allowed = await syncReminder(next, enabled)
    if (!enabled || allowed) update(s => { s.measurementReminders = { time: '08:00', items: {}, ...s.measurementReminders, notifications: enabled } })
    else useUI.getState().toast(t('Enable notifications in your device settings.'))
    setBusy(false)
  }
  return <><h3>{t('Measurement reminders')}</h3>
    <p className="small muted">{t('Optional tracking reminders. They never affect your training streak.')}</p>
    <label>{t('Measurement')}<select className="field" value={metric} onChange={e => setMetric(e.target.value)}>{REMINDER_METRICS.map(([key, label]) => <option key={key} value={key}>{t(label)}</option>)}</select></label>
    <label>{t('Measurement reminder')}<select className="field" value={preset} onChange={e => choosePreset(e.target.value)}>{[['off','Off'],['1','Every week'],['2','Every 2 weeks'],['month','Monthly'],['custom','Custom']].map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select></label>
    {preset === 'custom' && <div className="measurement-reminder-interval"><Stepper label={t('Repeat every')} value={interval.value} min={1} max={{days:365,weeks:52,months:12}[interval.unit]} step={1} onChange={intervalValue => patch({intervalValue, overrideUntil:null})} /><select aria-label={t('Interval unit')} className="field" value={interval.unit} onChange={e => patch({intervalUnit:e.target.value, overrideUntil:null})}>{[['days','Days'],['weeks','Weeks'],['months','Months']].map(([key,label]) => <option key={key} value={key}>{t(label)}</option>)}</select></div>}
    {current && <div className="card"><b>{t(current.status)}</b><p>{t('Next: {0}', fmtDate(current.due, true))}</p><Button onClick={() => onRecord(metric)}>{t('Record measurement')}</Button><Button onClick={() => update(s => postponeMeasurement(s, metric))}>{t('Remind me tomorrow')}</Button><Button onClick={() => update(s => postponeMeasurement(s, metric, true))}>{t('Skip this reminder')}</Button></div>}
    <div className="list">{MOBILE && <Row title={t('Measurement notifications')}><Switch checked={!!S.measurementReminders?.notifications} disabled={busy} onChange={notifications} /></Row>}<Row className="measurement-reminder-time" title={t('Reminder time')}><input className="field" aria-label={t('Reminder time')} type="time" value={S.measurementReminders?.time || '08:00'} onChange={e => update(s => { s.measurementReminders = { items:{}, ...s.measurementReminders, time:e.target.value } })} /></Row></div>
    <h4>{t('Measurement reminders')}</h4><div className="list">{reminders.map(r => <Row key={r.id} title={t(r.label)} subtitle={`${t(r.status)} · ${fmtDate(r.due, true)}`} accessory="chevron" onClick={() => setMetric(r.metric)} />)}</div>
  </>
}
