// @vitest-environment happy-dom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {MemoryRouter,useLocation,useNavigate} from 'react-router-dom'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import TabBar from './TabBar.jsx'
import {DEF,useStore} from '../store/useStore.js'
import {useUI} from '../store/useUI.js'
import {makeBackHandler} from '../lib/back.js'

vi.mock('../lib/i18n.js',()=>({t:(value,...args)=>value.replace(/\{(\d+)\}/g,(_,index)=>args[index]??'')}))
let host,root,before,raw,start,clock
function Route(){const location=useLocation();return <output data-location>{location.pathname+location.search+location.hash}</output>}
beforeEach(()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;clock=1000
 vi.spyOn(performance,'now').mockImplementation(()=>clock)
 localStorage.clear();localStorage.setItem('gym_guest','1')
 before={...structuredClone(DEF),statsSections:['history','bodyweight'],statsSectionOrder:['history','bodyweight'],profile:{name:'Kept profile'},active:{id:'kept-workout',start:Date.now()-120000,lastUserInteractionAt:Date.now(),entries:[{id:'0025',sets:[{w:42.75,r:8,done:false}]}]},workouts:[{id:'kept-history',d:'2026-10-29',entries:[]}]}
 useStore.setState({S:structuredClone(before),user:null,needsMobileOnboarding:false})
 useUI.setState({sheets:[],toastMsg:'',timer:null,work:null,appTourRequest:null,appTourWorkoutPreview:false})
 raw=JSON.stringify(before);localStorage.setItem('gym_state_v1',raw)
 start=vi.fn();host=document.createElement('div');document.body.append(host);root=createRoot(host)
})
afterEach(async()=>{await act(()=>root.unmount());host.remove();useUI.getState().closeAll();vi.restoreAllMocks();localStorage.clear()})
const mount=(path='/home')=>act(()=>root.render(<MemoryRouter initialEntries={[path]}><button data-content>Background action</button><TabBar onStart={start}/><Route/></MemoryRouter>))
const current=()=>host.querySelector('[data-location]').textContent
const handle=()=>host.querySelector('#navigation-dock-toggle')
const nav=()=>host.querySelector('#tabbar')
const tab=label=>[...host.querySelectorAll('.navigation-dock-tab')].find(button=>button.textContent===label)
const click=node=>act(()=>node.click())
const preserved=()=>{expect(useStore.getState().S).toEqual(before);expect(localStorage.getItem('gym_state_v1')).toBe(raw)}
const pointer=(type,x,y,target=nav())=>act(()=>target.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:1,button:0,isPrimary:true,clientX:x,clientY:y})))
const drag=async(from,to,duration=250)=>{await pointer('pointerdown',200,from,handle());await pointer('pointermove',200,to);clock+=duration;await pointer('pointerup',200,to)}

it('starts on main pages with only the fixed workout action and lift handle available, without tab chevrons or menus',async()=>{
 await mount('/home')
 expect(handle().getAttribute('aria-label')).toBe('Open navigation');expect(handle().getAttribute('aria-expanded')).toBe('false')
 expect(handle().dataset.tour).toBe('navigation');expect(nav().hasAttribute('inert')).toBe(false)
 const slots=[...host.querySelectorAll('.navigation-dock-slot')]
 expect(slots).toHaveLength(4);expect(slots.every(slot=>slot.hasAttribute('inert')&&slot.getAttribute('aria-hidden')==='true')).toBe(true)
 expect(slots.every(slot=>slot.querySelector('button').tabIndex===-1)).toBe(true)
 expect(host.querySelectorAll('.tab-label .icn')).toHaveLength(0);expect(host.querySelectorAll('[aria-haspopup]')).toHaveLength(0)
 expect(host.querySelector('.start').closest('[inert]')).toBeNull();expect(host.querySelector('.start').textContent).toBe('Resume')
 expect(host.querySelector('.navigation-dock-backdrop')).toBeNull();preserved()
})

it.each([['Today','/home'],['Routine','/plan'],['Nutrition','/nutrition'],['Stats','/stats']])('lifts then navigates directly to %s, closes and preserves all stored data',async(label,path)=>{
 const writes=vi.spyOn(localStorage,'setItem'),update=vi.spyOn(useStore.getState(),'update')
 await mount('/home');await click(handle())
 expect(handle().getAttribute('aria-label')).toBe('Close navigation');expect(handle().getAttribute('aria-expanded')).toBe('true')
 expect(tab(label).tabIndex).toBe(0);expect(tab(label).closest('[inert]')).toBeNull()
 expect(host.querySelector('.navigation-dock-backdrop')).not.toBeNull()
 await click(tab(label));expect(current()).toBe(path);expect(handle().getAttribute('aria-expanded')).toBe('false')
 expect(host.querySelector('.navigation-dock-backdrop')).toBeNull();expect(useUI.getState().sheets).toHaveLength(0)
 expect(tab(label).getAttribute('aria-current')).toBe('page');expect(document.activeElement).toBe(handle())
 expect(update).not.toHaveBeenCalled();expect(writes).not.toHaveBeenCalled();preserved()
})

it('uses keyboard lift, contains focus, and returns focus when Escape or the outside surface closes it',async()=>{
 await mount();handle().focus()
 await act(()=>handle().dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true,cancelable:true})))
 expect(document.activeElement).toBe(tab('Today'))
 for(let i=0;i<9;i++){
  await act(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true})))
  expect(nav().contains(document.activeElement)).toBe(true)
 }
 await act(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})))
 expect(handle().getAttribute('aria-expanded')).toBe('false');expect(document.activeElement).toBe(handle())
 await click(handle());const wheel=new WheelEvent('wheel',{bubbles:true,cancelable:true});host.querySelector('.navigation-dock-backdrop').dispatchEvent(wheel);expect(wheel.defaultPrevented).toBe(true)
 await click(host.querySelector('.navigation-dock-backdrop'));expect(handle().getAttribute('aria-expanded')).toBe('false');preserved()
})

it('lifts upward and lowers downward while the workout action keeps its same element and placement contract',async()=>{
 await mount();const fixed=host.querySelector('.start')
 nav().setPointerCapture=vi.fn();nav().releasePointerCapture=vi.fn()
 await drag(800,720);expect(handle().getAttribute('aria-expanded')).toBe('true');expect(host.querySelector('.start')).toBe(fixed)
 await act(()=>handle().dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1})))
 expect(handle().getAttribute('aria-expanded')).toBe('true')
 await drag(720,800);expect(handle().getAttribute('aria-expanded')).toBe('false');expect(host.querySelector('.start')).toBe(fixed)
 expect(nav().setPointerCapture).toHaveBeenCalled();expect(nav().releasePointerCapture).toHaveBeenCalled();preserved()
})

it('accepts an intentional fast lift and ignores slow jitter or a horizontal gesture',async()=>{
 await mount();await drag(800,788,300);expect(handle().getAttribute('aria-expanded')).toBe('false')
 await drag(800,778,25);expect(handle().getAttribute('aria-expanded')).toBe('true');await click(handle())
 await pointer('pointerdown',200,800,handle());await pointer('pointermove',280,790);await pointer('pointerup',280,790)
 await act(()=>handle().dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1})))
 expect(handle().getAttribute('aria-expanded')).toBe('false');preserved()
})

it.each(['pointercancel','lostpointercapture'])('cancels %s without opening or saving a preference',async type=>{
 await mount();await pointer('pointerdown',200,800,handle());await pointer('pointermove',200,740)
 expect(nav().dataset.dragging).toBe('true');await pointer(type,200,740)
 expect(nav().dataset.dragging).toBeUndefined();expect(handle().getAttribute('aria-expanded')).toBe('false');preserved()
})

it('keeps Resume direct and fixed, closing an open rail without rewriting the active workout',async()=>{
 const writes=vi.spyOn(localStorage,'setItem');await mount('/nutrition');await click(handle())
 const fixed=host.querySelector('.start');expect(fixed.parentElement.children[2]).toBe(fixed)
 expect(fixed.hasAttribute('aria-haspopup')).toBe(false);await click(fixed)
 expect(current()).toBe('/workout');expect(nav()).toBeNull();expect(handle()).toBeNull();expect(host.querySelector('.navigation-dock-backdrop')).toBeNull();expect(start).not.toHaveBeenCalled();expect(writes).not.toHaveBeenCalled();preserved()
})

it('preserves the planned Start callback and hides the whole dock during onboarding',async()=>{
 before={...before,active:null,routines:[{id:'planned',name:'Planned',ex:[{id:'0025'}]}],week:{[new Date().getDay()]:'planned'}}
 raw=JSON.stringify(before);useStore.setState({S:structuredClone(before)});localStorage.setItem('gym_state_v1',raw)
 await mount();await click(host.querySelector('.start'));expect(start).toHaveBeenCalledExactlyOnceWith('planned');expect(current()).toBe('/home');preserved()
 await act(()=>useStore.setState({needsMobileOnboarding:true}));expect(nav()).toBeNull()
})

it('closes before another modal or the tour takes over and keeps hidden module buttons out of focus',async()=>{
 await mount();await click(handle());await act(()=>useUI.getState().openSheet(()=>null))
 expect(handle().getAttribute('aria-expanded')).toBe('false');expect(tab('Today').tabIndex).toBe(-1)
 expect(host.querySelector('.navigation-dock-backdrop')).toBeNull();preserved()
})

it('consumes Android Back before navigation while open and releases the handler after closing',async()=>{
 await mount('/nutrition');await click(handle())
 const goBack=vi.fn(),exit=vi.fn(),handler=makeBackHandler({getSheets:()=>[],closeSheet:vi.fn(),toast:vi.fn(),goBack,exit})
 let action;await act(()=>{action=handler({canGoBack:true})})
 expect(action).toBe('navigation');expect(handle().getAttribute('aria-expanded')).toBe('false')
 expect(current()).toBe('/nutrition');expect(goBack).not.toHaveBeenCalled();expect(exit).not.toHaveBeenCalled()
 expect(handler({canGoBack:true})).toBe('history');expect(goBack).toHaveBeenCalledOnce();preserved()
})

it('closes its transient surface on a browser popstate without adding a history entry or changing the profile',async()=>{
 await mount('/nutrition');const push=vi.spyOn(window.history,'pushState');await click(handle())
 await act(()=>window.dispatchEvent(new PopStateEvent('popstate')))
 expect(handle().getAttribute('aria-expanded')).toBe('false');expect(push).not.toHaveBeenCalled();preserved()
})
it.each([['/settings',true],['/settings',false],['/workout',true],['/workout',false]])('removes the full dock in %s and restores it collapsed on return (active=%s)',async(path,active)=>{
 if(!active){before={...before,active:null};raw=JSON.stringify(before);useStore.setState({S:structuredClone(before)});localStorage.setItem('gym_state_v1',raw)}
 function Links(){const go=useNavigate();return <><button data-settings onClick={()=>go(path)}>Open page</button><button data-home onClick={()=>go('/home')}>Back</button><Route/></>}
 await act(()=>root.render(<MemoryRouter initialEntries={['/home']}><Links/><TabBar onStart={start}/></MemoryRouter>))
 expect(host.querySelector('.start').textContent).toBe(active?'Resume':'Start')
 await click(handle());expect(host.querySelector('.navigation-dock-backdrop')).not.toBeNull()
 await click(host.querySelector('[data-settings]'))
 expect(current()).toBe(path);expect(nav()).toBeNull();expect(host.querySelector('.start')).toBeNull();expect(host.querySelector('.navigation-dock-backdrop')).toBeNull()
 const goBack=vi.fn(),handler=makeBackHandler({getSheets:()=>[],closeSheet:vi.fn(),toast:vi.fn(),goBack,exit:vi.fn()})
 expect(handler({canGoBack:true})).toBe('history');expect(goBack).toHaveBeenCalledOnce()
 await click(host.querySelector('[data-home]'))
 expect(current()).toBe('/home');expect(host.querySelector('.start').textContent).toBe(active?'Resume':'Start');expect(handle().getAttribute('aria-expanded')).toBe('false')
 expect(start).not.toHaveBeenCalled();preserved()
})

it('hides the lifted rail when the app loses visibility or window focus',async()=>{
 before={...before,active:null};raw=JSON.stringify(before);useStore.setState({S:structuredClone(before)});localStorage.setItem('gym_state_v1',raw)
 await mount();await click(handle());await act(()=>window.dispatchEvent(new Event('blur')))
 expect(handle().getAttribute('aria-expanded')).toBe('false')
 await click(handle());const previous=Object.getOwnPropertyDescriptor(document,'visibilityState')
 Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'})
 try {await act(()=>document.dispatchEvent(new Event('visibilitychange')));expect(handle().getAttribute('aria-expanded')).toBe('false')}
 finally {if(previous)Object.defineProperty(document,'visibilityState',previous);else delete document.visibilityState}
 preserved()
})
