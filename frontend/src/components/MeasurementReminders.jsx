import { useId, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { todayISO, fmtDate } from '../lib/format.js'
import { REMINDER_METRICS, reminderCategory, reminderConfig, measurementDates, measurementReminders, reminderInterval, measurementNotificationPlan, postponeMeasurement } from '../lib/measurement-reminders.js'
import { validMeasurementDate } from '../lib/body-records.js'
import Icon from './Icon.jsx'
import { MOBILE } from '../lib/mobile.js'
import { Button, Row, NumberField, Switch } from './ui.jsx'
import ReminderPanel, { ReminderStatus, useReminderActions } from './ReminderPanel.jsx'
import ReminderTimeField from './ReminderTimeField.jsx'

export default function MeasurementReminders({ initialMetric = 'weight', onRecord, settingsOnly = false }) {
  const S = useStore(s => s.S)
  const [metric, setMetric] = useState(reminderCategory(initialMetric)), [date,setDate] = useState(todayISO())
  const editorId=useId()
  const {commit,busy,error} = useReminderActions('measurement')
  const validDate = validMeasurementDate(date,todayISO()), dates = measurementDates(S,metric)
  const config = reminderConfig(S,metric), interval = reminderInterval(config)
  const reminders=measurementReminders(S),current = reminders.find(r => r.metric === metric)
  const label = t(REMINDER_METRICS.find(([key])=>key===metric)?.[1] || 'Measurement')
  const patch = (changes, category=metric) => commit(s => {
    s.measurementReminders ||= { time:'08:00', notifications:false, items:{} }
    s.measurementReminders.items ||= {}
    s.measurementReminders.items[category] = { anchorDate:todayISO(), ...reminderConfig(s,category), id:`measurement:${category}`, ...changes }
  })
  const preset = interval.unit === 'weeks' && [1,2].includes(interval.value) ? String(interval.value) : interval.unit === 'months' && interval.value === 1 ? 'month' : 'custom'
  const choosePreset = value => patch(value === 'custom' ? {intervalUnit:'days',intervalValue:30,overrideUntil:null} : {intervalUnit:value==='month'?'months':'weeks',intervalValue:value==='month'?1:Number(value),overrideUntil:null})
  const notification = measurementNotificationPlan(S).find(n=>n.metrics.includes(metric))
  return <ReminderPanel title={t('Measurement reminders')} icon="scale" description={t('Optional tracking reminders. They never affect your training streak.')}>
    <div className="measurement-reminder-categories" role="group" aria-label={t('Measurement')}>{REMINDER_METRICS.map(([key,title])=>{
      const enabled=!!reminderConfig(S,key).enabled,next=reminders.find(r=>r.metric===key)
      return <div key={key} className={'reminder-metric-toggle'+(metric===key?' selected':'')}>
        <button type="button" className="measurement-reminder-choice" aria-label={t(title)} aria-pressed={metric===key} aria-controls={editorId} onClick={()=>setMetric(key)}><span>{t(title)}</span>{enabled&&next && <small>{t('Next: {0}',fmtDate(next.due,true))+(next.status==='Upcoming'?'':' · '+t(next.status))}</small>}<Icon name="pencil"/></button>
        <Switch aria-label={t('Measurement reminder')+' · '+t(title)} checked={enabled} disabled={busy} onChange={value=>patch({enabled:value},key)}/>
      </div>
    })}</div>
    <div className="reminder-fields" id={editorId} aria-label={t('Measurement reminder')+' · '+label}>
      <label className="field-label">{t('Frequency')}<select aria-label={t('Measurement reminder')} className="field" value={preset} onChange={e=>choosePreset(e.target.value)}>{[['1','Every week'],['2','Every 2 weeks'],['month','Monthly'],['custom','Custom']].map(([value,title])=><option key={value} value={value}>{t(title)}</option>)}</select></label>
      {preset==='custom' && <div className="measurement-reminder-interval"><label className="field-label">{t('Repeat every')}<NumberField className="field" aria-label={t('Repeat every')} value={interval.value} decimal={false} validation={{min:1,max:{days:365,weeks:52,months:12}[interval.unit],step:1}} retainInvalid onChange={intervalValue=>patch({intervalValue,overrideUntil:null})}/></label><label className="field-label">{t('Interval unit')}<select aria-label={t('Interval unit')} className="field" value={interval.unit} onChange={e=>patch({intervalUnit:e.target.value,intervalValue:Math.min(interval.value,{days:365,weeks:52,months:12}[e.target.value]),overrideUntil:null})}>{[['days','Days'],['weeks','Weeks'],['months','Months']].map(([key,title])=><option key={key} value={key}>{t(title)}</option>)}</select></label></div>}
      <ReminderTimeField label={t('Reminder time')} value={S.measurementReminders?.time ?? '08:00'} showZone onChange={value=>commit(s=>{s.measurementReminders={items:{},...s.measurementReminders,time:value}})}/>
    </div>
    {current && <div className="measurement-reminder-actions"><Button size="sm" onClick={()=>commit(s=>postponeMeasurement(s,metric))}>{t('Remind me tomorrow')}</Button><Button size="sm" onClick={()=>commit(s=>postponeMeasurement(s,metric,true))}>{t('Skip this reminder')}</Button></div>}
    {MOBILE && <Row icon="bell" title={t('Measurement notifications')} subtitle={t('One notification time for all enabled measurements.')}><Switch checked={!!S.measurementReminders?.notifications} disabled={busy} onChange={enabled=>commit(s=>{s.measurementReminders={time:'08:00',items:{},...s.measurementReminders,notifications:enabled}},enabled)}/></Row>}
    <ReminderStatus kind="measurement" enabled={MOBILE ? !!S.measurementReminders?.notifications : !!config.enabled} error={error} onRetry={()=>commit(()=>{},true)}/>
    {config.enabled && S.measurementReminders?.notifications && !notification && <p className="small muted">{t('Overdue reminders remain in the calendar; no repeated alerts are sent.')}</p>}
    {!settingsOnly && <section className="measurement-reminder-record">
      <h4>{t('Record measurement')}</h4><p className="small muted">{dates.length ? t('Last recorded')+' · '+fmtDate(dates.at(-1),true) : t('No data yet')}</p>
      <label className="field-label">{t('Date')}<input type="date" aria-label={t('Date')} className="field" value={date} max={todayISO()} onChange={e=>setDate(e.target.value)}/></label>
      {!validDate && <p role="alert" className="small">{t('Check the date and highlighted values.')}</p>}
      <Button variant="primary" disabled={!validDate} onClick={()=>onRecord?.(metric,date)}>{t('Record measurement')}</Button>
    </section>}
  </ReminderPanel>
}
