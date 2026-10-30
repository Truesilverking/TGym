import { Activity, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { activeStatsPage, moduleForPath, STATS_PAGES, statsPages } from '../lib/navigation-model.js'
import { t } from '../lib/i18n.js'
import Home from '../views/Home.jsx'
import Plan from '../views/Plan.jsx'
import Library from '../views/Library.jsx'
import Nutrition from '../views/Nutrition.jsx'
import Stats from '../views/Stats.jsx'
import Records from '../views/Records.jsx'
import History from '../views/History.jsx'
import ProgressReport from '../views/ProgressReport.jsx'
import StatsSections from './StatsSections.jsx'
import SwipeNavigation from './SwipeNavigation.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'

// Visit lazily, then retain local dates, chart filters and drafts. Hidden
// Activity boundaries clean up effects rather than running invisible timers.
function RetainedPages({ active, pages }) {
  const location=useLocation()
  const visited=useRef(new Set())
  if(active)visited.current.add(active)
  return pages.map(([id,element])=>visited.current.has(id)?<Activity key={id} mode={active===id?'visible':'hidden'}>
    <section className="module-page" data-app-pane={id} aria-hidden={active===id?undefined:true} inert={active===id?undefined:true}><ErrorBoundary active={active===id} resetKey={location.key}>{element}</ErrorBoundary></section>
  </Activity>:null)
}
function StatsHub() {
  const location=useLocation(),S=useStore(s=>s.S)
  const active=activeStatsPage(S,location),pages=statsPages(S,active)
  const kind=active==='records'?'records':active==='workout-history'?'history':active==='report'?'report':'analytics'
  return <div className="stats-hub">
    <div className="stats-slide-heading" aria-live="polite" aria-atomic="true"><strong>{t(STATS_PAGES.find(([id])=>id===active)?.[1]||'Stats')}</strong><small>{pages.indexOf(active)+1} / {pages.length}</small></div>
    <RetainedPages active={kind} pages={[
      ['analytics',<Stats standaloneControl={false}/>],['records',<Records />],['history',<History />],['report',<ProgressReport />],
    ]}/>
  </div>
}
export default function ModuleDeck() {
  const location=useLocation(),path=location.pathname
  const S=useStore(s=>s.S)
  const active=path==='/home'?'home':path==='/plan'?'plan':path==='/library'?'library':path==='/nutrition'?'nutrition':['/stats','/body','/records','/history','/progress'].includes(path)?'stats':null
  useEffect(()=>{
    if(!location.hash)return
    let frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(()=>document.getElementById(location.hash.slice(1))?.scrollIntoView({block:'start',behavior:'auto'}))})
    return()=>cancelAnimationFrame(frame)
  },[location.pathname,location.hash,location.key])
  return <>
    <SwipeNavigation><RetainedPages active={active} pages={[
      ['home',<Home/>],['plan',<Plan/>],['library',<Library/>],['nutrition',<Nutrition/>],['stats',<StatsHub/>],
    ]}/></SwipeNavigation>
    {moduleForPath(path)==='stats'&&<StatsSections activeId={activeStatsPage(S,location)}/>}
  </>
}
