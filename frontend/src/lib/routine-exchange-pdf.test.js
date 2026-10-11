import { describe, expect, it } from 'vitest'
import { createRoutineExchange } from './routine-exchange.js'
import { routinePDFPages } from './routine-exchange-pdf.js'

const fixture = () => ({
  unit: 'lb', restSec: 75, strictReps: true, backoffRepsMode: 'same',
  customEx: [{ id: 'custom-pdf', n: 'Extensión de cadera áéíóú Ñ / hombros', eq: 'body weight', custom: true }],
  exerciseAliases: { 'custom-pdf': 'Mi ejercicio ágil' },
  routines: [{ id: 'pdf-routine', name: 'Piernas y técnica', ex: [
    { id: 'custom-pdf', sets: 3, reps: 16, repsMin: 12, side: true, bodyweight: true, weight: 20, warmupSets: 2, setScheme: 'topback', topSets: 2, backoffSets: 2, topRepsMin: 12, topRepsMax: 16, backoffPct: 15, targetRirMin: 1, targetRirMax: 2, inc: 5, note: 'Evita girar la cadera.' },
    { id: 'custom-pdf', mode: 'time', side: true, sets: 2, sec: 45, weight: 0, prog: 'off' },
    { id: 'custom-pdf', mode: 'cardio', sets: 1, min: 20, speed: 7.5 },
  ] }], week: { 1: ['pdf-routine'] }, dayPlan: {},
})
const content = pages => pages.map(page => page.svg).join('')

describe('routine PDF complete prescription projection', () => {
  it('uses readable series tables, side units, bodyweight load and derived cardio distance', () => {
    const pages = routinePDFPages(createRoutineExchange(fixture())), svg = content(pages)
    expect(svg).toContain('data-series-instance="pdf-routine:1"')
    expect(svg).toContain('6-8 reps / side')
    expect(svg).toContain('45 s / side')
    expect(svg).toContain('Bodyweight +20 lb')
    expect(svg).toContain('2.5 km')
    expect(svg).toContain('Progression: off')
    expect(svg).toContain('Strict rep targets: on')
    expect(svg).toContain('Top association: sets 3-4')
    expect(svg).toContain('Load reduction 15%')
    expect(svg).toContain('Reps same')
    expect(svg).toContain('Extensión de cadera áéíóú Ñ / hombros')
    expect(svg).not.toContain('NaN')
  })

  it('describes increased and independent Back-off targets without opaque association IDs', () => {
    const S = fixture(), e = S.routines[0].ex[0]
    e.backoffRepsMode = 'increased'
    let svg = content(routinePDFPages(createRoutineExchange(S)))
    expect(svg).toContain('8-10 reps / side')
    expect(svg).toContain('Reps increased (+2 / side)')
    expect(svg).not.toContain('pdf-routine:1:Top')
    e.autoBackoffReps = false; e.backoffRepsMin = 18; e.backoffRepsMax = 22
    svg = content(routinePDFPages(createRoutineExchange(S)))
    expect(svg).toContain('9-11 reps / side')
    expect(svg).toContain('Reps independent range')
  })

  it('renders rest-pause activation and one work total according to the existing execution helper', () => {
    const S = fixture()
    S.routines[0].ex = [{ id: 'custom-pdf', sets: 5, reps: 16, side: true, weight: 10, intensifier: { type: 'restpause', totalReps: 40, restSec: 15 } }]
    const svg = content(routinePDFPages(createRoutineExchange(S)))
    expect((svg.match(/data-set-order=/g) || [])).toHaveLength(2)
    expect(svg).toContain('8 reps / side')
    expect(svg).toContain('20 reps / side')
    expect(svg).toContain('Rest-pause: activation + one working set')
    expect(svg).toContain('Cluster rest 15 s')
    expect(svg).not.toContain('{&quot;type&quot;')
  })

  it('escapes literal free text and leaves source records untouched', () => {
    const S = fixture(); S.routines[0].ex[0].note = '<script>alert("test")</script> =1+1 & áéíóú'
    const data = createRoutineExchange(S), snapshot = JSON.stringify(data), svg = content(routinePDFPages(data))
    expect(svg).toContain('&lt;script&gt;')
    expect(svg).toContain('&amp;')
    expect(svg).not.toContain('<script>')
    expect(JSON.stringify(data)).toBe(snapshot)
  })
})

describe('routine PDF pagination', () => {
  it('keeps exercise titles with a series table, repeats table headers and never emits empty pages', () => {
    const S = fixture()
    S.routines[0].ex = Array.from({ length: 20 }, (_, i) => ({ id: 'custom-pdf', sets: 8, reps: 8, weight: 12.5, note: `Note ${i}` }))
    const pages = routinePDFPages(createRoutineExchange(S))
    expect(pages.length).toBeGreaterThan(2)
    for (const page of pages) {
      expect(page.svg).toContain('data-set-order=')
      expect(page.svg).toContain('data-series-header=')
      expect(page.svg).not.toMatch(/<text[^>]+y="1[1-9]\d\d"/)
      for (const match of page.svg.matchAll(/data-exercise-heading="([^"]+)"/g)) {
        expect(page.svg).toContain(`data-series-instance="${match[1]}"`)
      }
    }
  })

  it('flows extremely long names and notes completely while keeping every line inside page bounds', () => {
    const S = fixture()
    S.routines[0].name = 'Rutina extensión y técnica '.repeat(80) + 'NAME_END'
    S.routines[0].ex[0].note = 'Ángulos y movimiento <seguro> '.repeat(1400) + 'NOTE_END'
    const pages = routinePDFPages(createRoutineExchange(S)), svg = content(pages)
    expect(svg).toContain('NAME_END'); expect(svg).toContain('NOTE_END')
    expect(pages.every(page => /data-prescription-content/.test(page.svg))).toBe(true)
    for (const page of pages) expect(page.svg).not.toMatch(/<text[^>]+y="1[1-9]\d\d"/)
  })
})
