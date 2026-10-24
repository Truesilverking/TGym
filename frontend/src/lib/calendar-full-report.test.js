// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { calendarReportPages } from './calendar-report.js'
import { calendarPeriod } from './calendar-data.js'
import { buildStreakReport, streakReportPages } from './streak-report.js'
import { calendarReportState } from './calendar-visual.js'

const parse = svg => new DOMParser().parseFromString(svg, 'image/svg+xml')
const fixture = year => ({
  trainingStartDate: `${year}-01-02`, routines: [{ id: 'r', name: 'Private A' }, { id: 's', name: 'Private B' }], week: { 1: ['r'], 3: ['r'], 5: ['r'] },
  dayPlan: { [`${year}-01-02`]: ['r'], [`${year}-01-03`]: ['r', 's'], [`${year}-01-04`]: ['r'], [`${year}-01-05`]: [], [`${year}-01-06`]: ['r'], [`${year}-01-07`]: ['r'] },
  trainingPauses: [{ start: `${year}-01-06`, end: `${year}-01-07` }],
  workouts: [2, 3].map(day => ({ id: `w${day}`, d: `${year}-01-0${day}`, routineId: 'r', entries: [{ id: 'exercise', sets: [{ done: true, r: 8 }] }] })),
})

describe('readable Full Reports', () => {
  it.each([2024, 2026, 2027])('keeps every date and status in %i exactly once, in complete four-month pages', year => {
    const S = fixture(year), now = new Date(`${year}-01-07T12:00:00`), before = JSON.stringify(S)
    const streak = buildStreakReport(S, { period: 'full', anchor: now, now }), consistency = calendarPeriod(S, now, 'year', now)
    const expectedDates = consistency.days.map(day => day.iso)
    for (const [kind, pages, expected] of [
      ['streak', streakReportPages(S, { period: 'full', anchor: now, now }), streak.days],
      ['consistency', calendarReportPages(S, now, 'full', 'pdf', { now }), consistency.days],
    ]) {
      expect(pages).toHaveLength(3)
      const cells = pages.flatMap(page => [...parse(page.svg).querySelectorAll('[data-date]')])
      expect(cells.map(cell => cell.getAttribute('data-date'))).toEqual(expectedDates)
      expect(new Set(cells.map(cell => cell.getAttribute('data-date'))).size).toBe(year === 2024 ? 366 : 365)
      expect(cells.map(cell => cell.getAttribute('data-status'))).toEqual(expected.map(day => day.status))
      expect(cells.map(cell => cell.getAttribute('data-status'))).toContain('untracked')
      expect(cells.map(cell => cell.getAttribute('data-status'))).toContain('pending')
      if (kind === 'consistency') expect(new Set(cells.map(cell => cell.getAttribute('data-status'))).size).toBe(7)
      for (const [i, page] of pages.entries()) {
        const doc = parse(page.svg)
        expect(doc.querySelector('parsererror')).toBeNull()
        expect(doc.documentElement.getAttribute('data-part')).toBe(String(i + 1))
        expect([...doc.querySelectorAll('[data-month]')].map(month => month.getAttribute('data-month'))).toEqual(Array.from({ length: 4 }, (_, month) => `${year}-${String(i * 4 + month + 1).padStart(2, '0')}`))
        expect(doc.querySelector('[data-date] pattern, [data-date] [data-symbol], [data-date] path, [data-date] circle')).toBeNull()
      }
    }
    expect(JSON.stringify(S)).toBe(before)
  })
  it('keeps six-week months above the next month/legend with readable numbers at final A4 scaling', () => {
    const S = fixture(2026), now = new Date('2026-01-07T12:00:00')
    for (const [kind, pages] of [['streak', streakReportPages(S, { period: 'full', now })], ['consistency', calendarReportPages(S, now, 'full', 'pdf', { now })]]) {
      for (const page of pages) {
        expect(page.width).toBe(1000); expect(page.height).toBeGreaterThanOrEqual(1414)
        const doc = parse(page.svg), scale = Math.min(190 / page.width, 277 / page.height)
        const months = [...doc.querySelectorAll('[data-month]')]
        for (const [i, month] of months.entries()) {
          const nextRow = months[i + 2], bottom = nextRow ? +nextRow.querySelector('text').getAttribute('y') - 20 : +doc.querySelector('[data-legend] rect').getAttribute('y') - 20
          for (const cell of month.querySelectorAll('[data-date]')) {
            const box = cell.querySelector('rect'), number = cell.querySelector('text'), status = cell.getAttribute('data-status')
            expect(cell.querySelectorAll('rect')).toHaveLength(1); expect(cell.querySelectorAll('text')).toHaveLength(1)
            expect(+box.getAttribute('width')).toBe(48); expect(box.getAttribute('width')).toBe(box.getAttribute('height'))
            expect(+box.getAttribute('y') + 48).toBeLessThanOrEqual(bottom)
            expect(+number.getAttribute('font-size') * scale * 72 / 25.4).toBeGreaterThanOrEqual(15)
            expect(box.getAttribute('fill')).toBe(calendarReportState(status, kind).fill)
            expect(box.getAttribute('fill')).toBe(doc.querySelector(`[data-legend][data-semantic="${calendarReportState(status, kind).semantic}"] rect`).getAttribute('fill'))
            expect(number.textContent).toBe(String(Number(cell.getAttribute('data-date').slice(-2))))
          }
        }
        for (const label of doc.querySelectorAll('[data-legend] text')) expect(+label.getAttribute('font-size') * scale * 72 / 25.4).toBeGreaterThanOrEqual(9)
      }
    }
  })
  it('repeats the existing metric values and explicit evaluation context without changing their meaning', () => {
    const S = fixture(2026), now = new Date('2026-01-07T12:00:00'), anchor = new Date('2027-08-01T12:00:00')
    const streak = buildStreakReport(S, { period: 'full', anchor, now }), consistency = calendarPeriod(S, anchor, 'year', now)
    for (const page of streakReportPages(S, { period: 'full', anchor, now })) {
      const doc = parse(page.svg)
      expect(doc.querySelector('[data-summary="Training streak"]').getAttribute('data-value')).toBe(String(streak.current))
      expect(doc.querySelector('[data-summary="Best streak"]').getAttribute('data-value')).toBe(String(streak.best))
      expect(doc.documentElement.textContent).toContain(`Streak as of ${streak.asOf}`)
      expect(doc.documentElement.textContent).toContain('2027-01-01 – 2027-12-31')
    }
    for (const page of calendarReportPages(S, anchor, 'full', 'pdf', { now })) {
      const doc = parse(page.svg)
      expect(doc.querySelector('[data-summary="Completed"]').getAttribute('data-value')).toBe(String(consistency.stats.completed))
      expect(doc.querySelector('[data-summary="Missed"]').getAttribute('data-value')).toBe(String(consistency.stats.missed))
      expect(doc.querySelector('[data-summary="Completion"]').getAttribute('data-value')).toBe(consistency.completion == null ? '—' : `${consistency.completion}%`)
      expect(doc.documentElement.textContent).toContain('Training since 2026-01-02')
    }
  })
  it('preserves the existing Year and low-level Streak PNG options and handles empty Full Reports', () => {
    const now = new Date('2024-03-01T12:00:00')
    expect(streakReportPages({}, { period: 'year', now })).toHaveLength(3)
    expect(calendarReportPages({}, now, 'year', 'pdf', { now })).toHaveLength(3)
    expect(streakReportPages({}, { period: 'full', format: 'png', now })).toHaveLength(1)
    for (const page of streakReportPages({}, { period: 'full', now })) expect(page.svg).toContain('No recorded activity in this period.')
    expect(() => calendarReportPages({}, now, 'full', 'png', { now })).toThrow('Full reports require PDF')
  })
})
