import { nextDailyRoutine } from '../lib/daily-plan.js'
import { isTrainingPaused } from '../lib/training-pause.js'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import { openModuleMenu } from './ModuleMenu.jsx'
import { useState } from 'react'

export default function TabBar({ onStart }) {
  const nav = useNavigate()
  const loc = useLocation()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const isGuest = useStore(s => s.isGuest())
  const onboarding = useStore(s => s.needsMobileOnboarding)
  const [opened,setOpened]=useState(null)
  // First-run setup is a full-screen flow: the rail would offer exits into empty screens.
  if ((!user && !isGuest) || onboarding) return null
  const cur = loc.pathname.split('/')[1] || 'home'
  // Each module owns its sub-screens: Exercises live under Plan, History/Report under Progress.
  const owner = { history: 'stats', progress: 'stats', body: 'stats', records: 'stats', library: 'plan', settings: 'home', admin: 'home' }
  const on = k => (owner[cur] || cur) === k

  const startWorkout = () => {
    if (!S.active) {
      if(isTrainingPaused(S,todayISO())) { onStart(); return }
      const r = nextDailyRoutine(S, todayISO())
      if (r && r.ex.length) { onStart(r.id); return }
    }
    nav('/workout')
  }
  // Render buttons directly: an inline component type remounts during the activity
  // capture handler, removing the pointer target before its click can navigate.
  const tab = (k, icon, to, label) => (
    <button type="button" aria-current={on(k) ? 'page' : undefined} className={on(k) ? 'on' : ''} aria-haspopup="dialog" aria-expanded={opened===k} aria-controls={k==='stats'?'stats-sections-menu':'module-menu-'+k} onClick={() => {setOpened(k);openModuleMenu(k,label,loc.pathname+loc.search+loc.hash,nav,()=>setOpened(null))}}>
      <Icon name={icon} /><span className="tab-label">{label}<Icon name="chevronDown"/></span>
    </button>
  )

  return (
    <nav id="tabbar" data-tour="navigation">
      {tab('home', 'house', '/home', t('Today'))}
      {tab('plan', 'calendar', '/plan', t('Routine'))}
      <button data-tour="start" className={'start' + (S.active ? ' rec' : '')} onClick={startWorkout}>
        <span className="cir"><Icon name={S.active ? 'play' : 'dumbbell'} /></span>
        <span>{S.active ? t('Resume') : t('Start')}</span>
      </button>
      {tab('nutrition', 'fork', '/nutrition', t('Nutrition'))}
      {tab('stats', 'chart', '/stats', t('Stats'))}
    </nav>
  )
}
