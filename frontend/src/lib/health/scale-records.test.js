import { describe, expect, it } from 'vitest'
import { withingsRecords, mergeScaleRecords } from './scale-records.js'
import { LB_PER_KG } from '../weight-units.js'

const now=Date.parse('2026-11-04T20:00:00Z'), time=Date.parse('2026-11-03T15:00:00Z')
const record=(id=10,extra={})=>({id,date:time/1000,category:1,measures:[{type:1,value:80000,unit:-3},{type:6,value:2050,unit:-2},{type:8,value:16400,unit:-3}],...extra})
const base=()=>({unit:'kg',measurementUnit:'cm',bodyweight:[],inbody:[],measurements:[{id:'manual-tape',d:'2026-11-01',neck:35}],workouts:[{id:'saved'}],routines:[{id:'routine'}],active:{id:'active'}})
describe('Withings read-only record projection',()=>{
  it('normalizes documented powers of ten and UTC timestamps into local dates',()=>{
    expect(withingsRecords([record()],now)[0]).toMatchObject({id:'withings:10',t:time,source:'withings',weight:80,bodyFatPct:20.5,bodyFatMass:16.4})
  })
  it('skips malformed, future, objective and unsupported records while keeping valid measurements',()=>{
    const rows=[null,{},record(1,{category:2}),record(2,{date:now/1000+1}),record(3,{id:'../bad'}),record(4,{measures:[{type:76,value:70000,unit:-3}]}),record(5,{measures:[{type:1,value:Infinity,unit:-3}]}),record(6)]
    expect(withingsRecords(rows,now).map(r=>r.id)).toEqual(['withings:6'])
    expect(()=>withingsRecords({},now)).toThrow('Invalid scale response')
  })
  it('does not relabel generic fat-free or muscle mass as skeletal muscle',()=>{
    const state=base();mergeScaleRecords(state,[record(1,{measures:[{type:1,value:80000,unit:-3},{type:5,value:64000,unit:-3},{type:76,value:30000,unit:-3}]})],now)
    expect(state.inbody).toEqual([]);expect(state.bodyweight[0].w).toBe(80)
  })
  it('imports weight and body composition into their existing histories without changing other data',()=>{
    const state=base(),previous=structuredClone(state);expect(mergeScaleRecords(state,[record()],now)).toEqual({added:1,updated:0,unchanged:0})
    expect(state.bodyweight[0]).toMatchObject({w:80,unit:'kg',samples:[{id:'withings:10',w:80}]})
    expect(state.inbody[0]).toMatchObject({weight:80,bodyFatPct:20.5,bodyFatMass:16.4})
    for(const key of ['measurements','workouts','routines','active'])expect(state[key]).toEqual(previous[key])
    const saved=structuredClone(state);expect(mergeScaleRecords(state,[record()],now)).toEqual({added:0,updated:0,unchanged:1});expect(state).toEqual(saved)
  })
  it('averages provider readings with existing manual samples and revises provider IDs without duplication',()=>{
    const state=base();state.bodyweight=[{d:'2026-11-03',w:78,t:time-60000}]
    mergeScaleRecords(state,[record()],now);expect(state.bodyweight[0].w).toBe(79);expect(state.bodyweight[0].samples).toHaveLength(2)
    mergeScaleRecords(state,[record(10,{measures:[{type:1,value:82000,unit:-3}]})],now);expect(state.bodyweight[0].w).toBe(80);expect(state.bodyweight[0].samples).toHaveLength(2);expect(state.bodyweight[0].samples[0].w).toBe(78)
  })
  it('normalizes affected daily and sample unit stamps before averaging; fat mass stays canonical kg',()=>{
    const state=base();state.unit='lb';state.bodyweight=[{d:'2026-11-03',unit:'kg',w:78,samples:[{w:78,unit:'kg'}]},{d:'2026-11-01',w:150,unit:'lb'}]
    mergeScaleRecords(state,[record()],now)
    expect(state.bodyweight[1].w).toBeCloseTo(Math.round(79*LB_PER_KG*10)/10);expect(state.bodyweight[1].unit).toBe('lb')
    expect(state.bodyweight[1].samples[0].w).toBeCloseTo(78*LB_PER_KG);expect(state.bodyweight[0]).toEqual({d:'2026-11-01',w:150,unit:'lb'})
    expect(state.inbody[0]).toMatchObject({weight:80,bodyFatMass:16.4})
  })
  it('moves a revised provider date without losing manual readings on the old date',()=>{
    const state=base();state.bodyweight=[{d:'2026-11-03',w:78,samples:[{w:78}]}];mergeScaleRecords(state,[record()],now)
    mergeScaleRecords(state,[record(10,{date:(time+86400000)/1000})],now)
    expect(state.bodyweight).toHaveLength(2);expect(state.bodyweight[0].w).toBe(78);expect(state.bodyweight[0].samples).toHaveLength(1);expect(state.bodyweight[1].w).toBe(80)
  })
  it('records available height using the existing display-unit contract without overwriting manual same-day/newer data',()=>{
    const state=base();state.measurementUnit='in';const height=record(1,{measures:[{type:4,value:1850,unit:-3}]})
    mergeScaleRecords(state,[height],now);expect(state.heightCm).toBeCloseTo(185/2.54);expect(state.heightHistory[0].cm).toBeCloseTo(185)
    state.heightCm=190/2.54;state.heightHistory[0].cm=190
    mergeScaleRecords(state,[height],now);expect(state.heightCm).toBeCloseTo(190/2.54)
  })
})
