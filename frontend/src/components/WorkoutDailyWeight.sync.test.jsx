// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { startFlow } from '../sheets.jsx'
import { setLang } from '../lib/i18n.js'
const mock=vi.hoisted(()=>({sync:vi.fn()}))
vi.mock('../lib/health/health-connect-weight-connection.js',()=>({syncHealthConnectWeight:mock.sync,healthConnectWeightStatus:vi.fn(),connectHealthConnectWeight:vi.fn(),setHealthConnectWeightAutoSync:vi.fn(),disconnectHealthConnectWeight:vi.fn(),openHealthConnectWeightSettings:vi.fn()}))
let root,host
const state=()=>useStore.getState().S
const addWeight=()=>useStore.getState().update(S=>S.bodyweight.push({d:'2026-11-24',w:80.5,t:Date.now()-1000,samples:[{id:'hc-measured',source:'health-connect',w:80.5,t:Date.now()-1000}]}))
function Sheets(){return useUI(s=>s.sheets).map(sheet=><div key={sheet.id}>{sheet.render(()=>useUI.getState().closeSheet(sheet.id))}</div>)}
beforeEach(async()=>{
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-24T12:00:00'));vi.clearAllMocks();localStorage.clear();await setLang('en')
  useStore.setState({user:null,S:{...structuredClone(DEF),lang:'en',hasCompletedOnboarding:true,hasCompletedAppTour:true,
    scaleWeightSource:'health-connect',healthConnectWeight:{enabled:true,autoSync:true,generation:'test-generation'},
    bodyweight:[{d:'2026-11-23',w:80}],routines:[{id:'routine',name:'Kept routine',ex:[{id:'0025',sets:1,reps:8,weight:30,prog:'off'}]}],
    workouts:[{id:'kept-history',entries:[]}],routineOrder:['routine']}})
  useUI.setState({sheets:[],toastMsg:'',timer:null,work:null})
  host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(()=>root.render(<Sheets/>))
})
afterEach(async()=>{await act(()=>root.unmount());host.remove();useUI.getState().closeAll();vi.clearAllTimers();vi.useRealTimers();vi.restoreAllMocks()})
it('checks missing daily weight once, then starts with imported weight without a manual sample',async()=>{
  let finish;mock.sync.mockImplementation(()=>new Promise(resolve=>{finish=resolve}))
  const before={routines:structuredClone(state().routines),workouts:structuredClone(state().workouts)}
  await act(()=>{startFlow('routine');startFlow('routine')});expect(mock.sync).toHaveBeenCalledOnce();expect(useUI.getState().sheets).toHaveLength(1)
  expect(host.textContent).toContain('Checking today’s weight…')
  await act(async()=>{addWeight();finish({readings:1})})
  expect(state().active).toMatchObject({routineId:'routine',bw:80.5});expect(useUI.getState().sheets).toHaveLength(0)
  expect(state().bodyweight.at(-1).samples).toHaveLength(1);for(const key of Object.keys(before))expect(state()[key]).toEqual(before[key])
})
it('does not start a workout after the user cancels a pending read',async()=>{
  let finish;mock.sync.mockImplementation(()=>new Promise(resolve=>{finish=resolve}))
  await act(()=>startFlow('routine'));await act(()=>useUI.getState().closeAll())
  await act(async()=>{addWeight();finish({readings:1})});expect(state().active).toBeNull();expect(useUI.getState().sheets).toHaveLength(0)
})
it('falls back to one manual check-in when the Health Connect read fails',async()=>{
  mock.sync.mockRejectedValue(Error('permission revoked'));const before=structuredClone(state().bodyweight)
  await act(async()=>startFlow('routine'))
  expect(state().active).toBeNull();expect(useUI.getState().sheets).toHaveLength(1);expect(host.querySelector('.bodyweight-picker')).toBeTruthy()
  expect(state().bodyweight).toEqual(before)
})
it('bounds the start wait and does not start automatically when a timed-out read finishes late',async()=>{
  let finish;mock.sync.mockImplementation(()=>new Promise(resolve=>{finish=resolve}));await act(()=>startFlow('routine'))
  await act(()=>vi.advanceTimersByTimeAsync(5000));expect(host.querySelector('.bodyweight-picker')).toBeTruthy();expect(state().active).toBeNull()
  await act(async()=>{addWeight();finish({readings:1})});expect(state().active).toBeNull();expect(useUI.getState().sheets).toHaveLength(1)
})
it('keeps the existing today-weight path synchronous and respects disabled automatic sync',async()=>{
  await act(()=>addWeight());await act(()=>startFlow('routine'));expect(state().active.bw).toBe(80.5);expect(mock.sync).not.toHaveBeenCalled()
  await act(()=>useStore.getState().update(S=>{S.active=null;S.bodyweight=[];S.healthConnectWeight.autoSync=false}))
  await act(()=>startFlow('routine'));expect(mock.sync).not.toHaveBeenCalled();expect(host.querySelector('.bodyweight-picker')).toBeTruthy()
})
it('abandons the start when navigation changes during the weight check',async()=>{
  let finish;mock.sync.mockImplementation(()=>new Promise(resolve=>{finish=resolve}));await act(()=>startFlow('routine'))
  const previous=window.location.hash;window.location.hash='#/settings'
  await act(async()=>finish({readings:0}));expect(state().active).toBeNull();expect(useUI.getState().sheets).toHaveLength(0)
  window.location.hash=previous
})
