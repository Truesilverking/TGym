// @vitest-environment happy-dom
import { expect, it } from 'vitest'
import { buildStreakReport, streakReportPages } from './streak-report.js'
import { calendarReportState } from './calendar-visual.js'

const now = new Date('2026-11-02T12:00:00')
const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5QAAAABJRU5ErkJggg=='
const S = {
  streakCalendarShowProfile: true, profile: { name: 'Synthetic Local Athlete', photo },
  trainingStartDate: '2024-01-01', routines: [{ id: 'routine' }], week: { 1: 'routine', 3: 'routine', 5: 'routine' },
  workouts: ['2024-02-29', '2026-10-30', '2026-11-02'].map((d, i) => ({ id: `w${i}`, d, entries: [{ sets: [{ done: true, r: 8 }] }] })),
}
const parse = svg => new DOMParser().parseFromString(svg, 'image/svg+xml')
const cells = pages => pages.flatMap(page => [...parse(page.svg).querySelectorAll('[data-date]')].map(cell => [cell.getAttribute('data-date'), cell.getAttribute('data-status')]))

it.each(['png', 'pdf'])('lays out the complete annual %s as three columns and four rows, with readable dates and a prominent identity', format => {
  const before = structuredClone(S), pages = streakReportPages(S, { period: 'year', now, format })
  expect(pages).toHaveLength(1)
  const page = pages[0], doc = parse(page.svg), months = [...doc.querySelectorAll('[data-month]')]
  expect(months).toHaveLength(12)
  const positions = months.map(month => month.querySelector('[data-period] > text')).map(title => [+title.getAttribute('x'), +title.getAttribute('y')])
  const xs = [...new Set(positions.map(([x]) => x))], ys = [...new Set(positions.map(([, y]) => y))]
  expect(xs).toHaveLength(3); expect(ys).toHaveLength(4)
  positions.forEach(([x, y], i) => { expect(x).toBe(xs[i % 3]); expect(y).toBe(ys[Math.floor(i / 3)]) })
  expect(cells(pages)).toEqual(buildStreakReport(S, { period: 'year', now }).days.map(day => [day.iso, day.status]))
  expect(page.height / page.width).toBeLessThan(2.1)
  expect(page.width * page.height * 4).toBeLessThan(12_000_000)
  const image = doc.querySelector('[data-profile-photo]'), name = doc.querySelector('[data-profile-name] text')
  expect(+image.getAttribute('width')).toBeGreaterThanOrEqual(224)
  expect(+name.getAttribute('font-size')).toBeGreaterThanOrEqual(44)
  const summary = doc.querySelector('[data-summary] > rect')
  expect(+image.getAttribute('y')).toBeGreaterThan(+summary.getAttribute('y') + +summary.getAttribute('height') + 12)
  const pdfScale = Math.min(190 / page.width, 277 / page.height)
  for (const month of months) {
    const weekdays = [...month.querySelectorAll('[data-period] > text')].slice(1)
    expect(weekdays).toHaveLength(7)
    for (const label of weekdays) expect(+label.getAttribute('font-size') * pdfScale * 72 / 25.4).toBeGreaterThanOrEqual(8)
  }
  for (const cell of doc.querySelectorAll('[data-date]')) {
    const box = cell.querySelector('rect'), number = cell.querySelector('text')
    expect(+number.getAttribute('font-size') * pdfScale * 72 / 25.4).toBeGreaterThanOrEqual(10)
    expect(box.getAttribute('fill')).toBe(calendarReportState(cell.getAttribute('data-status'), 'streak').fill)
  }
  expect(S).toEqual(before)
})

it.each([
  { period: 'this-week' }, { period: 'last-week' }, { period: 'week', anchor: '2024-02-29' },
  { period: 'this-month' }, { period: 'last-month' }, { period: 'month', anchor: '2024-02-29' },
  { period: 'year' }, { period: 'full' },
  { period: 'custom', from: '2026-09-01', to: '2026-10-31' },
  { period: 'custom', from: '2026-01-01', to: '2026-11-02' },
])('preserves the exact dates, statuses and visible identity in both formats for $period/$anchor/$from', options => {
  const pdf = streakReportPages(S, { ...options, now, format: 'pdf' }), png = streakReportPages(S, { ...options, now, format: 'png' })
  expect(cells(pdf)).toEqual(cells(png))
  for (const page of [...pdf, ...png]) {
    const doc = parse(page.svg)
    expect(doc.querySelector('parsererror')).toBeNull()
    expect(doc.querySelector('[data-profile-name]').textContent).toBe(S.profile.name)
    expect(doc.querySelector('[data-profile-photo]').getAttribute('href')).toBe(photo)
    const dates = [...doc.querySelectorAll('[data-date] rect')]
    const legendTop = +doc.querySelector('[data-legend] rect').getAttribute('y')
    expect(Math.max(...dates.map(box => +box.getAttribute('y') + +box.getAttribute('height')))).toBeLessThan(legendTop - 16)
  }
})

it('paginates long custom PDF ranges without losing leap days or duplicating calendar dates', () => {
  const options = { period: 'custom', from: '2024-01-01', to: '2026-11-02', now }
  const pages = streakReportPages(S, options), dates = cells(pages)
  expect(pages).toHaveLength(3)
  expect(dates).toEqual(buildStreakReport(S, options).days.map(day => [day.iso, day.status]))
  expect(new Set(dates.map(([iso]) => iso)).size).toBe(dates.length)
  expect(dates.some(([iso]) => iso === '2024-02-29')).toBe(true)
})
