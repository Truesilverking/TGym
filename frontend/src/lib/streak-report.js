import { trainingStreak, streakOfRows } from './training-plan.js'
import { trackingStart, validDate } from './training-history.js'
import { isTrainingPaused } from './training-pause.js'
import { isoOf } from './format.js'
import { dailyPlan } from './daily-plan.js'

export const STREAK_PERIODS = [['this-week','This week'],['last-week','Last Week'],['this-month','This month'],['last-month','Last Month'],['week','Selected Week'],['month','Selected Month'],['year','Year'],['full','Full report'],['custom','Custom Range']]
export function streakRange({ period = 'this-week', anchor = new Date(), from, to, now = new Date() } = {}) {
  const today = isoOf(now)
  if (!validDate(today) || !STREAK_PERIODS.some(([id]) => id === period)) return { error: 'Choose a valid date range.' }
  if (period === 'custom') return !validDate(from) || !validDate(to) || from > to || to > today ? { error: 'Choose a valid date range.' } : { start: from, end: to, today }
  if (!period.startsWith('this-') && !period.startsWith('last-') && typeof anchor === 'string' && !validDate(anchor)) return { error: 'Choose a valid date range.' }
  const date = period.startsWith('this-') || period.startsWith('last-') ? new Date(now) : new Date(typeof anchor === 'string' ? anchor + 'T12:00:00' : anchor)
  if (!Number.isFinite(date.getTime())) return { error: 'Choose a valid date range.' }
  date.setHours(12,0,0,0)
  if (period.endsWith('week')) { date.setDate(date.getDate() - (date.getDay()+6)%7); if (period === 'last-week') date.setDate(date.getDate()-7) }
  else { date.setDate(1); if (period === 'last-month') date.setMonth(date.getMonth()-1); if (['year','full'].includes(period)) date.setMonth(0) }
  const end = new Date(date)
  if (period.endsWith('week')) end.setDate(end.getDate()+6)
  else if (period.endsWith('month')) { end.setMonth(end.getMonth()+1); end.setDate(0) }
  else { end.setFullYear(end.getFullYear()+1); end.setDate(0) }
  return { start: isoOf(date), end: isoOf(end), today }
}

// Reuse Home's actual streak rows, including neutral rest/pause and pending today.
// Earlier activity supplies streak continuity, never additional exported calendar dates.
export function buildStreakReport(S, options = {}) {
  const range = streakRange(options)
  if (range.error) return { range, days: [] }
  const asOf = range.end < range.today ? range.end : range.today
  const streak = trainingStreak(S, options.now || new Date())
  const summary = streakOfRows(streak.rows.filter(row => row.iso <= asOf))
  const rows = new Map(streak.rows.map(row => [row.iso, row]))
  const tracked = trackingStart(S, asOf), days = []
  for (const date = new Date(range.start+'T12:00:00'); isoOf(date) <= range.end; date.setDate(date.getDate()+1)) {
    const iso = isoOf(date), row = rows.get(iso)
    const status = iso < tracked ? 'untracked' : row?.status || (isTrainingPaused(S,iso) ? 'paused' : iso > asOf && dailyPlan({ ...S, routines: S.routines || [] },iso).total ? 'pending' : 'rest')
    days.push({ iso, status })
  }
  return { range, asOf, current: summary.current, best: summary.best, days, noData: !days.some(day => day.status === 'completed') }
}

const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))
const text = (x,y,value,size=20) => `<text x="${x}" y="${y}" font-size="${size}" fill="#202733">${esc(value)}</text>`
const colors = { completed:'#d82727', missed:'#c93e4e', pending:'#747b87', rest:'#edf0f4', paused:'#77619b', untracked:'#f4f4f4' }
const labels = { completed:'Recorded activity', missed:'Not completed', pending:'Pending', rest:'Rest day', paused:'Training paused', untracked:'Not tracking yet' }
export function streakReportPages(S, { format = 'pdf', t = x => x, ...options } = {}) {
  if (!['png','pdf'].includes(format)) throw Error('Invalid report format')
  const report = buildStreakReport(S, options)
  if (report.range.error) throw Error(report.range.error)
  if (format === 'png' && report.days.length > 366) throw Error('Use PDF for ranges longer than one year.')
  // PNG keeps a single image; PDF splits dates without repeating date cells.
  const size = format === 'png' ? report.days.length : options.period === 'year' ? 126 : 42, pages = []
  for (let first=0; first<report.days.length; first+=size) {
    const days=report.days.slice(first,first+size), offset=(new Date(days[0].iso+'T12:00:00').getDay()+6)%7
    const rows=Math.ceil((offset+days.length)/7), height=430+rows*90
    let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="${height}" viewBox="0 0 1000 ${height}" aria-label="${esc(t('Streak Report'))}"><rect width="1000" height="${height}" fill="white"/><g font-family="Arial, sans-serif">`
    svg+=text(48,60,'TGym',28)+text(48,112,t('Streak Report'),36)+text(48,150,report.range.start+' – '+report.range.end)
    if (!first) svg+=text(48,194,t('Streak as of {0}').replace('{0}',report.asOf))+text(48,232,t('Training streak')+': '+report.current+' · '+t('Best streak')+': '+report.best,26)
    svg+=text(48,272,t('Activity days advance the streak; missed scheduled days reset it.'),17)
    if (report.noData && !first) svg+=text(48,299,t('No recorded activity in this period.'),17)
    ;['Mo','Tu','We','Th','Fr','Sa','Su'].forEach((label,i)=>{svg+=text(54+i*130,326,t(label),16)})
    days.forEach((day,i)=>{const x=48+((offset+i)%7)*130,y=342+Math.floor((offset+i)/7)*90;svg+=`<g data-date="${day.iso}" data-status="${day.status}"><rect x="${x}" y="${y}" width="122" height="78" rx="6" fill="${colors[day.status]}"/>`+`<text x="${x+8}" y="${y+43}" font-size="17" fill="${['rest','untracked'].includes(day.status)?'#576172':'white'}">${day.iso}</text></g>`})
    Object.entries(labels).forEach(([status,label],i)=>{const x=48+(i%3)*310,y=height-67+Math.floor(i/3)*28;svg+=`<rect x="${x}" y="${y-15}" width="16" height="16" fill="${colors[status]}"/>`+text(x+24,y,t(label),15)})
    svg+=text(900,height-14,`${pages.length+1} / ${Math.ceil(report.days.length/size)}`,14)
    pages.push({svg:svg+'</g></svg>',width:1000,height})
  }
  return pages
}
export function streakFilename(options = {}) {
  const range=streakRange(options)
  if(range.error)throw Error(range.error)
  return `TGym-Streak-${range.start}_${range.end}.${options.format || 'pdf'}`
}
