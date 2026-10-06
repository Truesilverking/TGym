// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest'
import { REPORT_EXPORTS, PDF_REPORT_EXPORTS, buildDashboardReports, buildReportFile, buildSelectedReports, saveSelectedReports, selectedReports } from './report-exports.js'
import { reportPagesFile } from './report-file.js'
vi.mock('./i18n.js',()=>({t:s=>s,exerciseNameFor:e=>e.n||e.id,getLang:()=> 'en',dateLocale:()=> 'en'}))
vi.mock('./report-file.js',()=>({reportPagesFile:vi.fn(async(pages,name)=>({name,blob:new Blob(pages.map(p=>p.svg),{type:'application/pdf'})})),saveReportFile:vi.fn(),saveReportBatch:vi.fn()}))
vi.mock('./progress-file.js',()=>({buildProgressFile:async report=>({name:'progress.pdf',blob:new Blob([JSON.stringify(report)])}),buildProgressPages:async report=>[{svg:'<svg><text>Progress Report</text><text>'+JSON.stringify(report)+'</text></svg>',width:1000,height:1390}]}))
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

it('combines only selected dashboard pages in catalog order for every nonempty PDF selection',async()=>{
 const ids=PDF_REPORT_EXPORTS.map(([id])=>id),before=structuredClone(S),count=reportPagesFile.mock.calls.length
 expect(ids).toEqual(['streak','consistency','progress','stats'])
 for(let mask=1;mask<2**ids.length;mask++){
  const selected=ids.filter((_,i)=>mask&(1<<i)),settings=Object.fromEntries(selected.map(id=>[id,{sentinel:id}])),options={now}
  const build=vi.fn(async id=>[0,1].map(i=>({svg:`<svg><text>${id}_PAGE_${i}</text></svg>`,width:1000,height:1390})))
  const files=await buildDashboardReports(S,[...selected].reverse().concat(selected,'history','plan','backup','unknown'),settings,options,build)
  expect(build.mock.calls.map(call=>call[0])).toEqual(selected)
  for(const [id,state,filters,receivedOptions] of build.mock.calls){expect(state).toBe(S);expect(filters).toBe(settings[id]);expect(receivedOptions).toBe(options)}
  expect(files).toHaveLength(1);expect(files[0].id).toBe('reports');expect(files[0].reportIds).toEqual(selected)
  expect(files[0].name).toMatch(/^TGym-Reports-2026-10-05(?:-[a-z]+)?\.pdf$/)
  expect(files[0].blob.type).toBe('application/pdf')
  const text=await files[0].blob.text()
  expect([...text.matchAll(/(streak|consistency|progress|stats)_PAGE_\d/g)].map(match=>match[0])).toEqual(selected.flatMap(id=>[`${id}_PAGE_0`,`${id}_PAGE_1`]))
  for(const id of ids.filter(id=>!selected.includes(id)))expect(text).not.toContain(`${id}_PAGE_`)
  for(const format of ['.html','.csv','.json'])expect(files[0].name).not.toContain(format)
 }
 expect(reportPagesFile.mock.calls.length-count).toBe(15)
 expect(S).toEqual(before)
})

it('routes combined selection through the existing Streak and Consistency page builders',async()=>{
 const files=await buildSelectedReports(S,['consistency','streak'],{streak:{period:'last-week'},consistency:{period:'month'}},{now,combinePDF:true})
 expect(files).toHaveLength(1);expect(files[0].reportIds).toEqual(['streak','consistency'])
 const text=await files[0].blob.text()
 expect(text).toContain('Streak Report');expect(text).toContain('Consistency Report')
 expect(text).not.toContain('Progress Report');expect(text).not.toContain('Body measurements')
})

it('saves a combined PDF once, preserves canceled status and retries only with every original report ID',async()=>{
 const file={id:'reports',reportIds:['streak','stats'],name:'reports.pdf',blob:new Blob(['pdf'],{type:'application/pdf'})}
 const save=vi.fn().mockRejectedValueOnce(Object.assign(Error('cancel'),{name:'AbortError'})).mockResolvedValueOnce()
 expect(await saveSelectedReports([file],['streak','stats'],save)).toEqual([{id:'reports',status:'canceled'}])
 expect(save).toHaveBeenCalledOnce();expect(save.mock.calls[0][0]).toBe(file)
 expect(await saveSelectedReports([file],['streak'],save)).toEqual([])
 expect(save).toHaveBeenCalledOnce()
 expect(await saveSelectedReports([file],['stats','streak','stats'],save)).toEqual([{id:'reports',status:'saved'}])
 expect(save).toHaveBeenCalledTimes(2);expect(save.mock.calls[1][0]).toBe(file)
})

it('rejects empty report choices or invalid empty Stats content before packaging partial pages',async()=>{
 const count=reportPagesFile.mock.calls.length,build=vi.fn(async(id,state,settings)=>{
  if(id==='stats'&&!settings.sections.length)throw Error('Select at least one section.')
  return [{svg:'<svg/>',width:1000,height:1390}]
 })
 await expect(buildDashboardReports(S,['streak','stats'],{stats:{sections:[]}},{now},build)).rejects.toThrow('Select at least one section.')
 expect(build.mock.calls.map(call=>call[0])).toEqual(['streak','stats'])
 expect(reportPagesFile.mock.calls.length).toBe(count)
 build.mockClear()
 await expect(buildDashboardReports(S,[],{}, {now},build)).rejects.toThrow('Select at least one report.')
 await expect(buildDashboardReports(S,['backup','history','plan'],{}, {now},build)).rejects.toThrow('Select at least one report.')
 expect(build).not.toHaveBeenCalled()
 expect(reportPagesFile.mock.calls.length).toBe(count)
})
