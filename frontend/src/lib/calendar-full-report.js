import { MONTHS_LONG } from './format.js'
import { calendarLegend } from './calendar-visual.js'
import { calendarGrid, calendarText as text, calendarRect as rect, escapeCalendarText as escape } from './calendar-grid.js'

// The complete year has one date cell per date, in two six-month A4 pages.
// Callers supply the existing report data and metrics; this module only lays them out.
const WIDTH = 1000, HEIGHT = 1414, NAVY = '#18324f', MUTED = '#52647c', BLUE = '#115bb2'
const measure = (value, size) => [...String(value)].reduce((width, char) => width + size * (/\s/.test(char) ? .3 : /[ilIt.,:!|]/.test(char) ? .3 : /[MW@%]/.test(char) ? .85 : char.codePointAt(0) > 0x2e80 ? 1 : .57), 0)
function lines(value, maxWidth, size) {
  const result = [], words = String(value).split(/\s+/), push = word => {
    if (!result.length || measure(result.at(-1) + ' ' + word, size) > maxWidth) result.push(word)
    else result[result.length - 1] += ' ' + word
  }
  for (const word of words) {
    if (measure(word, size) <= maxWidth) push(word)
    else { let part = ''; for (const char of word) { if (part && measure(part + char, size) > maxWidth) { push(part); part = '' }; part += char }; if (part) push(part) }
  }
  return result
}
const wrapped = (x, y, value, maxWidth, size, lineHeight, weight = 400, fill = MUTED) => lines(value, maxWidth, size).map((line, i) => text(x, y + i * lineHeight, line, size, weight, 'start', fill)).join('')

function legend(kind, t) {
  let svg = '<g data-full-legend="true">'
  calendarLegend(kind).forEach((state, i) => {
    const x = 48 + i % 2 * 464, y = 1220 + Math.floor(i / 2) * 40
    svg += `<g data-legend="${state.status}" data-semantic="${state.semantic}">` +
      `<rect x="${x}" y="${y - 16}" width="20" height="20" rx="4" fill="${state.fill}" stroke="${state.border}"/>` + wrapped(x + 31, y, t(state.label), 395, 18, 20) + '</g>'
  })
  return svg + '</g>'
}

export function calendarFullReportPages({ kind, days, start, end, metrics, context = '', note = '', emptyMessage = '', t = x => x }) {
  const year = Number(start.slice(0, 4)), title = t(kind === 'streak' ? 'Streak Report' : 'Consistency Report')
  const titleMarkup = measure(title, 36) <= 720 ? text(48, 103, title, 36, 750, 'start', NAVY) : wrapped(48, 78, title, 720, 30, 32, 750, NAVY)
  const months = Array.from({ length: 12 }, (_, month) => ({ month, key: `${year}-${String(month + 1).padStart(2, '0')}`, days: days.filter(day => Number(day.iso.slice(5, 7)) === month + 1) }))
  return [0, 1].map(half => {
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${escape(title)}" data-layout="full-year" data-half="${half + 1}"><g font-family="Arial, sans-serif">`
    svg += rect(0, 0, WIDTH, HEIGHT, '#ffffff', 0)
    svg += rect(48, 38, 5, 24, BLUE, 2) + text(66, 58, 'TGym', 24, 750, 'start', BLUE)
    svg += titleMarkup + text(952, 103, year, 58, 750, 'end', NAVY)
    svg += text(48, 135, `${t('Full report')} · ${start} - ${end}`, 19, 400, 'start', MUTED)
    svg += text(48, 160, context, 17, 400, 'start', MUTED)
    const cardWidth = (904 - 16 * (metrics.length - 1)) / metrics.length
    metrics.forEach(([label, value], i) => {
      const x = 48 + i * (cardWidth + 16)
      svg += `<g data-summary="${escape(label)}" data-value="${escape(value)}">` + rect(x, 175, cardWidth, 65, '#eef3fa', 10)
      svg += wrapped(x + 16, 203, t(label), cardWidth - 132, 18, 20, 500, NAVY)
      svg += text(x + cardWidth - 16, 223, value, 34, 750, 'end', BLUE) + '</g>'
    })
    svg += wrapped(48, 259, note, 904, 16, 18)
    months.slice(half * 6, half * 6 + 6).forEach(({ month, key, days }, i) => {
      const x = 48 + i % 2 * 464, y = 284 + Math.floor(i / 2) * 304
      svg += `<g data-month="${key}">` + `<rect x="${x}" y="${y}" width="440" height="292" rx="12" fill="#f7f9fc" stroke="#e2e8f0"/>`
      svg += calendarGrid({ days, title: t(MONTHS_LONG[month]), x: x + 20, y: y + 26, width: 400, kind, t,
        geometry: { cell: 34, gap: 4, daySize: 18, weekdaySize: 16, titleSize: 23, weekdayOffset: 22, daysOffset: 33, titleFill: NAVY } }) + '</g>'
    })
    svg += '<line x1="48" y1="1198" x2="952" y2="1198" stroke="#e2e8f0"/>' + legend(kind, t)
    if (emptyMessage) svg += wrapped(48, 1348, emptyMessage, 904, 16, 18)
    svg += text(48, 1390, `${t(MONTHS_LONG[half * 6])} - ${t(MONTHS_LONG[half * 6 + 5])} ${year}`, 17, 500, 'start', MUTED)
    svg += text(952, 1390, `${half + 1} / 2`, 17, 500, 'end', MUTED)
    return { svg: svg + '</g></svg>', width: WIDTH, height: HEIGHT }
  })
}
