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
let host,root,before,raw,start
const originalIsGuest=useStore.getState().isGuest
function Route(){const location=useLocation();return <output data-location>{location.pathname+location.search+location.hash}</output>}
beforeEach(()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true
 localStorage.clear();localStorage.setItem('gym_guest','1')
 before={...structuredClone(DEF),statsSections:['history','bodyweight'],statsSectionOrder:['history','bodyweight'],profile:{name:'Kept profile'},active:{id:'kept-workout',start:Date.now()-120000,lastUserInteractionAt:Date.now(),entries:[{id:'0025',sets:[{w:42.75,r:8,done:false}]}]},workouts:[{id:'kept-history',d:'2026-10-29',entries:[]}]}
 useStore.setState({S:structuredClone(before),user:null,needsMobileOnboarding:false,isGuest:originalIsGuest})
 useUI.setState({sheets:[],toastMsg:'',timer:null,work:null,appTourRequest:null,appTourWorkoutPreview:false})
 raw=JSON.stringify(before);localStorage.setItem('gym_state_v1',raw)
 start=vi.fn();host=document.createElement('div');document.body.append(host);root=createRoot(host)
})
afterEach(async()=>{await act(()=>root.unmount());host.remove();useUI.getState().closeAll();useStore.setState({isGuest:originalIsGuest});vi.restoreAllMocks();localStorage.clear()})
const mount=(path='/home')=>act(()=>root.render(<MemoryRouter initialEntries={[path]}><button data-content>Background action</button><TabBar onStart={start}/><Route/></MemoryRouter>))
const current=()=>host.querySelector('[data-location]').textContent
const nav=()=>host.querySelector('#tabbar')
const tab=label=>[...host.querySelectorAll('.navigation-dock-tab')].find(button=>button.textContent===label)
const click=node=>act(()=>node.click())
const preserved=()=>{expect(useStore.getState().S).toEqual(before);expect(localStorage.getItem('gym_state_v1')).toBe(raw)}

it('makes all four module buttons available immediately beside the central workout action',async()=>{
 await mount('/home')
 expect(nav().classList.contains('persistent-navigation')).toBe(true)
 expect(nav().dataset.tour).toBe('navigation')
 expect(nav().children).toHaveLength(5)
 expect([...nav().children].every(button=>button.tagName==='BUTTON')).toBe(true)
 expect([...host.querySelectorAll('.navigation-dock-tab')].map(button=>button.textContent)).toEqual(['Today','Routine','Nutrition','Stats'])
 for(const button of nav().children){
  expect(button.tabIndex).toBe(0);expect(button.closest('[inert],[hidden],[aria-hidden="true"]')).toBeNull()
 }
 expect(nav().children[2].classList.contains('start')).toBe(true)
 expect(nav().children[2].textContent).toBe('Resume')
 expect(host.querySelector('#navigation-dock-toggle,.navigation-dock-backdrop,.navigation-dock-slot')).toBeNull()
 expect(nav().hasAttribute('data-open')).toBe(false)
 expect(host.querySelectorAll('[aria-haspopup],[aria-expanded],.tab-label .icn')).toHaveLength(0)
 preserved()
})

it.each([['Today','/home'],['Routine','/plan'],['Nutrition','/nutrition'],['Stats','/stats']])('navigates directly to %s without opening a menu or modifying the profile',async(label,path)=>{
 const writes=vi.spyOn(localStorage,'setItem'),update=vi.spyOn(useStore.getState(),'update')
 await mount('/home');await click(tab(label))
 expect(current()).toBe(path);expect(tab(label).getAttribute('aria-current')).toBe('page')
 expect(nav().children).toHaveLength(5);expect(host.querySelector('.navigation-dock-backdrop')).toBeNull()
 expect(useUI.getState().sheets).toHaveLength(0);expect(update).not.toHaveBeenCalled();expect(writes).not.toHaveBeenCalled();preserved()
})

it.each([['/library','Routine'],['/stats?section=bodyweight','Stats'],['/records','Stats'],['/history','Stats'],['/progress','Stats']])('marks the owning module for %s',async(path,label)=>{
 await mount(path)
 expect(tab(label).getAttribute('aria-current')).toBe('page')
 expect(nav().querySelectorAll('[aria-current="page"]')).toHaveLength(1)
 preserved()
})

it('leaves keyboard focus and Android Back with normal page navigation',async()=>{
 await mount('/nutrition')
 const outside=host.querySelector('[data-content]');outside.focus()
 for(const key of ['Tab','Escape','ArrowUp','ArrowDown']){
  const event=new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true})
  await act(()=>document.dispatchEvent(event))
  expect(event.defaultPrevented).toBe(false);expect(document.activeElement).toBe(outside)
 }
 const goBack=vi.fn(),exit=vi.fn(),handler=makeBackHandler({getSheets:()=>[],closeSheet:vi.fn(),toast:vi.fn(),goBack,exit})
 expect(handler({canGoBack:true})).toBe('history');expect(goBack).toHaveBeenCalledOnce();expect(exit).not.toHaveBeenCalled()
 expect(current()).toBe('/nutrition');preserved()
})

it('does not capture a vertical drag or hide the module buttons',async()=>{
 await mount();const buttons=[...nav().children],capture=vi.fn();nav().setPointerCapture=capture
 for(const [type,y] of [['pointerdown',800],['pointermove',720],['pointerup',720]]){
  const event=new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:1,button:0,isPrimary:true,clientX:200,clientY:y})
  await act(()=>nav().dispatchEvent(event));expect(event.defaultPrevented).toBe(false)
 }
 expect(capture).not.toHaveBeenCalled();expect([...nav().children]).toEqual(buttons)
 expect(nav().hasAttribute('data-open')).toBe(false);preserved()
})

it('keeps Resume direct and removes the bar inside the workout without rewriting it',async()=>{
 const writes=vi.spyOn(localStorage,'setItem');await mount('/nutrition')
 const fixed=host.querySelector('.start');expect(fixed.parentElement.children[2]).toBe(fixed)
 expect(fixed.hasAttribute('aria-haspopup')).toBe(false);await click(fixed)
 expect(current()).toBe('/workout');expect(nav()).toBeNull();expect(host.querySelector('.start')).toBeNull()
 expect(start).not.toHaveBeenCalled();expect(writes).not.toHaveBeenCalled();preserved()
})

it('preserves the planned Start callback and removes the bar during onboarding',async()=>{
 before={...before,active:null,routines:[{id:'planned',name:'Planned',ex:[{id:'0025'}]}],week:{[new Date().getDay()]:'planned'}}
 raw=JSON.stringify(before);useStore.setState({S:structuredClone(before)});localStorage.setItem('gym_state_v1',raw)
 await mount();await click(host.querySelector('.start'))
 expect(start).toHaveBeenCalledExactlyOnceWith('planned');expect(current()).toBe('/home');preserved()
 await act(()=>useStore.setState({needsMobileOnboarding:true}));expect(nav()).toBeNull()
})

it('does not expose navigation before authentication',async()=>{
 useStore.setState({user:null,isGuest:()=>false});await mount('/home');expect(nav()).toBeNull();preserved()
})

it.each([['/settings',true],['/settings',false],['/workout',true],['/workout',false],['/plan/r/example',true],['/admin',false]])('hides the bar in %s and restores all buttons on return (active=%s)',async(path,active)=>{
 if(!active){before={...before,active:null};raw=JSON.stringify(before);useStore.setState({S:structuredClone(before)});localStorage.setItem('gym_state_v1',raw)}
 function Links(){const go=useNavigate();return <><button data-away onClick={()=>go(path)}>Open page</button><button data-home onClick={()=>go('/home')}>Back</button><Route/></>}
 await act(()=>root.render(<MemoryRouter initialEntries={['/home']}><Links/><TabBar onStart={start}/></MemoryRouter>))
 expect(host.querySelector('.start').textContent).toBe(active?'Resume':'Start')
 await click(host.querySelector('[data-away]'))
 expect(current()).toBe(path);expect(nav()).toBeNull();expect(host.querySelector('.start')).toBeNull()
 const goBack=vi.fn(),handler=makeBackHandler({getSheets:()=>[],closeSheet:vi.fn(),toast:vi.fn(),goBack,exit:vi.fn()})
 expect(handler({canGoBack:true})).toBe('history');expect(goBack).toHaveBeenCalledOnce()
 await click(host.querySelector('[data-home]'))
 expect(current()).toBe('/home');expect(host.querySelector('.start').textContent).toBe(active?'Resume':'Start')
 expect(nav().querySelectorAll('.navigation-dock-tab')).toHaveLength(4)
 expect(host.querySelector('#navigation-dock-toggle,.navigation-dock-backdrop,[aria-expanded]')).toBeNull()
 expect(start).not.toHaveBeenCalled();preserved()
})
