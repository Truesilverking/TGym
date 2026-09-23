import { fmtDate } from '../lib/format.js'
import { setLabel } from '../lib/history.js'
import { t } from '../lib/i18n.js'

// Keep the existing set formatter: timed/cardio, per-side and effort details stay intact.
export default function ExerciseSessions({ name, exerciseId, sessions }) {
  if (!sessions.length) return null
  return <section className="exercise-sessions" aria-label={t('Recent sessions')}>
    <header><h3>{name}</h3><span className="small muted">{t('Recent sessions')}</span></header>
    <ol className="exercise-session-list">{sessions.map((session,index)=><li className="exercise-session" key={`${session.d}-${index}`}>
      <div className="exercise-session-heading"><time dateTime={session.d}>{fmtDate(session.d,true)}</time><span className="session-set-count">{session.sets.length} {t('Sets')}</span></div>
      <ol className="exercise-set-list">{session.sets.map((set,i)=><li key={i}><span className="exercise-set-number" aria-label={t('Set {0}',i+1)}>{String(i+1).padStart(2,'0')}</span><span>{setLabel(exerciseId,set,session.target)}</span></li>)}</ol>
    </li>)}</ol>
  </section>
}
