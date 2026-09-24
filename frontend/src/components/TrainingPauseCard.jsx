import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { Button } from './ui.jsx'
import { t } from '../lib/i18n.js'
import { todayISO, fmtDate, uid } from '../lib/format.js'
import { openTrainingPause, pauseTraining, resumeTraining } from '../lib/training-pause.js'
import { MOBILE, syncReminder } from '../lib/mobile.js'

export default function TrainingPauseCard({ onSaved }) {
  const S=useStore(s=>s.S), update=useStore(s=>s.update)
  const [busy,setBusy]=useState(false), [error,setError]=useState(''), [pendingSave,setPendingSave]=useState(false)
  const pause=openTrainingPause(S)
  const save=async()=>{
    setBusy(true);setError('')
    try {
      if(!pendingSave) update(s=>{s.trainingPauses=pause ? resumeTraining(s,todayISO()) : pauseTraining(s,todayISO(),uid())})
      setPendingSave(true)
      const reminders = MOBILE ? syncReminder(useStore.getState().S) : Promise.resolve(true)
      await useStore.getState().flushPersistence()
      const noticesSaved=await reminders
      setPendingSave(false)
      useUI.getState().toast(t(!noticesSaved ? 'Saved, but reminder updates failed. Reopen the app to retry.' : openTrainingPause(useStore.getState().S)?'Training paused':'Training resumed'))
      onSaved?.()
    } catch {setError(t('Could not save. Check available storage and try again.'))}
    finally {setBusy(false)}
  }
  return <section className="card training-pause-card">
    <h2>{t(pause?'Training paused':'Training break')}</h2>
    <p className="small muted">{pause ? t('Paused from {0}. Resume when you are ready.',fmtDate(pause.start,true)) : t('Pause for illness, travel or recovery. Your streak is protected without adding training days.')}</p>
    <details><summary>{t('How this pause works')}</summary><p className="small muted">{t('Workout and deload alerts stop. The deload cycle freezes; resuming shifts it by the paused days. Your usual weekdays stay unchanged, with no catch-up backlog.')}</p>
    {!pause && <p className="small muted">{t('Starts today, or tomorrow if you already logged a workout today. Previous missed days stay unchanged.')}</p>}</details>
    {S.active && !pause && <p className="small muted">{t('Finish or discard the active workout before pausing your plan.')}</p>}
    {error && <p role="alert">{error}</p>}
    <Button variant={pause?'primary':undefined} disabled={busy || (!pause && !!S.active)} onClick={save}>{t(pendingSave?'Retry saving':pause?'Resume training':'Pause training')}</Button>
  </section>
}

export function TrainingPauseAction({ onlyPaused = false, compact = false }) {
  const S = useStore(s => s.S), pause = openTrainingPause(S)
  if (onlyPaused && !pause) return null
  return <button data-tour="pause" className={'training-pause-action' + (pause ? ' paused' : '') + (compact ? ' compact' : '')} aria-label={compact ? t(pause ? 'Resume training' : 'Pause training') : undefined} onClick={() => useUI.getState().openSheet(close => <TrainingPauseCard onSaved={close} />)}><span className="pause-action-symbol" aria-hidden="true">{pause ? '▶' : 'Ⅱ'}</span><span><b>{t(compact ? (pause ? 'Resume' : 'Pause') : (pause ? 'Training paused' : 'Pause training'))}</b>{!compact && <small>{t(pause ? 'Resume when you are ready' : 'Protect your streak during a break')}</small>}</span>{!compact && <span aria-hidden="true">›</span>}</button>
}
