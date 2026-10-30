// @vitest-environment happy-dom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {MemoryRouter,useLocation} from 'react-router-dom'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import TabBar from './TabBar.jsx'
import Toast from './Toast.jsx'
import {DEF,useStore} from '../store/useStore.js'
import {useUI} from '../store/useUI.js'

vi.mock('../lib/i18n.js',()=>({t:(value,...args)=>value.replace(/\{(\d+)\}/g,(_,index)=>args[index]??'')}))

let host,root,before,raw,start
// happy-dom binds Storage methods on the instance; its proxy ignores ordinary
// property assignment, so restore this descriptor explicitly after spying.
const originalWrite=localStorage.setItem,originalUpdate=useStore.getState().update
function Route(){const location=useLocation();return <output data-location>{location.pathname+location.search+location.hash}</output>}
// Render the real sheet content and useUI close callbacks without browser-history
// handling, which belongs to the separately tested modal container.
function Sheets(){return useUI(state=>state.sheets).map(sheet=><section key={sheet.id} data-test-sheet>{sheet.render(()=>useUI.getState().closeSheet(sheet.id))}</section>)}
beforeEach(()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-30T12:00:00'))
 localStorage.clear();localStorage.setItem('gym_guest','1')
 before={...structuredClone(DEF),statsSections:['history','bodyweight'],statsSectionOrder:['history','bodyweight'],profile:{name:'Kept profile'},active:{id:'kept-workout',start:Date.now()-120000,lastUserInteractionAt:Date.now(),entries:[{id:'0025',sets:[{w:42.75,r:8,done:false}]}]},workouts:[{id:'kept-history',d:'2026-10-29',entries:[]}]}
 useStore.setState({S:structuredClone(before),update:originalUpdate,user:null,needsMobileOnboarding:false,storageError:null,storageWarning:null})
 useUI.setState({sheets:[],toastMsg:'',timer:null,work:null,appTourRequest:null,appTourWorkoutPreview:false})
 raw=JSON.stringify(before);localStorage.setItem('gym_state_v1',raw)
 start=vi.fn();host=document.createElement('div');document.body.append(host);root=createRoot(host)
})
afterEach(async()=>{await act(()=>root.unmount());host.remove();useUI.getState().closeAll();vi.clearAllTimers();vi.useRealTimers();vi.restoreAllMocks();Object.defineProperty(localStorage,'setItem',{value:originalWrite,writable:true,configurable:true});useStore.setState({update:originalUpdate})})
const mount=(path='/home')=>act(()=>root.render(<MemoryRouter initialEntries={[path]}><TabBar onStart={start}/><Route/><Sheets/><Toast/></MemoryRouter>))
const current=()=>host.querySelector('[data-location]').textContent
const tab=label=>[...host.querySelectorAll('#tabbar>button')].find(button=>button.querySelector('.tab-label')?.textContent===label)
const menu=()=>host.querySelector('[data-test-sheet]')
const click=node=>act(()=>node.click())
const preserved=()=>{expect(useStore.getState().S).toEqual(before);expect(localStorage.getItem('gym_state_v1')).toBe(raw)}
const option=label=>[...menu().querySelectorAll('.module-jump-option,.stats-section-jump')].find(button=>button.textContent===label)

it.each([
 ['Today','Training Calendar','/home#training-calendar','module-menu-home'],
 ['Routine','Exercises','/library','module-menu-plan'],
 ['Nutrition','Dinner','/nutrition#nutrition-dinner','module-menu-nutrition'],
 ['Stats','Body Weight','/stats?section=bodyweight','stats-sections-menu'],
])('opens the %s dropdown and jumps directly to %s without saving the profile',async(label,target,path,controlledId)=>{
 const writes=vi.spyOn(localStorage,'setItem'),update=vi.spyOn(useStore.getState(),'update')
 await mount('/workout');const trigger=tab(label)
 expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');expect(trigger.getAttribute('aria-expanded')).toBe('false')
 await click(trigger)
 expect(current()).toBe('/workout');expect(trigger.getAttribute('aria-expanded')).toBe('true')
 expect(trigger.getAttribute('aria-controls')).toBe(controlledId);expect(menu().querySelector('#'+controlledId)).not.toBeNull()
 await click(option(target))
 expect(current()).toBe(path);expect(menu()).toBeNull();expect(useUI.getState().sheets).toHaveLength(0)
 expect(trigger.getAttribute('aria-expanded')).toBe('false');expect(trigger.getAttribute('aria-current')).toBe('page')
 expect(update).not.toHaveBeenCalled();expect(writes).not.toHaveBeenCalled();preserved()
})

it('clears aria-expanded when a dropdown is dismissed without selecting a destination',async()=>{
 const writes=vi.spyOn(localStorage,'setItem');await mount('/home')
 for(const label of ['Today','Routine','Nutrition','Stats']){
  const trigger=tab(label);await click(trigger);expect(trigger.getAttribute('aria-expanded')).toBe('true')
  await act(()=>useUI.getState().closeSheet(useUI.getState().sheets[0].id))
  expect(trigger.getAttribute('aria-expanded')).toBe('false');expect(menu()).toBeNull();expect(current()).toBe('/home')
 }
 expect(writes).not.toHaveBeenCalled();preserved()
})

it('keeps Resume fixed in the center and resumes the active workout without opening a menu or rewriting it',async()=>{
 const writes=vi.spyOn(localStorage,'setItem');await mount('/nutrition#nutrition-water')
 const buttons=[...host.querySelectorAll('#tabbar>button')],resume=buttons[2]
 expect(buttons).toHaveLength(5);expect(resume.classList.contains('start')).toBe(true);expect(resume.textContent).toBe('Resume')
 expect(resume.hasAttribute('aria-haspopup')).toBe(false);expect(resume.hasAttribute('aria-expanded')).toBe(false)
 await click(resume)
 expect(current()).toBe('/workout');expect(menu()).toBeNull();expect(start).not.toHaveBeenCalled();expect(writes).not.toHaveBeenCalled();preserved()
})

it('keeps Start as a direct action when there is no active or scheduled workout',async()=>{
 before={...before,active:null};raw=JSON.stringify(before);useStore.setState({S:structuredClone(before)});localStorage.setItem('gym_state_v1',raw)
 const writes=vi.spyOn(localStorage,'setItem');await mount('/stats?section=bodyweight')
 const startButton=host.querySelectorAll('#tabbar>button')[2]
 expect(startButton.textContent).toBe('Start');await click(startButton)
 expect(current()).toBe('/workout');expect(menu()).toBeNull();expect(start).not.toHaveBeenCalled();expect(writes).not.toHaveBeenCalled();preserved()
})

it.each(['reorder','enable and open'])('keeps the Stats menu, route and profile intact when %s cannot be persisted',async operation=>{
 await mount('/stats?section=history');await click(tab('Stats'))
 const initialOrder=[...menu().querySelectorAll('[data-stats-option]')].map(row=>row.dataset.statsOption)
 const blocked=vi.spyOn(localStorage,'setItem').mockImplementation(function(key,value){
  if(key==='gym_state_v1')throw new DOMException('Synthetic full storage','QuotaExceededError')
  return originalWrite.call(this,key,value)
 })
 const target=operation==='reorder'?menu().querySelector('[data-stats-option="history"] .stats-order-actions button:last-child'):option('Effort')
 await click(target)
 expect(blocked).toHaveBeenCalled()
 expect(host.querySelector('#toast').textContent).toBe('Could not save changes. Try again.');expect(host.querySelector('#toast').classList.contains('show')).toBe(true)
 expect(menu()).not.toBeNull();expect(useUI.getState().sheets).toHaveLength(1);expect(tab('Stats').getAttribute('aria-expanded')).toBe('true')
 expect(current()).toBe('/stats?section=history')
 expect([...menu().querySelectorAll('[data-stats-option]')].map(row=>row.dataset.statsOption)).toEqual(initialOrder)
 expect(menu().querySelector('[data-stats-option="effort"] [role="checkbox"]').getAttribute('aria-checked')).toBe('false')
 expect(menu().querySelector('[data-stats-option="history"] .stats-section-jump').getAttribute('aria-current')).toBe('page')
 preserved()
})
