// Presentation only: calendar/streak calculations keep their existing status IDs.
// Streak activity and consistency's completion/partial precedence have different rules.
export const CALENDAR_STATES = Object.freeze({
  completed: { label: 'Completed', fill: '#115bb2', ink: '#ffffff', border: '#073977' },
  activity: { label: 'Recorded activity', fill: '#115bb2', ink: '#ffffff', border: '#073977' },
  partial: { label: 'Partially completed', fill: '#e49b32', ink: '#202733', border: '#835000' },
  missed: { label: 'Not completed', fill: '#ac2040', ink: '#ffffff', border: '#72152b' },
  pending: { label: 'Pending', fill: '#475569', ink: '#ffffff', border: '#263345' },
  rest: { label: 'Rest day', fill: '#f2d36c', ink: '#202733', border: '#806818' },
  paused: { label: 'Training paused', fill: '#6b3e91', ink: '#ffffff', border: '#482761' },
  untracked: { label: 'Not tracking yet', fill: '#d7dee8', ink: '#202733', border: '#657185' },
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
export function calendarVisualStyle(status, kind = 'consistency') {
  const state = calendarState(status, kind)
  return { '--calendar-fill': state.fill, '--calendar-ink': state.ink, '--calendar-border': state.border }
}
