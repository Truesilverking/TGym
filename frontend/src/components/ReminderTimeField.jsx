import { useId } from 'react'
import { dateLocale, t } from '../lib/i18n.js'
import { localTZ } from '../lib/format.js'
import Icon from './Icon.jsx'
import './ReminderPanel.css'

export const validReminderTime = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value || '')

// Keep the saved wall-clock value untouched. The native picker follows the
// device's 12/24-hour preference; its large field remains usable without a mouse.
export default function ReminderTimeField({ label, value, onChange, timeZone = localTZ(), disabled = false, showZone = false }) {
  const id = useId(), zoneId = useId(),errorId=useId(),invalid=!validReminderTime(value)
  const description=[showZone?zoneId:null,invalid?errorId:null].filter(Boolean).join(' ')||undefined
  return <div className="reminder-time">
    <label htmlFor={id}>{label}</label>
    <div className="reminder-time-control"><Icon name="clock"/><input id={id} className="field" type="time" lang={dateLocale()} step="60" value={value} disabled={disabled}
      aria-invalid={invalid||undefined} aria-describedby={description} onChange={e => { if (validReminderTime(e.target.value) && e.target.value !== value) onChange(e.target.value) }}/></div>
    {invalid && <small className="reminder-time-error" role="alert" id={errorId}>{t('Enter a valid time')}</small>}
    {showZone && <small id={zoneId} className="reminder-time-zone">{t('Time zone')}: {timeZone}</small>}
  </div>
}
