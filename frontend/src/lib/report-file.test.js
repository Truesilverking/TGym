// @vitest-environment happy-dom
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { reportPagesFile, saveReportFile, saveReportBatch, rasterizeReport } from './report-file.js'
import { buildProgressFile } from './progress-file.js'
import { buildProgressReport } from './progress-report.js'
import { PROGRESS_SECTIONS } from './progress-sections.js'

const mock = vi.hoisted(() => ({ documents: [], share: vi.fn(), mobile: false, geometry: vi.fn(async () => ({})) }))
vi.mock('./mobile.js', () => ({ get MOBILE() { return mock.mobile }, shareBase64: (...args) => mock.share(...args), shareReportFiles: (...args) => mock.share(...args) }))
vi.mock('./body-geometry.js', () => ({ loadBodyGeometry: () => mock.geometry() }))
vi.mock('jspdf', () => ({ jsPDF: class {
  constructor() { this.images = []; this.pages = 1; mock.documents.push(this) }
  setProperties(properties) { this.properties = properties }
  addPage() { this.pages++ }
  addImage(...args) { this.images.push(args) }
  output() { return new Blob([JSON.stringify({ pages: this.pages, images: this.images, properties: this.properties })], { type: 'application/pdf' }) }
} }))
const page = { svg: '<svg/>', width: 1000, height: 1390 }
beforeEach(() => {
  mock.documents.length = 0; mock.mobile = false; mock.geometry.mockClear(); mock.share.mockReset()
  const create = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation(tag => {
    const node = create(tag)
    if (tag === 'canvas') { node.getContext = () => ({ drawImage: vi.fn() }); node.toDataURL = mime => 'data:' + mime + ';base64,eA==' }
    return node
  })
  vi.stubGlobal('Image', class { set src(value) { queueMicrotask(() => this.onload()) } })
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:report')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })

it('keeps sequential independent files separate with proportional page fitting', async () => {
  const calendar = await reportPagesFile([page, page], 'calendar.pdf', { imageType: 'JPEG' })
  const progress = await reportPagesFile([page], 'progress.pdf', { fullPage: true, title: 'TGym Progress Report' })
  expect(calendar.name).toBe('calendar.pdf'); expect(progress.name).toBe('progress.pdf')
  expect(calendar.blob.size).toBeGreaterThan(0); expect(progress.blob.size).toBeGreaterThan(0)
  expect(mock.documents.map(d => d.pages)).toEqual([2, 1])
  expect(mock.documents.map(d => d.images.map(i => i[1]))).toEqual([['JPEG', 'JPEG'], ['PNG']])
  expect(mock.documents[1].properties.title).toBe('TGym Progress Report')
  const [, , x, y, w, h] = mock.documents[1].images[0]
  expect(x).toBe(0); expect(y).toBe(0); expect(w / h).toBeCloseTo(page.width / page.height)
})
it('preserves each report page image format and margins inside one combined PDF', async () => {
  const inset={svg:'<svg/>',width:800,height:1000,imageType:'JPEG',fullPage:false}
  const full={svg:'<svg/>',width:1000,height:1390,imageType:'PNG',fullPage:true}
  const inherited={svg:'<svg/>',width:1000,height:1390}
  const file=await reportPagesFile([inset,full,inherited],'reports.pdf',{imageType:'JPEG',fullPage:false,title:'TGym Reports'})
  expect(file.blob.type).toBe('application/pdf');expect(mock.documents).toHaveLength(1)
  const pdf=mock.documents[0]
  expect(pdf.pages).toBe(3);expect(pdf.images.map(args=>args[1])).toEqual(['JPEG','PNG','JPEG'])
  expect(pdf.properties.title).toBe('TGym Reports')
  const [, , insetX,insetY,insetW,insetH]=pdf.images[0]
  expect(insetX).toBe(10);expect(insetY).toBe(10);expect(insetW).toBe(190);expect(insetH).toBe(237.5)
  const [, , fullX,fullY,fullW,fullH]=pdf.images[1]
  expect(fullX).toBe(0);expect(fullY).toBe(0);expect(fullW).toBe(210);expect(fullH).toBe(291.9)
  expect(fullW/fullH).toBeCloseTo(full.width/full.height)
  expect(pdf.images[2][3]).toBe(10)
})
it('produces PNG bytes and rejects empty or unsupported files', async () => {
  const file = await reportPagesFile([page], 'calendar.png', { format: 'png' })
  expect(file.blob.type).toBe('image/png'); expect(file.blob.size).toBeGreaterThan(0)
  await expect(reportPagesFile([], 'empty.pdf')).rejects.toThrow('Empty report')
  await expect(reportPagesFile([page, page], 'partial.png', { format: 'png' })).rejects.toThrow('PNG requires one page')
  await expect(reportPagesFile([page], 'wrong.csv', { format: 'csv' })).rejects.toThrow('Invalid report format')
})
it.each(['overview', 'consistency', 'duration', 'routines', 'performance', 'body', 'inbody', 'trends'])('builds a correctly named %s-only progress file and loads body assets only when needed', async section => {
  const report = buildProgressReport({ workouts: [] }, { now: new Date('2026-09-26T12:00:00') })
  const file = await buildProgressFile(report, { sections: [section, section, 'invalid'] })
  expect(file.name).toBe(`TGym-Progress-Report-${report.range.start}_${report.range.end}-${section}.pdf`)
  expect(file.blob.type).toBe('application/pdf'); expect(file.blob.size).toBeGreaterThan(0)
  expect(mock.geometry).toHaveBeenCalledTimes(section === 'body' ? 1 : 0)
  expect(mock.documents).toHaveLength(1); expect(mock.documents[0].pages).toBe(1)
})
it('rejects empty section selections before loading assets or allocating a PDF', async () => {
  const report = buildProgressReport({ workouts: [] })
  await expect(buildProgressFile(report, { sections: [] })).rejects.toThrow('Select at least one section.')
  expect(mock.geometry).not.toHaveBeenCalled(); expect(mock.documents).toHaveLength(0)
})
it('builds independent nonempty files for every one of the 255 section combinations', async () => {
  const report = buildProgressReport({ workouts: [] }), ids = PROGRESS_SECTIONS.map(([id]) => id)
  for (let mask = 1; mask < 256; mask++) {
    const sections = ids.filter((_, i) => mask & (1 << i))
    const file = await buildProgressFile(report, { sections })
    const suffix = sections.length === 1 ? '-' + sections[0] : sections.length < ids.length ? '-selected' : ''
    expect(file.name).toBe(`TGym-Progress-Report-${report.range.start}_${report.range.end}${suffix}.pdf`)
    expect(file.blob.size).toBeGreaterThan(0); expect(file.blob.type).toBe('application/pdf')
    expect(mock.documents.at(-1).images.length).toBe(mock.documents.at(-1).pages)
  }
  expect(mock.documents).toHaveLength(255)
  expect(mock.geometry).toHaveBeenCalledTimes(128)
})
it.each(['text/html;charset=utf-8', 'text/csv;charset=utf-8'])('preserves UTF-8 text when saving %s through the native binary adapter', async type => {
  mock.mobile = true
  const text = 'caf\u00e9,\u00f1\r\n', blob = new Blob([text], { type })
  await saveReportFile({ blob, name: 'report.txt' })
  const bytes = Uint8Array.from(atob(mock.share.mock.calls[0][0]), c => c.charCodeAt(0))
  expect(new TextDecoder().decode(bytes)).toBe(text)
})
it('releases an SVG URL when image decoding fails', async () => {
  vi.stubGlobal('Image', class { set src(value) { queueMicrotask(() => this.onerror(new Error('Decode failed'))) } })
  await expect(rasterizeReport(page)).rejects.toThrow('Decode failed')
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:report')
})
it('preserves browser Share/save and direct Download as distinct actions', async () => {
  const share = vi.fn().mockResolvedValue(undefined), click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  vi.stubGlobal('navigator', { canShare: () => true, share })
  const file = { blob: new Blob(['binary'], { type: 'application/pdf' }), name: 'report.pdf', url: 'blob:existing' }
  await saveReportFile(file, { share: true }); expect(share).toHaveBeenCalledOnce(); expect(click).not.toHaveBeenCalled()
  await saveReportFile(file); expect(click).toHaveBeenCalledOnce(); expect(document.querySelector('a')).toBeNull()
})
it.each([
  ['routines.json', 'application/json'],
  ['routines.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ['routines.pdf', 'application/pdf']
])('downloads %s directly even when the browser advertises a failing share service', async (name, type) => {
  const canShare = vi.fn(() => true), share = vi.fn().mockRejectedValue(new DOMException('Windows share failed', 'DataError'))
  vi.stubGlobal('navigator', { canShare, share })
  const downloads = []
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { downloads.push({ name: this.download, href: this.href }) })
  const blob = new Blob([Uint8Array.of(0, 80, 75, 255)], { type })
  await saveReportFile({ blob, name })
  expect(downloads).toEqual([{ name, href: 'blob:report' }])
  expect(URL.createObjectURL).toHaveBeenCalledWith(blob)
  expect(canShare).not.toHaveBeenCalled(); expect(share).not.toHaveBeenCalled()
  expect(document.querySelector('a')).toBeNull()
})
it('keeps direct routine downloads on the native binary sharing path in Capacitor', async () => {
  mock.mobile = true
  const bytes = Uint8Array.of(80, 75, 3, 4, 0, 255, 128)
  await saveReportFile({ blob: new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), name: 'routines.xlsx' })
  const [base64, name] = mock.share.mock.calls[0]
  expect(name).toBe('routines.xlsx')
  expect(Uint8Array.from(atob(base64), char => char.charCodeAt(0))).toEqual(bytes)
})
it('releases temporary download URLs after download and preserves caller-owned preview URLs', async () => {
  vi.useFakeTimers(); vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  const file = { blob: new Blob(['data']), name: 'report.html' }
  await saveReportFile(file); expect(URL.revokeObjectURL).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1000); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:report')
  URL.revokeObjectURL.mockClear()
  await saveReportFile({ ...file, url: 'blob:preview' }); await vi.advanceTimersByTimeAsync(1000)
  expect(URL.revokeObjectURL).not.toHaveBeenCalled()
})

it('keeps native batch bytes independent and opens a single share sheet',async()=>{
 mock.mobile=true
 await saveReportBatch([{name:'streak.pdf',blob:new Blob(['streak'])},{name:'stats.html',blob:new Blob(['<h1>Stats</h1>'])}])
 expect(mock.share).toHaveBeenCalledOnce()
 const files=mock.share.mock.calls[0][0]
 expect(files.map(f=>f.name)).toEqual(['streak.pdf','stats.html'])
 expect(atob(files[0].base64)).toBe('streak');expect(atob(files[1].base64)).toBe('<h1>Stats</h1>')
})
