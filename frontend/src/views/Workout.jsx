import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { exOr } from '../lib/exercises.js'
import { effectiveRoutine, lastEntryFor, bestWeightFor, buildSets, freestyleConfig, defaultConfig, setsDoneActive, supersetUnits, unitOf, setLabel, modeOf, isBw, isPerSide, sideReps, repStep, fmtSec, EFFORT, effortOf, stepEffort, capEffort, cascadeWeight, cascadeTopBackWeight, cascadeTopBackReps, insertWarmupRow, removeRowAt, pairAdjacent, unpairSuperset, cleanupSg, applyIntensifierPlan, pinnedNoteFor, exNoteFor, rerampWarmups } from '../lib/history.js'
import { fmtNum, fmtDate, todayISO, exCount, DAYN } from '../lib/format.js'
import { beep, vibrate } from '../lib/sound.js'
import { t, exerciseNameFor } from '../lib/i18n.js'
import { api } from '../lib/api.js'
import { setProgressHighWater, supersetFlowStep, restAfterSet, restOnRecheck } from '../lib/supersetFlow.js'
import Media from '../components/Media.jsx'
import { startFlow, exercisePicker, exConfigSheet, exerciseDetailSheet, topWeightSheet, finishWorkout, workoutCompleteSheet, confirmSheet, exerciseNoteSheet, sessionNoteSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button, Check, NumberField } from '../components/ui.jsx'
import { nextPrescription, applyPrescription, defaultIncrement } from '../lib/progression.js'
import { glyphOf } from '../lib/glyphs.js'
import { isWarmupRow, isDropSet, isRestPauseSet, dropsOf, clustersOf, addDrop, addCluster, removeDropAt, removeClusterAt, setDropAt, setClusterAt, nextDropWeight, nextBurstReps } from '../lib/workout-model.js'
import { restSeconds } from '../lib/rest-policy.js'
import { seedPlannedRir, applyTrainingPlan, clampReps, deloadStatus, deloadTargetFor, repBounds, repRangeEnabled, rirAdvice, targetRirFor, targetRirRangeFor } from '../lib/training-plan.js'
import { pauseWorkoutClock, resumeWorkoutClock, workoutElapsedMs } from '../lib/workout-time.js'

/* ---------- start chooser (no active workout) ---------- */
function StartChooser() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const todayR = effectiveRoutine(S, todayISO())
  const todayOvr = S.dayPlan[todayISO()] !== undefined
  const others = S.routines.filter(r => r !== todayR)
  return <div className="narrow">
    <div className="hdr"><div><h1>{t('Start workout')}</h1><div className="sub">{t(DAYN[new Date().getDay()])} — {todayR ? t('today is {0}', todayR.name) : t('rest day, but no one’s stopping you')}</div></div></div>
    {todayR && <div className="card" style={{ borderColor: 'var(--acc)' }}>
      <h2 className="accent">{t("Today's plan")}{todayOvr ? ' · ' + t('rescheduled') : ''}</h2>
      <div className="row between" style={{ marginBottom: 12 }}>
        <div><div className="big">{todayR.name}</div><div className="muted small">{exCount(todayR.ex.length)}</div></div>
        <span className="lrow-i" style={{ width: 38, height: 38, borderRadius: 9, fontSize: 22 }}><Icon name={glyphOf(todayR.emoji)} /></span>
      </div>
      <Button variant="primary" icon="play" onClick={() => startFlow(todayR.id)}>{t('Start {0}', todayR.name)}</Button>
    </div>}
    {others.length > 0 && <><h4 className="sec">{t('Other routines')}</h4>
      <div className="list">{others.map(r => <div key={r.id} className="item" onClick={() => startFlow(r.id)}>
        <span className="lrow-i"><Icon name={glyphOf(r.emoji)} /></span>
        <div className="grow"><div className="tt">{r.name}</div><div className="ss">{exCount(r.ex.length)}</div></div>
        <span className="tag acc">{t('Start')}</span></div>)}</div></>}
    <div style={{ height: 14 }} />
    <Button icon="shuffle" onClick={() => startFlow(null)}>{t('Freestyle workout (pick as you go)')}</Button>
    {!S.routines.length && <><div style={{ height: 10 }} /><Button variant="primary" onClick={() => nav('/plan')}>{t('Build a plan first')}</Button></>}
  </div>
}

/* ---------- elapsed clock (isolated so the workout tree doesn't re-render every second) ---------- */
function Elapsed({ workout }) {
  const [t, setT] = useState('0:00')
  useEffect(() => {
    const tick = () => { const s = Math.floor(workoutElapsedMs(workout) / 1000); setT(Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')) }
    tick(); const iv = setInterval(tick, 1000); return () => clearInterval(iv)
  }, [workout.start, workout.timerPausedAt, workout.pausedDurationMs, workout.end])
  return <span>{t}</span>
}

/* ---------- one exercise block (reps: weight×reps · time: a held duration · cardio: duration+speed) ---------- */
function ExerciseBlock({ entryIdx, compact, onToggle, onField, onAddSet, onRemoveSet, onAddWarmup, onRemoveSetAt, onStartTimed, onPairPrev, onPairNext, onSubstitute }) {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const working = useUI(s => s.work)
  const entry = S.active.entries[entryIdx]
  // Drops/bursts mutate the row in place — same card, not a new set with its own long rest.
  // A planned exercise (see the exercise's "Intensifier" config) arrives with these already
  // filled in by applyIntensifierPlan; these only add/edit/remove entries live from here on.
  const mutSet = (i, fn) => update(s => { const row = s.active.entries[entryIdx].sets[i]; s.active.entries[entryIdx].sets[i] = fn(row) }, true)
  const addDropRow = i => mutSet(i, row => {
    const drops = dropsOf(row)
    const base = drops.length ? drops[drops.length - 1].w : (row.w || 0)
    const pct = entry.target?.intensifier?.type === 'dropset' ? entry.target.intensifier.pct : undefined
    return addDrop(row, { w: nextDropWeight(base, pct), r: row.r })
  })
  // A rest-pause row's own reps are always the total across every burst (see
  // applyIntensifierPlan/history.js) — clusters are the breakdown of that total, not extra on
  // top of it — so adding, removing or editing one keeps `r` in step by the same delta.
  const addBurstRow = i => mutSet(i, row => {
    const clusters = clustersOf(row)
    const base = clusters.length ? clusters[clusters.length - 1].r : (row.r || 0)
    const restSec = entry.target?.intensifier?.type === 'restpause' ? entry.target.intensifier.restSec : (S.restPauseSec || 15)
    const added = nextBurstReps(base)
    return { ...addCluster(row, { r: added, restSec }), r: (row.r || 0) + added }
  })
  const removeDrop = (i, di) => mutSet(i, row => removeDropAt(row, di))
  const removeCluster = (i, ci) => mutSet(i, row => {
    const removed = clustersOf(row)[ci]?.r || 0
    return { ...removeClusterAt(row, ci), r: Math.max(0, (row.r || 0) - removed) }
  })
  const setDropField = (i, di, field, v) => mutSet(i, row => setDropAt(row, di, { [field]: v }))
  const setClusterField = (i, ci, v) => mutSet(i, row => {
    const delta = (Number(v) || 0) - (clustersOf(row)[ci]?.r || 0)
    return { ...setClusterAt(row, ci, { r: v }), r: Math.max(0, (row.r || 0) + delta) }
  })
  const ex = exOr(entry.id)
  const mode = modeOf({ ...(entry.target || {}), id: entry.id })
  const cardio = mode === 'cardio'
  const timed = mode === 'time'
  const last = lastEntryFor(S, entry.id)
  const standingNote = exNoteFor(S, entry.id)
  // Only worth surfacing while there is still work left: once the exercise is finished, a note
  // telling you what to do in it is behind you, and the block is already long.
  const pinnedNote = entry.sets.some(s => !s.done) ? pinnedNoteFor(S, entry.id) : null
  // The same number the "confirm your working weight" sheet calls your best, so the two
  // never disagree inside one session: heaviest logged set, or the working weight you kept.
  const best = cardio ? 0 : Math.max(bestWeightFor(S, entry.id), (S.exWeights[entry.id] || {}).w || 0)
  // What the progression policy decided for this session, and why (issue #17). Computed when
  // the session was built so the reason matches the numbers already in the rows.
  const plan = entry.plan
  // A bodyweight set has no weight to type, so the column is not there (issue #32) — one
  // stepper instead of two, which is the whole point of the flag. Adding a belt weight in the
  // config brings it back, now labelled as the addition it is.
  const cfg = { ...(entry.target || {}), id: entry.id }
  const bw = !cardio && isBw(cfg)
  const added = bw && entry.sets.some(s => s.w > 0)
  const loadStep = cfg.inc > 0 ? cfg.inc : defaultIncrement(entry.id, S.unit)
  const loadCol = { f: 'w', step: loadStep, dec: true, hd: bw ? t('Added ({0})', S.unit) : t('Weight ({0})', S.unit) }
  // The reps column is the total in every mode, unilateral included — the stepper walks in
  // twos there so the number you land on is one you can actually split evenly.
  const repCol = { f: 'r', step: repStep(cfg), dec: false, hd: t('Reps') }
  const col1 = cardio ? { f: 'min', step: 1, dec: false, hd: t('Duration (min)') }
    : timed ? { f: 'sec', step: 5, dec: false, hd: t('Seconds') }
      : (bw && !added) ? repCol : loadCol
  const col2 = cardio ? { f: 'speed', step: 0.5, dec: true, hd: t('Speed (km/h)') }
    : timed ? ((bw && !added) ? null : loadCol)
      : (bw && !added) ? null : repCol
  // Effort (RIR or RPE, whichever the profile logs) only makes sense for weighted rep sets,
  // not cardio/timed holds, and is opt-in since it adds a third stepper to every row. `opt`
  // because an unlogged effort is not the same as 0 — RIR 0 says the set went to failure.
  const hasRirTarget = [null, 'top', 'backoff'].some(role => targetRirFor(cfg, role) != null)
  const preferredEffort = effortOf(S)
  const kind = hasRirTarget && (cfg.deload || !preferredEffort || preferredEffort === 'none') ? 'rir' : preferredEffort
  const eff = EFFORT[kind]
  const col3 = mode === 'reps' && eff ? { ...eff, eff: kind, dec: true, opt: true, hd: t(eff.hd) } : null
  // The effort column walks its own scale — see stepEffort. Weight and reps step up from 0
  // with no ceiling, as they always did.
  const bump = (s, i, col, dir) => {
    if (col.eff) return onField(i, col.f, stepEffort(col.eff, s[col.f], dir))
    const value = Math.max(0, Math.round(((s[col.f] || 0) + dir * col.step) * 100) / 100)
    onField(i, col.f, col.f === 'r' ? clampReps(S, cfg, s, value) : value)
  }
  // Uses the shared stepper markup so a set row picks up the same control styling
  // as every other +/- field in the app.
  const cell = (s, i, col, cls) => (
    <div className={'stp ' + cls}>
      <button aria-label="Decrease" onClick={() => bump(s, i, col, -1)}><Icon name="minus" /></button>
      {/* a typed effort is capped — there is no RPE 12, and 12 reps in reserve is a warm-up */}
      <span className="val"><NumberField decimal={col.dec} nullable={col.opt} value={s[col.f] ?? ''}
        onChange={v => onField(i, col.f, col.eff ? capEffort(col.eff, v) : col.f === 'r' ? clampReps(S, cfg, s, v) : v)} /></span>
      <button aria-label="Increase" onClick={() => bump(s, i, col, 1)}><Icon name="plus" /></button>
    </div>
  )
  // A smaller stepper for a drop's weight/reps or a burst's reps — editing what the plan (or a
  // live "+ Drop"/"+ Burst" tap) already put on the row, not typing into a fresh field.
  const miniStepper = (value, step, dec, onChange) => (
    <div className="stp mini">
      <button aria-label="Decrease" onClick={() => onChange(Math.max(0, Math.round(((value || 0) - step) * 100) / 100))}><Icon name="minus" /></button>
      <span className="val"><NumberField decimal={dec} value={value ?? ''} onChange={onChange} /></span>
      <button aria-label="Increase" onClick={() => onChange(Math.max(0, Math.round(((value || 0) + step) * 100) / 100))}><Icon name="plus" /></button>
    </div>
  )
  return <>
    <Media ex={ex} key={entry.id} compact={compact} minimizable />
    <div className="row between" style={{ marginBottom: 6 }}>
      <div><div style={{ fontSize: compact ? 17 : 20, fontWeight: 600, letterSpacing: '-.02em', textTransform: 'capitalize', lineHeight: 1.2 }}>{exerciseNameFor(ex)}</div>{S.exerciseAliases?.[ex.id] && <div className="small dim">{t('Alias')}: {S.exerciseAliases[ex.id]}</div>}</div>
      <div className="row" style={{ gap: 2, flex: 'none' }}>
        {!compact && <button className="iconbtn" aria-label={t('Substitute for this workout')} title={t('Substitute for this workout')} onClick={onSubstitute}><Icon name="shuffle" /></button>}
        <button className="iconbtn" aria-label={t('Note')} title={t('Note')}
          style={entry.note ? { color: 'var(--acc)' } : undefined}
          onClick={() => exerciseNoteSheet(entryIdx)}><Icon name="pencil" /></button>
        <button className="iconbtn" aria-label={t('Details')} onClick={() => exerciseDetailSheet(ex)}><Icon name="info" /></button>
      </div>
    </div>
    {!compact && (onPairPrev || onPairNext) && <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
      {onPairPrev && <Button size="xs" variant="tinted" icon="link" title={t('Make superset with previous')} onClick={onPairPrev}>{t('Make superset with previous')}</Button>}
      {onPairNext && <Button size="xs" variant="tinted" icon="link" title={t('Make superset with next')} onClick={onPairNext}>{t('Make superset with next')}</Button>}
    </div>}
    <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
      {cardio && <span className="tag acc"><Icon name="figureRun" />{t('Cardio')}</span>}
      {/* You log the total; this is the split, so the set in front of you is unambiguous
          without the rep count having to mean two different things (issue #31). */}
      {!cardio && isPerSide(cfg) && <span className="tag acc nocap"><Icon name="shuffle" />{timed ? `${fmtSec(entry.sets.find(s => !s.done)?.sec ?? entry.sets[0]?.sec)} ${t('/ side')}` : t('{0} per side', fmtNum(sideReps(entry.sets.find(s => !s.done)?.r ?? entry.sets[0]?.r)))}</span>}
      {(ex.tg || ex.bp) && <span className="tag">{t(ex.tg || ex.bp)}</span>}
      {ex.eq && <span className="tag">{t(ex.eq)}</span>}
      {best > 0 && <span className="tag nocap">{t('Best:')} {fmtNum(best)} {S.unit}</span>}
    </div>
    {/* Three notes can apply to one exercise and they are not interchangeable, so each keeps its
        own line and its own icon: the plan's instruction (cfg.note, from the routine), the
        standing fact about the movement (exNotes), and the message you pinned to yourself last
        session. Today's own note is edited through the button in the header and shown last. */}
    {cfg.note && <div className="exnote">{cfg.note}</div>}
    {standingNote && <div className="exnote"><Icon name="info" style={{ fontSize: 13, marginRight: 5, verticalAlign: '-2px' }} />{standingNote}</div>}
    {pinnedNote && <div className="exnote" style={{ color: 'var(--yellow)' }}>
      <Icon name="flag" style={{ fontSize: 13, marginRight: 5, verticalAlign: '-2px' }} />
      {t('From {0}:', fmtDate(pinnedNote.d, true))} {pinnedNote.note}
    </div>}
    {entry.note && <div className="exnote">{entry.note}</div>}
    {last && <div className="small dim" style={{ marginBottom: 4 }}>{t('Last time')} ({fmtDate(last.d)}): {last.sets.map(s => setLabel(entry.id, s, last.target)).join(', ')}</div>}
    {plan && plan.why && plan.kind !== 'off' && <div className={'progline' + (plan.kind === 'deload' ? ' warn' : '')}>
      <Icon name={plan.kind === 'up' ? 'arrowUp' : plan.kind === 'deload' ? 'arrowDown' : 'lightbulb'} />
      <span>{t(...plan.why)}</span>
    </div>}
    {!cardio && !timed && (() => {
      const targetRir = targetRirRangeFor(cfg, null)
      return <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {targetRir && cfg.setScheme !== 'topback' && <span className="tag nocap">{t('Target RIR')}: {fmtNum(targetRir.min)}{targetRir.max !== targetRir.min ? `–${fmtNum(targetRir.max)}` : ''}</span>}
      </div>
    })()}
    {S.exerciseGoals?.[entry.id] && <div className="small row" style={{ color: 'var(--yellow)', gap: 5, marginBottom: 8 }}><Icon name="target" />{t('Goal')}: {S.exerciseGoals[entry.id].weight > 0 ? fmtNum(S.exerciseGoals[entry.id].weight) + ' ' + S.unit : ''}{S.exerciseGoals[entry.id].weight > 0 && S.exerciseGoals[entry.id].reps > 0 ? ' × ' : ''}{S.exerciseGoals[entry.id].reps > 0 ? S.exerciseGoals[entry.id].reps + ' ' + t('reps') : ''}</div>}
    <div className="card sets-card" style={{ marginTop: 10, marginBottom: 0 }}>
      {/* the header carries the same eff3 sizing as the rows, or the labels drift off their columns */}
      <div className={'sethead' + (col3 ? ' eff3' : '')}><span className="n-sp" />
        <span className={'w-sp' + (col1.hd === t('Reps') ? ' sethead-range' : '')}><span>{col1.hd}</span>{mode === 'reps' && cfg.setScheme !== 'topback' && col1.hd === t('Reps') && repRangeEnabled(cfg) && <small>{repBounds(cfg).min}-{repBounds(cfg).max}</small>}</span>
        {col2 && <span className={'r-sp' + (col2.hd === t('Reps') ? ' sethead-range' : '')}><span>{col2.hd}</span>{mode === 'reps' && cfg.setScheme !== 'topback' && col2.hd === t('Reps') && repRangeEnabled(cfg) && <small>{repBounds(cfg).min}-{repBounds(cfg).max}</small>}</span>}
        {col3 && <span className="eff-sp sethead-range"><span>{col3.hd}</span>{cfg.setScheme !== 'topback' && col3.eff === 'rir' && targetRirRangeFor(cfg) && <small>{fmtNum(targetRirRangeFor(cfg).min)}{targetRirRangeFor(cfg).max !== targetRirRangeFor(cfg).min ? `–${fmtNum(targetRirRangeFor(cfg).max)}` : ''}</small>}</span>}{(timed || cardio) && <span className="ck-sp" />}<span className="ck-sp" /></div>
      {entry.sets.map((s, i) => {
        const warm = isWarmupRow(s)
        const warmBefore = i > 0 && isWarmupRow(entry.sets[i - 1])
        const isFirstWarmup = warm && !warmBefore
        // Numbering restarts per phase: with two warm-ups the first work set reads 1, not 3.
        const phaseNum = entry.sets.slice(0, i + 1).filter(x => isWarmupRow(x) === warm).length
        const roleBefore = i > 0 ? entry.sets[i - 1].role : null
        return <div key={i}>
          {isFirstWarmup && <div className="setph">{t('Warm-up')}</div>}
          {!warm && warmBefore && <div className="setsep" />}
          {!warm && s.role && s.role !== roleBefore && <div className={'settargets' + (col3 ? ' eff3' : '')}>
            <span className="phase-label">{s.role === 'top' ? t('Top set') : t('Back-off sets')}</span>
            <span className="n-sp" />
            <span className="w-sp">{col1.f === 'r' && repRangeEnabled(cfg) && <b>{repBounds(cfg, s.role).min}-{repBounds(cfg, s.role).max}</b>}</span>
            {col2 && <span className="r-sp">{col2.f === 'r' && repRangeEnabled(cfg) && <b>{repBounds(cfg, s.role).min}-{repBounds(cfg, s.role).max}</b>}</span>}
            {col3 && (() => { const rr = targetRirRangeFor(cfg, s.role); const label = rr ? `${fmtNum(rr.min)}${rr.max !== rr.min ? `–${fmtNum(rr.max)}` : ''}` : ''; return <span className="eff-sp" aria-label={rr ? `RIR ${label}` : undefined}>{rr && <b>{label}</b>}</span> })()}
            <span className="ck-sp" />
          </div>}
          <div className={'setrow' + (s.done ? ' done' : '') + (col3 ? ' eff3' : '')}>
            <div className="n">{phaseNum}</div>
            {cell(s, i, col1, 'w')}
            {col2 && cell(s, i, col2, 'r')}
            {col3 && (warm ? <div className="stp eff disabled" aria-label={t('RIR is not rated for warm-up sets')}>—</div> : cell(s, i, col3, 'eff'))}
            {/* A timed set is started, not typed: the timer counts the hold down and checks the
                set off itself. The checkbox stays for anyone who timed it on their own watch. */}
            {(timed || cardio) && <button className="setgo" aria-label={t(cardio ? 'Start cardio timer' : 'Start set')} disabled={s.done || !!working}
              onClick={() => onStartTimed(i)}><Icon name="play" /></button>}
            {warm && <button className="iconbtn" style={{ fontSize: 13 }} aria-label={t('Remove set')}
              disabled={entry.sets.length <= 1} onClick={() => onRemoveSetAt(i)}><Icon name="xmark" /></button>}
            <Check checked={s.done} onChange={() => onToggle(i)} />
          </div>
          {/* Drop-sets and rest-pause bursts extend this same row — no long rest, no new set.
              A planned exercise arrives with these already filled in (applyIntensifierPlan);
              every value here is just as editable as the main row's own weight/reps. */}
          {!warm && mode === 'reps' && <>
            {dropsOf(s).map((d, di) => (
              <div className="subrow" key={'d' + di}>
                <span className="subn">{t('Drop {0}', di + 1)}</span>
                {miniStepper(d.w, loadStep, true, v => setDropField(i, di, 'w', v))}
                {miniStepper(d.r, 1, false, v => setDropField(i, di, 'r', v))}
                <button className="iconbtn" aria-label={t('Remove drop')} onClick={() => removeDrop(i, di)}><Icon name="xmark" /></button>
              </div>
            ))}
            {clustersOf(s).map((c, ci) => (
              <div className="subrow" key={'c' + ci}>
                <span className="subn">{t('Burst {0}', ci + 1)}</span>
                {miniStepper(c.r, 1, false, v => setClusterField(i, ci, v))}
                <span className="dim small">{c.restSec}s</span>
                <button className="iconbtn" aria-label={t('Remove burst')} onClick={() => removeCluster(i, ci)}><Icon name="xmark" /></button>
              </div>
            ))}
            <div className="setextra">
              {!isRestPauseSet(s) && <button className="chip add" onClick={() => addDropRow(i)}><Icon name="arrowDown" />{t('+ Drop')}</button>}
              {!isDropSet(s) && <button className="chip add" onClick={() => addBurstRow(i)}><Icon name="bolt" />{t('+ Burst')}</button>}
            </div>
          </>}
        </div>
      })}
      <div style={{ height: 8 }} />
      <div className="workout-set-actions">
        <Button size="sm" icon="flame" onClick={onAddWarmup}>{t('Add warm-up set')}</Button>
        <Button size="sm" aria-label={t('Add set')} onClick={onAddSet}>+ {t('Set')}</Button>
        <Button size="sm" aria-label={t('Remove set')} disabled={entry.sets.length <= 1} onClick={onRemoveSet}>− {t('Set')}</Button>
      </div>
      {(() => {
        const advice = rirAdvice(entry.sets, cfg)
        const hasTarget = targetRirFor(cfg, null) != null || (cfg.setScheme === 'topback' && (targetRirFor(cfg, 'top') != null || targetRirFor(cfg, 'backoff') != null))
        if (!hasTarget || advice.kind === 'missing') return null
        const copy = advice.kind === 'increase' ? t('RIR suggests increasing the load next time.') : advice.kind === 'reduce' ? t('RIR suggests reducing the load next time.') : t('RIR is on target — keep the load.')
        return <div className={'progline rir-suggestion' + (advice.kind === 'reduce' ? ' warn' : '')}><Icon name={advice.kind === 'increase' ? 'arrowUp' : advice.kind === 'reduce' ? 'arrowDown' : 'checkCircle'} /><span>{copy}</span></div>
      })()}
    </div>
  </>
}

/* ---------- active workout ---------- */
export function removeActiveExercise(idx) {
  // Clear the work callback before indexes can shift. This also protects a confirmation sheet
  // that was opened first and confirmed after a timed hold started.
  useUI.getState().stopWork()
  useStore.getState().update(s => {
    if (!s.active || !Array.isArray(s.active.entries)) return
    if (idx < 0 || idx >= s.active.entries.length) return
    s.active.entries.splice(idx, 1)
    cleanupSg(s.active.entries)
    if (idx < s.active.cur) s.active.cur--
    if (s.active.cur >= s.active.entries.length) s.active.cur = Math.max(0, s.active.entries.length - 1)
  }, true)
}

function ActiveWorkout() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const { startRest, stopRest, work } = useUI()
  const A = S.active
  const routine = S.routines.find(r => r.id === A.routineId) || {}
  const restFor = (idx, setIndex, phase = 'set') => restSeconds({ state: S, routine, target: A.entries[idx]?.target || {}, setIndex, warmup: isWarmupRow(A.entries[idx]?.sets?.[setIndex]), phase })
  const beginRest = sec => { if (sec > 0) startRest(sec); else stopRest() }
  const units = supersetUnits(A.entries)
  const cur = Math.min(A.cur, Math.max(0, A.entries.length - 1))
  const unit = A.entries.length ? unitOf(units, cur) : []
  const unitIdx = units.findIndex(u => u === unit)
  const isSuperset = unit.length > 1
  // Superset flow: keep the active exercise in view - completing a set scrolls to the
  // next exercise in the group, then back up to the first exercise of the next round.
  const exRefs = useRef({})
  const progressHighWater = useRef(A.entries.map(e => e.sets.filter(s => s.done).length))
  // The marks are index-keyed, and removing an exercise shifts every index above it down
  // (removeActiveExercise splices). Re-baseline whenever the list length changes, otherwise a
  // shifted exercise inherits its predecessor's mark and its real progress reads as a re-check.
  useEffect(() => {
    progressHighWater.current = A.entries.map(e => e.sets.filter(s => s.done).length)
  }, [A.entries.length])
  useEffect(() => {
    if (!isSuperset) return
    const el = exRefs.current[cur]
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [cur, isSuperset, A.entries.length])

  const total = A.entries.reduce((n, e) => n + e.sets.length, 0)
  const done = setsDoneActive(A)

  const mutEntry = (idx, fn) => update(s => { fn(s.active.entries[idx]) }, true)
  // Clearing an optional field drops the key rather than storing null, so a set only carries
  // what was actually logged — in the session, in history and in a backup.
  const setField = (idx, i, field, v) => mutEntry(idx, e => {
    const warm = isWarmupRow(e.sets[i])
    const safe = field === 'r' && warm ? Math.max(0, Math.round(Number(v) || 0)) : v
    if (safe == null) delete e.sets[i][field]; else e.sets[i][field] = safe
    // Changing a weight cascades to the following sets of the same phase, so a
    // heavier bar carries through the set instead of retyping every row.
    if (field === 'w') {
      e.sets = e.target?.setScheme === 'topback'
        ? cascadeTopBackWeight(e.sets, i, safe, e.target, defaultIncrement(e.id, S.unit))
        : cascadeWeight(e.sets, i, safe)
    }
    if (field === 'r' && e.target?.setScheme === 'topback' && !warm) e.sets = cascadeTopBackReps(e.sets, i, safe, e.target)
    const firstWork = e.sets.findIndex(row => !isWarmupRow(row))
    if (i === firstWork && (field === 'w' || field === 'r' || field === 'sec')) e.sets = rerampWarmups(e.sets, defaultIncrement(e.id, S.unit))
  })
  const modeAt = idx => modeOf({ ...(A.entries[idx].target || {}), id: A.entries[idx].id })
  const addSet = idx => mutEntry(idx, e => {
    const l = e.sets[e.sets.length - 1]
    const m = modeOf({ ...(e.target || {}), id: e.id })
    if (m === 'cardio') e.sets.push({ min: l ? l.min : (e.target.min || 20), speed: l ? l.speed : (e.target.speed || 8), done: false })
    else if (m === 'time') e.sets.push({ sec: l ? l.sec : (e.target.sec || 45), w: l ? (l.w || 0) : (e.target.weight || 0), done: false })
    else e.sets.push(seedPlannedRir({ w: l ? l.w : 0, r: l ? l.r : e.target.reps, role: l?.role, done: false }, e.target || {}))
  })
  const removeSet = idx => mutEntry(idx, e => { if (e.sets.length > 1) e.sets.pop() })
  const addWarmup = idx => mutEntry(idx, e => {
    const m = modeOf({ ...(e.target || {}), id: e.id })
    e.sets = insertWarmupRow(e.sets, m, e.target || {}, defaultIncrement(e.id, S.unit))
  })
  const removeSetAt = (idx, i) => mutEntry(idx, e => { e.sets = removeRowAt(e.sets, i) })
  const pairAt = (first, second) => update(s => {
    s.active.entries = pairAdjacent(s.active.entries, first, second)
  })
  const unpairAt = idx => update(s => {
    s.active.entries = unpairSuperset(s.active.entries, idx)
  })
  const onPairPrev = !isSuperset && cur > 0 ? () => pairAt(cur - 1, cur) : null
  const onPairNext = !isSuperset && cur < A.entries.length - 1 ? () => pairAt(cur, cur + 1) : null

  // Remove a whole exercise from the session. The confirmation always asks first; in a
  // superset it asks WHICH exercise of the group to remove.
  const removeExercise = removeActiveExercise
  const confirmRemoveExercise = idx => {
    const e = A.entries[idx]
    if (!e) return
    const hasDone = (e.sets || []).some(s => s.done)
    confirmSheet({
      title: t('Remove {0}?', exerciseNameFor(exOr(e.id))),
      message: hasDone
        ? t('The sets you logged for this exercise in this session will be lost.')
        : t('This removes the exercise from your current session.'),
      confirmText: t('Remove'), danger: true, onConfirm: () => removeExercise(idx)
    })
  }
  const removeExerciseSheet = () => {
    if (unit.length > 1) {
      useUI.getState().openSheet(close => (
        <div>
          <h3>{t('Remove exercise')}</h3>
          <div className="muted small" style={{ marginBottom: 12 }}>{t('Which exercise in this superset do you want to remove?')}</div>
          <div className="list">
            {unit.map(idx => <div key={idx} className="item" onClick={() => { close(); confirmRemoveExercise(idx) }}>
              <div className="grow"><div className="tt">{exerciseNameFor(exOr(A.entries[idx]?.id))}</div></div>
              <Icon name="chevronRight" />
            </div>)}
          </div>
        </div>
      ))
    } else confirmRemoveExercise(cur)
  }

  // A timed set is held, not typed. The work timer records what was actually held — an early
  // finish logs 0:38 of a 0:45 target rather than crediting the full prescription — and then
  // checks the set off through the normal path, so rest, supersets and the finish prompt all
  // behave exactly as they do for a reps set.
  const startTimed = (idx, i) => {
    const e = A.entries[idx]
    const cardio = modeAt(idx) === 'cardio'
    const seconds = cardio ? Math.max(60, Math.round((e.sets[i].min || 20) * 60)) : (e.sets[i].sec || 45)
    const name = exerciseNameFor(exOr(e.id))
    if (!cardio && isPerSide(e.target)) {
      useUI.getState().startWork(seconds, `${name} · ${t('Left side')}`, leftSec => {
        mutEntry(idx, en => { en.sets[i].leftSec = leftSec; en.sets[i].side = true })
        useUI.getState().toast(t('Switch sides'))
        setTimeout(() => {
          const live = useStore.getState().S.active?.entries?.[idx]?.sets?.[i]
          if (!live || live.done) return
          useUI.getState().startWork(seconds, `${name} · ${t('Right side')}`, rightSec => {
            mutEntry(idx, en => { en.sets[i].rightSec = rightSec; en.sets[i].side = true })
            if (!useStore.getState().S.active.entries[idx].sets[i].done) toggle(idx, i)
          })
        }, 700)
      })
      return
    }
    useUI.getState().startWork(seconds, name, elapsed => {
      mutEntry(idx, en => { if (cardio) en.sets[i].min = Math.round(elapsed / 6) / 10; else en.sets[i].sec = elapsed })
      if (!useStore.getState().S.active.entries[idx].sets[i].done) toggle(idx, i)
    })
  }

  const substituteExercise = idx => {
    const originalEntry = A.entries[idx]
    const original = exOr(originalEntry.id)
    const choose = () => exercisePicker(ex => exConfigSheet(ex, null, cfg => {
      const target = { id: ex.id, ...cfg }
      const plan = nextPrescription(S, target, null)
      const step = defaultIncrement(ex.id, S.unit)
      const sets = applyIntensifierPlan(applyTrainingPlan(applyPrescription(buildSets(S, target, { step }), plan, step), target, step, deloadStatus(S)), target)
      update(s => {
        const old = s.active.entries[idx]
        s.active.entries[idx] = { id: ex.id, sg: old.sg, target, plan, sets, substitutedFor: old.substitutedFor || old.id }
      }, true)
      useUI.getState().toast(t('Substituted only for this workout'))
    }, null, null), {
      title: 'Choose a substitute',
      subtitle: 'Suggestions use the same body area and a similar muscle or equipment.',
      filter: ex => ex.id !== original.id && ex.bp === original.bp && (ex.tg === original.tg || ex.eq === original.eq)
    })
    if (originalEntry.sets.some(s => s.done)) confirmSheet({
      title: t('Replace completed sets?'), message: t('Completed sets for this exercise will be removed from the current workout.'), confirmText: t('Continue'), danger: true, onConfirm: choose
    })
    else choose()
  }

  const toggle = (idx, i) => {
    const m = modeAt(idx)
    const cardioEntry = m === 'cardio'
    let askTop = false, exJustDone = false, workoutDone = false, checked = false
    mutEntry(idx, e => {
      e.sets[i].done = !e.sets[i].done
      checked = e.sets[i].done
      if (e.sets[i].done) {
        e.sets[i].doneAt = Date.now()
        beep(S.sound, 1040, 0.12); vibrate(30)
        workoutDone = A.entries.every((entry, ui) => {
          const sets = (ui === idx ? e : entry).sets
          return sets.length > 0 && sets.every(x => x.done)
        })
        // Only loaded reps training has a "working weight" worth confirming — a bodyweight
        // plank has nothing to put in that slider, and neither does a set of push-ups
        // (issue #32: the fewest taps that still record what happened).
        const loaded = m === 'reps' && !(isBw({ ...(e.target || {}), id: e.id }) && !e.sets.some(x => x.w > 0))
        if (e.sets.every(x => x.done)) { exJustDone = true; if (loaded && !e.asked) { e.asked = true; askTop = true } }
      } else delete e.sets[i].doneAt
    })
    update(s => {
      if (!s.active) return
      if (workoutDone && checked) s.active = pauseWorkoutClock(s.active)
    }, true)
    // reps: topWeight first (it chains into the finish/continue prompt on the last unit).
    // cardio/timed or already-confirmed: go straight to the prompt.
    if (askTop) topWeightSheet(idx)
    else if (workoutDone) workoutCompleteSheet()
    else if (exJustDone && cardioEntry) useUI.getState().toast(t('Cardio logged'))
    else if (exJustDone && m === 'time') useUI.getState().toast(t('Hold logged'))

    // Only progress beyond this exercise's high-water mark may navigate or change rest. This
    // prevents an uncheck/re-check of finished work from replaying the flow side effects.
    const fresh = useStore.getState().S.active
    if (fresh && checked && fresh.entries[idx]) {
      const progress = setProgressHighWater(fresh.entries[idx], progressHighWater.current[idx] || 0)
      progressHighWater.current[idx] = progress.highWater

      const freshUnits = supersetUnits(fresh.entries)
      const freshUnit = freshUnits.find(u => u.includes(idx))
      const freshUnitIdx = freshUnits.indexOf(freshUnit)
      const freshLastUnit = freshUnitIdx >= freshUnits.length - 1
      const freshUnitDone = freshUnit?.every(ui => fresh.entries[ui].sets.every(x => x.done))

      // A re-check of finished work must not navigate or reopen a sheet, but it may still owe
      // you a rest — see restOnRecheck, and the other half of issue #3.
      if (!progress.isNew) {
        if (restOnRecheck({ timerRunning: !!useUI.getState().timer, unitDone: freshUnitDone, lastUnit: freshLastUnit })) beginRest(restFor(idx, i, freshUnitDone ? 'betweenExercises' : 'set'))
        return
      }

      // Singleton units are ordinary exercises: they rest between sets and after the closing
      // one, and never enter superset navigation. stopRest() first so the rest that belongs
      // after this set replaces the one that was running, rather than stacking on it.
      if (freshUnitDone) stopRest()
      if (!freshUnit || freshUnit.length <= 1) {
        if (restAfterSet({ unitDone: freshUnitDone, lastUnit: freshLastUnit })) beginRest(restFor(idx, i, freshUnitDone ? 'betweenExercises' : 'set'))
        return
      }

      const step = supersetFlowStep(fresh.entries, freshUnit, idx)
      if (!step) return
      if (step.unitDone) {
        if (!freshLastUnit) {
          const nextUnit = freshUnits[freshUnitIdx + 1]
          // The top-weight sheet's explicit "Just close" path owns the choice not to advance.
          if (!askTop && nextUnit?.length) update(s => { if (s.active) s.active.cur = nextUnit[0] })
          beginRest(restFor(idx, i, 'supersetRound'))
        }
      } else {
        if (step.nextIdx != null) update(s => { if (s.active) s.active.cur = step.nextIdx })
        if (step.roundDone) beginRest(restFor(idx, i, 'supersetRound'))
        else beginRest(restFor(idx, i, 'supersetMove'))
      }
    }
  }

  // Live-presence heartbeat so the admin dashboard can show who's training now. Signed-in only —
  // guests have no server session. Reads fresh state each tick so progress stays current.
  useEffect(() => {
    if (!useStore.getState().user) return
    let stopped = false
    const ping = active => {
      const A2 = useStore.getState().S.active
      if (!A2) return
      const u = supersetUnits(A2.entries)
      const c = Math.min(A2.cur, Math.max(0, A2.entries.length - 1))
      const ui = u.findIndex(x => x.includes(c))
      const tot = A2.entries.reduce((n, e) => n + e.sets.length, 0)
      api('/api/activity', { method: 'POST', body: JSON.stringify({
        active, name: A2.name, exIdx: ui + 1, exTotal: u.length,
        setsDone: setsDoneActive(A2), setsTotal: tot, startedAt: A2.start
      }) }).catch(() => {})
    }
    ping(true)
    const iv = setInterval(() => { if (!stopped) ping(true) }, 20000)
    return () => {
      stopped = true; clearInterval(iv)
      // best-effort "left" signal: sendBeacon survives a tab close, fetch covers in-app nav
      try { navigator.sendBeacon?.('/api/activity', new Blob([JSON.stringify({ active: false })], { type: 'application/json' })) } catch { /* */ }
      api('/api/activity', { method: 'POST', body: JSON.stringify({ active: false }) }).catch(() => {})
    }
  }, [])

  return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" aria-label={t('Discard')} onClick={() => confirmSheet({ title: t('Discard workout?'), message: t('The sets you logged in this session will be lost.'), confirmText: t('Discard'), danger: true, onConfirm: () => { update(s => { s.active = null }); stopRest(); nav('/home') } })}><Icon name="xmark" /></button>
      <div style={{ textAlign: 'center' }}><div style={{ fontWeight: 600 }}>{A.name}</div><div className="sub"><Elapsed workout={A} /> · {t('{0} sets', done + '/' + total)}</div></div>
      <button className="iconbtn" style={{ color: 'var(--acc)' }} aria-label={t('Finish')} onClick={finishWorkout}><Icon name="check" /></button>
    </div>
    <div className="wprog"><i style={{ width: (total ? done / total * 100 : 0) + '%' }} /></div>

    {A.entries.length ? <>
      <div className="muted small" style={{ marginBottom: 6 }}>{isSuperset ? t('Superset {0} / {1}', unitIdx + 1, units.length) : t('Exercise {0} / {1}', unitIdx + 1, units.length)}</div>
      {isSuperset ? (
        <div className="ss-card">
          <div className="ss-hd" style={{ justifyContent: 'space-between' }}>
            <span className="row" style={{ gap: 5 }}><Icon name="link" />{t('Superset · do these back-to-back, rest when done')}</span>
            <Button size="xs" variant="ghost" icon="link" title={t('Unpair')} onClick={() => unpairAt(cur)}>{t('Unpair')}</Button>
          </div>
          {unit.map((idx, k) => <div key={idx} ref={el => { exRefs.current[idx] = el }} className="ss-ex" data-exidx={idx}>
            {k > 0 && <div className="ss-amp">+</div>}
            <ExerciseBlock entryIdx={idx} compact
              onToggle={i => toggle(idx, i)} onField={(i, f, v) => setField(idx, i, f, v)} onAddSet={() => addSet(idx)} onRemoveSet={() => removeSet(idx)} onAddWarmup={() => addWarmup(idx)} onRemoveSetAt={i => removeSetAt(idx, i)} onStartTimed={i => startTimed(idx, i)} />
          </div>)}
        </div>
      ) : (
        <ExerciseBlock entryIdx={cur} onToggle={i => toggle(cur, i)} onField={(i, f, v) => setField(cur, i, f, v)} onAddSet={() => addSet(cur)} onRemoveSet={() => removeSet(cur)} onAddWarmup={() => addWarmup(cur)} onRemoveSetAt={i => removeSetAt(cur, i)} onStartTimed={i => startTimed(cur, i)} onPairPrev={onPairPrev} onPairNext={onPairNext} onSubstitute={() => substituteExercise(cur)} />
      )}
    </> : <div className="empty"><div className="ico"><Icon name="shuffle" /></div>{t('Freestyle workout — add your first exercise.')}</div>}

    <div style={{ height: 12 }} />
    <div className="row">
      <Button icon="chevronLeft" disabled={unitIdx <= 0} onClick={() => update(s => { s.active.cur = units[unitIdx - 1][0] })}>{t('Prev')}</Button>
      <Button trailingIcon="chevronRight" disabled={unitIdx < 0 || unitIdx >= units.length - 1} onClick={() => update(s => { s.active.cur = units[unitIdx + 1][0] })}>{t('Next')}</Button>
    </div>
    <div style={{ height: 10 }} />
    <Button onClick={() => exercisePicker(ex => {
      const routine = S.routines.find(r => r.id === A.routineId)
      const freestyle = !A.routineId
      // Freestyle has no routine prescription to apply: show the last target in the config
      // sheet and carry its completed rows forward. A planned session keeps its existing path.
      const seed = freestyle ? freestyleConfig(S, { id: ex.id, ...defaultConfig(ex.id) }) : null
      exConfigSheet(ex, null, cfg => update(s => {
        const full = { ...cfg, id: ex.id }
        const plan = freestyle ? null : nextPrescription(s, full, s.routines.find(r => r.id === s.active.routineId))
        const step = defaultIncrement(ex.id, s.unit)
        const sets = buildSets(s, full, { step, ...(freestyle ? { preferLast: true } : {}) })
        const progressed = freestyle ? sets : applyPrescription(sets, plan, step)
        const deload = deloadStatus(s)
        const target = deloadTargetFor(full, deload)
        const shownPlan = deload.active ? { kind: 'deload', why: ['Deload session — load, working sets and effort are reduced for recovery.'] } : plan
        s.active.entries.push({ id: ex.id, target, plan: shownPlan, sets: applyIntensifierPlan(applyTrainingPlan(progressed, target, step, deload), target) })
        s.active.cur = s.active.entries.length - 1
      }), null, routine, seed)
    })} icon="plus">{t('Add exercise')}</Button>
    {A.entries.length > 0 && <>
      <div style={{ height: 6 }} />
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Button size="sm" icon="minus" style={{ color: 'var(--red)' }} disabled={!!work} onClick={removeExerciseSheet}>{t('Remove exercise')}</Button>
      </div>
    </>}
    <div style={{ height: 10 }} />
    {/* Wrapping up is when you know how the session went, so the note sits with the finish
        button rather than somewhere in the header. */}
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
      <Button size="sm" icon="pencil" variant={A.note ? 'tinted' : undefined} onClick={sessionNoteSheet}>
        {A.note ? t('Edit session note') : t('Add session note')}
      </Button>
    </div>
    {A.timerPausedAt && <Button onClick={() => update(s => {
      if (s.active) s.active = resumeWorkoutClock(s.active)
    }, true)}>{t('Continue workout')}</Button>}
    {(() => {
      const exDone = A.entries.filter(e => e.sets.length && e.sets.every(s => s.done)).length
      const allDone = A.entries.length > 0 && exDone === A.entries.length
      return <button className={allDone ? 'btn primary' : 'btn ghost dim'} onClick={finishWorkout}>
        {allDone ? t('Finish workout') : t('Finish workout early · {0} exercises', exDone + '/' + A.entries.length)}
      </button>
    })()}
    <div style={{ height: 40 }} />
  </div>
}

export default function Workout() {
  const active = useStore(s => s.S.active)
  return active ? <ActiveWorkout /> : <StartChooser />
}
