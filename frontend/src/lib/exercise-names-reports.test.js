// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { registerCustom } from './exercises.js'
import { _setLangState } from './i18n-core.js'
import { strengthExerciseRows, strengthExerciseRowsForMuscle } from './strength-exercises.js'
import { historyCsv, filteredHistory } from './history-export.js'
import { statsReportHTML } from './stats-report.js'
import { statsReportPages } from './stats-pdf.js'
import { buildProgressReport } from './progress-report.js'
import { progressReportPages, progressReportHTML, wrapReportText } from './progress-export.js'
import { buildDashboardReportPages } from './report-exports.js'
import { buildPlanBundle, planPrintHTML } from './plan-share.js'

const now = new Date('2026-10-06T12:00:00')
const customs = [
  { id: 'name-test-one', n: 'Original first lift', tg: 'chest', eq: 'barbell' },
  { id: 'name-test-two', n: 'Original second lift', tg: 'chest', eq: 'dumbbell' },
]
const workout = (id, d, weight) => ({
  id, d, name: 'Name tests', routineId: 'routine-name-test',
  start: +new Date(d + 'T09:00:00'), end: +new Date(d + 'T10:00:00'),
  entries: customs.map((exercise, i) => ({ id: exercise.id, n: exercise.n, target: { mode: 'reps' }, sets: [{ done: true, w: weight + i * 10, r: 8, rir: 2 }] })),
})
const state = () => ({
  unit: 'kg', measurementUnit: 'cm', customEx: structuredClone(customs), week: {},
  routines: [{ id: 'routine-name-test', name: 'Name tests', ex: customs.map(exercise => ({ id: exercise.id, sets: 3, reps: 8 })) }],
  workouts: [workout('name-workout-a', '2026-09-01', 60), workout('name-workout-b', '2026-10-05', 70)],
  exerciseAliases: { 'name-test-one': 'My first lift', 'name-test-two': 'My second lift' },
  bodyweight: [], measurements: [], inbody: [],
})
const text = pages => pages.map(page => page.svg).join('\n')

beforeEach(() => { registerCustom(customs); _setLangState('en'); vi.useFakeTimers(); vi.setSystemTime(now) })
afterEach(() => { registerCustom([]); _setLangState('en'); vi.useRealTimers() })

describe('exercise names in reports and strength rows', () => {
  it.each(['aliases', 'original'])('uses %s mode in CSV, Stats HTML/PDF, Progress HTML/PDF and printable plans', async mode => {
    const S = state(); S.exerciseNameMode = mode
    const before = structuredClone(S), report = buildProgressReport(S, { now })
    const outputs = [
      historyCsv(S), statsReportHTML(S),
      text(statsReportPages(S, { now, sections: ['exercise'], filters: { exId: customs[0].id } })),
      text(progressReportPages(S, { now, report, sections: ['routines'] })),
      progressReportHTML(report, { state: S }), planPrintHTML(S, 'Names'),
      text(await buildDashboardReportPages('progress', S, {}, { now, sections: ['routines'] })),
      text(await buildDashboardReportPages('stats', S, { sections: ['exercise'], filters: { exId: customs[0].id } }, { now })),
    ]
    for (const output of outputs) {
      expect(output).toContain(mode === 'original' ? 'Original first lift' : 'My first lift')
      // The separate CSV Alias column stays compatible in either display mode.
      if (output !== outputs[0]) expect(output).not.toContain(mode === 'original' ? 'My first lift' : 'Original first lift')
    }
    expect(strengthExerciseRows(S, +now).find(row => row.id === customs[0].id).name).toBe(mode === 'original' ? 'Original first lift' : 'My first lift')
    expect(strengthExerciseRowsForMuscle(S, +now, 'chest').find(row => row.id === customs[0].id).name).toBe(mode === 'original' ? 'Original first lift' : 'My first lift')
    expect(S).toEqual(before)
  })

  it.each([undefined, '', '   '])('falls back to the base original for an absent or empty alias (%s)', alias => {
    const S = state(); S.exerciseAliases[customs[0].id] = alias
    expect(strengthExerciseRows(S, +now).find(row => row.id === customs[0].id).name).toBe('Original first lift')
    expect(historyCsv(S)).toContain('Original first lift')
    expect(text(statsReportPages(S, { now, sections: ['exercise'], filters: { exId: customs[0].id } }))).toContain('Original first lift')
  })

  it('searches aliases and base names in either mode, including saved names for deleted custom IDs', () => {
    for (const mode of ['aliases', 'original']) {
      const S = state(); S.exerciseNameMode = mode
      expect(filteredHistory(S, { query: 'my first lift' })).toHaveLength(2)
      expect(filteredHistory(S, { query: 'original first lift' })).toHaveLength(2)
      S.customEx = []; registerCustom([])
      expect(filteredHistory(S, { query: 'original first lift' })).toHaveLength(2)
      expect(historyCsv(S)).toContain(mode === 'original' ? 'Original first lift' : 'My first lift')
      registerCustom(customs)
    }
  })

  it('keeps duplicate aliases as separate exercise IDs and preserves every metric and canonical plan field', () => {
    const S = state(), originalReport = buildProgressReport(S, { now }), originalRows = strengthExerciseRows(S, +now)
    S.exerciseAliases = Object.fromEntries(customs.map(exercise => [exercise.id, 'Same alias']))
    const before = structuredClone(S), report = buildProgressReport(S, { now }), rows = strengthExerciseRows(S, +now)
    expect(rows).toHaveLength(2); expect(new Set(rows.map(row => row.id)).size).toBe(2)
    expect(rows.map(row => row.name)).toEqual(['Same alias', 'Same alias'])
    expect(report.exercises.map(group => group.key)).toEqual(originalReport.exercises.map(group => group.key))
    expect(report.exercises.map(group => group.metrics)).toEqual(originalReport.exercises.map(group => group.metrics))
    expect(rows.map(({ name, ...metric }) => metric)).toEqual(originalRows.map(({ name, ...metric }) => metric))
    const json = JSON.stringify(buildPlanBundle(S, 'Names'))
    expect(json).toContain('Original first lift'); expect(json).not.toContain('Same alias')
    expect(S).toEqual(before)
  })

  it('reflects alias edits and removals without changing deleted exercise snapshots or introducing markup', () => {
    const S = state(); S.customEx = []; registerCustom([])
    S.exerciseAliases[customs[0].id] = '<nickname & custom>'
    const pages = statsReportPages(S, { now, sections: ['exercise'], filters: { exId: customs[0].id } })
    expect(text(pages)).toContain('&lt;nickname &amp; custom&gt;')
    const before = structuredClone(S)
    expect(strengthExerciseRows(S, +now).find(row => row.id === customs[0].id).name).toBe('<nickname & custom>')
    S.exerciseNameMode = 'original'
    expect(strengthExerciseRows(S, +now).find(row => row.id === customs[0].id).name).toBe('Original first lift')
    expect(S.exerciseAliases).toEqual(before.exerciseAliases)
    S.exerciseNameMode = 'aliases'; delete S.exerciseAliases[customs[0].id]
    expect(strengthExerciseRows(S, +now).find(row => row.id === customs[0].id).name).toBe('Original first lift')
    expect(S.workouts).toEqual(before.workouts)
  })

  it('wraps a maximum-length nickname in PDF dashboards and keeps valid SVG markup', () => {
    const S = state(); S.exerciseAliases[customs[0].id] = 'Long nickname '.repeat(5).slice(0, 60)
    const outputs = [statsReportPages(S, { now, sections: ['exercise'], filters: { exId: customs[0].id } }), progressReportPages(S, { now, sections: ['routines'] })]
    for (const pages of outputs) {
      for (const page of pages) expect(new DOMParser().parseFromString(page.svg, 'image/svg+xml').querySelector('parsererror')).toBeNull()
      const textNodes = pages.flatMap(page => [...new DOMParser().parseFromString(page.svg, 'image/svg+xml').querySelectorAll('text')].map(node => node.textContent)).join(' ')
      expect(textNodes).toContain('Long nickname')
      expect(textNodes).not.toContain('Original first lift')
    }
  })

  it('uses the frozen Progress snapshot for default HTML/PDF names after later preference edits', () => {
    const S = state(), report = buildProgressReport(S, { now })
    S.exerciseNameMode = 'original'; S.exerciseAliases[customs[0].id] = 'Later nickname'
    for (const output of [progressReportHTML(report), text(progressReportPages(null, { report, sections: ['routines'] }))]) {
      expect(output).toContain('My first lift'); expect(output).not.toContain('Later nickname'); expect(output).not.toContain('Original first lift')
    }
    const next = buildProgressReport(S, { now })
    expect(progressReportHTML(next)).toContain('Original first lift')
    expect(text(progressReportPages(null, { report: next, sections: ['routines'] }))).toContain('Original first lift')
    expect(S.workouts[0].entries[0].n).toBe('Original first lift')
  })

  it('keeps the default Stats chart on the same ID when nickname sorting differs or an unknown ID has only an alias', () => {
    const S = state()
    for (const workout of S.workouts) workout.entries[1].sets[0].w = workout.entries[0].sets[0].w
    S.workouts[1].entries.push({ id: 'nameless-unknown-id', target: { mode: 'reps' }, sets: [{ done: true, w: 200, r: 8 }] })
    S.exerciseAliases = { ...S.exerciseAliases, 'name-test-one': 'Z nickname', 'name-test-two': 'A nickname', 'nameless-unknown-id': 'Unknown alias' }
    const alias = text(statsReportPages(S, { now, sections: ['exercise'] }))
    S.exerciseNameMode = 'original'
    const original = text(statsReportPages(S, { now, sections: ['exercise'] }))
    expect(alias).toContain('Z nickname'); expect(alias).not.toContain('A nickname'); expect(alias).not.toContain('Unknown alias')
    expect(original).toContain('Original first lift'); expect(original).not.toContain('Original second lift')
  })

  it.each([['A', .722], ['W', .944], ['M', .833], ['漢', 1], ['🙂', 1.5]])('wraps 60 unbroken %s glyphs inside PDF cards without dropping nickname content', (glyph, em) => {
    const nickname = glyph.repeat(60), S = state()
    S.exerciseAliases[customs[0].id] = nickname
    const wrapped = wrapReportText(nickname, 876, 21, 700)
    expect(wrapped.length).toBeGreaterThan(1)
    expect(wrapped.join('')).toBe(nickname)
    for (const line of wrapped) expect(Array.from(line).length * em * 21).toBeLessThan(876)
    const pages = statsReportPages(S, { now, sections: ['exercise'], filters: { exId: customs[0].id } })
    const titleNodes = pages.flatMap(page => [...new DOMParser().parseFromString(page.svg, 'image/svg+xml').querySelectorAll('text[font-size="21"][font-weight="700"]')]).filter(node => Array.from(node.textContent).every(char => char === glyph))
    expect(titleNodes.length).toBeGreaterThan(1)
    expect(titleNodes.map(node => node.textContent).join('')).toBe(nickname)
    for (const node of titleNodes) expect(Array.from(node.textContent).length * em * 21 + Number(node.getAttribute('x'))).toBeLessThan(956)
    const progress = text(progressReportPages(S, { now, sections: ['routines'] }))
    expect(progress).not.toContain('>' + nickname + '</text>')
    expect(new DOMParser().parseFromString(pages[0].svg, 'image/svg+xml').querySelector('parsererror')).toBeNull()
  })

  it.each([['😀', 30], ['🇩', 30], ['♥', 60]])('fits emoji and flag nicknames within the editor limit in narrow report columns (%s)', (glyph, count) => {
    const nickname=glyph.repeat(count)
    expect(nickname.length).toBe(60)
    for(const [width,size,weight] of [[876,21,700],[912,24,700],[585,18,700],[416,18,400]]){
      const rows=wrapReportText(nickname,width,size,weight)
      expect(rows.join('')).toBe(nickname)
      for(const row of rows)expect(Array.from(row).length*size*1.5).toBeLessThan(width)
    }
  })
})
