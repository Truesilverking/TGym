import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { todayISO, fmtScheduledDate, fmtNum } from '../lib/format.js'
import { historySummary, trainingStart, trackingStart, validateTrainingHistory } from '../lib/training-history.js'
import { Button } from './ui.jsx'

export function TrainingHistoryForm({ close }) {
  const S = useStore(s => s.S)
  const [start, setStart] = useState(trainingStart(S))
  const [trackedFrom, setTrackedFrom] = useState(S.trainingHistory?.trackedFrom || trackingStart(S))
  const [count, setCount] = useState(S.trainingHistory?.historicalWorkouts || 0)
  const [frequency, setFrequency] = useState(S.trainingHistory?.workoutsPerWeek || 0)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const save = async e => {
    e.preventDefault()
    const history = { trackedFrom, historicalWorkouts:Number(count), workoutsPerWeek:Number(frequency), source:'user-estimate' }
    if (!validateTrainingHistory(start, history)) { setError(t('Check the dates and estimates. Prior workouts require a start before tracking began.')); return }
    setBusy(true); setError('')
    try {
      useStore.getState().update(s => { s.trainingStartDate=start; s.trainingHistory=history })
      await useStore.getState().flushPersistence()
      close?.()
    } catch { setError(t('Could not save. Check available storage and try again.')) }
    finally { setBusy(false) }
  }
  return <form className="training-history-form" onSubmit={save}>
    <h3>{t('Training history settings')}</h3>
    <p className="small muted">{t('Confirm your start date. Earlier records are kept; statistics use the selected period.')}</p>
    <label>{t('Since when have you trained consistently?')}<input className="input" type="date" required max={todayISO()} value={start} onChange={e=>setStart(e.target.value)} /></label>
    <label>{t('App tracking began')}<input className="input" type="date" required max={todayISO()} value={trackedFrom} onChange={e=>setTrackedFrom(e.target.value)} /></label>
    <label>{t('Estimated workouts before app tracking')}<input className="input" type="number" min="0" max="1000000" step="1" required value={count} onChange={e=>setCount(e.target.value)} /></label>
    <label>{t('Usual workouts per week before tracking')}<input className="input" type="number" min="0" max="50" step="0.5" required value={frequency} onChange={e=>setFrequency(e.target.value)} /></label>
    <p className="small muted">{t('Estimates only add to your lifetime total. They do not create sessions, streaks, durations or calendar results. Dates before tracking are not missed workouts.')}</p>
    {error && <p role="alert">{error}</p>}
    <Button type="submit" disabled={busy}>{t(busy ? 'Working…' : 'Save')}</Button>
  </form>
}
export const openTrainingHistory = () => useUI.getState().openSheet(close => <TrainingHistoryForm close={close} />)
export default function TrainingHistory({ promptOnly=false }) {
  const S = useStore(s=>s.S), h=historySummary(S)
  if (promptOnly && S.trainingStartDate) return null
  return <section className="card training-history-card">
    <div className="row between"><h2>{t('Training history')}</h2><Button size="sm" onClick={openTrainingHistory}>{t(S.trainingStartDate ? 'Edit' : 'Confirm')}</Button></div>
    {!S.trainingStartDate && <p>{t('Since when have you trained consistently?')}</p>}
    <p className="small muted">{t('Training since {0}',fmtScheduledDate(h.start))}</p>
    {!promptOnly && <><div className="tiles">
      <div className="tile"><div className="l">{t('Total workouts')}</div><div className="v">{h.total}</div></div>
      <div className="tile"><div className="l">{t('Average workouts per week')}</div><div className="v">{fmtNum(Math.round(h.averagePerWeek*10)/10)}</div></div>
      <div className="tile"><div className="l">{t('Currently scheduled per week')}</div><div className="v">{h.scheduledPerWeek}</div></div>
    </div><p className="small muted">{t('{0} recorded · {1} estimated before tracking',h.trackedWorkouts,h.historicalWorkouts)}</p><p className="small muted">{t('Weekly average includes all calendar days since your start, including breaks.')}</p></>}
  </section>
}
