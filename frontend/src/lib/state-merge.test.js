import { describe, expect, it } from 'vitest'
import { applyRemoteConflicts, mergeTGymStates } from './state-merge.js'

describe('TGym state merge', () => {

  it('combines independent records and reports actual scalar conflicts', () => {
    const local = { lang: 'es', workouts: [{ id: 'a', note: 'A' }], targetW: 80 }
    const remote = { lang: 'en', workouts: [{ id: 'b', note: 'B' }], targetW: 75 }
    const result = mergeTGymStates(local, remote)
    expect(result.merged.lang).toBe('es')
    expect(result.merged.workouts.map(x => x.id)).toEqual(['a', 'b'])
    expect(result.conflicts).toEqual([{ path: 'targetW', segments: ['targetW'], local: 80, remote: 75 }])
    expect(applyRemoteConflicts(result.merged, result.conflicts).targetW).toBe(75)
  })

  it('keeps each conflicting workout coherent instead of duplicating edited sets', () => {
    const workout = { id: 'workout.1', name: 'Strength', vol: 100, entries: [{ id: 'squat', sets: [{ done: true, w: 20, r: 5 }] }] }
    const edited = structuredClone(workout)
    edited.entries[0].sets[0].w = 30
    edited.vol = 150
    const result = mergeTGymStates({ workouts: [workout] }, { workouts: [edited] })
    expect(result.merged.workouts).toEqual([workout])
    expect(result.conflicts).toHaveLength(1)
    expect(applyRemoteConflicts(result.merged, result.conflicts).workouts).toEqual([edited])
    expect(result.merged.workouts).toEqual([workout])
  })

  it('resolves record conflicts by identity even when order differs and IDs contain dots', () => {
    const local = { routines: [{ id: 'routine.1', name: 'Old', ex: [] }, { id: 'second', name: 'Keep', ex: [] }] }
    const remote = { routines: [{ id: 'second', name: 'Keep', ex: [] }, { id: 'routine.1', name: 'New', ex: [] }] }
    const result = mergeTGymStates(local, remote)
    expect(applyRemoteConflicts(result.merged, result.conflicts).routines).toEqual([{ ...local.routines[0], name: 'New' }, local.routines[1]])
  })

  it('treats ordered routine exercises as a choice, without resurrecting removed exercises', () => {
    const local = { routines: [{ id: 'r', ex: [{ id: 'squat', sets: 3 }] }] }
    const remote = { routines: [{ id: 'r', ex: [{ id: 'press', sets: 4 }, { id: 'squat', sets: 2 }] }] }
    const result = mergeTGymStates(local, remote)
    expect(result.merged).toMatchObject(local)
    expect(result.conflicts).toHaveLength(1)
    expect(applyRemoteConflicts(result.merged, result.conflicts)).toMatchObject(remote)
  })

  it('does not silently restore a cleared goal or stale active workout', () => {
    const local = { targetW: null, active: null }
    const remote = { targetW: 70, active: { id: 'stale', entries: [] } }
    const result = mergeTGymStates(local, remote)
    expect(result.merged).toMatchObject(local)
    expect(result.conflicts).toHaveLength(2)
    expect(applyRemoteConflicts(result.merged, result.conflicts)).toMatchObject(remote)
  })

  it('matches legacy dated measurements without duplicating an edited weigh-in', () => {
    const result = mergeTGymStates({ bodyweight: [{ d: '2026-09-25', w: 80 }] }, { bodyweight: [{ d: '2026-09-25', w: 79 }] })
    expect(result.merged.bodyweight).toEqual([{ d: '2026-09-25', w: 80 }])
    expect(applyRemoteConflicts(result.merged, result.conflicts).bodyweight).toEqual([{ d: '2026-09-25', w: 79 }])
  })

  it('does not collapse multiple legacy reports sharing a date or union ambiguous versions', () => {
    const local = { inbody: [{ d: '2026-09-25', weight: 80 }, { d: '2026-09-25', weight: 81 }] }
    const remote = { inbody: [{ d: '2026-09-25', weight: 82 }] }
    const result = mergeTGymStates(local, remote)
    expect(result.merged.inbody).toEqual(local.inbody)
    expect(result.conflicts).toHaveLength(1)
    expect(applyRemoteConflicts(result.merged, result.conflicts).inbody).toEqual(remote.inbody)
  })
})

