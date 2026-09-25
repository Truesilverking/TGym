import { trainingStart } from './training-history.js'
import { calendarPeriod, calendarFilename } from './calendar-data.js'
import { MONTHS_LONG, isoOf } from './format.js'

// A dedicated export layout; data and completion calculations remain shared with the app.
export const REPORT_COLORS = { partial: '#8662b8', completed: '#2878d0', missed: '#c93e4e', pending: '#747b87', rest: '#edf0f4', paused: '#77619b', untracked: '#f4f4f4' }
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]))
const text = (x, y, value, size = 22, weight = 400, anchor = 'start', fill = '#202733') => `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="${fill}">${escape(value)}</text>`
const rect = (x, y, w, h, fill, radius = 6) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}"/>`

function grid(S, date, period, x, y, width, t, now) {
  const data = calendarPeriod(S, date, period, now)
  const offset = period === 'week' ? 0 : (new Date(data.start + 'T12:00:00').getDay() + 6) % 7
  const gap = width < 400 ? 5 : 9, cell = (width - 6 * gap) / 7
  const title = period === 'week' ? `${data.start} - ${data.end}` : `${t(MONTHS_LONG[date.getMonth()])} ${date.getFullYear()}`
  let svg = `<g data-period="${period}" data-start="${data.start}">` + text(x, y, title, width < 400 ? 20 : 26, 650)
  const headings = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
  headings.forEach((day, i) => { svg += text(x + i * (cell + gap) + cell / 2, y + 31, t(day), width < 400 ? 13 : 18, 500, 'middle', '#576172') })
  data.days.forEach((day, i) => {
    const col = (offset + i) % 7, row = Math.floor((offset + i) / 7)
    const cx = x + col * (cell + gap), cy = y + 44 + row * (cell + gap)
    svg += `<g data-date="${day.iso}" data-status="${day.status}"><title>${escape(day.iso+(day.plan?.total>1 ? ' '+day.plan.completed+'/'+day.plan.total : ''))}</title>`
    svg += rect(cx, cy, cell, cell, REPORT_COLORS[day.status])
    svg += text(cx + cell / 2, cy + cell / 2 + (width < 400 ? 5 : 7), Number(day.iso.slice(-2)), width < 400 ? 15 : 21, 600, 'middle', ['rest','untracked'].includes(day.status) ? '#576172' : '#ffffff') + '</g>'
  })
  return svg + '</g>'
}

function page(S, anchor, period, months, overview, t, now, pageNumber, pageCount) {
  const summary = calendarPeriod(S, anchor, period === 'full' ? 'year' : period, now)
  const height = period === 'week' ? 680 : overview ? 1730 : 1390
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="${height}" viewBox="0 0 1000 ${height}" role="img" aria-label="${escape(t('Consistency Report'))}"><g font-family="Arial, sans-serif">`
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
  const legendY = height - 125
  ;[['completed', 'Completed'], ['partial','Partially completed'], ['missed', 'Not completed'], ['pending', 'Pending'], ['paused', 'Training paused'], ['untracked', 'Not tracking yet']].forEach(([status, label], i) => {
    const x = 48 + (i % 2) * 478, y = legendY + Math.floor(i / 2) * 30
    svg += rect(x, y - 18, 18, 18, REPORT_COLORS[status], 3) + text(x + 29, y - 2, t(label), 18)
  })
  svg += text(48, height - 26, t('Rest day') + ': ' + t('No scheduled workout'), 15, 400, 'start', '#576172')
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
  return groups.map((months, i) => page(S, anchor, period, months, months?.length === 12, t, now, i + 1, groups.length))
}

export function reportFilename(anchor, period, format) {
  const date = new Date(typeof anchor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(anchor) ? anchor + 'T12:00:00' : anchor)
  if (period === 'week') date.setDate(date.getDate() - (date.getDay() + 6) % 7)
  return calendarFilename(period, isoOf(date), '', format)
}
