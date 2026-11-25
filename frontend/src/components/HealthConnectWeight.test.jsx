// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import HealthConnectWeight, { HealthConnectWeightAutoSync } from './HealthConnectWeight.jsx'
import { DEF, useStore } from '../store/useStore.js'
const mock = vi.hoisted(() => ({ status:vi.fn(),connect:vi.fn(),sync:vi.fn(),disconnect:vi.fn(),auto:vi.fn(),settings:vi.fn() }))
vi.mock('../lib/health/health-connect-weight-connection.js', () => ({
  healthConnectWeightStatus:mock.status,connectHealthConnectWeight:mock.connect,syncHealthConnectWeight:mock.sync,
  disconnectHealthConnectWeight:mock.disconnect,setHealthConnectWeightAutoSync:mock.auto,openHealthConnectWeightSettings:mock.settings
}))
vi.mock('../lib/i18n.js', () => ({ t:(key,...args)=>key.replace(/\{(\d+)\}/g,(_,n)=>args[n]) }))
let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks(); localStorage.clear()
  vi.spyOn(Capacitor,'getPlatform').mockReturnValue('android')
  useStore.setState({ S:{...structuredClone(DEF),bodyweight:[{d:'2026-11-20',w:80}],workouts:[{id:'kept'}],routines:[{id:'kept-routine'}]} })
  mock.status.mockResolvedValue({available:true,granted:false})
  mock.sync.mockResolvedValue({added:1,updated:0,unchanged:2,readings:3})
  mock.connect.mockImplementation(async()=>{useStore.getState().update(S=>{S.scaleWeightSource='health-connect';S.healthConnectWeight={enabled:true,autoSync:true}});mock.status.mockResolvedValue({available:true,granted:true});return {available:true,granted:true}})
  mock.disconnect.mockImplementation(async()=>useStore.getState().update(S=>{S.healthConnectWeight.enabled=false}))
  host=document.createElement('div');document.body.append(host);root=createRoot(host)
})
afterEach(async()=>{await act(()=>root.unmount());host.remove();vi.restoreAllMocks();vi.useRealTimers()})
const render=()=>act(async()=>{root.render(<HealthConnectWeight/>);await Promise.resolve()})
const button=label=>[...host.querySelectorAll('button')].find(node=>node.textContent===label)
const click=label=>act(async()=>{button(label).click();await Promise.resolve()})
it('requests weight permission only after the explicit connect action, then imports and explains results',async()=>{
  const before=structuredClone(useStore.getState().S);await render()
  expect(mock.connect).not.toHaveBeenCalled();expect(mock.sync).not.toHaveBeenCalled()
  expect(host.textContent).toContain('Not connected');expect(host.textContent).toContain('Exercise access is separate.')
  await click('Allow weight access')
  expect(mock.connect).toHaveBeenCalledOnce();expect(mock.sync).toHaveBeenCalledOnce()
  expect(host.textContent).toContain('Added 1 · updated 0 · unchanged 2')
  expect(button('Sync now')).toBeTruthy()
  for(const key of ['bodyweight','workouts','routines'])expect(useStore.getState().S[key]).toEqual(before[key])
})
it('does not report weight readings merely because access was granted',async()=>{
  mock.sync.mockResolvedValue({added:0,updated:0,unchanged:0,readings:0});await render();await click('Allow weight access')
  expect(host.textContent).toContain('No Withings weight readings found.')
})
it('reports a denied connection safely without importing or changing records',async()=>{
  mock.connect.mockRejectedValue(Error('private-provider-response'));const before=structuredClone(useStore.getState().S)
  await render();await click('Allow weight access')
  expect(mock.sync).not.toHaveBeenCalled();expect(host.querySelector('[role=alert]').textContent).toContain('Your existing records are kept.')
  expect(host.textContent).not.toContain('private-provider-response');expect(useStore.getState().S).toEqual(before)
})
it('reflects revoked weight access even if the saved preference remains enabled',async()=>{
  useStore.getState().update(S=>{S.scaleWeightSource='health-connect';S.healthConnectWeight={enabled:true,autoSync:true}})
  await render();expect(button('Sync now')).toBeUndefined();expect(button('Allow weight access')).toBeTruthy()
  expect(host.textContent).toContain('Weight access is not granted.');expect(mock.sync).not.toHaveBeenCalled()
})
it('disconnects without deleting imported or manual history',async()=>{
  await render();await click('Allow weight access');const weights=structuredClone(useStore.getState().S.bodyweight)
  await click('Disconnect');expect(useStore.getState().S.healthConnectWeight.enabled).toBe(false)
  expect(useStore.getState().S.bodyweight).toEqual(weights);expect(button('Allow weight access')).toBeTruthy()
})
it('coalesces repeated connect clicks while the initial permission action is pending',async()=>{
  let finish;mock.connect.mockImplementation(()=>new Promise(resolve=>{finish=resolve}));await render()
  await act(()=>{button('Allow weight access').click();button('Allow weight access').click()})
  expect(mock.connect).toHaveBeenCalledOnce();await act(async()=>finish({available:true,granted:true}))
})
it('does not show the Android permission controls in a web browser',async()=>{
  vi.mocked(Capacitor.getPlatform).mockReturnValue('web');await render();expect(host.textContent).toBe('')
})
it('syncs on foreground only while the selected source and automatic preference are enabled',async()=>{
  vi.useFakeTimers();vi.spyOn(document,'hidden','get').mockReturnValue(false)
  await act(()=>root.render(<HealthConnectWeightAutoSync/>));expect(mock.sync).not.toHaveBeenCalled()
  await act(()=>useStore.getState().update(S=>{S.scaleWeightSource='health-connect';S.healthConnectWeight={enabled:true,autoSync:true}}))
  expect(mock.sync).toHaveBeenCalledWith({automatic:true});mock.sync.mockClear()
  await act(()=>document.dispatchEvent(new Event('visibilitychange')));expect(mock.sync).toHaveBeenCalledOnce()
  await act(()=>useStore.getState().update(S=>{S.scaleWeightSource='withings'}));mock.sync.mockClear()
  await act(()=>{document.dispatchEvent(new Event('visibilitychange'));vi.advanceTimersByTime(15*60000)})
  expect(mock.sync).not.toHaveBeenCalled()
})
