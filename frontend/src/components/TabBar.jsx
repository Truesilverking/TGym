import { isTrainingPaused } from '../lib/training-pause.js'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { effectiveRoutine } from '../lib/history.js'
import { todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'

export default function TabBar({ onStart }) {
  const nav = useNavigate()
  const loc = useLocation()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const isGuest = useStore(s => s.isGuest())
  if (!user && !isGuest) return null
  const cur = loc.pathname.split('/')[1] || 'home'
  const on = k => cur === k || (cur === 'history' && k === 'stats') || (cur === 'settings' && k === 'home')

  const startWorkout = () => {
    if (!S.active) {
      if(isTrainingPaused(S,todayISO())) { onStart(); return }
      const r = effectiveRoutine(S, todayISO())
      if (r && r.ex.length) { onStart(r.id); return }
    }
    nav('/workout')
  }
  // Render buttons directly: an inline component type remounts during the activity
  // capture handler, removing the pointer target before its click can navigate.
  const tab = (k, icon, to, label) => (
    <button aria-current={cur === k ? 'page' : undefined} className={on(k) ? 'on' : ''} onClick={() => nav(to)}>
      <Icon name={icon} /><span>{label}</span>
    </button>
  )

  return (
    <nav id="tabbar">
      {tab('home', 'house', '/home', t('Home'))}
      {tab('plan', 'calendar', '/plan', t('Routine'))}
      <button data-tour="start" className={'start' + (S.active ? ' rec' : '')} onClick={startWorkout}>
        <span className="cir"><Icon name={S.active ? 'play' : 'dumbbell'} /></span>
        <span>{S.active ? t('Resume') : t('Start')}</span>
      </button>
      {tab('stats', 'chart', '/stats', t('Stats'))}
      {tab('library', 'list', '/library', t('Exercises'))}
    </nav>
  )
}
