import { MONTHS_LONG } from './format.js'
import { calendarLegend } from './calendar-visual.js'
import { calendarGrid, calendarText as text, calendarRect as rect, escapeCalendarText as escape } from './calendar-grid.js'
import { calendarWrappedText as wrapped, calendarTextWidth as measure } from './calendar-full-report.js'

const WIDTH = 1414, HEIGHT = 1000, NAVY = '#18324f', MUTED = '#52647c', BLUE = '#115bb2'
// One complete year per landscape A4 page; no date cells are repeated or omitted.
// The report builders supply each year's existing data/metrics/evaluation context.
export function calendarYearReportPage({ kind, year, days, metrics, context = '', note = '', emptyMessage = '', pageNumber, pageCount, fromYear, toYear, t = x => x }) {
  const title = t(kind === 'streak' ? 'Streak Report' : 'Consistency Report')
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${escape(title)}" data-layout="complete-year" data-year="${year}"><g font-family="Arial, sans-serif">`
  svg += rect(0, 0, WIDTH, HEIGHT, '#ffffff', 0) + rect(48, 21, 4, 20, BLUE, 2) + text(63, 38, 'TGym', 20, 750, 'start', BLUE)
  svg += measure(title, 32) <= 1120 ? text(48, 77, title, 32, 750, 'start', NAVY) : wrapped(48, 52, title, 1120, 28, 30, 750, NAVY)
  svg += text(1366, 78, year, 50, 750, 'end', NAVY)
  svg += text(48, 103, `${t('Complete years')} · ${year}-01-01 - ${year}-12-31`, 17, 400, 'start', MUTED)
  svg += text(48, 125, context, 16, 400, 'start', MUTED) + wrapped(48, 148, note, 700, 15, 17)
  const totalWidth = metrics.length === 3 ? 590 : 470, cardWidth = (totalWidth - (metrics.length - 1) * 10) / metrics.length
  metrics.forEach(([label, value], i) => {
    const x = 1366 - totalWidth + i * (cardWidth + 10)
    svg += `<g data-summary="${escape(label)}" data-value="${escape(value)}">` + rect(x, 92, cardWidth, 72, '#eef3fa', 9)
    svg += wrapped(x + 12, 108, t(label), cardWidth - 24, 16, 18, 500, NAVY) + text(x + cardWidth - 12, 155, value, 22, 750, 'end', BLUE) + '</g>'
  })
  for (let month = 0; month < 12; month++) {
    const x = 48 + month % 4 * 334, y = 174 + Math.floor(month / 4) * 242, key = `${year}-${String(month + 1).padStart(2, '0')}`
    svg += `<g data-month="${key}"><rect x="${x}" y="${y}" width="316" height="232" rx="10" fill="#f7f9fc" stroke="#e2e8f0"/>`
    svg += calendarGrid({ days: days.filter(day => day.iso.startsWith(key)), title: t(MONTHS_LONG[month]), x: x + 18, y: y + 23, width: 280, kind, t,
      geometry: { cell: 26, gap: 3, daySize: 18, weekdaySize: 16, titleSize: 21, weekdayOffset: 22, daysOffset: 33, titleFill: NAVY } }) + '</g>'
  }
  svg += '<line x1="48" y1="897" x2="1366" y2="897" stroke="#e2e8f0"/>'
  calendarLegend(kind).forEach((state, i) => {
    const x = 48 + i % 4 * 334, y = 916 + Math.floor(i / 4) * 38
    svg += `<g data-legend="${state.status}" data-semantic="${state.semantic}"><rect x="${x}" y="${y - 15}" width="18" height="18" rx="3" fill="${state.fill}" stroke="${state.border}"/>` + wrapped(x + 27, y, t(state.label), 280, 18, 20) + '</g>'
  })
  if (emptyMessage) svg += wrapped(716, 954, emptyMessage, 650, 15, 17)
  svg += text(48, 990, `${t('Complete years')} · ${fromYear} - ${toYear}`, 15, 400, 'start', MUTED) + text(1366, 990, `${pageNumber} / ${pageCount}`, 15, 400, 'end', MUTED)
  return { svg: svg + '</g></svg>', width: WIDTH, height: HEIGHT, orientation: 'landscape' }
}
