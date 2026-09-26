// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { calendarReportPages, reportFilename, REPORT_COLORS } from './calendar-report.js'
const S = { routines: [{ id: 'r', name: 'PRIVATE ROUTINE' }], week: { 1: 'r', 3: 'r', 5: 'r' }, dayPlan: {}, workouts: [{ id: 'w', d: '2026-09-02', routineId: 'r', name: 'PRIVATE ROUTINE' }] }
const anchor = new Date(2026, 8, 16, 12)
const parse = svg => new DOMParser().parseFromString(svg, 'image/svg+xml')
describe('dedicated consistency reports', () => {
  it.each(['week', 'month', 'year', 'full'])('keeps %s pages square, bounded and free of routine/measurement content', period => {
    const pages = calendarReportPages(S, anchor, period, 'pdf', { now: anchor })
    for (const page of period === 'full' ? pages.slice(0,4) : pages) {
      expect(page.svg).not.toContain('PRIVATE ROUTINE')
      expect(page.svg).not.toContain('Measurement')
      const doc = parse(page.svg)
      expect(doc.querySelector('parsererror')).toBeNull()
      for (const cell of doc.querySelectorAll('[data-date] rect')) {
        expect(cell.getAttribute('width')).toBe(cell.getAttribute('height'))
        expect(+cell.getAttribute('x') + +cell.getAttribute('width')).toBeLessThanOrEqual(page.width - 40)
        expect(+cell.getAttribute('y') + +cell.getAttribute('height')).toBeLessThan(page.height - 90)
      }
      for (const label of ['Completed', 'Not completed', 'Pending']) expect(doc.documentElement.textContent).toContain(label)
    }
  })
  it('adds a progress section to Full Report without changing its calendar pages',()=>{
    const pages=calendarReportPages(S,anchor,'full','pdf',{now:anchor})
    expect(pages.length).toBeGreaterThan(4)
    expect(pages.slice(4).every(p=>p.svg.includes('Progress Report'))).toBe(true)
  })
  it('renders all twelve months once across year PDF pages and in the PNG overview', () => {
    const pdf = calendarReportPages(S, anchor, 'year', 'pdf'), png = calendarReportPages(S, anchor, 'year', 'png')
    expect(pdf).toHaveLength(3); expect(png).toHaveLength(1)
    expect(pdf.reduce((sum, p) => sum + parse(p.svg).querySelectorAll('[data-period="month"]').length, 0)).toBe(12)
    expect(parse(png[0].svg).querySelectorAll('[data-date]')).toHaveLength(365)
  })
  it('has exactly seven week cells and places September 1 in Tuesday column', () => {
    expect(parse(calendarReportPages(S, anchor, 'week', 'png')[0].svg).querySelectorAll('[data-date]')).toHaveLength(7)
    const doc = parse(calendarReportPages(S, anchor, 'month', 'png')[0].svg)
    expect(+doc.querySelector('[data-date="2026-09-01"] rect').getAttribute('x')).toBeGreaterThan(48)
    expect(doc.querySelector('[data-date="2026-09-02"] rect').getAttribute('fill')).toBe(REPORT_COLORS.completed)
  })
  it('uses the requested filenames and escapes translated text', () => {
    expect(reportFilename(anchor, 'week', 'pdf')).toBe('TGym-Consistency-Week-2026-09-14.pdf')
    expect(reportFilename(anchor, 'month', 'png')).toBe('TGym-Consistency-2026-09.png')
    expect(reportFilename(anchor, 'year', 'pdf')).toBe('TGym-Consistency-2026.pdf')
    expect(reportFilename(anchor, 'full', 'pdf')).toBe('TGym-Consistency-Report-2026.pdf')
    expect(calendarReportPages(S, anchor, 'week', 'png', { t: () => '<unsafe>' })[0].svg).not.toContain('<unsafe>')
  })
})
