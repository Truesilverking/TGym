import { useEffect, useRef } from 'react'
import { isoOf, todayISO, MONTHS } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { effectiveRoutineId } from '../lib/history.js'
import { deloadStatus } from '../lib/training-plan.js'

// GitHub-style consistency heatmap. Colour answers the useful question for a scheduled
// routine: was the planned routine actually completed? Extra training still appears, but it
// does not masquerade as adherence to a different routine.
export default function Heatmap({ S, onDay }) {
  const wrapRef = useRef(null)
  useEffect(() => { if (wrapRef.current) wrapRef.current.scrollLeft = wrapRef.current.scrollWidth }, [])

  const agg = {}
  S.workouts.forEach(w => {
    const a = agg[w.d] = agg[w.d] || { rows: [] }
    a.rows.push(w)
  })

  const today = new Date(); today.setHours(12, 0, 0, 0)
  const end = new Date(today); end.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  const start = new Date(end); start.setDate(end.getDate() - 52 * 7)

  const months = [], cols = []
  let lastMonth = -1
  for (let wk = 0; wk <= 52; wk++) {
    const colStart = new Date(start); colStart.setDate(start.getDate() + wk * 7)
    const mo = colStart.getMonth()
    const showM = mo !== lastMonth && colStart.getDate() <= 7 && wk < 51
    months.push(<span key={wk}>{showM ? t(MONTHS[mo]) : ''}</span>)
    if (colStart.getDate() <= 7) lastMonth = mo
    const cells = []
    for (let d = 0; d < 7; d++) {
      const day = new Date(colStart); day.setDate(colStart.getDate() + d)
      const key = isoOf(day)
      const a = agg[key]
      const planned = effectiveRoutineId(S, key)
      const routine = planned && (S.routines || []).find(r => r.id === planned)
      const complete = !!planned && !!a?.rows.some(w => w.routineId === planned || (!w.routineId && routine && w.name === routine.name))
      const status = complete ? ' complete' : a?.rows.length ? ' extra' : planned && day < today ? ' missed' : ''
      const de = deloadStatus(S, key).active
      const cls = 'hm-c' + status + (de ? ' deload' : '') + (key === todayISO() ? ' today' : '') + (day > today ? ' future' : '')
      cells.push(<div key={d} className={cls}
        title={key + (de ? ' · ' + t('Deload week') : '') + (complete ? ' · ' + t('Planned routine completed') : a?.rows.length ? ' · ' + t('Extra or different workout') : planned && day < today ? ' · ' + t('Planned routine not completed') : '')}
        onClick={a ? () => onDay(key) : undefined} />)
    }
    cols.push(<div key={wk} className="hm-col">{cells}</div>)
  }

  return <>
    <div className="hm-wrap" ref={wrapRef}>
      <div className="hm-months" style={{ marginLeft: 30 }}>{months}</div>
      <div className="hm-body">
        <div className="hm-days"><span>{t('Mon')}</span><span /><span>{t('Wed')}</span><span /><span>{t('Fri')}</span><span /><span /></div>
        <div className="hm-grid">{cols}</div>
      </div>
    </div>
    <div className="hm-legend"><div className="hm-c missed" />{t('Not completed')}<div className="hm-c extra" />{t('Extra')}<div className="hm-c complete" />{t('Completed')}</div>
  </>
}
