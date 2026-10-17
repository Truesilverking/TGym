import { trainingStart } from './training-history.js'
import { calendarPeriod, calendarFilename } from './calendar-data.js'
import { MONTHS_LONG, isoOf } from './format.js'
import { calendarState, CALENDAR_STATUS_IDS } from './calendar-visual.js'
import { calendarGrid, calendarPatterns, calendarSvgLegend, calendarText as text, calendarRect as rect, escapeCalendarText as escape } from './calendar-grid.js'

// A dedicated export layout; data and completion calculations remain shared with the app.
export const REPORT_COLORS = Object.fromEntries(CALENDAR_STATUS_IDS.map(status => [status, calendarState(status).fill]))

function grid(S, date, period, x, y, width, t, now) {
  const data = calendarPeriod(S, date, period, now)
  const title = period === 'week' ? `${data.start} - ${data.end}` : `${t(MONTHS_LONG[date.getMonth()])} ${date.getFullYear()}`
  return calendarGrid({ days: data.days, title, period, x, y, width, t })
}

function page(S, anchor, period, months, overview, t, now, pageNumber, pageCount) {
  const summary = calendarPeriod(S, anchor, period === 'full' ? 'year' : period, now)
  const height = period === 'week' ? 680 : overview ? 1730 : 1390
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="${height}" viewBox="0 0 1000 ${height}" role="img" aria-label="${escape(t('Consistency Report'))}">${calendarPatterns()}<g font-family="Arial, sans-serif">`
  svg += rect(0, 0, 1000, height, '#ffffff', 0) + rect(48, 48, 48, 5, '#d82727', 2)
  svg += text(48, 92, 'TGym', 30, 750) + text(48, 144, t('Consistency Report'), 38, 700)
  svg += text(48, 181, `${summary.start} - ${summary.end} · ${t('Training since {0}').replace('{0}',trainingStart(S,isoOf(now)))}`, 20, 400, 'start', '#576172')
  const metrics = [[t('Completed'), summary.stats.completed], [t('Missed'), summary.stats.missed], [t('Completion'), summary.completion == null ? '—' : `${summary.completion}%`]]
  metrics.forEach(([label, value], i) => {
    const x = 48 + 306 * i
    svg += rect(x, 210, 290, 98, '#f3f5f8', 12) + text(x + 18, 240, label, 19) + text(x + 18, 286, value, 36, 700)
  })
  if (months) {
    const cols = overview ? 3 : 2, width = overview ? 280 : 424, stride = overview ? 309 : 478, rowHeight = overview ? 300 : 430
    months.forEach((month, i) => { svg += grid(S, new Date(anchor.getFullYear(), month, 1), 'month', 48 + (i % cols) * stride, 358 + Math.floor(i / cols) * rowHeight, width, t, now) })
  } else svg += grid(S, anchor, period, 48, 370, 904, t, now)
  svg += calendarSvgLegend({ y: height - 145, t })
  svg += text(48, height - 26, t('No scheduled workout'), 15, 400, 'start', '#576172')
  svg += text(952, height - 26, `${pageNumber} / ${pageCount}`, 15, 400, 'end', '#576172')
  return { svg: svg + '</g></svg>', width: 1000, height }
}

export function calendarReportPages(S, anchor, period, format, { t = x => x, now = new Date() } = {}) {
  if (!['week', 'month', 'year', 'full'].includes(period) || !['png', 'pdf'].includes(format)) throw new Error('Invalid calendar export')
  if (period === 'full' && format !== 'pdf') throw new Error('Full reports require PDF')
  anchor = new Date(typeof anchor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(anchor) ? anchor + 'T12:00:00' : anchor)
  if (!Number.isFinite(anchor.getTime())) throw new Error('Invalid report date')
  const all = Array.from({ length: 12 }, (_, i) => i)
  const groups = period === 'week' || period === 'month' ? [null] : format === 'png' ? [all] : period === 'full' ? [all, all.slice(0, 4), all.slice(4, 8), all.slice(8)] : [all.slice(0, 4), all.slice(4, 8), all.slice(8)]
  const pages = groups.map((months, i) => page(S, anchor, period, months, months?.length === 12, t, now, i + 1, groups.length))
  return pages
}

export function reportFilename(anchor, period, format) {
  const date = new Date(typeof anchor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(anchor) ? anchor + 'T12:00:00' : anchor)
  if (period === 'week') date.setDate(date.getDate() - (date.getDay() + 6) % 7)
  return calendarFilename(period, isoOf(date), '', format)
}
