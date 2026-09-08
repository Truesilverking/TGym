import { describe, it, expect } from 'vitest'
import { createBackup } from './backup.js'
import { parseTGymJson } from './json-import.js'
describe('portable full snapshots', () => {
  const state = {workouts:[], routines:[], unit:'lb',lang:'en',active:{entries:[]},customEx:[],cloudSync:{on:true,accessToken:'secret',lastFileId:'private'},pin:'1234'}
  it('round trips preferences and active training but excludes authentication', () => {
    const backup = createBackup(state)
    const restored = parseTGymJson(JSON.stringify(backup)).data
    expect(restored).toMatchObject({unit:'lb',lang:'en',active:{entries:[]}})
    expect(JSON.stringify(backup)).not.toContain('secret')
    expect(restored).not.toHaveProperty('pin')
    expect(restored.cloudSync.on).toBe(false)
    expect(state.cloudSync.on).toBe(true)
  })
  it('rejects corrupted and future snapshots without modifying input', () => {
    const backup = createBackup(state); backup.data.unit='kg'
    expect(() => parseTGymJson(backup)).toThrow(/checksum/)
    const future = createBackup(state); future.schemaVersion=999
    expect(() => parseTGymJson(future)).toThrow(/version/)
    expect(state.unit).toBe('lb')
  })
  it('validates legacy shapes and strips prototype pollution', () => {
    expect(() => parseTGymJson({workouts:[null],routines:[]})).toThrow()
    const data = parseTGymJson('{"workouts":[],"routines":[],"__proto__":{"polluted":true}}').data
    expect(Object.hasOwn(data,'__proto__')).toBe(false)
  })
})
