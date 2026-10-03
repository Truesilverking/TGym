import { useId, useRef, useState, useSyncExternalStore } from 'react'
import { getReminderStatus, subscribeReminderStatus, MOBILE, syncReminder } from '../lib/mobile.js'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t, dateLocale } from '../lib/i18n.js'
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

export function ReminderStatus({ kind, enabled, onRetry, error }) {
  const all = useSyncExternalStore(subscribeReminderStatus, getReminderStatus)
  if (error) return <p className="reminder-feedback" role="alert">{error}</p>
  const status = all[kind]
  if (!enabled && !['error','syncing'].includes(status.status)) return <p className="reminder-status muted">{t('Off')}</p>
  let text, warning = false
  if (!MOBILE) text = t('Device alerts are available in the mobile app. Calendar reminders stay visible here.')
  else if (status.status === 'configured') text = status.count
    ? t('Next notification: {0}', new Date(status.nextAt).toLocaleString(dateLocale(), {weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}))
    : t('No notifications pending. Your reminder settings are saved.')
  else if (status.status === 'permission-denied') { text = t('Enable notifications in your device settings.'); warning = true }
  else if (status.status === 'error') { text = t('Could not schedule notifications. Try again.'); warning = true }
  else if (status.status === 'incomplete') { text = t(status.validation || 'Check your reminder settings.'); warning = true }
  else if (status.status === 'unsupported') text = t('Not supported in this browser.')
  else text = t('Checking notification schedule…')
  return <div className={'reminder-feedback'+(warning?' warning':'')} role={warning?'alert':'status'}>
    <span>{text}</span>{warning && onRetry && <Button size="sm" onClick={onRetry}>{t('Retry')}</Button>}
  </div>
}

export default function ReminderPanel({ title, description, icon='bell', checked, onToggle, busy, children, summary }) {
  const id = useId()
  return <section className="reminder-panel" aria-labelledby={id}>
    <header className="reminder-heading">
      <span className="lrow-i"><Icon name={icon}/></span>
      <div><h3 id={id}>{title}</h3>{description && <p>{description}</p>}</div>
      {onToggle && <Switch checked={checked} disabled={busy} aria-labelledby={id} onChange={onToggle}/>}
    </header>
    {summary && <p className="reminder-summary">{summary}</p>}
    <div className="reminder-controls">{children}</div>
  </section>
}
