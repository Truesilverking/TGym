import { expect, it } from 'vitest'
import { mergeScaleRecords } from './scale-records.js'
import { createBackup, readBackup } from '../backup.js'

const now=Date.parse('2026-11-24T20:00:00Z'),time=Date.parse('2026-11-23T15:00:00Z')
const record=(id=10,extra={})=>({id,date:time/1000,category:1,measures:[{type:1,value:80000,unit:-3}],...extra})
const base=()=>({unit:'kg',routines:[{id:'kept-routine'}],workouts:[{id:'kept-history'}],active:{id:'kept-active'},bodyweight:[],inbody:[]})
const sample=()=>({id:'health-connect:com.withings.wiscale2:hc-id',source:'health-connect',origin:'com.withings.wiscale2',providerId:'hc-id',updatedAt:time+1000,w:80,t:time+123,unit:'kg'})
it('links the same Health Connect measurement when switching to the API without doubling the daily average',()=>{
  const S=base(),hc=sample();S.bodyweight=[{d:'2026-11-23',w:79,unit:'kg',samples:[{w:78,t:time-60000,unit:'kg'},hc]}]
  const before=structuredClone(S);mergeScaleRecords(S,[record()],now)
  expect(S.bodyweight[0].samples).toHaveLength(2);expect(S.bodyweight[0].w).toBe(79)
  expect(S.bodyweight[0].samples[1]).toMatchObject({id:hc.id,source:'health-connect',withingsId:'withings:10'})
  const saved=structuredClone(S);mergeScaleRecords(S,[record()],now);expect(S).toEqual(saved)
  mergeScaleRecords(S,[record(10,{date:(time+86400000)/1000,measures:[{type:1,value:82000,unit:-3}]})],now)
  expect(S.bodyweight[0].samples).toEqual([before.bodyweight[0].samples[0]])
  expect(S.bodyweight[1].samples).toHaveLength(1);expect(S.bodyweight[1].samples[0]).toMatchObject({id:hc.id,withingsId:'withings:10',w:82})
  for(const key of ['workouts','routines','active'])expect(S[key]).toEqual(before[key])
})
it('does not merge manual readings or replace an existing alias with a second API identity',()=>{
  const S=base();S.bodyweight=[{d:'2026-11-23',w:80,unit:'kg',samples:[{id:'manual',source:'manual',w:80,t:time},sample()]}]
  mergeScaleRecords(S,[record(10),record(11)],now)
  expect(S.bodyweight[0].samples).toHaveLength(3)
  expect(S.bodyweight[0].samples[0].id).toBe('manual')
  expect(S.bodyweight[0].samples.find(s=>s.source==='health-connect').withingsId).toBe('withings:10')
  expect(S.bodyweight[0].samples.some(s=>s.id==='withings:11')).toBe(true)
})
it('matches provider readings in canonical kg while retaining original Health Connect identity',()=>{
  const S=base();S.unit='lb';S.bodyweight=[{d:'2026-11-23',w:80,unit:'kg',samples:[sample()]}]
  mergeScaleRecords(S,[record()],now)
  expect(S.bodyweight[0].samples).toHaveLength(1);expect(S.bodyweight[0].samples[0].source).toBe('health-connect')
  expect(S.bodyweight[0].w).toBeCloseTo(176.4)
})
it('preserves health weight lineage but disables device-specific access on portable restore',()=>{
  const S={...base(),healthConnectWeight:{enabled:true,autoSync:true,lastSyncAt:10,generation:'device-generation'},scaleWeightSource:'health-connect',bodyweight:[{d:'2026-11-23',w:80,samples:[{...sample(),withingsId:'withings:10'}]}]}
  const before=structuredClone(S),restored=readBackup(createBackup(S))
  expect(restored.healthConnectWeight).toEqual({enabled:false,autoSync:false,lastSyncAt:0})
  expect(restored.bodyweight).toEqual(S.bodyweight);expect(S).toEqual(before);expect(JSON.stringify(restored)).not.toContain('device-generation')
})
