import { describe, expect, it } from 'vitest'
import { applyRemoteConflicts, mergeTGymStates } from './state-merge.js'

describe('TGym state merge', () => {

  it('combines independent records and reports actual scalar conflicts', () => {
    const local = { lang: 'es', workouts: [{ id: 'a', note: 'A' }], targetW: 80 }
    const remote = { lang: 'en', workouts: [{ id: 'b', note: 'B' }], targetW: 75 }
    const result = mergeTGymStates(local, remote)
    expect(result.merged.lang).toBe('es')
    expect(result.merged.workouts.map(x => x.id)).toEqual(['a', 'b'])
    expect(result.conflicts).toEqual([{ path: 'targetW', local: 80, remote: 75 }])
    expect(applyRemoteConflicts(result.merged, result.conflicts).targetW).toBe(75)
  })
})

