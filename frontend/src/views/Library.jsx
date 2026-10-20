import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { BODYPARTS, allExercises, equipmentOf, exerciseSearchScore } from '../lib/exercises.js'
import { activeProfile, exAvailable } from '../lib/equipment.js'
import { bestWeightForEntry } from '../lib/history.js'
import { fmtNum } from '../lib/format.js'
import { t, exerciseNameFor, useLang } from '../lib/i18n.js'
import { Thumb } from '../components/Media.jsx'
import { exerciseDetailSheet, addToRoutineSheet, customExSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button, SearchField } from '../components/ui.jsx'

export default function Library() {
  const S = useStore(s => s.S)
  const langV = useLang()
  const [q, setQ] = useState('')
  const [bp, setBp] = useState('')
  const [eq, setEq] = useState('')
  const [showAll, setShowAll] = useState(false)   // ignore the active equipment profile for this session
  const [shown, setShown] = useState(40)
  const profile = activeProfile(S)
  const bestByEx = useMemo(() => {
    const map = new Map()
    for (const w of S.workouts || []) {
      for (const e of w.entries || []) {
        const wBest = bestWeightForEntry(e)
        if (wBest > (map.get(e.id) || 0)) map.set(e.id, wBest)
      }
    }
    return map
  }, [S.workouts])
  const { eqOpts, eqOn, f } = useMemo(() => {
    const filtered = allExercises(S).filter(e => !bp || e.bp === bp)
    const trimmed = q.trim()
    const base = trimmed
      ? filtered
          .map(e => ({ e, score: exerciseSearchScore(e, trimmed, S.exerciseAliases?.[e.id]) }))
          .filter(x => Number.isFinite(x.score))
          .sort((a, b) => a.score - b.score)
          .map(x => x.e)
      : filtered
    const eqFiltered = (profile && !showAll) ? base.filter(e => exAvailable(S, e)) : base
    const opts = equipmentOf(eqFiltered)
    // Drop the equipment filter if the search narrowed it away, so you never hit a dead end.
    const activeEq = opts.includes(eq) ? eq : ''
    return { eqOpts: opts, eqOn: activeEq, f: activeEq ? eqFiltered.filter(e => e.eq === activeEq) : eqFiltered }
  }, [S.customEx, S.exerciseAliases, S.equipProfiles, S.activeEquipId, S.equipFilterOn, bp, q, eq, showAll, profile, langV])

  return <>
    <div className="hdr hdr-centered"><span className="hdr-slot" aria-hidden="true" /><div className="hdr-center"><h1>{t('Exercises')}</h1></div><span className="hdr-slot" aria-hidden="true" /></div>
    <SearchField aria-label={t('Search…')} placeholder={t('Search…')} value={q} onChange={e => { setQ(e.target.value); setShown(40) }} onClear={() => { setQ(''); setShown(40) }} />
    {profile && <div className="small dim row" style={{ margin: '-4px 2px 10px', gap: 6, alignItems: 'center' }}>
      <Icon name="dumbbell" style={{ fontSize: 13 }} />
      {showAll ? t('Showing all equipment') : t('Showing what you have in "{0}"', profile.name)}
      <button className="chip nocap" style={{ marginLeft: 'auto', padding: '3px 10px', fontSize: 12 }} onClick={() => setShowAll(v => !v)}>
        {showAll ? t('Filter by "{0}"', profile.name) : t('Show all equipment')}
      </button>
    </div>}
    <div className="chips" style={{ marginBottom: eqOpts.length > 1 ? 8 : 12 }}>
      <button className={'chip nocap' + (!bp ? ' on' : '')} onClick={() => { setBp(''); setEq(''); setShown(40) }}>{t('All')}</button>
      {BODYPARTS.map(b => <button key={b} className={'chip' + (bp === b ? ' on' : '')} onClick={() => { setBp(b); setEq(''); setShown(40) }}>{t(b)}</button>)}
    </div>
    {eqOpts.length > 1 && <div className="chips" style={{ marginBottom: 12 }}>
      <button className={'chip nocap' + (!eqOn ? ' on' : '')} onClick={() => { setEq(''); setShown(40) }}>{t('Any equipment')}</button>
      {eqOpts.map(x => <button key={x} className={'chip' + (eqOn === x ? ' on' : '')} onClick={() => { setEq(x); setShown(40) }}>{t(x)}</button>)}
    </div>}
    <div className="list library-list">
      <button type="button" className="item" onClick={() => customExSheet(null, ex => exerciseDetailSheet(ex), q.trim())}>
        <div className="thumb thumb-x"><Icon name="sparkles" /></div>
        <div className="grow"><div className="tt">{t('Create your own exercise')}</div><div className="ss">{t('name + body part, no animation')}</div></div><Icon name="plus" className="chev" />
      </button>
      {f.slice(0, shown).map(e => {
        const best = bestByEx.get(e.id) || 0
        return <div key={e.id} className="item" onClick={() => exerciseDetailSheet(e)}>
          <button type="button" className="library-exercise-open" onClick={ev => { ev.stopPropagation(); exerciseDetailSheet(e) }}>
          <Thumb ex={e} />
          <div className="grow"><div className="tt capitalize">{exerciseNameFor(e)}</div><div className="ss capitalize">{t(e.tg || e.bp)} · {t(e.eq)}</div></div>
          {S.avoidedExercises?.[e.id] && <span className="tag" style={{ color: 'var(--orange)' }}>{t('Avoiding')}</span>}
          {best > 0 && <span className="tag acc">{fmtNum(best)}</span>}
          </button>
          <Button size="sm" variant="tinted" icon="plus" onClick={ev => { ev.stopPropagation(); addToRoutineSheet(e) }}>{t('Routine')}</Button>
        </div>
      })}
      {f.length === 0 && <div className="empty"><div className="ico"><Icon name="magnifier" /></div>{t('No match')}</div>}
    </div>
    {f.length > shown && <><div style={{ height: 10 }} /><Button onClick={() => setShown(s => s + 40)}>{t('Show more')}</Button></>}
  </>
}

