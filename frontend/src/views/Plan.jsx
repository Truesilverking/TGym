import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { DAYN, uid, exCount } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { dayAssignSheet, guidedPlansSheet, planToolsSheet, confirmSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { useEffect, useRef, useState } from 'react'
import { glyphOf, DEFAULT_GLYPH } from '../lib/glyphs.js'
import { vibrate } from '../lib/sound.js'

export default function Plan() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const [undoVisible, setUndoVisible] = useState(false)
  const [drag, setDrag] = useState({ id: null, dx: 0, armed: false })
  const dragRef = useRef(null)
  const didSwipe = useRef(false)
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
    const scheduled = Object.values(S.week || {}).filter(Boolean).length
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
    sessionStorage.setItem('framegym_deleted_single_routine', JSON.stringify({ routine: r, days: Object.entries(S.week || {}).filter(([, id]) => id === r.id), overrides: Object.entries(S.dayPlan || {}).filter(([, id]) => id === r.id) }))
    update(s => { s.routines = s.routines.filter(x => x.id !== r.id); Object.keys(s.week).forEach(k => { if (s.week[k] === r.id) delete s.week[k] }); Object.keys(s.dayPlan).forEach(k => { if (s.dayPlan[k] === r.id) delete s.dayPlan[k] }) })
    setDrag({ id: null, dx: 0, armed: false }); setUndoVisible(true)
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
  const beginSwipe = (e, r) => {
    dragRef.current = { id: r.id, startX: e.clientX, startY: e.clientY, width: e.currentTarget.getBoundingClientRect().width, vertical: false, buzzed: false }
    didSwipe.current = false
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const moveSwipe = e => {
    const d = dragRef.current
    if (!d) return
    const rawX = e.clientX - d.startX, rawY = e.clientY - d.startY
    if (Math.abs(rawY) > Math.abs(rawX) && Math.abs(rawY) > 8) { d.vertical = true; return }
    if (d.vertical || rawX > 0) return
    const dx = Math.max(-d.width, rawX)
    const armed = Math.abs(dx) >= d.width * .72
    d.armed = armed
    if (armed && !d.buzzed) { d.buzzed = true; if (S.vibration !== false) vibrate(35) }
    if (!armed) d.buzzed = false
    if (Math.abs(dx) > 8) didSwipe.current = true
    setDrag({ id: d.id, dx, armed })
  }
  const endSwipe = r => {
    const d = dragRef.current
    dragRef.current = null
    if (d && !d.vertical && d.id === r.id && d.armed) { deleteOne(r); return }
    setDrag({ id: null, dx: 0, armed: false })
  }

  return <>
    <div className="hdr hdr-centered">
      <span className="hdr-slot" aria-hidden="true" />
      <div className="hdr-center"><h1>{t('Routine')}</h1></div>
      <button className="iconbtn" onClick={planToolsSheet} aria-label={t('Share your plan')} title={t('Share your plan')}><Icon name="upload" /></button>
    </div>
    <div className="cols"><div>
      <h4 className="sec week-schedule-title">{t('Week schedule')}</h4>
      <div className="list" style={{ display: 'flex', flexDirection: 'column' }}>
        {[1, 2, 3, 4, 5, 6, 0].map(d => {
          const r = S.routines.find(x => x.id === S.week[d])
          return <div key={d} className="item" onClick={() => dayAssignSheet(d)}>
            <div className="grow"><div className="tt">{t(DAYN[d])}</div></div>
            {r ? <span className="tag acc"><Icon name={glyphOf(r.emoji)} />{r.name}</span> : <span className="tag">{t('Rest')}</span>}
            <Icon name="chevronRight" className="chev" /></div>
        })}
      </div>
    </div><div>
      <div className="row between" style={{ marginTop: 22, marginBottom: 10 }}>
        <h4 className="sec" style={{ margin: 0 }}>{t('Routines')}</h4>
        <div className="row" style={{ gap: 6 }}><Button size="sm" variant="tinted" icon="sparkles" onClick={guidedPlansSheet}>{t('Guided')}</Button><Button size="sm" variant="tinted" icon="plus" onClick={addRoutine}>{t('New')}</Button></div>
      </div>
      {S.routines.length ? <div className="routine-list">{S.routines.map(r => <div key={r.id} className={'swipe-routine' + (drag.id === r.id && drag.armed ? ' armed' : '')} style={{ '--swipe-x': `${drag.id === r.id ? drag.dx : 0}px` }}>
        <div className="swipe-delete" aria-hidden="true"><Icon name="trash" />{drag.id === r.id && drag.armed ? t('Release to delete') : t('Swipe to delete')}</div>
        <div className="item swipe-content" onPointerDown={e => beginSwipe(e, r)} onPointerMove={moveSwipe} onPointerUp={() => endSwipe(r)} onPointerCancel={() => { dragRef.current = null; setDrag({ id: null, dx: 0, armed: false }) }} onClick={() => { if (didSwipe.current) { didSwipe.current = false; return } nav('/plan/r/' + r.id) }}>
          <span className="lrow-i"><Icon name={glyphOf(r.emoji)} /></span>
          <div className="grow"><div className="tt">{r.name}</div><div className="ss">{exCount(r.ex.length)}</div></div>
        </div></div>)}</div> : <>
        <div className="empty"><div className="ico"><Icon name="clipboard" /></div>{t('No routines yet.')}<br />{t('Create one or load the starter plan.')}</div>
        <Button icon="sparkles" onClick={guidedPlansSheet}>{t('Choose a guided plan')}</Button>
      </>}
      {S.routines.length > 0 && <><div style={{ height: 12 }} /><Button variant="danger" icon="trash" onClick={deleteAll}>{t('Delete all routines')}</Button></>}
    </div></div>
    {undoVisible && <div className="routine-undo"><span>{t('Routine deleted')}</span><button onClick={restoreDeleted}>{t('Undo')}</button></div>}
  </>
}
