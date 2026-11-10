// @vitest-environment happy-dom
import { expect, it } from 'vitest'
import { streakReportPages } from './streak-report.js'
import { calendarReportPages } from './calendar-report.js'

const now = new Date('2026-10-05T12:00:00')
const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5QAAAABJRU5ErkJggg=='
const fixture = () => ({
  profile: { name: 'Chosen <Local> & Name', photo }, streakCalendarShowProfile: true,
  trainingStartDate: '2026-09-28', routines: [], week: {},
  workouts: [{ id: 'recorded', d: '2026-10-02', entries: [{ sets: [{ done: true, r: 8 }] }] }],
})
const parse = svg => new DOMParser().parseFromString(svg, 'image/svg+xml')
const semantics = pages => pages.map(page => {
  const doc = parse(page.svg)
  return {
    dates: [...doc.querySelectorAll('[data-date]')].map(cell => [cell.getAttribute('data-date'), cell.getAttribute('data-status')]),
    summaries: [...doc.querySelectorAll('[data-summary]')].map(metric => [metric.getAttribute('data-summary'), metric.getAttribute('data-value')]),
  }
})

it.each([
  { period: 'this-week', format: 'png' }, { period: 'this-month', format: 'png' },
  { period: 'year', format: 'pdf' }, { period: 'full', format: 'pdf' },
  { period: 'years', format: 'pdf', fromYear: '2024', toYear: '2025' },
])('includes the chosen visible local identity in $period/$format without changing report data', options => {
  const S = fixture(), before = structuredClone(S)
  const pages = streakReportPages(S, { ...options, now })
  const hidden = streakReportPages({ ...S, streakCalendarShowProfile: false }, { ...options, now })
  expect(semantics(pages)).toEqual(semantics(hidden))
  for (const page of pages) {
    const doc = parse(page.svg), identity = doc.querySelector('[data-report-profile]')
    expect(doc.querySelector('parsererror')).toBeNull()
    expect(identity.querySelector('[data-profile-name]').textContent).toBe(S.profile.name)
    expect(identity.querySelector('[data-profile-photo]').getAttribute('href')).toBe(photo)
    expect(page.svg).not.toContain('<Local>')
    const summary = doc.querySelector('[data-summary] > rect'), image = doc.querySelector('[data-profile-photo]')
    expect(+image.getAttribute('y')).toBeGreaterThan(+summary.getAttribute('y') + +summary.getAttribute('height') + 12)
    expect(+doc.querySelector('[data-report-period] > text').getAttribute('y') - 36).toBeGreaterThan(+image.getAttribute('y') + +image.getAttribute('height') + 10)
    expect(doc.querySelector('[data-report-note]')).toBeNull()
    const divider = +doc.querySelector('[data-legend] rect').getAttribute('y') - 16
    for (const cell of doc.querySelectorAll('[data-date] rect')) expect(+cell.getAttribute('y') + +cell.getAttribute('height')).toBeLessThan(divider)
    for (const text of doc.querySelectorAll('text')) expect(+text.getAttribute('y')).toBeLessThan(page.height)
  }
  expect(S).toEqual(before)
})

it.each([false, undefined])('does not disclose stored identity when visibility is %s', visibility => {
  const S = fixture(); S.streakCalendarShowProfile = visibility
  const pages = streakReportPages(S, { period: 'this-week', now })
  expect(pages).toEqual(streakReportPages({ ...S, profile: null }, { period: 'this-week', now }))
  expect(pages[0].svg).not.toContain('data-report-profile')
  expect(pages[0].svg).not.toContain(photo)
})

it.each(['https://example.test/private-photo.png', 'data:image/svg+xml;base64,PHN2Zy8+'])('falls back to local initials for a non-raster photo: %s', unsafePhoto => {
  const S = fixture(); S.profile = { name: 'Local Display', photo: unsafePhoto }
  const svg = streakReportPages(S, { period: 'this-week', now })[0].svg
  expect(parse(svg).querySelector('[data-profile-initials]').textContent).toBe('LD')
  expect(svg).not.toContain(unsafePhoto)
})

it('handles photo-only, empty and long imported names without overlapping the report summary', () => {
  for (const profile of [{ name: '', photo }, { name: '', photo: null }, { name: 'LongLocalName'.repeat(50), photo: null }]) {
    const page = streakReportPages({ ...fixture(), profile }, { period: 'year', now })[0], doc = parse(page.svg)
    const identity = doc.querySelector('[data-report-profile]')
    if (!profile.name && !profile.photo) expect(identity).toBeNull()
    else {
      const last = [...identity.querySelectorAll('text')].at(-1)
      expect(+doc.querySelector('[data-report-period] text').getAttribute('y') - 36).toBeGreaterThan(+last.getAttribute('y') + 12)
      expect(doc.querySelector('[data-profile-name]').textContent.length).toBeLessThanOrEqual(80)
    }
  }
})

it('leaves Consistency reports unchanged when a profile is visible in the Streak calendar', () => {
  const S = fixture()
  expect(calendarReportPages(S, now, 'year', 'pdf', { now })).toEqual(calendarReportPages({ ...S, profile: null, streakCalendarShowProfile: false }, now, 'year', 'pdf', { now }))
})
