// @vitest-environment happy-dom
import { expect, it } from 'vitest'
import { calendarReportPages } from './calendar-report.js'
import { streakReportPages } from './streak-report.js'

const locales = Object.entries(import.meta.glob('../locales/*.js', { eager: true, import: 'default' }))
const now = new Date('2026-10-17T12:00:00')
const parse = svg => new DOMParser().parseFromString(svg, 'image/svg+xml')

it.each(locales)('reserves wrapped note and metric space before the calendar in %s', (_, dictionary) => {
  const t = key => dictionary[key] || key
  for (const pages of [streakReportPages({}, { period: 'year', now, t }), calendarReportPages({}, now, 'year', 'pdf', { now, t })]) {
    for (const page of pages) {
      const doc = parse(page.svg), notes = [...doc.querySelectorAll('[data-report-note] text')]
      const title = doc.querySelector('[data-period] > text'), lastNote = notes.at(-1)
      expect(+title.getAttribute('y') - +title.getAttribute('font-size')).toBeGreaterThan(+lastNote.getAttribute('y') + 10)
      for (const metric of doc.querySelectorAll('[data-summary]')) {
        const texts = [...metric.querySelectorAll('text')], value = texts.at(-1), lastLabel = texts.at(-2)
        expect(+value.getAttribute('y') - +value.getAttribute('font-size')).toBeGreaterThan(+lastLabel.getAttribute('y'))
      }
      const divider = +doc.querySelector('[data-legend] rect').getAttribute('y') - 16
      for (const box of doc.querySelectorAll('[data-date] rect')) expect(+box.getAttribute('y') + +box.getAttribute('height')).toBeLessThan(divider)
    }
  }
})

it('grows metric cards for wrapped labels instead of overlapping values', () => {
  const long = 'Label with many words requiring more than one line within a metric card'
  const page = calendarReportPages({}, now, 'month', 'png', { now, t: key => key === 'Completed' ? long : key })[0]
  const summary = parse(page.svg).querySelector('[data-summary="Completed"]'), texts = [...summary.querySelectorAll('text')]
  expect(texts.length).toBeGreaterThan(2)
  const value = texts.at(-1), label = texts.at(-2)
  expect(+value.getAttribute('y') - +value.getAttribute('font-size')).toBeGreaterThan(+label.getAttribute('y'))
})
