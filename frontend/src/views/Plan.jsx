import RoutineList from '../components/RoutineList.jsx'
import { reorderRoutine } from '../lib/routine-order.js'
import { routineIds, removeRoutineAssignments } from '../lib/daily-plan.js'
import { openActivityEditor } from '../components/Activities.jsx'
import { TrainingPauseAction } from '../components/TrainingPauseCard.jsx'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { DAYN, uid, exCount } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { dayAssignSheet, guidedPlansSheet, planToolsSheet, confirmSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { useEffect, useState } from 'react'
import { glyphOf, DEFAULT_GLYPH } from '../lib/glyphs.js'
import { routineMuscleSheet } from '../components/RoutineMusclePreview.jsx'

export default function Plan() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const [undoVisible, setUndoVisible] = useState(false)
  useEffect(() => {
    if (!undoVisible) return
    const tm = setTimeout(() => setUndoVisible(false), 6500)
    return () => clearTimeout(tm)
  }, [undoVisible])

  const addRoutine = () => {
    const r = { id: uid(), name: t('New routine'), emoji: DEFAULT_GLYPH, ex: [] }
    update(s => { s.routines.push(r) })
    nav('/plan/r/' + r.id)
  }
  const deleteAll = () => {
    const scheduled = Object.values(S.week || {}).filter(ids=>routineIds(ids).length).length
    confirmSheet({
      title: t('Delete all routines?'),
      message: t('{0} routines will be deleted. {1} scheduled days will be cleared. You can undo this during the current app session.', S.routines.length, scheduled),
      confirmText: t('Delete all'), danger: true,
      onConfirm: () => {
        sessionStorage.setItem('framegym_deleted_routines', JSON.stringify({ routines: S.routines, week: S.week, dayPlan: S.dayPlan }))
        sessionStorage.removeItem('framegym_deleted_single_routine')
        update(s => { s.routines = []; s.week = {}; s.dayPlan = {} })
        setUndoVisible(true)
      },
    })
  }
  const restoreAll = () => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('framegym_deleted_routines'))
      if (!saved?.routines) return
      update(s => { s.routines = saved.routines; s.week = saved.week || {}; s.dayPlan = saved.dayPlan || {} })
      sessionStorage.removeItem('framegym_deleted_routines'); setUndoVisible(false)
    } catch { sessionStorage.removeItem('framegym_deleted_routines'); setUndoVisible(false) }
  }
  const deleteOne = r => {
    sessionStorage.removeItem('framegym_deleted_routines')
    sessionStorage.setItem('framegym_deleted_single_routine', JSON.stringify({ routine: r, days: Object.entries(S.week || {}).filter(([, ids]) => routineIds(ids).includes(r.id)), overrides: Object.entries(S.dayPlan || {}).filter(([, ids]) => routineIds(ids).includes(r.id)) }))
    update(s => { s.routines = s.routines.filter(x => x.id !== r.id); removeRoutineAssignments(s,r.id) })
    setUndoVisible(true)
  }
  const restoreDeleted = () => {
    if (sessionStorage.getItem('framegym_deleted_routines')) return restoreAll()
    try {
      const saved = JSON.parse(sessionStorage.getItem('framegym_deleted_single_routine'))
      if (!saved?.routine) return
      update(s => { if (!s.routines.some(r => r.id === saved.routine.id)) s.routines.push(saved.routine); (saved.days || []).forEach(([d, id]) => { s.week[d] = id }); (saved.overrides || []).forEach(([d, id]) => { s.dayPlan[d] = id }) })
      sessionStorage.removeItem('framegym_deleted_single_routine'); setUndoVisible(false)
    } catch { sessionStorage.removeItem('framegym_deleted_single_routine'); setUndoVisible(false) }
  }

  return <>
    <div className="hdr hdr-centered plan-header">
      <TrainingPauseAction compact />
      <div className="hdr-center"><h1>{t('Routine')}</h1></div>
      <button className="iconbtn" onClick={planToolsSheet} aria-label={t('Share your plan')} title={t('Share your plan')}><Icon name="upload" /></button>
    </div>
    <div className="cols"><div>
      <div className="week-schedule-header">
        <h4 className="sec week-schedule-title">{t('Week schedule')}</h4>
        <Button size="sm" onClick={()=>openActivityEditor({planning:true})}>{t('Plan activity')}</Button>
      </div>
      <div className="list week-schedule" style={{ display: 'flex', flexDirection: 'column' }}>
        {[1, 2, 3, 4, 5, 6, 0].map(d => {
          const routines = routineIds(S.week[d]).map(id=>S.routines.find(x=>x.id===id)).filter(Boolean)
          const r = routines[0]
          return <div key={d} className="item" onClick={() => dayAssignSheet(d)}>
            <div className="grow"><div className="tt">{t(DAYN[d])}</div>{routines.length>1 && <div className="ss schedule-names">{routines.map(r=>r.name).join(' · ')}</div>}</div>
            {r ? <span className="tag acc"><Icon name={glyphOf(r.emoji)} />{routines.length>1 ? t('{0} activities',routines.length) : r.name}</span> : <span className="tag">{t('Rest')}</span>}
            {r && <button className="iconbtn" aria-label={t('Muscles trained')} onClick={e=>{e.stopPropagation();routineMuscleSheet(r.id)}}><Icon name="info" /></button>}
            <Icon name="chevronRight" className="chev" /></div>
        })}
      </div>
    </div><div>
      <div className="row between" data-tour="routine" style={{ marginTop: 22, marginBottom: 10 }}>
        <h4 className="sec" style={{ margin: 0 }}>{t('Routines')}</h4>
        <div className="row" style={{ gap: 6 }}><Button size="sm" variant="tinted" icon="sparkles" onClick={guidedPlansSheet}>{t('Guided')}</Button><Button size="sm" variant="tinted" icon="plus" onClick={addRoutine}>{t('New')}</Button></div>
      </div>
      {S.routines.length ? <RoutineList S={S} onOpen={id=>nav('/plan/r/'+id)} onDelete={deleteOne} onInfo={routineMuscleSheet} onReorder={(id,target)=>update(s=>reorderRoutine(s,id,target))}/> : <>
        <div className="empty"><div className="ico"><Icon name="clipboard" /></div>{t('No routines yet.')}<br />{t('Create one or load the starter plan.')}</div>
        <Button icon="sparkles" onClick={guidedPlansSheet}>{t('Choose a guided plan')}</Button>
      </>}
      {S.routines.length > 0 && <><div style={{ height: 12 }} /><Button variant="danger" icon="trash" onClick={deleteAll}>{t('Delete all routines')}</Button></>}
    </div></div>
    {undoVisible && <div className="routine-undo"><span>{t('Routine deleted')}</span><button onClick={restoreDeleted}>{t('Undo')}</button></div>}
  </>
}
