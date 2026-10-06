// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest'
import { REPORT_EXPORTS, buildReportFile, buildSelectedReports, saveSelectedReports, selectedReports } from './report-exports.js'
vi.mock('./i18n.js',()=>({t:s=>s,exerciseNameFor:e=>e.n||e.id,getLang:()=> 'en',dateLocale:()=> 'en'}))
vi.mock('./report-file.js',()=>({reportPagesFile:async(pages,name)=>({name,blob:new Blob(pages.map(p=>p.svg))}),saveReportFile:vi.fn(),saveReportBatch:vi.fn()}))
vi.mock('./progress-file.js',()=>({buildProgressFile:async report=>({name:'progress.pdf',blob:new Blob([JSON.stringify(report)])})}))
const S={routines:[],workouts:[],bodyweight:[{d:'2026-10-01',w:70}],unit:'kg'},now=new Date('2026-10-05T12:00:00')
it('keeps Streak and Consistency separate even when exported together',async()=>{
 const files=await buildSelectedReports(S,['streak','consistency'],{streak:{period:'last-week'},consistency:{period:'month'}},{now})
 expect(files.map(f=>f.name)).toEqual(['TGym-Streak-2026-09-28_2026-10-04.pdf','TGym-Consistency-2026-10.pdf'])
 expect(await files[0].blob.text()).not.toContain('Consistency Report');expect(await files[1].blob.text()).not.toContain('Streak Report')
})
it('generates only selected formats, preserves Progress/History filters and complete backup scope',async()=>{
 const ids=['progress','stats','history','plan','backup'],settings={progress:{period:'custom',from:'2026-10-01',to:'2026-10-02'},history:{query:'absent',period:'30'}}
 const files=await buildSelectedReports(S,ids,settings,{now})
 expect(files).toHaveLength(5);expect(JSON.parse(await files[0].blob.text()).range).toMatchObject({start:'2026-10-01',end:'2026-10-02'})
 expect(await files[1].blob.text()).not.toContain('Progress Report')
 expect((await files[2].blob.text()).split('\r\n')).toHaveLength(1)
 expect(JSON.parse(await files[3].blob.text())).not.toHaveProperty('bodyweight')
 expect(JSON.parse(await files[4].blob.text()).data.bodyweight).toEqual(S.bodyweight)
})
it('checks every nonempty report combination, order, duplicates and independent saving',async()=>{
 const ids=REPORT_EXPORTS.map(([id])=>id)
 for(let mask=1;mask<2**ids.length;mask++) {
  const choice=ids.filter((_,i)=>mask&(1<<i)),build=vi.fn(async id=>({name:id+'.txt',blob:new Blob([id])})),save=vi.fn()
  const files=await buildSelectedReports(S,[...choice,...choice,'unknown'],{}, {now},build)
  expect(build.mock.calls.map(c=>c[0])).toEqual(choice)
  await saveSelectedReports(files,choice,save)
  expect(save.mock.calls.map(c=>c[0].id)).toEqual(choice)
  expect(new Set(files.map(f=>f.name)).size).toBe(choice.length)
 }
 expect(selectedReports([])).toEqual([]);await expect(buildSelectedReports(S,[],{},{})).rejects.toThrow('Select at least one report.')
 await expect(buildReportFile('unknown',S)).rejects.toThrow('Unknown report')
})
it('retains independent retry status on failure and cancellation',async()=>{
 const files=['streak','consistency','history'].map(id=>({id,name:id,blob:new Blob([id])})),save=vi.fn().mockResolvedValueOnce().mockRejectedValueOnce(Error('disk')).mockRejectedValueOnce(Object.assign(Error('cancel'),{name:'AbortError'}))
 expect(await saveSelectedReports(files,files.map(f=>f.id),save)).toEqual([{id:'streak',status:'saved'},{id:'consistency',status:'failed'},{id:'history',status:'canceled'}])
 save.mockClear();await saveSelectedReports(files,['consistency'],save);expect(save).toHaveBeenCalledOnce();expect(save.mock.calls[0][0].id).toBe('consistency')
})
