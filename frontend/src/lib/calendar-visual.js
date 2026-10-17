// Presentation only: calendar/streak calculations keep their existing status IDs.
// Streak activity and consistency's completion/partial precedence have different rules.
export const CALENDAR_STATES = Object.freeze({
  completed: { label: 'Completed', fill: '#006b57', ink: '#ffffff', border: '#00493c', symbol: '✓', pattern: 'solid' },
  activity: { label: 'Recorded activity', fill: '#115bb2', ink: '#ffffff', border: '#073977', symbol: '★', pattern: 'solid' },
  partial: { label: 'Partially completed', fill: '#e49b32', ink: '#202733', border: '#835000', symbol: '◐', pattern: 'diagonal' },
  missed: { label: 'Not completed', fill: '#ac2040', ink: '#ffffff', border: '#72152b', symbol: '×', pattern: 'cross' },
  pending: { label: 'Pending', fill: '#475569', ink: '#ffffff', border: '#263345', symbol: '…', pattern: 'dots' },
  rest: { label: 'Rest day', fill: '#f2d36c', ink: '#202733', border: '#806818', symbol: '−', pattern: 'horizontal' },
  paused: { label: 'Training paused', fill: '#6b3e91', ink: '#ffffff', border: '#482761', symbol: 'Ⅱ', pattern: 'vertical' },
  untracked: { label: 'Not tracking yet', fill: '#d7dee8', ink: '#202733', border: '#657185', symbol: '○', pattern: 'grid' },
})
export const CALENDAR_STATUS_IDS = Object.freeze(['completed', 'partial', 'missed', 'pending', 'rest', 'paused', 'untracked'])
export function calendarState(status, kind = 'consistency') {
  const semantic = kind === 'streak' && status === 'completed' ? 'activity' : status
  if (!CALENDAR_STATES[semantic]) throw new Error(`Unknown calendar status: ${status}`)
  return { ...CALENDAR_STATES[semantic], semantic, status }
}
export function calendarLegend(kind = 'consistency') {
  return CALENDAR_STATUS_IDS.filter(status => kind !== 'streak' || status !== 'partial').map(status => calendarState(status, kind))
}
const images = {
  solid: 'none', diagonal: 'repeating-linear-gradient(135deg,transparent 0 6px,#20273320 6px 7px)',
  cross: 'repeating-linear-gradient(45deg,transparent 0 8px,#ffffff24 8px 9px),repeating-linear-gradient(135deg,transparent 0 8px,#ffffff24 8px 9px)',
  dots: 'radial-gradient(#ffffff50 .8px,transparent 1px)', horizontal: 'repeating-linear-gradient(0deg,transparent 0 7px,#20273320 7px 8px)',
  vertical: 'repeating-linear-gradient(90deg,transparent 0 7px,#ffffff30 7px 8px)', grid: 'repeating-linear-gradient(0deg,transparent 0 7px,#20273320 7px 8px),repeating-linear-gradient(90deg,transparent 0 7px,#20273320 7px 8px)',
}
export function calendarVisualStyle(status, kind = 'consistency') {
  const state = calendarState(status, kind)
  return { '--calendar-fill': state.fill, '--calendar-ink': state.ink, '--calendar-border': state.border, '--calendar-pattern': images[state.pattern], '--calendar-pattern-size': state.pattern === 'dots' ? '7px 7px' : 'auto' }
}
