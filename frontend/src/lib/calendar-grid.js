import { calendarState, calendarLegend } from './calendar-visual.js'

export const escapeCalendarText = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]))
export const calendarText = (x, y, value, size = 22, weight = 400, anchor = 'start', fill = '#202733') => `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="${fill}">${escapeCalendarText(value)}</text>`
export const calendarRect = (x, y, w, h, fill, radius = 6) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}"/>`

function swatch(x, y, size, state) {
  return `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${Math.min(6, size / 8)}" fill="${state.fill}" stroke="${state.border}" stroke-width="1"/>`
}
// Shared by both report generators. Cell size is capped, never stretched to fill a page.
// The date range/month and weekday headers live outside the day squares.
export function calendarGrid({ days, title, period = 'month', x = 48, y = 370, width = 904, kind = 'consistency', t = x => x }) {
  const compact = width < 400, gap = compact ? 5 : 9, cell = Math.min(96, (width - 6 * gap) / 7)
  const left = x + (width - (7 * cell + 6 * gap)) / 2
  const offset = (new Date(days[0].iso + 'T12:00:00').getDay() + 6) % 7
  let svg = `<g data-period="${period}" data-start="${days[0].iso}">` + calendarText(x, y, title, compact ? 20 : 26, 650)
  ;['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].forEach((day, i) => { svg += calendarText(left + i * (cell + gap) + cell / 2, y + 31, t(day), compact ? 15 : 18, 500, 'middle', '#576172') })
  days.forEach((day, i) => {
    const state = calendarState(day.status, kind), cx = left + (offset + i) % 7 * (cell + gap), cy = y + 44 + Math.floor((offset + i) / 7) * (cell + gap)
    const accessible = `${day.iso}, ${t(state.label)}${day.plan?.total > 1 ? `, ${day.plan.completed}/${day.plan.total}` : ''}`
    svg += `<g data-date="${day.iso}" data-status="${day.status}" data-semantic="${state.semantic}" role="img" aria-label="${escapeCalendarText(accessible)}"><title>${escapeCalendarText(accessible)}</title>` + swatch(cx, cy, cell, state)
    svg += `<text data-day-number="true" x="${cx + cell / 2}" y="${cy + cell / 2}" dominant-baseline="central" text-anchor="middle" font-size="${compact ? 16 : 21}" font-weight="600" fill="${state.ink}">${Number(day.iso.slice(-2))}</text></g>`
  })
  return svg + '</g>'
}
export function calendarSvgLegend({ y, kind = 'consistency', t = x => x }) {
  return calendarLegend(kind).map((state, i) => {
    const x = 48 + i % 2 * 478, top = y + Math.floor(i / 2) * 30
    return `<g data-legend="${state.status}" data-semantic="${state.semantic}">` + swatch(x, top - 20, 22, state) + calendarText(x + 33, top - 3, t(state.label), 18) + '</g>'
  }).join('')
}
