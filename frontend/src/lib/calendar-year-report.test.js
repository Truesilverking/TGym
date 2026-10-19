// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { completeYearRange, MAX_REPORT_YEARS, CONSISTENCY_PERIODS } from './calendar-year-range.js'
import { calendarReportPages, reportFilename } from './calendar-report.js'
import { calendarPeriod } from './calendar-data.js'
import { buildStreakReport, streakReportPages, streakRange, streakFilename, STREAK_PERIODS } from './streak-report.js'
import { calendarReportState } from './calendar-visual.js'

const parse = svg => new DOMParser().parseFromString(svg, 'image/svg+xml')
const now = new Date('2026-01-07T12:00:00')
const S = {
  trainingStartDate: '2024-01-02', routines: [{ id: 'r', name: 'Private A' }, { id: 's', name: 'Private B' }], week: { 1: ['r'], 3: ['r'], 5: ['r'] },
  dayPlan: { '2026-01-02': ['r'], '2026-01-03': ['r', 's'], '2026-01-04': ['r'], '2026-01-05': [], '2026-01-06': ['r'], '2026-01-07': ['r'] },
  trainingPauses: [{ start: '2026-01-06', end: '2026-01-07' }],
  workouts: ['2024-01-02', '2025-08-01', '2026-01-02', '2026-01-03'].map((d, i) => ({ id: `w${i}`, d, routineId: 'r', entries: [{ id: 'exercise', sets: [{ done: true, r: 8 }] }] })),
  active: { id: 'active', d: '2026-01-07', entries: [{ id: 'exercise', sets: [{ done: true, r: 8 }] }] },
}

describe('complete-year ranges', () => {
  it('validates inclusive complete calendar years and allows future years', () => {
    expect(completeYearRange({ fromYear: '2024', toYear: 2027 })).toEqual({ start: '2024-01-01', end: '2027-12-31', years: [2024, 2025, 2026, 2027] })
    expect(streakRange({ period: 'years', fromYear: 2024, toYear: 2027, now })).toMatchObject({ start: '2024-01-01', end: '2027-12-31', today: '2026-01-07' })
    expect(STREAK_PERIODS).toContainEqual(['years', 'Complete years']); expect(CONSISTENCY_PERIODS).toContainEqual(['years', 'Complete years'])
    expect(completeYearRange({ fromYear: 1000, toYear: 1000 }).error).toBeUndefined()
    expect(completeYearRange({ fromYear: 9999, toYear: 9999 }).error).toBeUndefined()
  })
  it.each([['', 2026], [null, 2026], [2026, undefined], ['2024.0', 2026], ['2e3', 2026], [' 2024', 2026], [2024.5, 2026], [999, 2026], [2026, 10000], [2026, 2025], [NaN, 2026], [2024, Infinity], [true, 2026]])('rejects invalid bounds %s / %s before reading profile data', (fromYear, toYear) => {
    const inaccessible = new Proxy({}, { get() { throw Error('Profile read before range validation') } })
    expect(completeYearRange({ fromYear, toYear }).error).toBe('Choose a valid year range.')
    expect(buildStreakReport(inaccessible, { period: 'years', fromYear, toYear, now }).days).toEqual([])
    expect(() => calendarReportPages(inaccessible, now, 'years', 'pdf', { fromYear, toYear, now })).toThrow('Choose a valid year range.')
    expect(() => streakFilename({ period: 'years', fromYear, toYear, now })).toThrow('Choose a valid year range.')
  })
  it('bounds page/cell buffering before calculating an oversized export', () => {
    expect(MAX_REPORT_YEARS).toBe(25)
    expect(completeYearRange({ fromYear: 2000, toYear: 2024 }).years).toHaveLength(25)
    expect(completeYearRange({ fromYear: 2000, toYear: 2025 }).error).toBe('Choose up to 25 years per report.')
    const inaccessible = new Proxy({}, { get() { throw Error('Profile read before range validation') } })
    expect(() => streakReportPages(inaccessible, { period: 'years', fromYear: 1000, toYear: 9999, now })).toThrow('Choose up to 25 years per report.')
    expect(() => calendarReportPages(inaccessible, now, 'years', 'pdf', { fromYear: 1000, toYear: 9999, now })).toThrow('Choose up to 25 years per report.')
  })
})

describe('readable complete-year PDF pages', () => {
  it.each(['streak', 'consistency'])('keeps each %s annual data set, metric and context identical to the existing year calculations', kind => {
    const options = { period: 'years', fromYear: 2024, toYear: 2027, now }, before = JSON.stringify(S)
    const pages = kind === 'streak' ? streakReportPages(S, options) : calendarReportPages(S, 'irrelevant', 'years', 'pdf', options)
    expect(pages).toHaveLength(12)
    const allDates = []
    pages.forEach((page, i) => {
      const year = 2024 + Math.floor(i / 3), doc = parse(page.svg), anchor = `${year}-01-01`
      const annual = kind === 'streak' ? buildStreakReport(S, { period: 'year', anchor, now }) : calendarPeriod(S, new Date(anchor + 'T12:00:00'), 'year', now)
      const cells = [...doc.querySelectorAll('[data-date]')]
      expect(doc.querySelector('parsererror')).toBeNull()
      expect(doc.documentElement.getAttribute('data-layout')).toBe('complete-year')
      expect(doc.documentElement.getAttribute('data-year')).toBe(String(year))
      expect(page.orientation).toBeUndefined(); expect(page.width).toBe(1000); expect(page.height).toBeGreaterThanOrEqual(1414)
      expect(doc.querySelectorAll('[data-month]')).toHaveLength(4)
      expect(cells.map(cell => cell.getAttribute('data-date'))).toEqual(annual.days.filter(day => Math.floor((Number(day.iso.slice(5,7)) - 1) / 4) === i % 3).map(day => day.iso))
      expect(cells.map(cell => cell.getAttribute('data-status'))).toEqual(annual.days.filter(day => Math.floor((Number(day.iso.slice(5,7)) - 1) / 4) === i % 3).map(day => day.status))
      expect(cells.length).toBeGreaterThanOrEqual(120)
      allDates.push(...cells.map(cell => cell.getAttribute('data-date')))
      const expectedMetrics = kind === 'streak' ? [['Training streak', annual.current], ['Best streak', annual.best]] : [['Completed', annual.stats.completed], ['Missed', annual.stats.missed], ['Completion', annual.completion == null ? '—' : `${annual.completion}%`]]
      for (const [label, value] of expectedMetrics) expect(doc.querySelector(`[data-summary="${label}"]`).getAttribute('data-value')).toBe(String(value))
      if (kind === 'streak') expect(doc.documentElement.textContent).toContain(`Streak as of ${annual.asOf}`)
      expect(doc.querySelector('[data-date] pattern, [data-date] path, [data-date] circle, [data-date] [data-symbol]')).toBeNull()
      for (const cell of cells) {
        const box = cell.querySelector('rect'), number = cell.querySelector('text')
        expect(cell.querySelectorAll('rect')).toHaveLength(1); expect(cell.querySelectorAll('text')).toHaveLength(1)
        expect(box.getAttribute('width')).toBe('48'); expect(box.getAttribute('height')).toBe('48')
        expect(box.getAttribute('fill')).toBe(calendarReportState(cell.getAttribute('data-status'), kind).fill)
        expect(box.getAttribute('fill')).toBe(doc.querySelector(`[data-legend][data-semantic="${calendarReportState(cell.getAttribute('data-status'), kind).semantic}"] rect`).getAttribute('fill'))
        expect(+box.getAttribute('y') + 48).toBeLessThan(+doc.querySelector('[data-legend] rect').getAttribute('y') - 20)
        expect(+number.getAttribute('x')).toBe(+box.getAttribute('x') + 24)
        expect(+number.getAttribute('y')).toBe(+box.getAttribute('y') + 24)
        const scale = Math.min(190 / page.width, 277 / page.height)
        expect(+number.getAttribute('font-size') * scale * 72 / 25.4).toBeGreaterThanOrEqual(9)
      }
    })
    expect(allDates).toHaveLength(1461); expect(new Set(allDates).size).toBe(1461)
    expect(JSON.stringify(S)).toBe(before)
  })
  it('uses portable inclusive range filenames and requires PDF before generation', () => {
    const options = { period: 'years', fromYear: '2024', toYear: '2026', now }
    expect(streakFilename(options)).toBe('TGym-Streak-Years-2024_2026.pdf')
    expect(reportFilename('irrelevant', 'years', 'pdf', options)).toBe('TGym-Consistency-Years-2024_2026.pdf')
    expect(() => streakReportPages(S, { ...options, format: 'png' })).toThrow('Complete-year reports require PDF')
    expect(() => calendarReportPages(S, now, 'years', 'png', options)).toThrow('Complete-year reports require PDF')
  })
  it.each([1000, 9999])('stops at December 31 of boundary year %i', year => {
    const options = { period: 'years', fromYear: year, toYear: year, now }
    for (const pages of [streakReportPages({}, options), calendarReportPages({}, now, 'years', 'pdf', options)]) {
      const cells = pages.flatMap(page => [...parse(page.svg).querySelectorAll('[data-date]')])
      expect(cells).toHaveLength(365)
      expect(cells[0].getAttribute('data-date')).toBe(`${year}-01-01`)
      expect(cells.at(-1).getAttribute('data-date')).toBe(`${year}-12-31`)
    }
  })
  it('keeps Spanish metric labels whole and reserves separate space for their values', () => {
    const labels = { Completed: 'Completados', Missed: 'No completados', Completion: 'Cumplimiento' }
    const page = calendarReportPages(S, now, 'years', 'pdf', { fromYear: 2026, toYear: 2026, now, t: key => labels[key] || key })[0]
    for (const summary of parse(page.svg).querySelectorAll('[data-summary]')) {
      const texts = [...summary.querySelectorAll('text')]
      expect(texts).toHaveLength(2)
      expect(texts[0].textContent).toBe(labels[summary.getAttribute('data-summary')])
      expect(texts[0].getAttribute('y')).toBe('208')
      expect(texts[1].getAttribute('y')).toBe('258')
      expect(texts[1].getAttribute('font-size')).toBe('40')
    }
  })
})
