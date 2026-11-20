// @vitest-environment happy-dom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import SmartScale,{SmartScaleAutoSync} from './SmartScale.jsx'
import {useStore,DEF} from '../store/useStore.js'
const mock=vi.hoisted(()=>({status:vi.fn(),sync:vi.fn(),connect:vi.fn(),disconnect:vi.fn(),pair:vi.fn(),forget:vi.fn(),connection:vi.fn(),code:vi.fn()}))
vi.mock('../lib/health/scale-connection.js',()=>({scaleRequest:mock.status,syncScale:mock.sync,beginScaleAuthorization:mock.connect,disconnectScale:mock.disconnect,pairScaleServer:mock.pair,forgetScaleServer:mock.forget,scaleConnection:mock.connection,createScalePairingCode:mock.code}))
vi.mock('../lib/i18n.js',()=>({t:(value,...args)=>value.replace(/\{(\d+)\}/g,(_,n)=>args[n])}))
let host,root,flush
beforeEach(()=>{
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;vi.clearAllMocks();localStorage.clear();flush=useStore.getState().flushPersistence
  useStore.setState({user:null,S:{...structuredClone(DEF),smartScaleConnection:{enabled:false,lastSync:0}},flushPersistence:vi.fn().mockResolvedValue()})
  mock.status.mockResolvedValue({configured:false,connected:false});mock.connection.mockResolvedValue(null);mock.sync.mockResolvedValue({added:1,updated:0,unchanged:2});mock.pair.mockResolvedValue({configured:true,connected:false})
  host=document.createElement('div');document.body.append(host);root=createRoot(host)
})
afterEach(async()=>{await act(()=>root.unmount());host.remove();useStore.setState({flushPersistence:flush});vi.restoreAllMocks();vi.useRealTimers()})
const render=()=>act(async()=>{root.render(<SmartScale/>);await Promise.resolve()})
const click=label=>act(async()=>{[...host.querySelectorAll('button')].find(node=>node.textContent===label).click();await Promise.resolve()})
it('explains server setup and never claims a Withings connection before configuration',async()=>{
  await render();expect(host.textContent).toContain('Configure the Withings client ID');expect(host.textContent).toContain('Not connected')
  expect([...host.querySelectorAll('button')].some(node=>node.textContent==='Connect Withings')).toBe(false)
  expect(mock.connect).not.toHaveBeenCalled()
})
it('uses a private API connection form without editing saved training history',async()=>{
  const before=structuredClone(useStore.getState().S);await render();await click('API connection')
  const inputs=[...host.querySelectorAll('.smart-scale-config input')]
  await act(()=>{for(const [index,value] of ['https://gym.example.com','one-time-code'].entries()){Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(inputs[index],value);inputs[index].dispatchEvent(new Event('input',{bubbles:true}))}})
  await act(async()=>{host.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await Promise.resolve()})
  expect(mock.pair).toHaveBeenCalledWith('https://gym.example.com','one-time-code');expect(host.querySelector('form')).toBeNull();expect(useStore.getState().S).toEqual(before)
})
it('reports import results and preserves the current profile on provider failure',async()=>{
  mock.status.mockResolvedValue({configured:true,connected:true});await render();await click('Sync now');expect(host.textContent).toContain('Added 1 · updated 0 · unchanged 2')
  const before=structuredClone(useStore.getState().S);mock.sync.mockRejectedValueOnce(Error('provider-secret-response'));await click('Sync now')
  expect(host.querySelector('[role=alert]').textContent).toContain('Your existing records are kept.');expect(host.textContent).not.toContain('provider-secret-response');expect(useStore.getState().S).toEqual(before)
})
it('creates pairing codes only through an explicit signed-in action',async()=>{
  useStore.setState({user:{id:'synthetic-user'}});mock.code.mockResolvedValue('ABC123');await render();expect(mock.code).not.toHaveBeenCalled()
  await click('Create pairing code');expect(mock.code).toHaveBeenCalledOnce();expect(host.textContent).toContain('ABC123');expect(host.textContent).toContain('within 5 minutes')
  useStore.setState({user:null})
})
it('runs foreground-only automatic imports only while enabled and releases listeners on unmount',async()=>{
  vi.useFakeTimers();await act(()=>root.render(<SmartScaleAutoSync/>));expect(mock.sync).not.toHaveBeenCalled()
  await act(()=>useStore.getState().update(s=>{s.smartScaleConnection.enabled=true}));expect(mock.sync).toHaveBeenCalledWith({automatic:true})
  mock.sync.mockClear();await act(()=>{document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('online'))});expect(mock.sync).toHaveBeenCalledTimes(2)
  await act(()=>useStore.getState().update(s=>{s.smartScaleConnection.enabled=false}));mock.sync.mockClear();await act(()=>{window.dispatchEvent(new Event('online'));vi.advanceTimersByTime(15*60000)});expect(mock.sync).not.toHaveBeenCalled()
})
