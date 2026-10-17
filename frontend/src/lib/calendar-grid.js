import { calendarState, calendarLegend } from './calendar-visual.js'

export const escapeCalendarText = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]))
export const calendarText = (x, y, value, size = 22, weight = 400, anchor = 'start', fill = '#202733') => `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="${fill}">${escapeCalendarText(value)}</text>`
export const calendarRect = (x, y, w, h, fill, radius = 6) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}"/>`

export function calendarPatterns(kind = 'consistency') {
  return '<defs>' + calendarLegend(kind).map(state => {
    const stroke = state.ink, line = `stroke="${stroke}" stroke-opacity=".13" stroke-width="1"`
    const paths = { diagonal: `<path d="M-2 2L2 -2M0 8L8 0M6 10L10 6" ${line}/>`, cross: `<path d="M0 0L8 8M0 8L8 0" ${line}/>`, dots: `<circle cx="2" cy="2" r=".8" fill="${stroke}" fill-opacity=".3"/>`, horizontal: `<path d="M0 4H8" ${line}/>`, vertical: `<path d="M4 0V8" ${line}/>`, grid: `<path d="M0 4H8M4 0V8" ${line}/>` }
    return `<pattern id="calendar-${state.semantic}" width="8" height="8" patternUnits="userSpaceOnUse">${paths[state.pattern] || ''}</pattern>`
  }).join('') + '</defs>'
}
function swatch(x, y, size, state, symbolSize) {
  return `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${Math.min(6, size / 8)}" fill="${state.fill}" stroke="${state.border}" stroke-width="1"/>` +
    `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${Math.min(6, size / 8)}" fill="url(#calendar-${state.semantic})"/>` +
    (symbolSize ? `<text data-symbol="${state.semantic}" x="${x + size - 4}" y="${y + size - 3}" text-anchor="end" font-size="${symbolSize}" font-family="Arial, sans-serif" fill="${state.ink}">${state.symbol}</text>` : '')
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
    svg += `<g data-date="${day.iso}" data-status="${day.status}" data-semantic="${state.semantic}" role="img" aria-label="${escapeCalendarText(accessible)}"><title>${escapeCalendarText(accessible)}</title>` + swatch(cx, cy, cell, state, compact ? 11 : 14)
    svg += `<text data-day-number="true" x="${cx + cell / 2}" y="${cy + cell / 2}" dominant-baseline="central" text-anchor="middle" font-size="${compact ? 16 : 21}" font-weight="600" fill="${state.ink}">${Number(day.iso.slice(-2))}</text></g>`
  })
  return svg + '</g>'
}
export function calendarSvgLegend({ y, kind = 'consistency', t = x => x }) {
  return calendarLegend(kind).map((state, i) => {
    const x = 48 + i % 2 * 478, top = y + Math.floor(i / 2) * 30
    return `<g data-legend="${state.status}" data-semantic="${state.semantic}">` + swatch(x, top - 20, 22, state, 14) + calendarText(x + 33, top - 3, t(state.label), 18) + '</g>'
  }).join('')
}
