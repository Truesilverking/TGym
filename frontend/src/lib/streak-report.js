import { trainingStreak, streakOfRows } from './training-plan.js'
import { trackingStart, validDate } from './training-history.js'
import { isTrainingPaused } from './training-pause.js'
import { isoOf } from './format.js'
import { dailyPlan } from './daily-plan.js'
import { MONTHS_LONG } from './format.js'
import { calendarGrid, calendarSvgLegend, calendarText as text, calendarRect as rect, escapeCalendarText as esc } from './calendar-grid.js'

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

export function streakReportPages(S, { format = 'pdf', t = x => x, ...options } = {}) {
  if (!['png','pdf'].includes(format)) throw Error('Invalid report format')
  const report = buildStreakReport(S, options)
  if (report.range.error) throw Error(report.range.error)
  if (format === 'png' && report.days.length > 366) throw Error('Use PDF for ranges longer than one year.')
  // PNG keeps a single image; PDF splits dates without repeating date cells.
  const chunks = [], pages = []
  if (format === 'pdf' && options.period === 'year') {
    // Four whole months per A4 page keep month labels and legends readable.
    for (let month=0;month<12;month+=4) chunks.push(report.days.filter(day => { const m=Number(day.iso.slice(5,7))-1; return m>=month&&m<month+4 }))
  } else {
    const size = format === 'png' ? report.days.length : 42
    for (let first=0;first<report.days.length;first+=size) chunks.push(report.days.slice(first,first+size))
  }
  for (const [first, days] of chunks.entries()) {
    const week=(options.period || 'this-week').endsWith('week')
    const months = new Map()
    for (const day of days) { const key=week ? 'week' : day.iso.slice(0,7); if (!months.has(key)) months.set(key, []); months.get(key).push(day) }
    const groups=[...months.values()], overview=format==='png' && groups.length>2
    const cols=overview?3:groups.length>1?2:1, width=overview?280:cols===2?424:904, stride=overview?309:478
    const rowHeight=overview?300:cols===2?430:week?170:730
    const height=Math.max(680,350+Math.ceil(groups.length/cols)*rowHeight+180)
    let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="${height}" viewBox="0 0 1000 ${height}" role="img" aria-label="${esc(t('Streak Report'))}">${rect(0,0,1000,height,'#ffffff',0)}<g font-family="Arial, sans-serif">`
    svg+=text(48,60,'TGym',28)+text(48,112,t('Streak Report'),36)+text(48,150,report.range.start+' – '+report.range.end)
    if (!first) svg+=text(48,194,t('Streak as of {0}').replace('{0}',report.asOf))+text(48,232,t('Training streak')+': '+report.current+' · '+t('Best streak')+': '+report.best,26)
    svg+=text(48,272,t('Activity days advance the streak; missed scheduled days reset it.'),17)
    if (report.noData && !first) svg+=text(48,299,t('No recorded activity in this period.'),17)
    groups.forEach((days,i)=>{
      const date=new Date(days[0].iso+'T12:00:00'), title=week?`${days[0].iso} - ${days.at(-1).iso}`:`${t(MONTHS_LONG[date.getMonth()])} ${date.getFullYear()}`
      svg+=calendarGrid({days,title,period:week?'week':'month',x:48+i%cols*stride,y:350+Math.floor(i/cols)*rowHeight,width,kind:'streak',t})
    })
    svg+=calendarSvgLegend({y:height-115,kind:'streak',t})
    svg+=text(952,height-26,`${pages.length+1} / ${chunks.length}`,15,400,'end','#576172')
    pages.push({svg:svg+'</g></svg>',width:1000,height})
  }
  return pages
}
export function streakFilename(options = {}) {
  const range=streakRange(options)
  if(range.error)throw Error(range.error)
  return `TGym-Streak-${range.start}_${range.end}.${options.format || 'pdf'}`
}
