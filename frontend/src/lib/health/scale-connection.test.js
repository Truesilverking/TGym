// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const mocks=vi.hoisted(()=>({api:vi.fn(),pair:vi.fn()}))
vi.mock('../api.js',async original=>({...await original(),api:mocks.api,pairRedeem:mocks.pair}))
let connection,store,flush
const now=Date.parse('2026-11-04T20:00:00Z'), record={id:12,category:1,date:Date.parse('2026-11-03T15:00:00Z')/1000,measures:[{type:1,value:80000,unit:-3}]}
beforeEach(async()=>{
  vi.resetModules();vi.clearAllMocks();localStorage.clear();vi.useFakeTimers();vi.setSystemTime(now)
  const module=await import('../../store/useStore.js');store=module.useStore;flush=store.getState().flushPersistence
  store.setState({S:{...structuredClone(module.DEF),lang:'en',smartScaleConnection:{enabled:true,lastSync:0,generation:'synthetic-generation'}},flushPersistence:vi.fn().mockResolvedValue()})
  connection=await import('./scale-connection.js');mocks.api.mockResolvedValue({records:[record],fetchedAt:now});mocks.pair.mockResolvedValue({token:'synthetic-server-token',user:{id:'user'}})
})
afterEach(()=>{store.setState({flushPersistence:flush});vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers()})
it('accepts HTTPS server origins and rejects embedded credentials, paths and insecure remote URLs',()=>{
  expect(connection.scaleServerUrl(' https://gym.example.com/ ')).toBe('https://gym.example.com')
  expect(connection.scaleServerUrl('http://localhost:3000')).toBe('http://localhost:3000')
  for(const bad of ['http://gym.example.com','https://user:secret@gym.example.com','https://gym.example.com/path','https://gym.example.com?token=secret','javascript:alert(1)'])expect(connection.scaleServerUrl(bad)).toBeNull()
})
it('imports atomically once, coalesces concurrent sync and retains workout/routine data',async()=>{
  const before=structuredClone(store.getState().S),a=connection.syncScale(),b=connection.syncScale();await a;await b
  expect(mocks.api).toHaveBeenCalledTimes(1);expect(store.getState().S.bodyweight).toHaveLength(1)
  expect(store.getState().S.smartScaleConnection.lastSync).toBe(now)
  expect(store.getState().S.workouts).toEqual(before.workouts);expect(store.getState().S.routines).toEqual(before.routines)
  await connection.syncScale();expect(store.getState().S.bodyweight[0].samples).toHaveLength(1)
})
it('keeps the previous profile and cursor after primary storage failure, then retries without duplication',async()=>{
  const before=structuredClone(store.getState().S),setItem=localStorage.setItem.bind(localStorage)
  const failure=vi.spyOn(localStorage,'setItem').mockImplementation((key,value)=>{if(key==='gym_state_v1')throw new DOMException('Quota','QuotaExceededError');return setItem(key,value)})
  await expect(connection.syncScale()).rejects.toThrow();expect(store.getState().S).toEqual(before)
  failure.mockRestore();await connection.syncScale();expect(store.getState().S.bodyweight).toHaveLength(1);expect(store.getState().S.smartScaleConnection.lastSync).toBe(now)
})
it('allows ordinary profile edits during a network request and imports using the current unit',async()=>{
  let finish;mocks.api.mockImplementation(()=>new Promise(resolve=>{finish=resolve}));const pending=connection.syncScale();for(let i=0;i<20&&!finish;i++)await Promise.resolve()
  store.getState().update(s=>{s.unit='lb';s.profile={name:'Updated'}})
  finish({records:[record],fetchedAt:now});await pending
  expect(store.getState().S.profile.name).toBe('Updated');expect(store.getState().S.bodyweight[0].w).toBeCloseTo(176.4)
})
it('rejects an in-flight response after disconnect, preserving old measurements',async()=>{
  let finish;mocks.api.mockImplementation(path=>path.endsWith('/sync')?new Promise(resolve=>{finish=resolve}):Promise.resolve({ok:true}))
  const pending=connection.syncScale();for(let i=0;i<20&&!finish;i++)await Promise.resolve();await connection.disconnectScale();finish({records:[record],fetchedAt:now})
  await expect(pending).rejects.toThrow('Scale connection changed');expect(store.getState().S.bodyweight).toEqual([]);expect(store.getState().S.smartScaleConnection.enabled).toBe(false)
})
it('rejects malformed responses and never moves the incremental cursor on failure',async()=>{
  for(const data of [{records:[],fetchedAt:now+120000},{records:null,fetchedAt:now},{records:[],fetchedAt:-1}]){
    mocks.api.mockResolvedValueOnce(data);await expect(connection.syncScale()).rejects.toThrow('Invalid scale response');expect(store.getState().S.smartScaleConnection.lastSync).toBe(0)
  }
})
it('automatic sync remains disabled offline/unconfigured by preference and observes the 15-minute interval',async()=>{
  store.getState().update(s=>{s.smartScaleConnection.enabled=false});expect(await connection.syncScale({automatic:true})).toBeNull();expect(mocks.api).not.toHaveBeenCalled()
  store.getState().update(s=>{s.smartScaleConnection.enabled=true;s.smartScaleConnection.lastSync=now-60000});expect(await connection.syncScale({automatic:true})).toBeNull();expect(mocks.api).not.toHaveBeenCalled()
})
it('manual sync does not silently enable automatic imports',async()=>{
  store.getState().update(s=>{s.smartScaleConnection.enabled=false})
  await connection.syncScale();expect(store.getState().S.bodyweight).toHaveLength(1)
  expect(store.getState().S.smartScaleConnection).toMatchObject({enabled:false,lastSync:now})
  mocks.api.mockClear();expect(await connection.syncScale({automatic:true})).toBeNull();expect(mocks.api).not.toHaveBeenCalled()
})
it('pairs a private server without putting its bearer token in the profile or portable backup',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({configured:true,connected:false}))))
  await connection.pairScaleServer('https://gym.example.com','one-time-code')
  expect(await connection.scaleConnection()).toEqual({base:'https://gym.example.com',token:'synthetic-server-token'})
  expect(JSON.stringify(store.getState().S)).not.toContain('synthetic-server-token');expect(store.getState().S.smartScaleConnection).toMatchObject({enabled:false,lastSync:0})
  expect(localStorage.getItem('tgym_withings_private_connection_v1')).toContain('synthetic-server-token')
  await connection.forgetScaleServer();expect(await connection.scaleConnection()).toBeNull();expect(localStorage.getItem('tgym_withings_private_connection_v1')).toBeNull();vi.unstubAllGlobals()
})
it('opens authorization during the click, validates the provider and closes rejected popup responses',async()=>{
  const popup={opener:'old',location:{href:'about:blank'},close:vi.fn()},open=vi.spyOn(window,'open').mockReturnValue(popup)
  mocks.api.mockResolvedValueOnce({url:'https://account.withings.com/oauth2_user/authorize2?state=synthetic'})
  const pending=connection.beginScaleAuthorization();expect(open).toHaveBeenCalledOnce();await pending;expect(popup.opener).toBeNull();expect(popup.location.href).toContain('https://account.withings.com/')
  mocks.api.mockResolvedValueOnce({url:'https://evil.invalid/oauth2_user/authorize2?state=x'});await expect(connection.beginScaleAuthorization()).rejects.toThrow('Invalid authorization URL');expect(popup.close).toHaveBeenCalledOnce()
})
