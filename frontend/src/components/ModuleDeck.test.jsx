// @vitest-environment happy-dom
import React,{act,useEffect,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {MemoryRouter,useLocation,useNavigate} from 'react-router-dom'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import ModuleDeck from './ModuleDeck.jsx'
import {DEF,useStore} from '../store/useStore.js'
import {useUI} from '../store/useUI.js'

vi.mock('../lib/i18n.js',()=>({t:value=>value}))
vi.mock('../views/Home.jsx',()=>({default:()=> <Probe id="home"/>}))
vi.mock('../views/Plan.jsx',()=>({default:()=> <Probe id="plan"/>}))
vi.mock('../views/Library.jsx',()=>({default:()=> <Probe id="library"/>}))
vi.mock('../views/Nutrition.jsx',()=>({default:()=> <Probe id="nutrition"/>}))
vi.mock('../views/Stats.jsx',()=>({default:()=> <Probe id="analytics"/>}))
vi.mock('../views/Records.jsx',()=>({default:()=> <Probe id="records"/>}))
vi.mock('../views/History.jsx',()=>({default:()=> <Probe id="history"/>}))
vi.mock('../views/ProgressReport.jsx',()=>({default:()=> <Probe id="report"/>}))
vi.mock('./StatsSections.jsx',()=>({default:()=> <button data-stats-control>Sections</button>}))

let host,root,navigate,before,raw,frames,frameId
const activeEffects=new Set(),pulses={},broken={section:null}
function Probe({id}){
 const [draft,setDraft]=useState(0),location=useLocation()
 useEffect(()=>{
  activeEffects.add(id)
  const pulse=()=>{pulses[id]=(pulses[id]||0)+1}
  window.addEventListener('module-test-pulse',pulse)
  return()=>{activeEffects.delete(id);window.removeEventListener('module-test-pulse',pulse)}
 },[id])
 if(id==='analytics'&&broken.section!==null&&new URLSearchParams(location.search).get('section')===broken.section)throw Error('Synthetic analytics failure')
 return <div data-probe={id}><button data-draft={id} onClick={()=>setDraft(value=>value+1)}>{draft}</button><div id={id+'-anchor'}/></div>
}
function Harness(){navigate=useNavigate();const location=useLocation();return <><output data-location>{location.pathname+location.search+location.hash}</output><ModuleDeck/></>}
beforeEach(()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true
 vi.spyOn(console,'error').mockImplementation(()=>{})
 frames=new Map();frameId=0
 vi.stubGlobal('requestAnimationFrame',callback=>{frames.set(++frameId,callback);return frameId})
 vi.stubGlobal('cancelAnimationFrame',id=>frames.delete(id))
 activeEffects.clear();for(const id of Object.keys(pulses))delete pulses[id];broken.section=null
 localStorage.clear()
 before={...structuredClone(DEF),statsSections:['history','bodyweight'],active:{id:'kept-workout',start:1000,entries:[{id:'0025',sets:[{w:42.75,r:8,done:false}]}]},workouts:[{id:'kept-history',d:'2026-10-29',entries:[]}]}
 useStore.setState({S:structuredClone(before),user:null})
 useUI.setState({sheets:[],appTourRequest:null,appTourWorkoutPreview:false})
 raw=JSON.stringify(before);localStorage.setItem('gym_state_v1',raw)
 host=document.createElement('div');document.body.append(host);root=createRoot(host)
})
afterEach(async()=>{await act(()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals()})
const mount=path=>act(()=>root.render(<MemoryRouter initialEntries={[path]}><Harness/></MemoryRouter>))
const go=path=>act(()=>navigate(path))
const pane=id=>host.querySelector('[data-app-pane="'+id+'"]')
const preserved=()=>{expect(useStore.getState().S).toEqual(before);expect(localStorage.getItem('gym_state_v1')).toBe(raw)}
const flushFrames=()=>act(()=>{while(frames.size){const current=[...frames];frames.clear();for(const [,callback] of current)callback(0)}})

it('visits lazily, retains local drafts across modules, and makes inactive panes inert',async()=>{
 await mount('/home');expect(host.querySelector('[data-probe="nutrition"]')).toBeNull()
 await act(()=>host.querySelector('[data-draft="home"]').click())
 await go('/nutrition');await act(()=>host.querySelector('[data-draft="nutrition"]').click())
 expect(pane('home').style.display).toBe('none');expect(pane('home').inert).toBe(true);expect(pane('home').getAttribute('aria-hidden')).toBe('true')
 expect(pane('nutrition').inert).toBe(false)
 await go('/home');expect(host.querySelector('[data-draft="home"]').textContent).toBe('1')
 await go('/nutrition');expect(host.querySelector('[data-draft="nutrition"]').textContent).toBe('1');preserved()
})

it('cleans hidden effects, restores them on reveal, and suspends every page on a shell-only route',async()=>{
 await mount('/home');window.dispatchEvent(new Event('module-test-pulse'));expect(pulses.home).toBe(1)
 await go('/nutrition');expect([...activeEffects]).toEqual(['nutrition'])
 window.dispatchEvent(new Event('module-test-pulse'));expect(pulses.home).toBe(1);expect(pulses.nutrition).toBe(1)
 await go('/settings');expect([...activeEffects]).toEqual([]);expect(host.querySelector('[data-stats-control]')).toBeNull()
 expect(pane('home').style.display).toBe('none');expect(pane('nutrition').style.display).toBe('none')
 window.dispatchEvent(new Event('module-test-pulse'));expect(pulses.nutrition).toBe(1)
 await go('/home');expect([...activeEffects]).toEqual(['home']);window.dispatchEvent(new Event('module-test-pulse'));expect(pulses.home).toBe(2);preserved()
})

it('retains analytics and record drafts separately and cleans the nested inactive page effects',async()=>{
 await mount('/stats?section=history');await act(()=>host.querySelector('[data-draft="analytics"]').click())
 await go('/records');expect([...activeEffects]).toEqual(['records']);await act(()=>host.querySelector('[data-draft="records"]').click())
 await go('/stats?section=bodyweight');expect([...activeEffects]).toEqual(['analytics']);expect(host.querySelector('[data-draft="analytics"]').textContent).toBe('1')
 expect(pane('records').inert).toBe(true)
 await go('/records');expect(host.querySelector('[data-draft="records"]').textContent).toBe('1')
 await go('/workout');expect([...activeEffects]).toEqual([]);expect(host.querySelector('[data-stats-control]')).toBeNull();preserved()
})

it('shows only the Stats position above the section while preserving its accessible name and selector',async()=>{
 await mount('/stats?section=history')
 const positions=[
  ['/stats?section=history','Training history','1 / 5','analytics'],
  ['/stats?section=bodyweight','Body Weight','2 / 5','analytics'],
  ['/records','Personal records','3 / 5','records'],
  ['/history','History','4 / 5','history'],
  ['/progress','Progress Report','5 / 5','report'],
 ]
 for(const [route,label,position,id] of positions){
  await go(route)
  const heading=host.querySelector('.stats-slide-heading')
  expect(heading.textContent).toBe(position)
  expect(heading.querySelector('strong')).toBeNull()
  expect(heading.getAttribute('role')).toBe('status')
  expect(heading.getAttribute('aria-label')).toBe(label)
  expect(heading.getAttribute('aria-live')).toBe('polite')
  expect(host.querySelector('[data-stats-control]')).not.toBeNull()
  expect(pane(id).inert).toBe(false)
 }
 preserved()
})

it('recovers failed analytics on a section change or revisit without offering to discard the workout',async()=>{
 broken.section='history';await mount('/stats?section=history')
 expect(host.textContent).toContain('Something went wrong');expect(host.textContent).not.toContain('Discard the running workout')
 broken.section=null;await go('/stats?section=bodyweight')
 expect(host.textContent).not.toContain('Something went wrong');expect(host.querySelector('[data-probe="analytics"]')).not.toBeNull()
 broken.section='history';await go('/stats?section=history');expect(host.textContent).toContain('Something went wrong')
 await go('/home');broken.section=null;await go('/stats?section=history')
 expect(host.textContent).not.toContain('Something went wrong');expect([...activeEffects]).toEqual(['analytics']);preserved()
})

it('jumps to the same anchor again when a dropdown repeats the current route',async()=>{
 await mount('/home#home-anchor')
 const anchor=host.querySelector('#home-anchor'),scroll=vi.spyOn(anchor,'scrollIntoView')
 await flushFrames();expect(scroll).toHaveBeenCalledOnce()
 await go('/home#home-anchor');await flushFrames();expect(scroll).toHaveBeenCalledTimes(2);preserved()
})
