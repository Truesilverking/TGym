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
