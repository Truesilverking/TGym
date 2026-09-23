import { expect, it } from 'vitest'
import { upsertBodyRecord, parseMetrics, validMeasurementDate } from './body-records.js'
it('edits dates without losing same-day records or image associations',()=>{
 const rows=[{id:'a',d:'2026-09-01',image:'data:image/jpeg;base64,AA',legacy:42},{id:'b',d:'2026-09-02',image:'other'}]
 const edited=upsertBodyRecord(rows,{id:'a',d:'2026-09-02',weight:80})
 expect(edited).toHaveLength(2)
 expect(edited.find(r=>r.id==='a')).toMatchObject({image:rows[0].image,legacy:42,weight:80})
 expect(rows[0].d).toBe('2026-09-01')
 expect(upsertBodyRecord(edited,{id:'c',d:'2026-09-02'})).toHaveLength(3)
})
it('preserves legacy fields and attaches an ID when editing a legacy record',()=>{
 const result=upsertBodyRecord([{d:'2026-01-01',image:'photo',arm:30}],{id:'new',d:'2026-01-02'},0)
 expect(result).toEqual([{id:'new',d:'2026-01-02',image:'photo',arm:30}])
 expect(upsertBodyRecord(result,{id:'new',d:'2026-01-02'},0)).toHaveLength(1)
})
it('rejects invalid dates, signed/pasted junk, infinity and invalid percentages',()=>{
 for(const d of ['', '2026-99-01','2026-02-30','2027-01-01']) expect(validMeasurementDate(d,'2026-09-23')).toBe(false)
 expect(validMeasurementDate('2026-09-23','2026-09-23')).toBe(true)
 for(const v of ['-20','Infinity','1e8','101','0']) expect(parseMetrics({bodyFatPct:v},[['bodyFatPct']])).toBeNull()
 expect(parseMetrics({weight:'80,2',bmi:''},[['weight'],['bmi']])).toEqual({weight:80.2,bmi:null})
})
