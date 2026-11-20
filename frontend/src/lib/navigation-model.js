import { STATS_VIEW_SECTIONS, statsSelectionOrder } from './stats-sections.js'

export const MODULES = [
  { id:'home', label:'Today', icon:'house', to:'/home' },
  { id:'plan', label:'Routine', icon:'calendar', to:'/plan' },
  { id:'nutrition', label:'Nutrition', icon:'fork', to:'/nutrition' },
  { id:'stats', label:'Stats', icon:'chart', to:'/stats' },
]
export const STATS_EXTRA_PAGES = [['records','Personal records'],['workout-history','History'],['report','Progress Report']]
export const STATS_PAGES = [...STATS_VIEW_SECTIONS, ...STATS_EXTRA_PAGES]
const pageIds = STATS_PAGES.map(([id]) => id)
export const statsPageTarget = id => id === 'records' ? '/records' : id === 'workout-history' ? '/history' : id === 'report' ? '/progress' : '/stats?section=' + encodeURIComponent(id)
export function requestedStatsPage(location) {
  const path = location.pathname
  if (path === '/records') return 'records'
  if (path === '/history') return 'workout-history'
  if (path === '/progress') return 'report'
  if (path === '/body') return 'bodyweight'
  const id = new URLSearchParams(location.search || '').get('section')
  return path === '/stats' && pageIds.includes(id) ? id : null
}
export function statsPageOrder(S) {
  const saved = Array.isArray(S.statsPageOrder) ? S.statsPageOrder.filter(id => pageIds.includes(id)) : []
  return [...new Set([...saved, ...statsSelectionOrder(S.statsSections,S.statsSectionOrder), ...STATS_EXTRA_PAGES.map(([id])=>id), ...pageIds])]
}
export function statsPages(S, requested = null) {
  const shown = new Set([...statsSelectionOrder(S.statsSections,S.statsSectionOrder), ...STATS_EXTRA_PAGES.map(([id])=>id)])
  if (pageIds.includes(requested)) shown.add(requested)
  return statsPageOrder(S).filter(id=>shown.has(id))
}
export function activeStatsPage(S, location) {
  return requestedStatsPage(location) || statsPages(S)[0]
}
export function moduleForPath(path) {
  if (['/stats','/body','/records','/history','/progress'].includes(path)) return 'stats'
  if (path === '/plan' || path === '/library' || path.startsWith('/plan/r/')) return 'plan'
  if (path === '/nutrition') return 'nutrition'
  if (['/home','/settings','/admin'].includes(path)) return 'home'
  return null
}
export function swipeTarget(S, location, direction) {
  if (!['/home','/plan','/library','/nutrition','/stats','/body','/records','/history','/progress'].includes(location.pathname)) return null
  const requested = requestedStatsPage(location)
  const pages = statsPages(S,requested)
  const routes = ['/home','/plan','/library','/nutrition',...pages.map(statsPageTarget)]
  const current = moduleForPath(location.pathname) === 'stats' ? statsPageTarget(activeStatsPage(S,location)) : location.pathname
  const index = routes.indexOf(current)
  return index < 0 ? null : routes[(index + (direction > 0 ? 1 : -1) + routes.length) % routes.length]
}
