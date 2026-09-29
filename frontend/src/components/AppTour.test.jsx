// @vitest-environment happy-dom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {MemoryRouter} from 'react-router-dom'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import AppTour,{replayAppTour,TOUR_STEPS} from './AppTour.jsx'
import {useStore,DEF} from '../store/useStore.js'
import {useUI} from '../store/useUI.js'
vi.mock('../lib/i18n.js',()=>({t:s=>s}))
let root,host,flush
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;localStorage.clear();flush=useStore.getState().flushPersistence;useStore.setState({S:{...structuredClone(DEF),hasCompletedOnboarding:true},flushPersistence:vi.fn().mockResolvedValue()});useUI.setState({sheets:[],appTourRequest:null});host=document.createElement('div');document.body.append(host);root=createRoot(host)})
afterEach(async()=>{await act(()=>root.unmount());host.remove();useStore.setState({flushPersistence:flush})})
const render=()=>act(()=>root.render(<MemoryRouter initialEntries={['/settings']}><AppTour /></MemoryRouter>))
const click=async text=>act(async()=>{[...host.querySelectorAll('button')].find(b=>b.textContent===text).click();await Promise.resolve()})
it('does not start before onboarding, and skipping persists across remount',async()=>{useStore.setState({S:{...useStore.getState().S,hasCompletedOnboarding:false}});await render();expect(host.querySelector('[role=dialog]')).toBeNull();await act(()=>useStore.setState({S:{...useStore.getState().S,hasCompletedOnboarding:true}}));await click('Skip');expect(JSON.parse(localStorage.getItem('gym_state_v1')).hasCompletedAppTour).toBe(true);await render();expect(host.querySelector('[role=dialog]')).toBeNull()})
it('supports next/back, completion and replay without resetting saved completion',async()=>{await render();await click('Next');expect(host.textContent).toContain('Move around TGym');await click('Back');for(let i=0;i<TOUR_STEPS.length-1;i++)await click('Next');await click('Done');expect(host.querySelector('[role=dialog]')).toBeNull();await act(()=>replayAppTour());expect(host.textContent).toContain('Your training at a glance');expect(useStore.getState().S.hasCompletedAppTour).toBe(true);await click('Skip');expect(host.querySelector('[role=dialog]')).toBeNull()})
it('keeps a retryable dialog when the durable write fails',async()=>{useStore.setState({flushPersistence:vi.fn().mockRejectedValueOnce(Error('full')).mockResolvedValue()});await render();await click('Skip');expect(host.querySelector('[role=alert]')).not.toBeNull();await click('Skip');expect(host.querySelector('[role=dialog]')).toBeNull()})

it('uses twelve steps and keeps the workout preview out of persistent state',async()=>{
 const before=structuredClone(useStore.getState().S);await render();for(let i=0;i<4;i++)await click('Next');expect(useUI.getState().appTourWorkoutPreview).toBe(true);expect(useStore.getState().S.active).toBe(before.active);await click('Skip');expect(useUI.getState().appTourWorkoutPreview).toBe(false);expect(useStore.getState().S.workouts).toEqual(before.workouts);expect(TOUR_STEPS).toHaveLength(12)
})
