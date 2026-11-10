import { beforeEach, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({
  platform:'android', isNative:true, read:vi.fn(), begin:vi.fn(), append:vi.fn(), commit:vi.fn(), abort:vi.fn(), readClock:vi.fn(), writeClock:vi.fn(),
  writeFile:vi.fn(), readFile:vi.fn(),
}))
vi.mock('@capacitor/core', () => ({
  Capacitor:{isNativePlatform:()=>mock.isNative,getPlatform:()=>mock.platform},
  registerPlugin:()=>mock,
}))
vi.mock('@capacitor/filesystem', () => ({
  Filesystem:{writeFile:mock.writeFile,readFile:mock.readFile},Directory:{Data:'DATA'},Encoding:{UTF8:'utf8'},
}))
import { readProfileSnapshot, writeProfileSnapshot, readProfileClockJournal, profileClockJournalAvailable } from './native-profile-snapshot.js'
import { nativeLoad, nativeSave, nativeSaveClockJournal } from './mobile.js'

beforeEach(() => {
  vi.resetAllMocks();mock.platform='android';mock.isNative=true
  mock.begin.mockResolvedValue({token:'lease'})
  mock.append.mockResolvedValue({});mock.commit.mockResolvedValue({});mock.abort.mockResolvedValue({})
  mock.readClock.mockResolvedValue({journal:null});mock.writeClock.mockResolvedValue({saved:true})
})

it('keeps Android chunks within16Ki UTF-16 units and48KiB without changing Unicode or BOM text',async()=>{
  const data='a'.repeat(65533)+'🏋️'+'漢'.repeat(30000)+'\uFEFF'+'b'.repeat(65536)+'\uFEFFtail'
  await writeProfileSnapshot(data)
  const chunks=mock.append.mock.calls.map(([call])=>call)
  expect(chunks.length).toBeGreaterThan(3)
  expect(chunks.map(chunk=>chunk.data).join('')).toBe(data)
  expect(chunks.every(chunk=>chunk.data.length<=16384)).toBe(true)
  expect(chunks.every(chunk=>new TextEncoder().encode(chunk.data).length<=49152)).toBe(true)
  expect(chunks.map(chunk=>chunk.index)).toEqual(chunks.map((_,index)=>index))
  expect(chunks.every(chunk=>chunk.token==='lease')).toBe(true)
  expect(mock.begin).toHaveBeenCalledWith({characters:data.length})
  expect(mock.commit).toHaveBeenCalledWith({token:'lease'})
  expect(mock.abort).not.toHaveBeenCalled();expect(mock.writeFile).not.toHaveBeenCalled()
})

it('preserves a U+FEFF exactly at the start of the next string chunk',async()=>{
  const data='a'.repeat(16384)+'\uFEFFtail'
  await writeProfileSnapshot(data)
  expect(mock.append.mock.calls[1][0].data).toBe('\uFEFFtail')
})

it.each([16383,16382,16384])('keeps astral pairs whole around the chunk boundary after%s UTF-16 units',async prefix=>{
  const data='a'.repeat(prefix)+'\u{1f3cb}\ufe0f'+'\u6f22'.repeat(20000)
  await writeProfileSnapshot(data)
  const chunks=mock.append.mock.calls.map(([call])=>call.data)
  expect(chunks.join('')).toBe(data)
  for(const chunk of chunks){
    const first=chunk.charCodeAt(0),last=chunk.charCodeAt(chunk.length-1)
    expect(first>=0xdc00&&first<=0xdfff).toBe(false)
    expect(last>=0xd800&&last<=0xdbff).toBe(false)
    expect(chunk.length).toBeLessThanOrEqual(16384)
    expect(new TextEncoder().encode(chunk).length).toBeLessThanOrEqual(49152)
  }
})

it('streams a5MiB profile without constructing a full-profile text encoder or decoder',async()=>{
  const data=JSON.stringify({large:'x'.repeat(5*1024*1024)})
  const encode=vi.fn(function(){throw Error('Unexpected TextEncoder')})
  const decode=vi.fn(function(){throw Error('Unexpected TextDecoder')})
  vi.stubGlobal('TextEncoder',encode);vi.stubGlobal('TextDecoder',decode)
  try{await writeProfileSnapshot(data)}finally{vi.unstubAllGlobals()}
  expect(encode).not.toHaveBeenCalled();expect(decode).not.toHaveBeenCalled()
  expect(mock.begin).toHaveBeenCalledExactlyOnceWith({characters:data.length})
  const chunks=mock.append.mock.calls.map(([call])=>call.data)
  expect(chunks.join('')).toBe(data);expect(chunks.every(chunk=>chunk.length<=16384)).toBe(true)
  expect(mock.commit).toHaveBeenCalledExactlyOnceWith({token:'lease'})
  expect(mock.writeFile).not.toHaveBeenCalled()
})

it.each(['append','commit'])('aborts a failed %s without overwriting through the old filesystem path',async method=>{
  const failure=new Error('disk unavailable')
  mock[method].mockRejectedValueOnce(failure)
  await expect(writeProfileSnapshot('{"kept":"previous snapshot"}')).rejects.toBe(failure)
  expect(mock.abort).toHaveBeenCalledWith({token:'lease'})
  expect(mock.writeFile).not.toHaveBeenCalled()
  if(method==='append')expect(mock.commit).not.toHaveBeenCalled()
})

it('does not mask the original failure when a revoked lease cannot be aborted',async()=>{
  const failure=new Error('original write failed')
  mock.append.mockRejectedValueOnce(failure);mock.abort.mockRejectedValueOnce(new Error('stale lease'))
  await expect(writeProfileSnapshot('{}')).rejects.toBe(failure)
})

it('does not abort an unknown lease when begin itself fails',async()=>{
  mock.begin.mockRejectedValueOnce(new Error('cannot begin'))
  await expect(writeProfileSnapshot('{}')).rejects.toThrow('cannot begin')
  expect(mock.abort).not.toHaveBeenCalled();expect(mock.append).not.toHaveBeenCalled()
})

it('loads the unchanged legacy JSON shape through the Android recovery reader',async()=>{
  const state={_ts:123,active:{id:'keep',timerPausedAt:122},workouts:[{id:'history'}],customEx:[{id:'custom'}]}
  mock.read.mockResolvedValue({data:JSON.stringify(state)})
  expect(await nativeLoad()).toEqual(state)
  expect(mock.readFile).not.toHaveBeenCalled()
  mock.read.mockRejectedValueOnce(new Error('missing'))
  expect(await nativeLoad()).toBeNull()
})

it('reports failed native commits and permits the next queued snapshot to retry',async()=>{
  mock.commit.mockRejectedValueOnce(new Error('commit did not match'))
  expect(await nativeSave({value:'first'})).toBe(false)
  expect(await nativeSave({value:'second'})).toBe(true)
  expect(mock.begin).toHaveBeenCalledTimes(2)
  expect(mock.append.mock.calls.map(([call])=>JSON.parse(call.data).value)).toEqual(['first','second'])
})

it('finishes the older transaction before a later paused snapshot and captures data at call time',async()=>{
  let release
  mock.append.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve})).mockResolvedValue({})
  const old=nativeSave({active:{id:'session',start:1}})
  const next={active:{id:'session',start:1,timerPausedAt:72}}
  const paused=nativeSave(next)
  next.active.timerPausedAt=99
  await vi.waitFor(()=>expect(mock.append).toHaveBeenCalledOnce())
  expect(mock.begin).toHaveBeenCalledOnce();expect(mock.commit).not.toHaveBeenCalled()
  release({})
  expect(await old).toBe(true);expect(await paused).toBe(true)
  expect(mock.commit).toHaveBeenCalledTimes(2)
  expect(JSON.parse(mock.append.mock.calls[1][0].data).active.timerPausedAt).toBe(72)
})

it('uses the exact primary serialization on Android rather than reserializing the state',async()=>{
  const state={active:{id:'confirmed'},customEx:[{id:'asset',img:'unchanged'}]}
  const data=JSON.stringify(state),stringify=vi.spyOn(JSON,'stringify')
  try {
    expect(await nativeSave(state,data)).toBe(true)
    expect(stringify.mock.calls.some(([value])=>value===state)).toBe(false)
    expect(mock.append.mock.calls.map(([call])=>call.data).join('')).toBe(data)
  } finally { stringify.mockRestore() }
})

it.each(['ios','web'])('keeps the existing %s filesystem format and path',async platform=>{
  mock.platform=platform;mock.isNative=platform==='ios'
  mock.readFile.mockResolvedValue({data:'{"unchanged":true}'})
  await writeProfileSnapshot('{"unchanged":true}')
  expect(mock.writeFile).toHaveBeenCalledWith({path:'framegym-state.json',directory:'DATA',encoding:'utf8',data:'{"unchanged":true}'})
  expect(await readProfileSnapshot()).toBe('{"unchanged":true}')
  expect(mock.readFile).toHaveBeenCalledWith({path:'framegym-state.json',directory:'DATA',encoding:'utf8'})
  expect(mock.begin).not.toHaveBeenCalled()
})

it('does not wait for a suspended full-profile transaction to save the tiny clock journal',async()=>{
  let release
  mock.append.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve}))
  const pending=nativeSave({active:{id:'session',start:1}})
  await vi.waitFor(()=>expect(mock.append).toHaveBeenCalledOnce())
  const journal={id:'session',at:1000,_ts:2000}
  expect(await nativeSaveClockJournal(journal)).toBe(true)
  expect(mock.writeClock).toHaveBeenCalledWith(journal)
  expect(mock.commit).not.toHaveBeenCalled();expect(mock.writeFile).not.toHaveBeenCalled()
  release({});expect(await pending).toBe(true)
})

it('reports a failed tiny journal without falling back to overwriting the full profile',async()=>{
  mock.writeClock.mockRejectedValueOnce(new Error('journal disk full'))
  expect(await nativeSaveClockJournal({id:'session',at:1000,_ts:2000})).toBe(false)
  expect(mock.writeFile).not.toHaveBeenCalled();expect(mock.begin).not.toHaveBeenCalled()
})

it('merges native clock metadata without increasing whole-profile freshness or changing any history',async()=>{
  const now=Date.now(),state={_ts:now-1000,active:{id:'session',start:now-10000,lastUserInteractionAt:now-5000,entries:[]},workouts:[{id:'kept'}],unit:'lb'}
  mock.read.mockResolvedValue({data:JSON.stringify(state)})
  mock.readClock.mockResolvedValue({journal:{id:'session',at:now-100,_ts:now}})
  const restored=await nativeLoad()
  expect(restored._ts).toBe(state._ts);expect(restored.active.lastUserInteractionAt).toBe(now-100)
  expect(restored.workouts).toEqual(state.workouts);expect(restored.unit).toBe('lb')
})

it.each(['wrong id','older metadata','future metadata','ended','paused'])('keeps the native profile clock guards for %s',async condition=>{
  const now=Date.now(),state={_ts:now-1000,active:{id:'session',start:now-10000,lastUserInteractionAt:now-5000,entries:[]}}
  const journal={id:'session',at:now-100,_ts:now}
  if(condition==='wrong id')journal.id='another'
  if(condition==='older metadata')journal._ts=now-2000
  if(condition==='future metadata')journal._ts=now+1000
  if(condition==='ended')state.active.end=now-1000
  if(condition==='paused'){state.active.timerPausedAt=now-2000;state.active.pauseReason='manual'}
  mock.read.mockResolvedValue({data:JSON.stringify(state)});mock.readClock.mockResolvedValue({journal})
  const restored=await nativeLoad()
  if(condition==='paused'){
    expect(restored.active.lastUserInteractionAt).toBe(now-100);expect(restored.active.timerPausedAt).toBe(state.active.timerPausedAt);expect(restored.active.pauseReason).toBe('manual')
  }else expect(restored).toEqual(state)
  expect(restored._ts).toBe(state._ts)
})

it('keeps loading the native base if the optional journal is missing or unreadable',async()=>{
  mock.read.mockResolvedValue({data:'{"active":null,"workouts":[]}'})
  mock.readClock.mockRejectedValueOnce(new Error('missing'))
  expect(await nativeLoad()).toEqual({active:null,workouts:[]})
})

it('keeps iOS on its previous full hard-bound path and exposes no Android journal capability',async()=>{
  mock.platform='ios'
  expect(profileClockJournalAvailable()).toBe(false);expect(await readProfileClockJournal()).toBeNull()
  expect(await nativeSaveClockJournal({id:'session',at:1000,_ts:2000})).toBe(false)
  expect(mock.writeClock).not.toHaveBeenCalled();expect(mock.writeFile).not.toHaveBeenCalled()
})
