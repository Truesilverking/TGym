// @vitest-environment happy-dom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {MemoryRouter,useLocation} from 'react-router-dom'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import AppTour,{replayAppTour,TOUR_STEPS,visibleTourTarget,tourHighlightRect,tourViewport} from './AppTour.jsx'
import {useStore,DEF} from '../store/useStore.js'
import {useUI} from '../store/useUI.js'
vi.mock('../lib/i18n.js',()=>({t:s=>s}))
let root,host,flush
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;localStorage.clear();flush=useStore.getState().flushPersistence;useStore.setState({S:{...structuredClone(DEF),hasCompletedOnboarding:true},flushPersistence:vi.fn().mockResolvedValue()});useUI.setState({sheets:[],appTourRequest:null});host=document.createElement('div');document.body.append(host);root=createRoot(host)})
afterEach(async()=>{await act(()=>root.unmount());host.remove();useStore.setState({flushPersistence:flush})})
const render=()=>act(()=>root.render(<MemoryRouter initialEntries={['/settings']}><AppTour /></MemoryRouter>))
const click=async text=>act(async()=>{[...host.querySelectorAll('button')].find(b=>b.textContent===text).click();await Promise.resolve()})
it('does not start before onboarding, and skipping persists across remount',async()=>{useStore.setState({S:{...useStore.getState().S,hasCompletedOnboarding:false}});await render();expect(host.querySelector('[role=dialog]')).toBeNull();await act(()=>useStore.setState({S:{...useStore.getState().S,hasCompletedOnboarding:true}}));await click('Skip');expect(JSON.parse(localStorage.getItem('gym_state_v1')).hasCompletedAppTour).toBe(true);await render();expect(host.querySelector('[role=dialog]')).toBeNull()})
it('supports next/back, completion and replay without resetting saved completion',async()=>{await render();await click('Next');expect(host.textContent).toContain('Start or resume');await click('Back');for(let i=0;i<TOUR_STEPS.length-1;i++)await click('Next');await click('Finish');expect(host.querySelector('[role=dialog]')).toBeNull();await act(()=>replayAppTour());expect(host.textContent).toContain('Your training at a glance');expect(useStore.getState().S.hasCompletedAppTour).toBe(true);await click('Skip');expect(host.querySelector('[role=dialog]')).toBeNull()})
it('keeps a retryable dialog when the durable write fails',async()=>{useStore.setState({flushPersistence:vi.fn().mockRejectedValueOnce(Error('full')).mockResolvedValue()});await render();await click('Skip');expect(host.querySelector('[role=alert]')).not.toBeNull();await click('Skip');expect(host.querySelector('[role=dialog]')).toBeNull()})

it('groups every flow and keeps a complete replay out of workout, reminder and profile state',async()=>{
 const before=structuredClone(useStore.getState().S);await render();
 for(let i=0;i<TOUR_STEPS.length;i++){
   expect(useUI.getState().appTourWorkoutPreview).toBe(true)
   expect(useStore.getState().S).toEqual(before)
   if(i<TOUR_STEPS.length-1)await click('Next')
 }
 expect(new Set(TOUR_STEPS.map(step=>step[4]))).toEqual(new Set(['Training','Planning','Tracking','Exercises','Settings / Profile']))
 expect(TOUR_STEPS.some(step=>step[1]==='stats-view')).toBe(true)
 expect(TOUR_STEPS.some(step=>step[1]==='profile')).toBe(true)
 await click('Finish');expect(useUI.getState().appTourWorkoutPreview).toBe(false)
 expect(useStore.getState().S.workouts).toEqual(before.workouts)
 expect(useStore.getState().S.reminder).toEqual(before.reminder)
 expect(useStore.getState().S.profile).toEqual(before.profile)
})

it('never selects a hidden section when the same target exists in a visible header',()=>{
 const hidden=document.createElement('section'),visible=document.createElement('button')
 hidden.hidden=true;hidden.innerHTML='<button data-tour="history"></button>';visible.dataset.tour='history'
 for(const node of [hidden.firstChild,visible])node.getBoundingClientRect=()=>({width:44,height:44,top:10,left:10,right:54,bottom:54})
 host.append(hidden,visible);expect(visibleTourTarget('history')).toBe(visible)
 visible.style.display='none';expect(visibleTourTarget('history')).toBeNull()
})

it('reveals the same target again when a route scroll reset moves it outside the viewport',async()=>{
 const target=document.createElement('div');target.dataset.tour=TOUR_STEPS[0][1];let top=8
 target.getBoundingClientRect=()=>({top,bottom:top+200,left:18,right:360,width:342,height:200})
 target.scrollIntoView=vi.fn(()=>{top=8});document.body.append(target)
 await render();expect(host.querySelector('.tour-focus')).not.toBeNull()
 const calls=target.scrollIntoView.mock.calls.length
 top=934
 await act(()=>document.dispatchEvent(new Event('scroll')))
 expect(target.scrollIntoView).toHaveBeenCalledTimes(calls+1)
 expect(host.querySelector('.tour-focus')).not.toBeNull()
 expect(parseFloat(host.querySelector('.tour-focus').style.top)).toBeLessThan(20)
 target.remove()
})

it('ignores retained inert panes while allowing the tour-blocked app and tab bar to be highlighted',()=>{
 const app=document.createElement('main');app.id='app';app.inert=true
 const hidden=document.createElement('section');hidden.inert=true;hidden.dataset.appPane='stats'
 const stale=document.createElement('button'),visible=document.createElement('button')
 stale.dataset.tour='stats-actions';visible.dataset.tour='stats-actions';hidden.append(stale);app.append(hidden,visible);host.append(app)
 for(const node of [stale,visible])node.getBoundingClientRect=()=>({width:44,height:44,top:10,left:10,right:54,bottom:54})
 expect(visibleTourTarget('stats-actions')).toBe(visible)
 visible.inert=true;expect(visibleTourTarget('stats-actions')).toBeNull()
 const bar=document.createElement('nav');bar.id='tabbar';bar.inert=true;bar.dataset.tour='navigation';bar.getBoundingClientRect=visible.getBoundingClientRect;host.append(bar)
 expect(visibleTourTarget('navigation')).toBe(bar)
})

it('explains swipe/dropdown navigation and opens the visible analytics route for Stats actions',()=>{
 expect(TOUR_STEPS[0][1]).toBe('navigation')
 expect(TOUR_STEPS[0][3]).toContain('bottom menu')
 for(const step of TOUR_STEPS.filter(step=>['stats-view','stats-actions'].includes(step[1])))expect(step[0]).toBe('/stats?section=history')
 expect(TOUR_STEPS.find(step=>step[1]==='stats-view')[3]).toContain('open a section or change its order')
})

it('returns to the exact Stats section and anchor after replay without changing the active workout',async()=>{
 const active={id:'keep-active',start:1000,entries:[{id:'0025',sets:[{w:42.75,r:8,done:false}]}]}
 useStore.setState({S:{...useStore.getState().S,hasCompletedAppTour:true,active}})
 replayAppTour();const before=structuredClone(useStore.getState().S)
 function Route(){const location=useLocation();return <output data-route>{location.pathname+location.search+location.hash}</output>}
 await act(()=>root.render(<MemoryRouter initialEntries={['/stats?section=exercise#exercise-detail']}><Route/><AppTour/></MemoryRouter>))
 expect(host.querySelector('[data-route]').textContent).toBe('/home')
 await click('Next');await click('Next');await click('Skip')
 expect(host.querySelector('[data-route]').textContent).toBe('/stats?section=exercise#exercise-detail')
 expect(host.querySelector('[role=dialog]')).toBeNull();expect(useUI.getState().appTourWorkoutPreview).toBe(false)
 expect(useStore.getState().S).toEqual(before);expect(localStorage.getItem('gym_state_v1')).toBeNull()
})

it.each([[360,740,280],[1024,768,230],[740,360,220]])('keeps visible targets outside the tour panel at %i × %i', (width,height,panelHeight)=>{
 for(const bounds of [{top:12,bottom:height-40,left:16,right:width-16},{top:height-75,bottom:height-25,left:width/2-25,right:width/2+25},{top:height/2-20,bottom:height/2+24,left:20,right:width-20}]){
   const rect=tourHighlightRect(bounds,width,height,panelHeight)
   if(!rect)continue // A landscape dialog may occupy all available space.
   expect(rect.top).toBeGreaterThanOrEqual(bounds.top)
   expect(rect.top+rect.height).toBeLessThanOrEqual(bounds.bottom)
   expect(rect.atTop ? rect.top>=panelHeight+36 : rect.top+rect.height<=height-panelHeight-36).toBe(true)
   expect(rect.left+rect.width).toBeLessThanOrEqual(width-8)
 }
})

it('keeps focus on Next when advancing and on Back when returning',async()=>{
 await render()
 const next=()=>host.querySelector('[data-tour-action="next"]')
 await act(async()=>{await new Promise(requestAnimationFrame)})
 expect(document.activeElement).toBe(next())
 await click('Next');await act(async()=>{await new Promise(requestAnimationFrame)})
 expect(document.activeElement).toBe(next())
 const back=[...host.querySelectorAll('button')].find(button=>button.textContent==='Back')
 back.focus();await click('Back');await act(async()=>{await new Promise(requestAnimationFrame)})
 expect(document.activeElement).toBe(next()) // Back is now disabled on step one.
})

it('fits the visible viewport and keeps highlights outside the panel when a keyboard offsets it',()=>{
 const viewport=tourViewport({innerWidth:390,innerHeight:844,visualViewport:{width:320,height:300,offsetLeft:12,offsetTop:170}})
 expect(viewport).toEqual({left:12,top:170,width:320,height:300})
 const bounds={top:180,bottom:455,left:18,right:320,width:302,height:275}
 const rect=tourHighlightRect(bounds,viewport.width,viewport.height,170,viewport)
 expect(rect).not.toBeNull()
 expect(rect.top).toBeGreaterThanOrEqual(viewport.top+8)
 expect(rect.top+rect.height).toBeLessThanOrEqual(viewport.top+viewport.height-8)
 expect(rect.atTop ? rect.top>=viewport.top+18+170+18 : rect.top+rect.height<=viewport.top+viewport.height-18-170-18).toBe(true)
})

it('explains a missing target and still permits moving on or skipping',async()=>{
 await render();await act(async()=>{await new Promise(requestAnimationFrame)})
 expect(host.querySelector('.tour-focus')).toBeNull()
 expect(host.querySelector('.tour-unavailable').textContent).toContain('You can continue the tour.')
 await click('Next');expect(host.textContent).toContain('Start or resume')
 await click('Skip');expect(host.querySelector('[role=dialog]')).toBeNull()
})

it('prevents duplicate completion requests while its persistence mirror is pending',async()=>{
 let resolve
 const pending=new Promise(done=>{resolve=done}),mirror=vi.fn(()=>pending)
 useStore.setState({flushPersistence:mirror})
 await render()
 const skip=[...host.querySelectorAll('button')].find(button=>button.textContent==='Skip')
 await act(async()=>{skip.click();skip.click();await Promise.resolve()})
 expect(mirror).toHaveBeenCalledOnce()
 await act(async()=>{resolve();await pending})
 expect(host.querySelector('[role=dialog]')).toBeNull()
})

it('does not change an active session while moving forward, back and out of its practice preview',async()=>{
 const active={id:'existing-active',routineId:'r1',name:'Existing',d:'2026-10-22',start:1792660000000,cur:0,entries:[{id:'0025',sets:[{w:30,r:8,done:true}]}]}
 useStore.setState({S:{...useStore.getState().S,active,hasCompletedAppTour:true}})
 replayAppTour()
 const before=structuredClone(useStore.getState().S)
 await render();await click('Next');await click('Next');expect(useUI.getState().appTourWorkoutPreview).toBe(true)
 await click('Next');await click('Back');await click('Back');expect(useUI.getState().appTourWorkoutPreview).toBe(true)
 expect(useStore.getState().S).toEqual(before)
 await click('Skip');expect(useStore.getState().S).toEqual(before)
 expect(localStorage.getItem('gym_state_v1')).toBeNull()
})
