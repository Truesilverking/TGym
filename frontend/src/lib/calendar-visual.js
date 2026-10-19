// Presentation only: calendar/streak calculations keep their existing status IDs.
// Streak activity and consistency's completion/partial precedence have different rules.
// These four states share exactly the same definition on screen and in exports.
const SHARED_CALENDAR_STATES = Object.freeze({
  missed: { label: 'Not Trained', fill: '#f8d4d7', ink: '#78222d', border: '#b56b73' },
  pending: { label: 'Pending', fill: '#696969', ink: '#ffffff', border: '#424242' },
  rest: { label: 'Rest day', fill: '#ffffff', ink: '#263345', border: '#7b8796' },
  paused: { label: 'Training paused', fill: '#791f34', ink: '#ffffff', border: '#4b1020' },
})
// Describes the recording boundary outside date cells; it is not a calendar state.
export const TRACKING_START_MARKER = Object.freeze({ fill: '#0f766e', border: '#064e3b' })
export const CALENDAR_STATES = Object.freeze({
  completed: { label: 'Completed', fill: '#115bb2', ink: '#ffffff', border: '#073977' },
  activity: { label: 'Recorded activity', fill: '#115bb2', ink: '#ffffff', border: '#073977' },
  partial: { label: 'Partially completed', fill: '#e49b32', ink: '#202733', border: '#835000' },
  ...SHARED_CALENDAR_STATES,
})
export const CALENDAR_STATUS_IDS = Object.freeze(['completed', 'partial', 'missed', 'pending', 'rest', 'paused', 'untracked'])
export function calendarState(status, kind = 'consistency') {
  const semantic = status === 'untracked' ? 'rest' : kind === 'streak' && status === 'completed' ? 'activity' : status
  if (!CALENDAR_STATES[semantic]) throw new Error(`Unknown calendar status: ${status}`)
  return { ...CALENDAR_STATES[semantic], semantic, status }
}
export function calendarLegend(kind = 'consistency') {
  return CALENDAR_STATUS_IDS.filter(status => status !== 'untracked' && (kind !== 'streak' || status !== 'partial')).map(status => calendarState(status, kind))
}
export function calendarVisualStyle(status, kind = 'consistency') {
  const state = calendarState(status, kind)
  return { '--calendar-fill': state.fill, '--calendar-ink': state.ink, '--calendar-border': state.border }
}

// Pre-tracking dates retain their internal status while sharing Rest presentation.
// Partial keeps its existing presentation on each surface.
export const REPORT_CALENDAR_STATES = Object.freeze({
  completed: { label: 'Completed', fill: '#115bb2', ink: '#ffffff', border: '#073977' },
  activity: { label: 'Recorded activity', fill: '#115bb2', ink: '#ffffff', border: '#073977' },
  partial: { label: 'Partial', fill: '#f4cc83', ink: '#533600', border: '#9c6b14' },
  ...SHARED_CALENDAR_STATES,
})
export function calendarReportState(status, kind = 'consistency') {
  const semantic = status === 'untracked' ? 'rest' : kind === 'streak' && status === 'completed' ? 'activity' : status
  if (!REPORT_CALENDAR_STATES[semantic]) throw new Error(`Unknown calendar status: ${status}`)
  return { ...REPORT_CALENDAR_STATES[semantic], semantic, status }
}
export function calendarReportLegend(kind = 'consistency') {
  return CALENDAR_STATUS_IDS.filter(status => status !== 'untracked' && (kind !== 'streak' || status !== 'partial')).map(status => calendarReportState(status, kind))
}
