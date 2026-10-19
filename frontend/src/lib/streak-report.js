import { trainingStreak, streakOfRows } from './training-plan.js'
import { trackingStart, validDate } from './training-history.js'
import { isTrainingPaused } from './training-pause.js'
import { isoOf } from './format.js'
import { dailyPlan } from './daily-plan.js'
import { calendarReportLayout } from './calendar-report-layout.js'
import { calendarFullReportPages } from './calendar-full-report.js'
import { completeYearRange } from './calendar-year-range.js'
import { calendarYearReportPages } from './calendar-year-report.js'

export const STREAK_PERIODS = [['this-week','This week'],['last-week','Last Week'],['this-month','This month'],['last-month','Last Month'],['week','Selected Week'],['month','Selected Month'],['year','Year'],['full','Full report'],['custom','Custom Range'],['years','Complete years']]
export function streakRange({ period = 'this-week', anchor = new Date(), from, to, fromYear, toYear, now = new Date() } = {}) {
  const today = isoOf(now)
  if (!validDate(today) || !STREAK_PERIODS.some(([id]) => id === period)) return { error: 'Choose a valid date range.' }
  if (period === 'years') return { ...completeYearRange({ fromYear, toYear }), today }
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
export function buildStreakReport(S, options = {}, sharedStreak) {
  const range = streakRange(options)
  if (range.error) return { range, days: [] }
  if (options.period === 'years') {
    const streak = sharedStreak || trainingStreak(S, options.now || new Date())
    const yearReports = range.years.map(year => buildStreakReport(S, { ...options, period: 'year', anchor: `${year}-01-01` }, streak))
    const last = yearReports.at(-1)
    return { range, asOf: last.asOf, current: last.current, best: last.best, days: yearReports.flatMap(report => report.days), noData: yearReports.every(report => report.noData), yearReports }
  }
  const asOf = range.end < range.today ? range.end : range.today
  const streak = sharedStreak || trainingStreak(S, options.now || new Date())
  const summary = streakOfRows(streak.rows.filter(row => row.iso <= asOf))
  const rows = new Map(streak.rows.map(row => [row.iso, row]))
  const tracked = trackingStart(S, asOf), days = []
  const lastDate = new Date(range.end+'T12:00:00')
  for (const date = new Date(range.start+'T12:00:00'); date <= lastDate; date.setDate(date.getDate()+1)) {
    const iso = isoOf(date), row = rows.get(iso)
    const status = iso < tracked ? 'untracked' : row?.status || (isTrainingPaused(S,iso) ? 'paused' : iso > asOf && dailyPlan({ ...S, routines: S.routines || [] },iso).total ? 'pending' : 'rest')
    days.push({ iso, status })
  }
  return { range, asOf, current: summary.current, best: summary.best, days, noData: !days.some(day => day.status === 'completed') }
}

export function streakReportPages(S, { format = 'pdf', t = x => x, ...options } = {}) {
  if (!['png','pdf'].includes(format)) throw Error('Invalid report format')
  if (options.period === 'years' && format !== 'pdf') throw Error('Complete-year reports require PDF')
  const report = buildStreakReport(S, options)
  if (report.range.error) throw Error(report.range.error)
  const trackingSince = trackingStart(S, report.range.today)
  if (options.period === 'years') return report.yearReports.flatMap((annual, i) => calendarYearReportPages({ kind: 'streak', year: report.range.years[i], days: annual.days, trackingSince,
    metrics: [['Training streak', annual.current], ['Best streak', annual.best]], context: t('Streak as of {0}').replace('{0}', annual.asOf),
    note: `${t('Activity days advance the streak; missed scheduled days reset it.')} ${t('Counts training dates, not calendar days.')}`, emptyMessage: annual.noData ? t('No recorded activity in this period.') : '',
    t }))
  if (format === 'png' && report.days.length > 366) throw Error('Use PDF for ranges longer than one year.')
  if (format === 'pdf' && options.period === 'full') return calendarFullReportPages({ kind: 'streak', days: report.days, start: report.range.start, end: report.range.end, trackingSince,
    metrics: [['Training streak', report.current], ['Best streak', report.best]], context: t('Streak as of {0}').replace('{0}', report.asOf),
    note: `${t('Activity days advance the streak; missed scheduled days reset it.')} ${t('Counts training dates, not calendar days.')}`, emptyMessage: report.noData ? t('No recorded activity in this period.') : '', t })
  return calendarReportLayout({ kind: 'streak', days: report.days, start: report.range.start, end: report.range.end, trackingSince,
    metrics: [['Training streak', report.current], ['Best streak', report.best]], context: t('Streak as of {0}').replace('{0}', report.asOf),
    note: `${t('Activity days advance the streak; missed scheduled days reset it.')} ${t('Counts training dates, not calendar days.')}`,
    emptyMessage: report.noData ? t('No recorded activity in this period.') : '', format, week: (options.period || 'this-week').endsWith('week'), t })
}
export function streakFilename(options = {}) {
  const range=streakRange(options)
  if(range.error)throw Error(range.error)
  if (options.period === 'years') {
    if (options.format && options.format !== 'pdf') throw Error('Complete-year reports require PDF')
    return `TGym-Streak-Years-${range.years[0]}_${range.years.at(-1)}.pdf`
  }
  return `TGym-Streak-${range.start}_${range.end}.${options.format || 'pdf'}`
}
