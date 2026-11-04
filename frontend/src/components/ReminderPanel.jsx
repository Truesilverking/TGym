import { useId, useRef, useState, useSyncExternalStore } from 'react'
import { getReminderStatus, subscribeReminderStatus, MOBILE, syncReminder } from '../lib/mobile.js'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t, dateLocale } from '../lib/i18n.js'
import { isoOf } from '../lib/format.js'
import { useLocalNow } from '../lib/use-local-now.js'
import { workoutReminderDateLabel } from '../lib/workout-reminder-label.js'
import Icon from './Icon.jsx'
import { Button, Switch } from './ui.jsx'
import './ReminderPanel.css'

// Preference writes use the normal store path. Permission requests only follow
// an explicit action; mounting this view never schedules or requests permission.
export function useReminderActions(kind) {
  const lock = useRef(false), pending = useRef(0), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const commit = async (edit, interactive = false) => {
    if (interactive && lock.current) return false
    if (interactive) lock.current = true
    pending.current++; setBusy(true); setError('')
    try {
      useStore.getState().update(edit)
      return !MOBILE || await syncReminder(useStore.getState().S, interactive, kind)
    } catch {
      setError(t('Could not save changes. Try again.'))
      useUI.getState().toast(t('Could not save changes. Try again.'))
      return false
    } finally { if (interactive) lock.current = false; pending.current--; setBusy(pending.current > 0) }
  }
  return { commit, busy, error }
}

function WorkoutNotificationTime({status}){
  const dayPlan=useStore(s=>s.S.dayPlan),now=useLocalNow(),at=new Date(status.nextAt)
  // This is the notification's delivery time; an advance reminder may arrive
  // today for tomorrow's workout. nextDate identifies manual appointments only.
  const day=workoutReminderDateLabel({dayPlan},isoOf(at),isoOf(now),undefined,status.nextDate??isoOf(at))
  return t('Next notification: {0}',day+' · '+at.toLocaleTimeString(dateLocale(),{hour:'2-digit',minute:'2-digit'}))
}

export function ReminderStatus({ kind, enabled, onRetry, error }) {
  const all = useSyncExternalStore(subscribeReminderStatus, getReminderStatus)
  if (error) return <p className="reminder-feedback" role="alert">{error}</p>
  const status = all[kind] || {status:'syncing'}
  if (!enabled && !['error','syncing'].includes(status.status)) return null
  let text, warning = false
  if (!MOBILE) text = t('Device alerts are available in the mobile app. Calendar reminders stay visible here.')
  else if (status.status === 'configured') {
    text=status.count?(kind==='workout'?<WorkoutNotificationTime status={status}/>:t('Next notification: {0}',new Date(status.nextAt).toLocaleString(dateLocale(),{weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}))):t('No notifications pending. Your reminder settings are saved.')
    if(status.error){text=<>{text} {t(status.error)}</>;warning=true}
  }
  else if (status.status === 'permission-denied') { text = t('Enable notifications in your device settings.'); warning = true }
  else if (status.status === 'error') { text = t('Could not schedule notifications. Try again.'); warning = true }
  else if (status.status === 'incomplete') { text = t(status.validation || 'Check your reminder settings.'); warning = true }
  else if (status.status === 'unsupported') text = t('Not supported in this browser.')
  else text = t('Checking notification schedule…')
  return <div className={'reminder-feedback'+(warning?' warning':'')} role={warning?'alert':'status'}>
    <span>{text}</span>{warning && onRetry && <Button size="sm" onClick={onRetry}>{t('Retry')}</Button>}
  </div>
}

export default function ReminderPanel({ title, description, icon='bell', checked, onToggle, busy, children }) {
  const id = useId()
  return <section className="reminder-panel" aria-labelledby={id}>
    <header className="reminder-heading">
      <span className="lrow-i"><Icon name={icon}/></span>
      <div className="reminder-heading-copy"><h3 id={id}>{title}</h3>{description && <p>{description}</p>}</div>
      {onToggle && <Switch checked={checked} disabled={busy} aria-labelledby={id} onChange={onToggle}/>}
    </header>
    <div className="reminder-controls">{children}</div>
  </section>
}
