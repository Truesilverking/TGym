import { nextDailyRoutine } from '../lib/daily-plan.js'
import { isTrainingPaused } from '../lib/training-pause.js'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import './NavigationDock.css'

const DOCK_PAGES = new Set(['/home','/plan','/library','/nutrition','/stats','/body','/records','/history','/progress'])

export default function TabBar({ onStart }) {
  const nav = useNavigate(), loc = useLocation()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const isGuest = useStore(s => s.isGuest())
  const onboarding = useStore(s => s.needsMobileOnboarding)
  const page = loc.pathname.replace(/\/+$/,'') || '/home'
  // Workout, Settings and editors continue to own their full-screen navigation.
  if (!(user || isGuest) || onboarding || !DOCK_PAGES.has(page)) return null

  const cur = loc.pathname.split('/')[1] || 'home'
  const owner = { history:'stats', progress:'stats', body:'stats', records:'stats', library:'plan' }
  const startWorkout = () => {
    if (!S.active) {
      if (isTrainingPaused(S,todayISO())) { onStart(); return }
      const routine = nextDailyRoutine(S,todayISO())
      if (routine?.ex.length) { onStart(routine.id); return }
    }
    nav('/workout')
  }
  // Return native buttons directly so activity saves do not remount a pressed tab.
  const tab = (id,icon,to,label) => <button type="button" className={'navigation-dock-tab'+((owner[cur]||cur)===id?' on':'')}
    aria-current={(owner[cur]||cur)===id?'page':undefined} onClick={()=>nav(to)}>
    <Icon name={icon}/><span className="tab-label">{t(label)}</span>
  </button>

  return <nav id="tabbar" className="persistent-navigation" aria-label={t('Main navigation')} data-tour="navigation">
    {tab('home','house','/home','Today')}
    {tab('plan','calendar','/plan','Routine')}
    <button type="button" data-tour="start" className={'start'+(S.active?' rec':'')} onClick={startWorkout}>
      <span className="cir"><Icon name={S.active?'play':'dumbbell'}/></span>
      <span>{t(S.active?'Resume':'Start')}</span>
    </button>
    {tab('nutrition','fork','/nutrition','Nutrition')}
    {tab('stats','chart','/stats','Stats')}
  </nav>
}
