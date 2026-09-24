// @vitest-environment happy-dom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {ActivityEditor,HealthActivities} from './Activities.jsx'
import {useStore,DEF} from '../store/useStore.js'
vi.mock('../lib/i18n.js',()=>({t:(s,...args)=>s.replace(/\{(\d+)\}/g,(_,i)=>args[i])}))
vi.mock('../lib/health/adapters/health-connect.js',()=>({healthConnectAdapter:{status:async()=>({available:true,granted:true}),connect:async()=>({granted:true}),read:async()=>({records:[]}),settings:async()=>{}}}))
let host,root,flush,close
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;localStorage.clear();flush=useStore.getState().flushPersistence;useStore.setState({S:structuredClone(DEF),flushPersistence:vi.fn().mockResolvedValue()});host=document.createElement('div');document.body.append(host);root=createRoot(host);close=vi.fn()})
afterEach(async()=>{await act(()=>root.unmount());host.remove();useStore.setState({flushPersistence:flush})})
const click=label=>act(async()=>{[...host.querySelectorAll('button')].find(b=>b.textContent===label).click();await Promise.resolve()})
it('switching form modes never submits or creates a record',async()=>{await act(()=>root.render(<ActivityEditor close={close}/>));await click('Plan activity');await click('Weekly');expect(useStore.getState().S.workouts).toEqual([]);expect(useStore.getState().S.routines).toEqual([]);expect(host.querySelector('[role=alert]')).toBeNull()})
it('retries a failed durable save without duplicating the manual workout',async()=>{useStore.setState({flushPersistence:vi.fn().mockRejectedValueOnce(Error('full')).mockResolvedValue()});await act(()=>root.render(<ActivityEditor close={close}/>));await click('Save');expect(useStore.getState().S.workouts).toHaveLength(1);expect(close).not.toHaveBeenCalled();await click('Retry saving');expect(useStore.getState().S.workouts).toHaveLength(1);expect(close).toHaveBeenCalledOnce()})
it('disconnect retains imported history and exposes system permission management',async()=>{useStore.setState({S:{...structuredClone(DEF),healthConnection:{enabled:true,lastSync:123},workouts:[{id:'import',start:100000,end:160000,d:'2026-09-20',activity:{type:'running',source:'health-connect'}}]}});await act(async()=>{root.render(<HealthActivities/>);await Promise.resolve()});await click('Disconnect');expect(useStore.getState().S.healthConnection.enabled).toBe(false);expect(useStore.getState().S.workouts).toHaveLength(1);expect(host.textContent).toContain('Manage permissions')})
