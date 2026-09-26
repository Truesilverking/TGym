// @vitest-environment happy-dom
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { rasterizeReport, buildCalendarExport } from './CalendarExport.jsx'
vi.mock('../lib/i18n.js',()=>({t:s=>s}))
vi.mock('jspdf',()=>({jsPDF:class { addPage() {} addImage(data,type) { if(type!=='JPEG') throw Error('PDF must use compact images') } output() {return new Blob(['%PDF-test'],{type:'application/pdf'})} }}))
let canvases, create
beforeEach(()=>{
 canvases=[];create=document.createElement.bind(document)
 vi.spyOn(document,'createElement').mockImplementation(tag=>{
  const node=create(tag)
  if(tag==='canvas') {node.getContext=()=>({drawImage:vi.fn()});node.toDataURL=vi.fn(mime=>'data:'+mime+';base64,eA==');canvases.push(node)}
  return node
 })
 vi.stubGlobal('Image',class { set src(value) { queueMicrotask(()=>this.onload()) } })
 vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:test');vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{})
})
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals()})
it('builds calendar and progress PDF pages and releases every canvas allocation',async()=>{
 const file=await buildCalendarExport({},new Date('2026-09-23T12:00:00'),'full','pdf')
 expect(file.name).toBe('TGym-Consistency-Report-2026.pdf');expect(file.blob.type).toBe('application/pdf')
 expect(canvases.length).toBeGreaterThan(4);expect(canvases.every(c=>c.width===0 && c.height===0)).toBe(true)
 expect(URL.revokeObjectURL).toHaveBeenCalledTimes(canvases.length)
})
it('keeps PNG quality and releases allocations when encoding fails',async()=>{
 await rasterizeReport({svg:'<svg/>',width:100,height:100})
 expect(canvases[0].toDataURL).toHaveBeenCalledWith('image/png',0.92)
 vi.spyOn(document,'createElement').mockImplementation(tag=>{const c=create(tag);c.getContext=()=>null;canvases.push(c);return c})
 await expect(rasterizeReport({svg:'<svg/>',width:100,height:100})).rejects.toThrow('Canvas unavailable')
 expect(canvases.at(-1).width).toBe(0);expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
})
