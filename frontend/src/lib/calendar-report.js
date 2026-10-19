import { trainingStart, trackingStart } from './training-history.js'
import { calendarPeriod, calendarFilename } from './calendar-data.js'
import { isoOf } from './format.js'
import { calendarReportState, CALENDAR_STATUS_IDS } from './calendar-visual.js'
import { calendarReportLayout } from './calendar-report-layout.js'
import { calendarFullReportPages } from './calendar-full-report.js'
import { completeYearRange, CONSISTENCY_PERIODS } from './calendar-year-range.js'
import { calendarYearReportPages } from './calendar-year-report.js'
export { CONSISTENCY_PERIODS } from './calendar-year-range.js'

// A dedicated export layout; data and completion calculations remain shared with the app.
export const REPORT_COLORS = Object.fromEntries(CALENDAR_STATUS_IDS.map(status => [status, calendarReportState(status).fill]))

export function calendarReportPages(S, anchor, period, format, { t = x => x, now = new Date(), fromYear, toYear } = {}) {
  if (!CONSISTENCY_PERIODS.some(([id]) => id === period) || !['png', 'pdf'].includes(format)) throw new Error('Invalid calendar export')
  if (period === 'years') {
    if (format !== 'pdf') throw Error('Complete-year reports require PDF')
    const range = completeYearRange({ fromYear, toYear })
    if (range.error) throw Error(range.error)
    return range.years.flatMap(year => {
      const report = calendarPeriod(S, new Date(`${year}-01-01T12:00:00`), 'year', now)
      return calendarYearReportPages({ kind: 'consistency', year, days: report.days, trackingSince: trackingStart(S, isoOf(now)),
        metrics: [['Completed', report.stats.completed], ['Missed', report.stats.missed], ['Completion', report.completion == null ? '—' : `${report.completion}%`]],
        context: t('Training since {0}').replace('{0}', trainingStart(S, isoOf(now))), note: `${t('Rest day')}: ${t('No scheduled workout')}`,
        t })
    })
  }
  if (period === 'full' && format !== 'pdf') throw new Error('Full reports require PDF')
  anchor = new Date(typeof anchor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(anchor) ? anchor + 'T12:00:00' : anchor)
  if (!Number.isFinite(anchor.getTime())) throw new Error('Invalid report date')
  if (period === 'full') {
    const report = calendarPeriod(S, anchor, 'year', now)
    return calendarFullReportPages({ kind: 'consistency', days: report.days, start: report.start, end: report.end, trackingSince: trackingStart(S, isoOf(now)),
      metrics: [['Completed', report.stats.completed], ['Missed', report.stats.missed], ['Completion', report.completion == null ? '—' : `${report.completion}%`]],
      context: t('Training since {0}').replace('{0}', trainingStart(S, isoOf(now))), note: `${t('Rest day')}: ${t('No scheduled workout')}`, t })
  }
  const report = calendarPeriod(S, anchor, period, now)
  return calendarReportLayout({ kind: 'consistency', days: report.days, start: report.start, end: report.end, trackingSince: trackingStart(S, isoOf(now)),
    metrics: [['Completed', report.stats.completed], ['Missed', report.stats.missed], ['Completion', report.completion == null ? '—' : `${report.completion}%`]],
    context: t('Training since {0}').replace('{0}', trainingStart(S, isoOf(now))), note: `${t('Rest day')}: ${t('No scheduled workout')}`,
    format, week: period === 'week', t })
}

export function reportFilename(anchor, period, format, options = {}) {
  if (period === 'years') {
    if (format !== 'pdf') throw Error('Complete-year reports require PDF')
    const range = completeYearRange(options)
    if (range.error) throw Error(range.error)
    return `TGym-Consistency-Years-${range.years[0]}_${range.years.at(-1)}.pdf`
  }
  const date = new Date(typeof anchor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(anchor) ? anchor + 'T12:00:00' : anchor)
  if (period === 'week') date.setDate(date.getDate() - (date.getDay() + 6) % 7)
  return calendarFilename(period, isoOf(date), '', format)
}
