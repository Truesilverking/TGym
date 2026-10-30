// @vitest-environment happy-dom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {MemoryRouter,useLocation,useNavigate} from 'react-router-dom'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import SwipeNavigation from './SwipeNavigation.jsx'
import {DEF,useStore} from '../store/useStore.js'
import {useUI} from '../store/useUI.js'
let root,host,clicked,navigate,frames,frameId,systemReduced,motionListeners
const visits=[]
function Page(){const loc=useLocation();navigate=useNavigate();if(visits.at(-1)!==loc.key)visits.push(loc.key);return <><SwipeNavigation><p data-current>{loc.pathname+loc.search}</p><button onClick={clicked}>Control</button><div role="slider"/><svg className="chart-i"/><div className="zoomcal"/><div className="stats-view-control"/><div data-swipe-ignore/><div hidden data-hidden-pane/></SwipeNavigation><button data-outside onClick={()=>navigate('/nutrition')}>Dock</button></>}
beforeEach(async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;vi.useFakeTimers();localStorage.clear();useStore.setState({S:{...structuredClone(DEF),statsSections:['history','consistency']}});useUI.setState({sheets:[],appTourRequest:null,appTourWorkoutPreview:false})
 frames=new Map();frameId=0;visits.length=0;systemReduced=false;motionListeners=new Set()
 vi.stubGlobal('requestAnimationFrame',callback=>{frames.set(++frameId,callback);return frameId});vi.stubGlobal('cancelAnimationFrame',id=>frames.delete(id))
 vi.spyOn(window,'matchMedia').mockImplementation(()=>({get matches(){return systemReduced},addEventListener:(_,callback)=>motionListeners.add(callback),removeEventListener:(_,callback)=>motionListeners.delete(callback)}))
 clicked=vi.fn();host=document.createElement('div');document.body.append(host);root=createRoot(host)
})
afterEach(async()=>{await act(()=>root.unmount());host.remove();vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals()})
const current=()=>host.querySelector('[data-current]').textContent
const mount=path=>act(()=>root.render(<MemoryRouter initialEntries={[path]}><Page/></MemoryRouter>))
async function point(type,x,y=100,{id=1,target=host.querySelector('.swipe-navigation')}={}){const event=new MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y});Object.defineProperties(event,{pointerId:{value:id},isPrimary:{value:id===1}});await act(()=>target.dispatchEvent(event))}
const phase=()=>host.querySelector('.swipe-navigation').dataset.swipePhase
const content=()=>host.querySelector('.swipe-navigation-content')
const tick=ms=>act(()=>vi.advanceTimersByTime(ms))
const frame=()=>act(()=>{const pending=[...frames];frames.clear();for(const [,callback] of pending)callback(0)})
const settle=async()=>{await tick(200);await frame();await frame();await tick(240)}
const end=()=>act(()=>{const event=new Event('transitionend',{bubbles:true});Object.defineProperty(event,'propertyName',{value:'transform'});content().dispatchEvent(event)})
const swipe=async(from=250,to=100)=>{await point('pointerdown',from);await point('pointermove',to);await point('pointerup',to)}
it('moves modules with a horizontal swipe without writing the profile',async()=>{await mount('/home');const before=structuredClone(useStore.getState().S);await swipe();await settle();expect(current()).toBe('/plan');expect(useStore.getState().S).toEqual(before);expect(localStorage.getItem('gym_state_v1')).toBeNull()})
it('keeps a touch gesture when implicit capture transfers from a child to the navigation region',async()=>{await mount('/home');const target=host.querySelector('[data-current]');await point('pointerdown',250,100,{target});await point('pointermove',180,100,{target});await point('lostpointercapture',180,100,{target});await point('pointermove',80);await point('pointerup',80);await settle();expect(current()).toBe('/plan')})
it('exits the first Stats slide toward Nutrition and wraps its final page to Today',async()=>{await mount('/stats?section=history');await swipe(100,260);await settle();expect(current()).toBe('/nutrition')})
it.each(['button','[role=slider]','.chart-i','.zoomcal','.stats-view-control','[data-swipe-ignore]'])('leaves the %s interaction to that control',async selector=>{await mount('/home');const target=host.querySelector(selector);await point('pointerdown',260,100,{target});await point('pointermove',80,100,{target});await point('pointerup',80,100,{target});await settle();expect(current()).toBe('/home')})
it('preserves vertical scrolling and Android/iPhone edge gestures',async()=>{await mount('/home');await point('pointerdown',200,100);await point('pointermove',210,240);await point('pointerup',210,240);expect(current()).toBe('/home');await point('pointerdown',8);await point('pointermove',200);await point('pointerup',200);expect(current()).toBe('/home')})
it('cancels interrupted and secondary-pointer input without navigating',async()=>{await mount('/home');await point('pointerdown',250);await point('pointermove',100);await point('pointerup',100,100,{id:2});expect(current()).toBe('/home');await point('pointercancel',100);await point('pointerup',100);expect(current()).toBe('/home')})
it('blocks navigation while a sheet covers the screen',async()=>{await mount('/home');await act(()=>useUI.setState({sheets:[{id:'cover'}]}));await point('pointerdown',260);await point('pointermove',80);await point('pointerup',80);expect(current()).toBe('/home')})
it('does not swallow a later intentional click after the swipe click guard expires',async()=>{await mount('/home');await swipe();await settle();await tick(401);await act(()=>host.querySelector('button').dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1})));expect(clicked).toHaveBeenCalledOnce()})

it.each([[250,100,'next',-1,'/plan'],[100,260,'previous',1,'/progress']])('tracks the finger and animates the outgoing and incoming pages in opposite directions',async(from,to,direction,sign,target)=>{
 await mount('/home');const width=window.innerWidth
 await point('pointerdown',from);await point('pointermove',to)
 expect(phase()).toBe('dragging');expect(content().style.transform).toBe(`translate3d(${to-from}px,0,0)`)
 await point('pointerup',to)
 expect(phase()).toBe('leaving');expect(current()).toBe('/home');expect(content().style.transform).toBe(`translate3d(${sign*width}px,0,0)`)
 expect(host.querySelector('.swipe-navigation').dataset.swipeDirection).toBe(direction)
 await end();expect(current()).toBe(target);expect(phase()).toBe('preparing');expect(content().style.transform).toBe(`translate3d(${-sign*width}px,0,0)`)
 await frame();expect(phase()).toBe('preparing');await frame();expect(phase()).toBe('entering');expect(content().style.transform).toBe('')
 await end();expect(phase()).toBe('idle');expect(host.querySelector('.swipe-navigation').hasAttribute('aria-busy')).toBe(false)
})

it('commits exactly once when transitionend and its fallback both become due',async()=>{
 await mount('/home');await swipe();await end();expect(current()).toBe('/plan');await end();await settle();await tick(1000)
 expect(current()).toBe('/plan');expect(visits).toHaveLength(2);expect(phase()).toBe('idle')
})

it('uses a bounded fallback when the browser does not dispatch transitionend',async()=>{
 await mount('/home');await swipe();await tick(199);expect(current()).toBe('/home');await tick(1);expect(current()).toBe('/plan')
 await frame();await frame();await tick(240);expect(phase()).toBe('idle');expect(visits).toHaveLength(2)
})

it.each(['sheet','external route','outside press','blur'])('cancels pending animation navigation after %s',async cause=>{
 await mount('/home');await swipe()
 if(cause==='sheet')await act(()=>useUI.setState({sheets:[{id:'cover'}]}))
 if(cause==='external route')await act(()=>navigate('/nutrition'))
 if(cause==='outside press')await point('pointerdown',150,100,{target:host.querySelector('[data-outside]')})
 if(cause==='blur')await act(()=>window.dispatchEvent(new Event('blur')))
 await settle();expect(current()).toBe(cause==='external route'?'/nutrition':'/home');expect(phase()).toBe('idle');expect(content().style.transform).toBe('')
})

it('cancels a pointer gesture without scheduling an old navigation',async()=>{
 await mount('/home');await point('pointerdown',250);await point('pointermove',100);await point('pointercancel',100);await point('pointerup',100);await settle()
 expect(current()).toBe('/home');expect(phase()).toBe('idle');expect(content().style.transform).toBe('')
})

it.each(['app','system'])('navigates immediately without animation when %s reduced motion is enabled',async source=>{
 if(source==='app')useStore.setState({S:{...useStore.getState().S,reduceMotion:true}});else systemReduced=true
 await mount('/home');const before=structuredClone(useStore.getState().S);await swipe()
 expect(current()).toBe('/plan');expect(phase()).toBe('idle');expect(frames.size).toBe(0);expect(content().style.transform).toBe('');expect(useStore.getState().S).toEqual(before)
})

it('finishes a committed navigation immediately if reduced motion is enabled mid-exit',async()=>{
 await mount('/home');await swipe();await act(()=>{systemReduced=true;for(const listener of motionListeners)listener()})
 expect(current()).toBe('/plan');expect(phase()).toBe('idle');await settle();expect(visits).toHaveLength(2)
})

it('consumes the compatibility click while allowing a new deliberate control press',async()=>{
 await mount('/home');await swipe();await tick(20)
 const button=host.querySelector('button')
 await act(()=>button.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,detail:1})));expect(clicked).not.toHaveBeenCalled()
 await point('pointerdown',150,100,{target:button});await act(()=>button.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1})))
 expect(clicked).toHaveBeenCalledOnce();await settle();expect(current()).toBe('/home')
})

it('tracks large drags one-to-one up to three quarters of the real content width',async()=>{
 await mount('/home');vi.spyOn(host.querySelector('.swipe-navigation'),'getBoundingClientRect').mockReturnValue({width:400})
 await point('pointerdown',350);await point('pointermove',50);expect(content().style.transform).toBe('translate3d(-300px,0,0)')
 await point('pointermove',0);expect(content().style.transform).toBe('translate3d(-309px,0,0)')
 await point('pointerup',0);expect(content().style.transform).toBe('translate3d(-400px,0,0)');await settle();expect(current()).toBe('/plan')
})

it('ignores synthetic gestures targeted at a hidden retained pane',async()=>{
 await mount('/home');const target=host.querySelector('[data-hidden-pane]')
 await point('pointerdown',250,100,{target});await point('pointermove',100,100,{target});await point('pointerup',100,100,{target});await settle()
 expect(current()).toBe('/home');expect(phase()).toBe('idle');expect(visits).toHaveLength(1)
})

it('prevents native text dragging only while a noninteractive navigation gesture owns the pointer',async()=>{
 await mount('/home');const text=host.querySelector('[data-current]')
 let event=new Event('dragstart',{bubbles:true,cancelable:true});await act(()=>text.dispatchEvent(event));expect(event.defaultPrevented).toBe(false)
 await point('pointerdown',250,100,{target:text})
 event=new Event('dragstart',{bubbles:true,cancelable:true});await act(()=>text.dispatchEvent(event));expect(event.defaultPrevented).toBe(true)
 await point('pointercancel',250)
 event=new Event('dragstart',{bubbles:true,cancelable:true});await act(()=>text.dispatchEvent(event));expect(event.defaultPrevented).toBe(false)
})
