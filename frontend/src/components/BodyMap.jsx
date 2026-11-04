import { useEffect, useState } from 'react'
import { MUSCLES, INERT, MUSCLE_NAME, levelsOf } from '../lib/muscles.js'
import { loadBodyGeometry } from '../lib/body-geometry.js'
import { Button } from './ui.jsx'
import { t } from '../lib/i18n.js'

// Front and back views of a body, each muscle shaded by how hard it was worked.
//
// The five shade steps are the same ones the activity heatmap uses (.hm-c.l0…l4), so
// "more accent = more training" means one thing everywhere in the app rather than two.
//
// The geometry is ~90 KB and only some screens show a map, so it is fetched on first
// render instead of riding along in the main bundle. Until it lands the component
// renders nothing but keeps its height, so nothing below it jumps on arrival.

function useBodyPaths() {
  const [paths,setPaths]=useState(null),[error,setError]=useState(false),[attempt,setAttempt]=useState(0)
  useEffect(()=>{
    let alive=true
    setError(false)
    loadBodyGeometry().then(p=>{if(alive)setPaths(p)}).catch(()=>{if(alive)setError(true)})
    return()=>{alive=false}
  },[attempt])
  return {paths,error,retry:()=>setAttempt(n=>n+1)}
}

function View({ view, label, levels, onMuscle, selected, overlay }) {
  return (
    <svg className="bm-v" viewBox={view.vb} role={overlay ? "group" : "img"} aria-label={label}>
      {INERT.map(slug => (view.p[slug] || []).map((d, i) =>
        <path key={slug + i} className="bm-sil" d={d} />))}
      {MUSCLES.map(slug => (view.p[slug] || []).map((d, i) =>
        <path
          key={slug + i}
          className={'bm-m l' + (levels[slug] || 0) + (selected === slug ? ' sel' : '')}
          d={d}
          onClick={onMuscle ? () => onMuscle(slug) : undefined}
        >
          <title>{t(MUSCLE_NAME[slug])}</title>
        </path>))}
      {overlay}
    </svg>
  )
}

/**
 * <BodyMap load={{ chest: 12, … }} body="male" />
 * `load` is effective sets per muscle (see lib/muscles.js); shading is relative to
 * the hardest-worked muscle in that same load, so it always reads as a balance. Pass ordered
 * `{ at, level, exclusive? }` `thresholds` for a fixed absolute scale (recovery views use this
 * to keep their semantic bands stable); omitting it preserves the balance behavior.
 */
export default function BodyMap({ load = {}, thresholds, body = 'male', onMuscle, selected, className = '', renderOverlay, frontOnly=false, label }) {
  const {paths,error,retry} = useBodyPaths()
  const levels = levelsOf(load, thresholds)
  const g = paths && (paths[body] || paths.male)
  return (
    <div className={'bodymap ' + className}>
      {g ? <>
        <View view={g.front} label={label||t('Muscles trained: front view')} overlay={renderOverlay?.(g.front)} levels={levels} onMuscle={onMuscle} selected={selected} />
        {!frontOnly&&<View view={g.back} label={t('Muscles trained: back view')} levels={levels} onMuscle={onMuscle} selected={selected} />}
      </> : <div className="bm-ph" role="status">{error?<><p>{t('Could not load body model.')}</p><Button size="sm" onClick={retry}>{t('Retry')}</Button></>:t('Loading…')}</div>}
    </div>
  )
}

export function BodyMapLegend() {
  return <div className="hm-legend">
    {t('Less')} <div className="hm-c l0" /><div className="hm-c l1" /><div className="hm-c l2" />
    <div className="hm-c l3" /><div className="hm-c l4" /> {t('More')}
  </div>
}
