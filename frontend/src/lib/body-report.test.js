import bodyGeometry from './body-paths.js'
import { describe,it,expect } from 'vitest'
import { bodyRecords,compareBody } from './body-report.js'
import { buildProgressReport } from './progress-report.js'
import { progressReportPages } from './progress-export.js'
const range={start:'2026-01-01',end:'2026-09-27'}
describe('body dashboard projection',()=>{
 it('normalizes units, preserves dates/legacy sides and never mutates history',()=>{
  const S={measurementUnit:'cm',measurements:[{d:'2026-01-01',unit:'in',arm:10},{d:'2026-08-01',armLeft:27,armRight:25}]},old=structuredClone(S)
  const rows=bodyRecords(S,range),c=compareBody(rows)
  expect(c.metrics.find(m=>m.key==='armLeft').delta).toBeCloseTo(1.6)
  expect(c.metrics.find(m=>m.key==='armRight').delta).toBeCloseTo(-.4)
  expect(c.increase.key).toBe('armLeft');expect(c.decrease.key).toBe('armRight');expect(S).toEqual(old)
 })
 it('uses exact chosen rows, not the last nonmissing value from a different date',()=>{
  const rows=bodyRecords({measurements:[{d:'2026-01-01',neck:30,waist:90},{d:'2026-02-01',neck:31},{d:'2026-03-01',neck:32,waist:88}]},range)
  const c=compareBody(rows,'0','1'),waist=c.metrics.find(m=>m.key==='waist')
  expect(waist.last).toBeNull();expect(waist.delta).toBeNull();expect(c.after.d).toBe('2026-02-01')
  expect(c.metrics.find(m=>m.key==='neck').percent).toBeCloseTo(100/30)
 })
 it('handles empty/single/same-date/incomplete/unchanged/invalid records conservatively',()=>{
  expect(compareBody([]).metrics).toEqual([])
  const rows=bodyRecords({measurements:[{d:'invalid',neck:30},{d:'2026-01-01',neck:30,waist:null},{d:'2026-02-01',neck:30.02},{d:'2027-01-01',neck:40}]},range)
  expect(rows).toHaveLength(2);expect(compareBody(rows,'1','1').metrics[0].delta).toBeNull()
  expect(compareBody(rows).stable).toHaveLength(1)
  expect(compareBody(rows.slice(0,1)).metrics[0].delta).toBeNull()
 })
 it('keeps same-date entries distinct and period boundaries consistent',()=>{
  const rows=bodyRecords({measurements:[{d:'2025-12-31',neck:20},{d:'2026-01-01',neck:30},{d:'2026-01-01',neck:31}]},range)
  expect(rows.map(r=>r.id)).toEqual(['1','2']);expect(compareBody(rows).days).toBe(0)
 })
})
describe('selected PDF sections',()=>{
 const S={measurements:[{d:'2026-01-01',neck:30,waist:90},{d:'2026-03-01',neck:32,waist:89},{d:'2026-09-01',neck:36,waist:87}]}
 const report=()=>buildProgressReport(S,{now:new Date('2026-09-27T12:00:00')})
 it('exports one section with its exact body comparison and a static model',()=>{
  const svg=progressReportPages(null,{report:report(),sections:['body'],bodyGeometry,bodySelection:{before:'0',after:'1'}}).map(p=>p.svg).join('')
  expect(svg).toContain('Body Progress');expect(svg).toContain('32 cm');expect(svg).not.toContain('36 cm')
  expect(svg).toContain('2026-03-01');expect(svg).toContain('<path');expect(svg).not.toContain('Training consistency')
 })
 it('exports multiple selected sections, rejects none and labels empty sections correctly',()=>{
  const svg=progressReportPages(null,{report:report(),sections:['duration','inbody']}).map(p=>p.svg).join('')
  expect(svg).toContain('Workout duration');expect(svg).toContain('InBody history');expect(svg).not.toContain('Body Progress')
  expect(()=>progressReportPages(null,{report:report(),sections:[]})).toThrow()
 })
})
