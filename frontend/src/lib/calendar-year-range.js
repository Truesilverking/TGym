// A bounded number of PDF pages keeps SVG/PDF buffers usable on mobile browsers.
// Each four-month page is rasterized at 2x (about 22.6 MB) and released in sequence.
export const MAX_REPORT_YEARS = 25
export const CONSISTENCY_PERIODS = [['week', 'Week'], ['month', 'Month'], ['year', 'Year'], ['full', 'Full report'], ['years', 'Complete years']]
export function completeYearRange({ fromYear, toYear } = {}) {
  const year = value => (typeof value === 'number' && Number.isInteger(value) || typeof value === 'string' && /^\d{4}$/.test(value)) && Number(value) >= 1000 && Number(value) <= 9999 ? Number(value) : null
  const from = year(fromYear), to = year(toYear)
  if (from == null || to == null || from > to) return { error: 'Choose a valid year range.' }
  if (to - from + 1 > MAX_REPORT_YEARS) return { error: 'Choose up to 25 years per report.' }
  return { start: `${from}-01-01`, end: `${to}-12-31`, years: Array.from({ length: to - from + 1 }, (_, i) => from + i) }
}
