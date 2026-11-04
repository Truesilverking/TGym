// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest'
import { shareReportFiles } from './mobile.js'
const mock=vi.hoisted(()=>({write:vi.fn(async({path})=>({uri:'file://cache/'+path})),share:vi.fn()}))
vi.mock('@capacitor/filesystem',()=>({Filesystem:{writeFile:(...args)=>mock.write(...args)},Directory:{Cache:'cache'}}))
vi.mock('@capacitor/share',()=>({Share:{share:(...args)=>mock.share(...args)}}))
it('writes separate native files and opens one share sheet with all URIs',async()=>{
 await shareReportFiles([{name:'streak.pdf',base64:'c3RyZWFr'},{name:'consistency.pdf',base64:'Y29uc2lzdGVuY3k='}])
 expect(mock.write.mock.calls.map(c=>c[0])).toEqual([{path:'streak.pdf',directory:'cache',data:'c3RyZWFr'},{path:'consistency.pdf',directory:'cache',data:'Y29uc2lzdGVuY3k='}])
 expect(mock.share).toHaveBeenCalledOnce();expect(mock.share.mock.calls[0][0].files).toEqual(['file://cache/streak.pdf','file://cache/consistency.pdf'])
})
