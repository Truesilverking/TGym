import { expect, it, vi } from 'vitest'
const { writeFile } = vi.hoisted(()=>({writeFile:vi.fn()}))
vi.mock('@capacitor/filesystem',()=>({Filesystem:{writeFile},Directory:{Data:'DATA'},Encoding:{UTF8:'utf8'}}))
import { nativeSave } from './mobile.js'

it('serializes native writes so a slow old snapshot cannot replace a paused clock', async()=>{
  let release
  writeFile.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve})).mockResolvedValue(undefined)
  const first=nativeSave({active:{start:0}})
  const paused={active:{start:0,timerPausedAt:72*60000}}
  const second=nativeSave(paused)
  paused.active.timerPausedAt=99*60000
  await vi.waitFor(()=>expect(writeFile).toHaveBeenCalledTimes(1))
  release()
  await Promise.all([first,second])
  expect(writeFile).toHaveBeenCalledTimes(2)
  expect(JSON.parse(writeFile.mock.calls[1][0].data).active.timerPausedAt).toBe(72*60000)
})

it('reports storage failure without poisoning subsequent queued saves',async()=>{
 writeFile.mockRejectedValueOnce(new Error('full')).mockResolvedValueOnce(undefined)
 expect(await nativeSave({inbody:[{id:'a',image:'photo'}]})).toBe(false)
 expect(await nativeSave({inbody:[{id:'a',image:'photo'}]})).toBe(true)
})

it('reuses a confirmed immutable serialization and retains snapshot-at-call behavior for other callers',async()=>{
 writeFile.mockClear();writeFile.mockResolvedValue(undefined)
 const state={active:{id:'cached',start:0},customEx:[{id:'custom',img:'data:image/gif;base64,large'}]}
 const confirmed=JSON.stringify(state),stringify=vi.spyOn(JSON,'stringify')
 try{
  await nativeSave(state,confirmed)
  expect(stringify.mock.calls.some(([value])=>value===state)).toBe(false)
  expect(writeFile.mock.calls[0][0].data).toBe(confirmed)
  const next={...state,active:{...state.active,timerPausedAt:100}}
  const pending=nativeSave(next);next.active.timerPausedAt=200
  await pending
  expect(stringify.mock.calls.some(([value])=>value===next)).toBe(true)
  expect(JSON.parse(writeFile.mock.calls[1][0].data).active.timerPausedAt).toBe(100)
 }finally{stringify.mockRestore()}
})
