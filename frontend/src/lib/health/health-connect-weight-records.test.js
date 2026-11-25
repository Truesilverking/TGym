import { describe, expect, it } from 'vitest'
import { healthConnectWeightRecords, isSameWithingsWeightSample, mergeHealthConnectWeightRecords, WITHINGS_ANDROID_PACKAGE } from './health-connect-weight-records.js'
import { LB_PER_KG } from '../weight-units.js'
import { isoOf } from '../format.js'

const now = Date.parse('2026-11-21T16:00:00Z'), time = now - 3600000
const row = (id = 'weight-1', extra = {}) => ({ id, origin: WITHINGS_ANDROID_PACKAGE, time, updatedAt: time + 1000, weightKg: 80, ...extra })
const data = records => ({ complete: true, from: now - 30 * 86400000, to: now, records })
const state = () => ({ unit: 'kg', bodyweight: [], inbody: [{ id: 'kept-fat' }], routines: [{ id: 'kept-routine' }], workouts: [{ id: 'kept-history' }], active: { id: 'kept-active', bw: 75 } })
const merge = (S, records) => mergeHealthConnectWeightRecords(S, data(records), now)
const key = id => `health-connect:${WITHINGS_ANDROID_PACKAGE}:${id}`

describe('Withings weights read through Health Connect', () => {
  it('projects only official Withings-origin records with genuine Health Connect provenance', () => {
    const records = healthConnectWeightRecords(data([row(), row('other', { origin: 'unrelated.app', weightKg: 100 })]), now)
    expect(records).toEqual([{ id: key('weight-1'), providerId: 'weight-1', source: 'health-connect', origin: WITHINGS_ANDROID_PACKAGE,
      updatedAt: time + 1000, t: time, d: isoOf(new Date(time)), weightKg: 80 }])
  })
  it.each([
    { complete: false }, { records: {} }, { from: -1 }, { from: now - 30 * 86400000 - 1 }, { to: now + 60001 },
  ])('rejects incomplete or unbounded native snapshots before merging (%j)', invalid => {
    const S = state(), before = structuredClone(S)
    expect(() => mergeHealthConnectWeightRecords(S, { ...data([row()]), ...invalid }, now)).toThrow('Invalid Health Connect')
    expect(S).toEqual(before)
  })
  it.each([{ id: '../bad' }, { time: now + 1 }, { time: now - 31 * 86400000 }, { weightKg: 0 }, { weightKg: Infinity }, { weightKg: 601 }, { updatedAt: NaN }])('rejects malformed supported records without partial state changes (%j)', invalid => {
    const S = state(), before = structuredClone(S)
    expect(() => merge(S, [row('good'), row('bad', invalid)])).toThrow('Invalid Health Connect')
    expect(S).toEqual(before)
  })
  it('selects the newest revision inside a snapshot, and rejects conflicting equal revisions', () => {
    expect(healthConnectWeightRecords(data([row('same', { weightKg: 78 }), row('same', { weightKg: 81, updatedAt: time + 2000 })]), now)[0].weightKg).toBe(81)
    expect(() => healthConnectWeightRecords(data([row('same'), row('same', { weightKg: 81 })]), now)).toThrow()
  })
  it('imports and retries idempotently without changing history, active weight or other body measurements', () => {
    const S = state(), before = structuredClone(S)
    expect(merge(S, [row()])).toEqual({ added: 1, updated: 0, unchanged: 0, readings: 1 })
    const saved = structuredClone(S)
    expect(merge(S, [row()])).toEqual({ added: 0, updated: 0, unchanged: 1, readings: 1 })
    expect(S).toEqual(saved)
    for (const field of ['inbody', 'routines', 'workouts', 'active']) expect(S[field]).toEqual(before[field])
  })
  it('retains manual samples and normalizes stamped units before the existing daily average', () => {
    const S = state(); S.unit = 'lb'; S.bodyweight = [{ d: isoOf(new Date(time)), w: 78, unit: 'kg', samples: [{ w: 78, unit: 'kg', t: time - 60000 }] }]
    const manual = structuredClone(S.bodyweight[0].samples[0])
    merge(S, [row()]); expect(S.bodyweight[0].samples).toHaveLength(2)
    expect(S.bodyweight[0].samples[0]).toMatchObject({ ...manual, w: 78 * LB_PER_KG, unit: 'lb' })
    expect(S.bodyweight[0].w).toBe(Math.round(79 * LB_PER_KG * 10) / 10)
  })
  it('retains a numeric legacy manual day without samples instead of replacing it with an imported reading', () => {
    const S = state(); S.bodyweight = [{ d: isoOf(new Date(time)), w: '78', t: time - 60000, unit: 'kg' }]
    merge(S, [row()])
    expect(S.bodyweight[0].w).toBe(79)
    expect(S.bodyweight[0].samples).toHaveLength(2)
    expect(S.bodyweight[0].samples[0]).toMatchObject({ w: 78, t: time - 60000, unit: 'kg' })
  })
  it('moves revised records between days while retaining manual samples and ignoring stale revisions', () => {
    const S = state(); S.bodyweight = [{ d: isoOf(new Date(time)), w: 78, samples: [{ w: 78, t: time - 60000 }] }]
    merge(S, [row()]); merge(S, [row('weight-1', { time: time - 86400000, weightKg: 82, updatedAt: time + 2000 })])
    expect(S.bodyweight).toHaveLength(2); expect(S.bodyweight[1].samples).toEqual([{ w: 78, t: time - 60000, unit: 'kg' }])
    expect(S.bodyweight[0].w).toBe(82)
    const saved = structuredClone(S); expect(merge(S, [row()]).unchanged).toBe(1); expect(S).toEqual(saved)
  })
  it('links an identical API reading instead of counting it twice, then reconciles HC revisions through its alias', () => {
    const S = state(); S.bodyweight = [{ d: isoOf(new Date(time)), w: 79, samples: [
      { w: 78, t: time - 60000 }, { id: 'withings:42', source: 'withings', w: 80, t: time, unit: 'kg' },
    ] }]
    expect(merge(S, [row()])).toEqual({ added: 0, updated: 1, unchanged: 0, readings: 1 })
    expect(S.bodyweight[0].w).toBe(79); expect(S.bodyweight[0].samples).toHaveLength(2)
    expect(S.bodyweight[0].samples[1]).toMatchObject({ id: 'withings:42', source: 'withings', healthConnect: { id: key('weight-1'), origin: WITHINGS_ANDROID_PACKAGE } })
    merge(S, [row('weight-1', { time: time - 86400000, weightKg: 82, updatedAt: time + 2000 })])
    expect(S.bodyweight).toHaveLength(2); expect(S.bodyweight[0].w).toBe(82); expect(S.bodyweight[0].samples[0].id).toBe('withings:42')
    expect(S.bodyweight[1].w).toBe(78)
    expect(merge(S, [row('weight-1', { time: time - 86400000, weightKg: 82, updatedAt: time + 2000 })]).unchanged).toBe(1)
  })
  it('does not merge unrelated readings or identify an explicit manual entry as an API duplicate', () => {
    const S = state(); S.bodyweight = [{ d: isoOf(new Date(time)), w: 80, samples: [{ w: 80, t: time }] }]
    merge(S, [row()]); expect(S.bodyweight[0].samples).toHaveLength(2)
    expect(isSameWithingsWeightSample(S.bodyweight[0].samples[1], S.bodyweight[0], { t: time, weightKg: 80 })).toBe(true)
    expect(isSameWithingsWeightSample(S.bodyweight[0].samples[1], S.bodyweight[0], { t: time + 1000, weightKg: 80 })).toBe(false)
  })
  it('does not replace an established API alias with another API identity that has the same measured second and weight', () => {
    const S = state(); merge(S, [row()])
    const sample = S.bodyweight[0].samples[0]
    expect(isSameWithingsWeightSample(sample, S.bodyweight[0], { t: time, weightKg: 80 })).toBe(true)
    sample.withingsId = 'withings:42'
    expect(isSameWithingsWeightSample(sample, S.bodyweight[0], { t: time, weightKg: 80 })).toBe(false)
    expect(sample.withingsId).toBe('withings:42')
  })
  it('preserves inverse API identity through a later native revision and keeps equal native revisions from overwriting newer API values', () => {
    const S = state(); merge(S, [row()])
    S.bodyweight[0].samples[0].withingsId = 'withings:42'
    merge(S, [row('weight-1', { weightKg: 81, updatedAt: time + 2000 })])
    expect(S.bodyweight[0].samples[0]).toMatchObject({ id: key('weight-1'), source: 'health-connect', withingsId: 'withings:42', w: 81 })
    S.bodyweight[0].samples[0].w = 82; S.bodyweight[0].w = 82
    const before = structuredClone(S)
    expect(merge(S, [row('weight-1', { weightKg: 81, updatedAt: time + 2000 })]).unchanged).toBe(1)
    expect(S).toEqual(before)
  })
  it('does not let an equal-revision HC snapshot replace a newer value retained under the original API identity', () => {
    const S = state(); S.bodyweight = [{ d: isoOf(new Date(time)), w: 80, samples: [
      { id: 'withings:42', source: 'withings', w: 80, t: time, unit: 'kg' },
    ] }]
    merge(S, [row()]); S.bodyweight[0].samples[0].w = 81; S.bodyweight[0].w = 81
    const before = structuredClone(S)
    expect(merge(S, [row()]).unchanged).toBe(1)
    expect(S).toEqual(before)
  })
  it('reports a genuinely empty completed read without inventing a measurement', () => {
    const S = state(); expect(merge(S, [])).toEqual({ added: 0, updated: 0, unchanged: 0, readings: 0 }); expect(S.bodyweight).toEqual([])
  })
})
