import { useId, useRef, useState } from 'react'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { MOBILE, syncReminder } from '../lib/mobile.js'
import { deloadStatus } from '../lib/training-plan.js'
import Icon from './Icon.jsx'
import { Section, Row, SelectRow, Switch } from './ui.jsx'
import './DeloadSettings.css'

const validDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false
  const date = new Date(value + 'T12:00:00')
  return !Number.isNaN(date.getTime()) && `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` === value
}

// Expansion and an unfinished date edit belong to this app session, not the
// saved training configuration. Keeping them in the UI store survives navigation.
export default function DeloadSettings({ S, update, toast, reminderStatus }) {
  const expanded = useUI(s => !!s.settingsDeloadExpanded)
  const dateDraft = useUI(s => s.settingsDeloadDateDraft)
  const panelId = useId()
  const dateId = useId()
  const errorId = useId()
  const [alertsBusy, setAlertsBusy] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const alertsPending = useRef(false)
  const { config } = deloadStatus(S)
  const dateValue = dateDraft ?? config.startDate ?? todayISO()
  const dateError = (config.on || dateDraft != null) && !validDate(dateValue)
  const cycle = t('{0} normal weeks + {1} deload week', config.normalWeeks, config.deloadWeeks)
  const parameters = `${t('Training load')}: ${config.loadPct}% · ${t('Working sets')}: ${config.setPct}% · ${t('Target RIR')}: ${config.targetRir}`
  const save = edit => {
    try { update(edit); setSaveError(false); return true }
    catch { setSaveError(true); return false }
  }
  const change = (key, value) => save(s => { s.deload = { ...s.deload, [key]: value } })
  const toggleAlerts = async value => {
    if (alertsPending.current) return
    alertsPending.current = true
    setAlertsBusy(true)
    try {
      if (!change('notifications', value)) return
      await syncReminder(useStore.getState().S, value, 'deload')
    } catch {
      toast?.(t('Could not schedule notifications. Try again.'))
    } finally {
      alertsPending.current = false
      setAlertsBusy(false)
    }
  }
  const editDate = value => {
    const saved = validDate(value) && change('startDate', value)
    useUI.setState({ settingsDeloadDateDraft: saved ? undefined : value })
  }

  return <Section className="deload-settings">
    <div className="deload-settings-header">
      <button type="button" className="deload-settings-toggle" aria-expanded={expanded}
        aria-controls={panelId} onClick={() => useUI.setState({ settingsDeloadExpanded: !expanded })}>
        <span className="lrow-i" style={{ '--tint': 'var(--orange)' }}><Icon name="arrowDown" /></span>
        <span className="deload-settings-heading">
          <span className="deload-settings-title">{t('Deload week')} <span className={'deload-settings-state' + (config.on ? ' on' : '')}>{t(config.on ? 'On' : 'Off')}</span></span>
          <span className="deload-settings-summary">{cycle}</span>
          <span className="deload-settings-summary">{parameters}</span>
        </span>
        <Icon name="chevronDown" className={'deload-settings-chevron' + (expanded ? ' expanded' : '')} />
      </button>
      <Switch aria-label={t('Scheduled deload')} checked={!!config.on} onChange={value => save(s => {
        s.deload = { ...DEF.deload, ...(s.deload || {}), on: value, startDate: s.deload?.startDate || todayISO() }
      })} />
    </div>
    {saveError && <div className="deload-settings-error" role="alert">{t('Could not save changes. Free device storage and try again.')}</div>}
    {reminderStatus}
    {dateError && <div className="deload-settings-error" role="alert" id={errorId}>
      <span>{t('Choose a valid cycle start date.')}</span>
      {!expanded && <button type="button" onClick={() => useUI.setState({ settingsDeloadExpanded: true })}>{t('Edit')}</button>}
    </div>}
    <div id={panelId} className="deload-settings-panel" hidden={!expanded}>
      {!!config.on && <>
        <SelectRow title={t('Normal weeks')} value={config.normalWeeks} onChange={value => change('normalWeeks', value)}
          options={[4, 5, 6, 7, 8, 10, 12].map(value => ({ value, label: String(value) }))} />
        <SelectRow title={t('Deload weeks')} value={config.deloadWeeks} onChange={value => change('deloadWeeks', value)}
          options={[1, 2].map(value => ({ value, label: String(value) }))} />
        <div className="lrow deload-settings-date"><label className="lrow-t" htmlFor={dateId}>{t('Cycle start')}</label>
          <input className="input" id={dateId} type="date" value={dateValue} onChange={e => editDate(e.target.value)}
            aria-invalid={dateError || undefined} aria-describedby={dateError ? errorId : undefined} />
        </div>
        <SelectRow title={t('Training load')} value={config.loadPct} onChange={value => change('loadPct', value)}
          options={[80, 85, 90, 95].map(value => ({ value, label: value + '%' }))} />
        <SelectRow title={t('Working sets')} value={config.setPct} onChange={value => change('setPct', value)}
          options={[40, 50, 60, 70, 80].map(value => ({ value, label: value + '%' }))} />
        <SelectRow title={t('Target RIR')} value={config.targetRir} onChange={value => change('targetRir', value)}
          options={[3, 3.5, 4, 4.5, 5].map(value => ({ value, label: String(value) }))} />
        {MOBILE && <Row icon="bell" title={t('Deload alerts')} subtitle={t('One day before and on the first day.')}>
          <Switch checked={config.notifications !== false} disabled={alertsBusy} onChange={toggleAlerts} />
        </Row>}
      </>}
      <p className="deload-settings-info">{t('The cycle starts on Monday. Training breaks freeze it and shift its dates. Saved workouts stay unchanged. Alerts respect quiet hours.')}</p>
    </div>
  </Section>
}
