import { t } from '../lib/i18n.js'
import { nav } from '../lib/nav.js'
import Icon from './Icon.jsx'

// Sub-screens that share one tab-bar module. Each item is its own route, so back
// navigation, deep links and the tab bar's active state keep working.
export const PLAN_VIEWS = [
  { to: '/plan', icon: 'calendar', label: 'Week & routines' },
  { to: '/library', icon: 'list', label: 'Exercises' },
]
export const PROGRESS_VIEWS = [
  { to: '/stats', icon: 'chart', label: 'Overview' },
  { to: '/body', icon: 'scale', label: 'Body' },
  { to: '/records', icon: 'trophy', label: 'PRs', name: 'Personal records' },
  { to: '/history', icon: 'history', label: 'History', tour: 'history' },
  { to: '/progress', icon: 'chartLine', label: 'Report', name: 'Progress Report' },
]

// Each view passes its own route as `current`, so the switch needs no router context:
// views stay renderable on their own (tests, previews) and navigation goes through the
// app-registered navigate in lib/nav.js.
export default function ModuleSwitch({ items = PLAN_VIEWS, current, label }) {
  const name = label || t(items === PROGRESS_VIEWS ? 'Progress sections' : 'Plan sections')
  return (
    <nav className={'module-switch' + (items.length > 3 ? ' many' : '')} aria-label={name}>
      {items.map(item => (
        <button key={item.to} type="button" data-tour={item.tour} aria-label={t(item.name || item.label)} aria-current={current === item.to ? 'page' : undefined}
          onClick={() => { if (current !== item.to) nav(item.to) }}>
          <Icon name={item.icon} />{t(item.label)}
        </button>
      ))}
    </nav>
  )
}
