// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { statsReportPages } from './stats-pdf.js'
import { STATS_SECTIONS } from './stats-sections.js'
import { historySummary, statisticsState } from './training-history.js'
import { routineConsistency, routineDurationSummary } from './stats-insights.js'
import { hybridSummary } from './activities.js'
import { effortSummary, toScale, displayScale } from './effort.js'
import { effortLabel } from './history.js'
import { bmiFor, bmiBand } from './stats-insights.js'
import { fmtDur } from './format.js'

const now = new Date('2026-10-06T12:00:00'), day = 86400000
const workout = (id, d, exercise = 'test-strength', weight = 60) => ({ id, d, routineId: 'r', name: 'WORKOUT_ONLY_' + id, start: +new Date(d + 'T09:00:00'), end: +new Date(d + 'T10:00:00'), vol: weight * 8 * 3, entries: [{ id: exercise, n: exercise === 'test-strength' ? 'STRENGTH_ONLY' : 'SECOND_ONLY', exercise: { id: exercise, n: exercise === 'test-strength' ? 'STRENGTH_ONLY' : 'SECOND_ONLY', muscleGroups: ['chest'] }, target: { mode: 'reps' }, sets: [{ done: true, w: weight, r: 8, rir: 2 }, { done: true, w: weight, r: 8, rir: 2 }, { done: true, w: weight, r: 8, rir: 1 }] }] })
const fixture = () => ({ unit: 'kg', measurementUnit: 'cm', accent: 'violet', body: 'male', heightCm: 180, targetW: 85, effort: 'rir', trainingStartDate: '2026-01-01', trainingHistory: { trackedFrom: '2026-01-01', historicalWorkouts: 12, workoutsPerWeek: 3 }, statsSections: ['bodyweight'], routines: [{ id: 'r', name: 'ROUTINE_ONLY', ex: [{ id: 'test-strength', sets: 3, reps: 8 }] }], week: { 1: 'r', 3: 'r', 5: 'r' }, workouts: [workout('old', '2026-01-05'), workout('one', '2026-09-07'), workout('two', '2026-09-21'), workout('three', '2026-10-05'), workout('four', '2026-10-06', 'second', 70)], bodyweight: [{ d: '2026-01-05', w: 82 }, { d: '2026-09-07', w: 83 }, { d: '2026-09-21', w: 84 }, { d: '2026-10-06', w: 86 }], measurements: [{ d: '2026-01-05', neck: 32, arm: 30 }, { d: '2026-09-21', neck: 35 }, { d: '2026-10-06', neck: 36, armLeft: 32, armRight: 31 }], inbody: [{ d: '2026-10-06', score: 81 }], customEx: [] })
const options = more => ({ now, formatNumber: n => String(Math.round(n * 10) / 10), ...more })
const doc = svg => new DOMParser().parseFromString(svg, 'image/svg+xml')
const texts = pages => pages.flatMap(page => [...doc(page.svg).querySelectorAll('text')].map(text => text.textContent))
const all = pages => pages.map(page => page.svg).join('')
const ids = pages => [...new Set(pages.flatMap(page => [...doc(page.svg).querySelectorAll('[data-stats-section]')].map(group => group.getAttribute('data-stats-section'))))]

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now) })
afterEach(() => vi.useRealTimers())

describe('Stats dashboard PDF source isolation', () => {
  it.each(STATS_SECTIONS)('exports only the selected %s section, including hidden sections', (id, title) => {
    const S = fixture(), before = structuredClone(S), pages = statsReportPages(S, options({ sections: [id] }))
    expect(pages.length).toBeGreaterThan(0)
    expect(ids(pages)).toEqual([id])
    expect(texts(pages)).toContain(title)
    expect(S).toEqual(before)
    for (const page of pages) expect(doc(page.svg).querySelector('parsererror')).toBeNull()
  })
  it('exports all existing sections in presentation order and ignores display preferences', () => {
    const S = fixture(), before = structuredClone(S), pages = statsReportPages(S, options())
    expect(ids(pages)).toEqual(STATS_SECTIONS.map(([id]) => id))
    expect(statsReportPages({ ...S, statsSections: ['history', 'consistency'] }, options())).toEqual(pages)
    expect(all(pages)).not.toContain('InBody history')
    expect(S).toEqual(before)
  })
  it('filters obsolete IDs, duplicates and arbitrary ordering without adding defaults', () => {
    const pages = statsReportPages(fixture(), options({ sections: ['recent', 'unknown', 'bodyweight', 'recent'] }))
    expect(ids(pages)).toEqual(['bodyweight', 'recent'])
    expect(() => statsReportPages(fixture(), options({ sections: [] }))).toThrow('Select at least one section.')
    expect(() => statsReportPages(fixture(), options({ sections: ['unknown'] }))).toThrow('Select at least one section.')
  })
  it('renders an explicit empty state for every requested section when no data exists', () => {
    const pages = statsReportPages({ unit: 'kg', routines: [], week: {}, workouts: [], bodyweight: [], measurements: [] }, options())
    expect(ids(pages)).toEqual(STATS_SECTIONS.map(([id]) => id))
    expect(all(pages)).not.toMatch(/\b(?:NaN|Infinity|undefined)\b/)
    expect(texts(pages)).toContain('No data yet')
    expect(texts(pages)).toContain('No measurements logged yet.')
  })
  it('uses the same training boundary, record deduplication and cancellation rules as Stats', () => {
    const S = fixture(); S.trainingStartDate = '2026-09-01'
    S.workouts.push(structuredClone(S.workouts[1]), { ...workout('future', '2026-10-07'), name: 'FUTURE_ONLY' }, { ...workout('cancel', '2026-10-02'), cancelled: true, name: 'CANCEL_ONLY' }, { ...workout('active', '2026-10-02'), name: 'ACTIVE_ONLY' })
    S.active = { id: 'active' }; S.measurements.push({ d: '2026-10-07', neck: 999 })
    const before = structuredClone(S), pages = statsReportPages(S, options())
    for (const forbidden of ['WORKOUT_ONLY_old', 'FUTURE_ONLY', 'CANCEL_ONLY', 'ACTIVE_ONLY', '999 cm']) expect(all(pages)).not.toContain(forbidden)
    expect((all(pages).match(/WORKOUT_ONLY_one/g) || []).length).toBe(1)
    expect(S).toEqual(before)
  })
})

describe('Stats dashboard filters and shared calculations', () => {
  it('preserves body weight period and goal without mixing it with BMI period', () => {
    const S = fixture(), initial = statsReportPages(S, options({ sections: ['bodyweight'] }))
    expect(all(initial)).not.toContain('2026-01-05')
    expect(all(initial)).toContain('Goal: 85 kg')
    const allTime = statsReportPages(S, options({ sections: ['bodyweight'], filters: { range: 0 } }))
    expect(all(allTime)).toContain('2026-01-05')
    const recent = statsReportPages(S, options({ sections: ['bodyweight'], filters: { bodyweightRange: 30 } }))
    expect(texts(recent)).toContain('Last 30 days')
  })
  it('renders training history and consistency directly from their existing helpers', () => {
    const S = fixture(), projected = statisticsState(S, '2026-10-06'), h = historySummary(S, '2026-10-06'), c = routineConsistency(projected, 56, now)
    const history = texts(statsReportPages(S, options({ sections: ['history'] }))), consistency = texts(statsReportPages(S, options({ sections: ['consistency'] })))
    expect(history).toContain(String(h.total))
    expect(history).toContain(String(h.scheduledPerWeek))
    expect(history).toContain(`${h.trackedWorkouts} recorded · ${h.historicalWorkouts} estimated before tracking`)
    expect(consistency).toContain(String(c.activeDays))
    expect(consistency).toContain(Math.round(c.rate * 100) + '%')
  })
  it('honors the routine duration filter, ID grouping, pause clock and validation', () => {
    const S = fixture(); S.workouts[3].pausedDurationMs = 30 * 60000
    S.workouts.push({ ...workout('invalid', '2026-10-01'), end: null })
    const projected = statisticsState(S, '2026-10-06'), expected = routineDurationSummary(projected.workouts, { routines: S.routines, days: 30, now: +now })
    const values = texts(statsReportPages(S, options({ sections: ['duration'], filters: { durationRange: 30 } })))
    expect(values).toContain('ROUTINE_ONLY')
    expect(values).toContain('Average duration: ' + fmtDur(expected[0].meanMs))
    expect(values).toContain('Median: ' + fmtDur(expected[0].medianMs))
    expect(values).toContain(`${expected[0].count} workouts`)
    expect(values).toContain('Last 30 days')
  })
  it('keeps overview and effort periods independent', () => {
    const S = fixture(), projected = statisticsState(S, '2026-10-06')
    const overview = hybridSummary(projected.workouts.filter(workout => workout.d >= '2026-09-06'))
    const effortState = { ...projected, workouts: projected.workouts.filter(workout => workout.start > +now - 30 * day) }
    const effort = effortSummary(effortState, 0)
    const values = texts(statsReportPages(S, options({ sections: ['overview', 'effort'], filters: { overviewPeriod: '30', effortRange: 30 } })))
    expect(values).toContain(String(overview.strength))
    expect(values).toContain(effortLabel(displayScale(S), toScale(displayScale(S), effort.avg)))
    expect(values).toContain(`${effort.rated} of ${effort.done} finished sets rated`)
    expect(values).toContain('Last 30 days · how close to failure')
  })
  it('preserves selected measurement comparison and unit/legacy helpers', () => {
    const S = fixture()
    const pages = statsReportPages(S, options({ sections: ['measurements'], filters: { bodySelection: { before: '1', after: '2' } } }))
    expect(texts(pages)).toContain('Before: 2026-09-21 · After: 2026-10-06')
    expect(texts(pages)).toContain('Before: 35 cm → After: 36 cm')
    expect(texts(pages)).toContain('+1 cm · +2.9 %')
    expect(all(pages)).not.toContain('32 cm → After: 36 cm')
  })
  it('uses BMI from the same latest weight and recorded display height as Stats', () => {
    const S = fixture(), expected = bmiFor(S.bodyweight.at(-1).w, S.unit, S.heightCm, S.measurementUnit)
    const values = texts(statsReportPages(S, options({ sections: ['bmi'] })))
    expect(values).toContain(String(expected))
    expect(values).toContain('Calculated from 86 kg and 180 cm.')
    expect(values.join(' ')).toContain('BMI is an orientation only. It can read high in muscular people and does not measure body-fat percentage.')
  })
  it('labels the weight tile as body weight and keeps BMI classification in the section heading', () => {
    for (const weight of [76, 86]) {
      const S = fixture(); S.bodyweight.at(-1).w = weight
      const classification = bmiBand(bmiFor(weight, S.unit, S.heightCm, S.measurementUnit))
      const page = doc(statsReportPages(S, options({ sections: ['bmi'] }))[0].svg)
      expect(page.querySelector('[data-stats-section="bmi"]').textContent).toContain(classification)
      const cardTexts = [...page.querySelectorAll('rect[rx="14"]')].map(rect => {
        const x = Number(rect.getAttribute('x')), y = Number(rect.getAttribute('y'))
        const right = x + Number(rect.getAttribute('width')), bottom = y + Number(rect.getAttribute('height'))
        return [...page.querySelectorAll('text')].filter(text => {
          const tx = Number(text.getAttribute('x')), ty = Number(text.getAttribute('y'))
          return tx >= x && tx < right && ty > y && ty < bottom
        }).map(text => text.textContent)
      })
      const weightTile = cardTexts.find(values => values.includes(weight + ' kg'))
      expect(weightTile).toContain('Body Weight')
      expect(weightTile).not.toContain(classification)
    }
  })
  it('exports selected exercise and metric with completed work rows, retaining effort and set labels', () => {
    const S = fixture()
    const selected = statsReportPages(S, options({ sections: ['exercise'], filters: { exId: 'test-strength', exMetric: 'e1rm' } }))
    expect(all(selected)).toContain('STRENGTH_ONLY · Est. 1RM')
    expect(all(selected)).not.toContain('SECOND_ONLY')
    expect(texts(selected)).toContain('Estimated 1RM per workout · Best: 76 kg')
    const effort = statsReportPages(S, options({ sections: ['exercise'], filters: { exId: 'test-strength', exMetric: 'effort' } }))
    expect(texts(effort)).toContain('Average effort per workout')
    expect(all(effort)).toContain('60×8 (RIR 2)')
    expect(all(effort)).not.toContain('Best: 60 kg')
  })
  it('retains reps-only, per-side, timed and cardio modes instead of calculating a weight max for them', () => {
    const S = fixture(); S.workouts = [workout('one', '2026-10-02'), workout('two', '2026-10-03'), workout('three', '2026-10-04')]
    for (const workout of S.workouts) { workout.entries[0].target = { mode: 'reps', side: true }; workout.entries[0].sets = [{ done: true, w: 0, r: 16 }] }
    const reps = statsReportPages(S, options({ sections: ['exercise'], filters: { exId: 'test-strength' } }))
    expect(texts(reps)).toContain('Most reps in a set per workout · Best: 8 reps')
    for (const workout of S.workouts) { workout.entries[0].target = { mode: 'time' }; workout.entries[0].sets = [{ done: true, sec: 35 }] }
    const timed = statsReportPages(S, options({ sections: ['exercise'], filters: { exId: 'test-strength', exMetric: 'e1rm' } }))
    expect(texts(timed)).toContain('Longest hold per workout · Best: 35 s')
    for (const workout of S.workouts) { workout.entries[0].target = { mode: 'cardio' }; workout.entries[0].sets = [{ done: true, min: 20, speed: 9 }] }
    const cardio = statsReportPages(S, options({ sections: ['exercise'], filters: { exId: 'test-strength' } }))
    expect(texts(cardio)).toContain('Top speed per workout · Best: 9 km/h')
  })
  it('honors muscle window, hard-set mode and existing recovery views', () => {
    const S = fixture()
    const balance = statsReportPages(S, options({ sections: ['muscles'], filters: { musclesRange: 7, musclesHard: true } }))
    expect(texts(balance)).toContain('Week · by hard sets')
    expect(texts(balance)).toContain('6 sets')
    const fatigue = statsReportPages(S, options({ sections: ['muscles'], filters: { musclesView: 'fatigue' } }))
    expect(texts(fatigue)).toContain('Fatigue')
    expect(texts(fatigue)).toContain('Fatigue shows how recently each muscle was trained. High means rest.')
    const strength = statsReportPages(S, options({ sections: ['muscles'], filters: { musclesView: 'strength' } }))
    expect(texts(strength)).toContain('Strength')
    expect(texts(strength)).toContain('0 sets')
  })
})

describe('Stats PDF dashboard pagination and escaping', () => {
  it('uses fixed A4-sized pages and never crosses the reserved footer', () => {
    const S = fixture()
    S.routines = Array.from({ length: 45 }, (_, i) => ({ id: 'r' + i, name: 'Long routine ' + i + ' — ' + 'nombre repetido '.repeat(40) }))
    S.workouts = S.routines.map((routine, i) => ({ ...workout(i, '2026-10-05'), routineId: routine.id, name: routine.name }))
    const pages = statsReportPages(S, options({ sections: ['duration', 'recent'] }))
    expect(pages.length).toBeGreaterThan(5)
    for (const page of pages) {
      expect(page.width / page.height).toBeCloseTo(210 / 297, 2)
      expect(page.height).toBe(1414)
      const svg = doc(page.svg)
      expect(svg.querySelector('parsererror')).toBeNull()
      for (const text of svg.querySelectorAll('text')) expect(Number(text.getAttribute('y'))).toBeLessThan(1414)
      for (const card of svg.querySelectorAll('rect[rx="14"]')) expect(Number(card.getAttribute('y')) + Number(card.getAttribute('height'))).toBeLessThanOrEqual(1330)
    }
    expect(all(pages)).toContain('Long routine 44')
  })
  it('escapes saved text and reuses supplied body artwork without external images or markup', () => {
    const S = fixture(); S.workouts.at(-1).name = '<script>&"saved"</script>'
    const geometry = { male: { front: { vb: '0 0 100 400', p: { chest: ['M 1 1 L 2 2 Z'] } }, back: { vb: '0 0 100 400', p: {} } } }
    const pages = statsReportPages(S, options({ sections: ['muscles', 'measurements', 'recent'], bodyGeometry: geometry }))
    for (const page of pages) expect(doc(page.svg).querySelector('script, image, foreignObject, parsererror')).toBeNull()
    expect(texts(pages)).toContain('<script>&"saved"</script>')
    expect(all(pages)).toContain('M 1 1 L 2 2 Z')
    expect(all(pages)).toContain('#bf5af2')
  })
})
