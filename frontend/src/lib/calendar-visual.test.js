// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { CALENDAR_STATES, calendarLegend, calendarState, calendarVisualStyle } from './calendar-visual.js'
import { calendarReportPages } from './calendar-report.js'
import { buildStreakReport, streakReportPages } from './streak-report.js'
import { calendarDay } from './calendar-data.js'

const now = new Date('2027-01-06T12:00:00')
const workout = (id, d) => ({ id, d, routineId: 'r', entries: [{ id: 'exercise', sets: [{ done: true, r: 8 }] }] })
const fixture = () => ({
  trainingStartDate: '2026-12-27', routines: [{ id: 'r', name: 'Private A' }, { id: 's', name: 'Private B' }], week: {},
  dayPlan: { '2027-01-01': ['r'], '2027-01-02': ['r', 's'], '2027-01-03': ['r'], '2027-01-04': [], '2027-01-05': ['r'], '2027-01-06': ['r'], '2027-01-07': ['r'] },
  trainingPauses: [{ start: '2027-01-05', end: '2027-01-06' }], workouts: [workout('one', '2027-01-01'), workout('two', '2027-01-02')],
})
const parse = svg => new DOMParser().parseFromString(svg, 'image/svg+xml')
const linear = hex => hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
const luminance = hex => linear(hex).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0)
const lab = hex => {
  const [r, g, b] = linear(hex)
  const xyz = [(r * .4124564 + g * .3575761 + b * .1804375) / .95047, r * .2126729 + g * .7151522 + b * .072175, (r * .0193339 + g * .119192 + b * .9503041) / 1.08883]
    .map(v => v > .008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116)
  return [116 * xyz[1] - 16, 500 * (xyz[0] - xyz[1]), 200 * (xyz[1] - xyz[2])]
}

describe('shared calendar state presentation', () => {
  it('uses a perceptually separated fixed palette with readable text and no symbols or patterns', () => {
    for (const kind of ['streak', 'consistency']) {
      const states = calendarLegend(kind)
      expect(new Set(states.map(state => state.fill)).size).toBe(states.length)
      for (const [i, state] of states.entries()) {
        expect(state).not.toHaveProperty('symbol')
        expect(state).not.toHaveProperty('pattern')
        const l = [luminance(state.fill), luminance(state.ink)].sort((a, b) => a - b)
        expect((l[1] + .05) / (l[0] + .05)).toBeGreaterThanOrEqual(4.5)
        for (const other of states.slice(i + 1)) {
          const a = lab(state.fill), b = lab(other.fill)
          expect(Math.hypot(...a.map((value, index) => value - b[index]))).toBeGreaterThan(25)
        }
        expect(JSON.stringify(calendarVisualStyle(state.status, kind))).not.toMatch(/var\(--acc|opacity|color-mix|pattern|gradient/)
      }
    }
  })
  it('keeps tracking/activity separate from dates before tracking and respects different completion rules', () => {
    const S = fixture(), before = JSON.stringify(S)
    expect(calendarDay(S, '2026-12-26', now).status).toBe('untracked')
    expect(calendarDay(S, '2027-01-02', now).status).toBe('partial')
    const streak = buildStreakReport(S, { period: 'this-month', now })
    expect(streak.days.find(day => day.iso === '2027-01-02').status).toBe('completed')
    expect(calendarState('completed', 'streak').label).toBe('Recorded activity')
    expect(calendarState('untracked', 'streak').label).toBe('Not tracking yet')
    expect(calendarState('completed', 'streak').semantic).not.toBe(calendarState('completed').semantic)
    expect(calendarState('completed').fill).toBe('#115bb2')
    expect(calendarState('completed', 'streak').fill).toBe('#115bb2')
    for (const status of ['missed', 'pending', 'rest', 'paused', 'untracked']) expect(calendarState(status, 'streak')).toEqual(calendarState(status))
    expect(JSON.stringify(S)).toBe(before)
    expect(() => calendarState('tracking')).toThrow('Unknown calendar status')
  })
  it('matches every plain cell to its exact legend color and accessible text', () => {
    const S = fixture()
    const pages = [
      ...calendarReportPages(S, now, 'month', 'png', { now }),
      ...calendarReportPages(S, new Date('2026-12-30T12:00:00'), 'week', 'png', { now }),
      ...streakReportPages(S, { period: 'custom', from: '2026-12-26', to: '2027-01-06', format: 'png', now }),
    ]
    const statuses = new Set()
    for (const page of pages) {
      const doc = parse(page.svg)
      expect(doc.querySelector('parsererror')).toBeNull()
      expect(doc.querySelector('pattern, [data-symbol], circle, path')).toBeNull()
      for (const cell of doc.querySelectorAll('[data-date]')) {
        const status = cell.getAttribute('data-status'), legend = doc.querySelector(`[data-legend="${status}"]`)
        statuses.add(status)
        expect(legend).not.toBeNull()
        expect(cell.querySelector('rect').getAttribute('fill')).toBe(legend.querySelector('rect').getAttribute('fill'))
        expect(cell.querySelectorAll('rect')).toHaveLength(1)
        expect(cell.querySelectorAll('text')).toHaveLength(1)
        expect(legend.querySelectorAll('rect')).toHaveLength(1)
        expect(legend.querySelectorAll('text')).toHaveLength(1)
        const number = cell.querySelector('[data-day-number]'), box = cell.querySelector('rect')
        expect(number.textContent).toBe(String(Number(cell.getAttribute('data-date').slice(-2))))
        expect(+number.getAttribute('x')).toBeCloseTo(+box.getAttribute('x') + +box.getAttribute('width') / 2)
        expect(+number.getAttribute('y')).toBeCloseTo(+box.getAttribute('y') + +box.getAttribute('height') / 2)
        expect(cell.getAttribute('aria-label')).toContain(legend.querySelector('text').textContent)
      }
    }
    expect([...statuses].sort()).toEqual(['completed', 'missed', 'partial', 'paused', 'pending', 'rest', 'untracked'])
  })
  it.each(['week', 'month', 'year', 'full'])('keeps %s cells square and bounded in both rendered report layouts', period => {
    const S = fixture(), before = JSON.stringify(S)
    for (const format of period === 'full' ? ['pdf'] : ['png', 'pdf']) {
      for (const page of [...calendarReportPages(S, now, period, format, { now }), ...streakReportPages(S, { period, anchor: now, format, now })]) {
        const doc = parse(page.svg)
        expect(doc.querySelector('parsererror')).toBeNull()
        expect(doc.querySelector('pattern, [data-symbol], circle, path')).toBeNull()
        for (const cell of doc.querySelectorAll('[data-date] rect')) {
          expect(cell.getAttribute('width')).toBe(cell.getAttribute('height'))
          expect(+cell.getAttribute('x')).toBeGreaterThanOrEqual(48)
          expect(+cell.getAttribute('x') + +cell.getAttribute('width')).toBeLessThanOrEqual(952)
          expect(+cell.getAttribute('y') + +cell.getAttribute('height')).toBeLessThan(page.height - 160)
        }
        // Every PDF legend stays above 8pt after the actual A4 fit in report-file.js.
        if (format === 'pdf') {
          const scale = Math.min(190 / page.width, 277 / page.height)
          expect(18 * scale * 72 / 25.4).toBeGreaterThanOrEqual(8)
        }
      }
    }
    expect(JSON.stringify(S)).toBe(before)
  })
  it('labels each month/year outside the squares and includes future and empty dates', () => {
    const S = fixture()
    const page = parse(streakReportPages(S, { period: 'custom', from: '2026-12-26', to: '2027-01-06', now, format: 'png' })[0].svg)
    expect(page.documentElement.textContent).toContain('December 2026')
    expect(page.documentElement.textContent).toContain('January 2027')
    const empty = streakReportPages({}, { period: 'year', anchor: '2024-01-01', now: new Date('2024-03-01T12:00:00') })
    expect(empty.flatMap(p => [...parse(p.svg).querySelectorAll('[data-date]')])).toHaveLength(366)
    expect(empty.some(p => p.svg.includes('No recorded activity in this period.'))).toBe(true)
    expect(calendarDay(S, '2027-01-07', now).status).toBe('pending')
    expect(CALENDAR_STATES.rest.fill).not.toBe(CALENDAR_STATES.untracked.fill)
    expect(CALENDAR_STATES.paused.fill).not.toBe(CALENDAR_STATES.partial.fill)
  })
})
