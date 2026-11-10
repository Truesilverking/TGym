// @vitest-environment happy-dom
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
const mock=vi.hoisted(()=>({read:vi.fn(),write:vi.fn(),pair:vi.fn(),api:vi.fn(),store:null}))
vi.mock('../mobile.js',()=>({MOBILE:true}))
vi.mock('../api.js',()=>({api:mock.api,pairRedeem:mock.pair}))
vi.mock('../../store/useStore.js',()=>({useStore:{getState:()=>mock.store}}))
vi.mock('@capacitor/filesystem',()=>({Directory:{Data:'DATA'},Encoding:{UTF8:'utf8'},Filesystem:{readFile:mock.read,writeFile:mock.write}}))
beforeEach(()=>{
  vi.resetModules();vi.clearAllMocks();mock.store={S:{smartScaleConnection:{enabled:false,lastSync:0}},async updateAtomic(mut){const next=structuredClone(this.S);mut(next);this.S=next}}
  mock.pair.mockResolvedValue({token:'synthetic-new-token',user:{id:'synthetic-user'}});mock.write.mockResolvedValue(undefined)
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({configured:true,connected:false}))))
})
afterEach(()=>vi.unstubAllGlobals())
it('does not let a late native private-file read replace a newly saved server connection',async()=>{
  let finish;mock.read.mockImplementation(()=>new Promise(resolve=>{finish=resolve}))
  const connection=await import('./scale-connection.js'),pending=connection.scaleConnection()
  for(let i=0;i<30&&!finish;i++)await Promise.resolve()
  expect(mock.read).toHaveBeenCalledOnce()
  await connection.pairScaleServer('https://new-server.example.com','ONE-TIME')
  finish({data:JSON.stringify({base:'https://old-server.example.com',token:'synthetic-old-token'})})
  const expected={base:'https://new-server.example.com',token:'synthetic-new-token'}
  expect(await pending).toEqual(expected);expect(await connection.scaleConnection()).toEqual(expected)
  expect(mock.write).toHaveBeenCalledWith(expect.objectContaining({path:'withings-connection.json',data:JSON.stringify(expected)}))
})
it('does not let a late native private-file read resurrect a forgotten server',async()=>{
  let finish;mock.read.mockImplementation(()=>new Promise(resolve=>{finish=resolve}))
  const connection=await import('./scale-connection.js'),pending=connection.scaleConnection()
  for(let i=0;i<30&&!finish;i++)await Promise.resolve()
  await connection.forgetScaleServer();finish({data:JSON.stringify({base:'https://old-server.example.com',token:'synthetic-old-token'})})
  expect(await pending).toBeNull();expect(await connection.scaleConnection()).toBeNull()
})
