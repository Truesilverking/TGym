import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { EXIDX, exOr } from '../lib/exercises.js'
import { t, exerciseNameFor, dateLocale } from '../lib/i18n.js'
import { displayReps, effortValue, fmtSec, isBw, isPerSide } from '../lib/history.js'
import { isWarmupRow, modeForSet, dropsOf, clustersOf, setSideState } from '../lib/workout-model.js'
import { fmtWeight } from '../lib/format.js'
import Media, { Thumb } from './Media.jsx'
import Icon from './Icon.jsx'
import './HistoryExerciseDetail.css'

const validUnit = value => value === 'kg' || value === 'lb' ? value : null
const HOLD_MS = 500
// A recorded target can have its own prescription unit; it does not relabel results.
export const historyResultUnit = (set, entry, workout, state) => validUnit(set?.unit) || validUnit(entry?.unit) || validUnit(workout?.unit) || validUnit(state?.unit) || 'kg'
export function historyExercise(state, entry) {
  const custom = state.customEx?.find(exercise => exercise.id === entry.id)
  if (custom || EXIDX[entry.id]) return custom || EXIDX[entry.id]
  const snapshot = entry.exercise && typeof entry.exercise === 'object' ? entry.exercise : {}
  return { ...exOr(entry.id), ...snapshot, id: entry.id,
    n: entry.n || snapshot.n || entry.muscleSnapshot?.n || exOr(entry.id).n,
    img: typeof snapshot.img === 'string' ? snapshot.img : '', gif: typeof snapshot.gif === 'string' ? snapshot.gif : '' }
}
export function historySetGroups(entry) {
  const groups = []
  for (const [index, set] of (Array.isArray(entry.sets) ? entry.sets : []).entries()) {
    if (!set || typeof set !== 'object') continue
    const kind = isWarmupRow(set) ? 'warmup' : set.role === 'top' ? 'top' : set.role === 'backoff' ? 'backoff' : 'work'
    if (groups.at(-1)?.kind !== kind) groups.push({ kind, rows: [] })
    groups.at(-1).rows.push({ set, index })
  }
  return groups
}
const number = value => value == null || value === '' || !Number.isFinite(Number(value)) ? '—' : new Intl.NumberFormat(dateLocale(), {maximumFractionDigits:10}).format(Number(value))
const groupTitle = group => t(group.kind === 'warmup' ? 'Warm-up sets' : group.kind === 'top' ? group.rows.length === 1 ? 'Top set' : 'Top sets' : group.kind === 'backoff' ? 'Back-off sets' : 'Working sets')
// Older local records can contain empty or primitive nested rows. Keep the
// saved record intact while showing only actual drop/burst objects.
const recordedParts = rows => rows.filter(row => row && typeof row === 'object' && !Array.isArray(row))
function RecordedSet({ set, index, phaseNumber, entry, workout, state, exercise }) {
  const mode = modeForSet(set, entry.target), cfg = { ...entry.target, id: entry.id, mode }
  if (cfg.bodyweight == null && exercise.eq === 'body weight') cfg.bodyweight = true
  if (set.side) cfg.side = true
  const unit = historyResultUnit(set, entry, workout, state), sides = setSideState(set)
  const drops = recordedParts(dropsOf(set)), clusters = recordedParts(clustersOf(set))
  const reps = value => number(displayReps(value, cfg))
  const load = value => isBw(cfg) && !(Number(value) > 0) ? t('Body weight') : `${isBw(cfg) && Number(value) > 0 ? '+' : ''}${fmtWeight(value)} ${unit}`
  const metrics = mode === 'cardio'
    ? [[t('Duration (min)'),number(set.min)],[t('Speed (km/h)'),number(set.speed)], ...(set.distanceKm != null ? [[t('Distance (km)'),number(set.distanceKm)]] : [])]
    : [[t('Weight'),load(set.w)], [t(mode === 'time' ? 'Time' : 'Reps'), mode === 'time' ? fmtSec(set.sec ?? set.seconds ?? set.durationSec) : reps(set.r ?? set.reps ?? set.actualReps)]]
  if (mode === 'time' && isPerSide(cfg)) {
    metrics.push([t('Left side'),fmtSec(set.leftSec ?? set.sec)],[t('Right side'),fmtSec(set.rightSec ?? set.sec)])
  }
  for (const effort of ['rir','rpe']) if (set[effort] != null && set[effort] !== '') metrics.push([effort.toUpperCase(),effortValue(effort,set[effort])])
  return <article className={'history-exercise-set'+(set.done ? ' completed' : '')} data-set-index={index} data-completed={!!set.done}>
    <div className="history-exercise-set-heading"><b>{t('Set')} {phaseNumber}</b><span className="history-exercise-set-status"><Icon name={set.done ? 'checkCircle' : 'clock'}/>{t(set.done ? 'Completed' : 'Pending')}</span></div>
    {['dropset','restpause'].includes(set.type) && <div className="history-exercise-technique">{t(set.type === 'dropset' ? 'Drop-set' : 'Rest-pause')}</div>}
    <dl className="history-exercise-values">{metrics.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {isPerSide(cfg) && mode !== 'cardio' && <div className="history-exercise-sides">{['left','right'].map(side=><span key={side}>{t(side === 'left' ? 'Left' : 'Right')}: {t(sides[side] ? 'Completed' : 'Pending')}</span>)}{mode === 'reps' && <span>{t('Reps per side')}</span>}</div>}
    {(drops.length > 0 || clusters.length > 0) && <ul className="history-exercise-extras">
      {drops.map((drop,i)=><li key={'drop-'+i}><b>{t('Drop {0}',i+1)}</b><span>{fmtWeight(drop.w)} {validUnit(drop.unit) || unit} × {reps(drop.r)} {t('reps')}</span></li>)}
      {clusters.map((cluster,i)=><li key={'burst-'+i}><b>{t('Burst {0}',i+1)}</b><span>{reps(cluster.r)} {t('reps')} · {number(cluster.restSec)} s</span></li>)}
    </ul>}
  </article>
}
export function HistoryExerciseDetail({ entry, workout }) {
  const state = useStore(s=>s.S), exercise = historyExercise(state, entry), groups = historySetGroups(entry)
  return <div className="history-exercise-detail" data-exercise-id={entry.id}>
    <div className="history-exercise-media">{exercise.img || exercise.gif ? <Media ex={exercise}/> : <div className="history-exercise-placeholder" role="img" aria-label={exerciseNameFor(exercise,{state,entry})}><Icon name="dumbbell"/></div>}</div>
    <h3>{exerciseNameFor(exercise,{state,entry,routineId:workout.routineId})}</h3>
    {groups.length ? groups.map((group, i)=><section className="history-exercise-set-group" data-set-kind={group.kind} key={i}>
      <h4>{groupTitle(group)}</h4>
      {group.rows.map(({set,index},row)=><RecordedSet key={index} set={set} index={index} phaseNumber={row+1} entry={entry} workout={workout} state={state} exercise={exercise}/>)}
    </section>) : <p className="empty">{t('no sets')}</p>}
    {entry.note && <p className="history-exercise-note">{entry.notePin && <Icon name="flag"/>}{entry.note}</p>}
  </div>
}

// React replaces unavailable native timestamps with a wall-clock value. Keep
// input timing monotonic instead of mixing that fallback with real events.
const inputTimestamp = event => {
  const value = event.nativeEvent ? event.nativeEvent.timeStamp : event.timeStamp
  return Number.isFinite(value) ? value : null
}
export default function HistoryExerciseRow({ entry, workout, pr }) {
  const state = useStore(s=>s.S), exercise = historyExercise(state,entry), name = exerciseNameFor(exercise,{state,entry,routineId:workout.routineId})
  const [holding,setHolding] = useState(false), press = useRef(null), timer = useRef(0), detail = useRef(null), button = useRef(null), latest = useRef(null)
  latest.current = { entry, workout }
  const cancel = () => { clearTimeout(timer.current); timer.current=0; press.current=null; setHolding(false) }
  const open = () => {
    cancel()
    if (detail.current || !button.current?.isConnected || button.current.closest('[inert]')) return
    button.current.focus({preventScroll:true})
    const saved = latest.current
    detail.current = useUI.getState().openSheet(()=> <HistoryExerciseDetail entry={saved.entry} workout={saved.workout}/>, {onClose:()=>{detail.current=null}})
  }
  useEffect(()=>{
    const move = event => { if (press.current && event.pointerId === press.current.id && Math.hypot(event.clientX-press.current.x,event.clientY-press.current.y)>press.current.slop) cancel() }
    const another = event => { if (press.current && event.pointerId !== press.current.id) cancel() }
    const touch = event => { if (event.touches?.length > 1) cancel() }
    const hidden = () => { if (document.hidden) cancel() }
    window.addEventListener('pointermove',move);window.addEventListener('pointerdown',another,true)
    window.addEventListener('pointerup',cancel);window.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel)
    window.addEventListener('dragstart',cancel,true)
    document.addEventListener('scroll',cancel,true);document.addEventListener('visibilitychange',hidden);document.addEventListener('touchstart',touch,true)
    return ()=>{
      clearTimeout(timer.current);press.current=null;detail.current?.close()
      window.removeEventListener('pointermove',move);window.removeEventListener('pointerdown',another,true)
      window.removeEventListener('pointerup',cancel);window.removeEventListener('pointercancel',cancel);window.removeEventListener('blur',cancel)
      window.removeEventListener('dragstart',cancel,true)
      document.removeEventListener('scroll',cancel,true);document.removeEventListener('visibilitychange',hidden);document.removeEventListener('touchstart',touch,true)
    }
  },[])
  const start = event => {
    cancel()
    if (event.button !== 0 || event.isPrimary === false || detail.current) return
    // Allow small finger drift during the hold. Native scrolling still owns its
    // gesture and cancels through pointercancel/scroll; no move is prevented.
    press.current={id:event.pointerId,x:event.clientX,y:event.clientY,slop:event.pointerType==='touch'?14:8,at:performance.now(),eventAt:inputTimestamp(event)};setHolding(true)
    timer.current=setTimeout(open,HOLD_MS)
  }
  const release = event => {
    const current=press.current
    if(!current||current.id!==event.pointerId||event.isPrimary===false||Math.hypot(event.clientX-current.x,event.clientY-current.y)>current.slop){cancel();return}
    // Input can reach a busy main thread before an overdue timer callback.
    // Compare event creation times so a queued short tap cannot become a hold.
    const eventAt=inputTimestamp(event)
    const elapsed=current.eventAt!=null&&eventAt!=null?eventAt-current.eventAt:performance.now()-current.at
    if(elapsed>=HOLD_MS)open()
    else cancel()
  }
  const hint = t('Tap the expand icon, hold for 0.5 seconds or press Enter to view sets.')
  return <button type="button" ref={button} className={'history-exercise-row'+(holding?' is-holding':'')} style={{'--history-exercise-hold-duration':`${HOLD_MS}ms`}} data-exercise-id={entry.id} aria-haspopup="dialog" aria-label={`${name}. ${hint}`}
    onPointerDown={start} onPointerUp={release} onPointerCancel={cancel} onPointerLeave={cancel} onTouchCancel={cancel} onContextMenu={event=>event.preventDefault()}
    onDragStart={event=>{event.preventDefault();cancel()}}
    onClick={event=>{if(event.detail===0||event.target.closest?.('[data-history-open]'))open()}}>
    <Thumb ex={exercise}/><span className="history-exercise-row-copy"><span className="tt history-exercise-name">{name}{pr&&<span className="pr"><Icon name="trophy"/>PR</span>}</span>
      {entry.substitutedFor&&<span className="small dim">{t('Substituted for {0}',exerciseNameFor(exOr(entry.substitutedFor),{state,routineId:workout.routineId}))}</span>}
    </span><span className="history-exercise-open" data-history-open aria-hidden="true"><Icon name="expand"/></span>
  </button>
}
