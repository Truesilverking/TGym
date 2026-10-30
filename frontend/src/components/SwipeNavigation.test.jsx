// @vitest-environment happy-dom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {MemoryRouter,useLocation} from 'react-router-dom'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import SwipeNavigation from './SwipeNavigation.jsx'
import {DEF,useStore} from '../store/useStore.js'
import {useUI} from '../store/useUI.js'
let root,host,clicked
function Page(){const loc=useLocation();return <SwipeNavigation><p data-current>{loc.pathname+loc.search}</p><button onClick={clicked}>Control</button><div role="slider"/><svg className="chart-i"/></SwipeNavigation>}
beforeEach(async()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;vi.useFakeTimers();localStorage.clear();useStore.setState({S:{...structuredClone(DEF),statsSections:['history','consistency']}});useUI.setState({sheets:[],appTourRequest:null,appTourWorkoutPreview:false});clicked=vi.fn();host=document.createElement('div');document.body.append(host);root=createRoot(host)})
afterEach(async()=>{await act(()=>root.unmount());host.remove();vi.useRealTimers();vi.restoreAllMocks()})
const current=()=>host.querySelector('[data-current]').textContent
const mount=path=>act(()=>root.render(<MemoryRouter initialEntries={[path]}><Page/></MemoryRouter>))
async function point(type,x,y=100,{id=1,target=host.querySelector('.swipe-navigation')}={}){const event=new MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y});Object.defineProperties(event,{pointerId:{value:id},isPrimary:{value:id===1}});await act(()=>target.dispatchEvent(event))}
it('moves modules with a horizontal swipe without writing the profile',async()=>{await mount('/home');const before=structuredClone(useStore.getState().S);await point('pointerdown',250);await point('pointermove',100);await point('pointerup',100);expect(current()).toBe('/plan');expect(useStore.getState().S).toEqual(before);expect(localStorage.getItem('gym_state_v1')).toBeNull()})
it('keeps a touch gesture when implicit capture transfers from a child to the navigation region',async()=>{await mount('/home');const target=host.querySelector('[data-current]');await point('pointerdown',250,100,{target});await point('pointermove',180,100,{target});await point('lostpointercapture',180,100,{target});await point('pointermove',80);await point('pointerup',80);expect(current()).toBe('/plan')})
it('exits the first Stats slide toward Nutrition and wraps its final page to Today',async()=>{await mount('/stats?section=history');await point('pointerdown',100);await point('pointermove',260);await point('pointerup',260);expect(current()).toBe('/nutrition')})
it.each(['button','[role=slider]','.chart-i'])('leaves the %s interaction to that control',async selector=>{await mount('/home');const target=host.querySelector(selector);await point('pointerdown',260,100,{target});await point('pointermove',80,100,{target});await point('pointerup',80,100,{target});expect(current()).toBe('/home')})
it('preserves vertical scrolling and Android/iPhone edge gestures',async()=>{await mount('/home');await point('pointerdown',200,100);await point('pointermove',210,240);await point('pointerup',210,240);expect(current()).toBe('/home');await point('pointerdown',8);await point('pointermove',200);await point('pointerup',200);expect(current()).toBe('/home')})
it('cancels interrupted and secondary-pointer input without navigating',async()=>{await mount('/home');await point('pointerdown',250);await point('pointermove',100);await point('pointerup',100,100,{id:2});expect(current()).toBe('/home');await point('pointercancel',100);await point('pointerup',100);expect(current()).toBe('/home')})
it('blocks navigation while a sheet covers the screen',async()=>{await mount('/home');await act(()=>useUI.setState({sheets:[{id:'cover'}]}));await point('pointerdown',260);await point('pointermove',80);await point('pointerup',80);expect(current()).toBe('/home')})
it('does not swallow a later intentional click after the swipe click guard expires',async()=>{await mount('/home');await point('pointerdown',250);await point('pointermove',100);await point('pointerup',100);await act(()=>vi.advanceTimersByTime(1));await act(()=>host.querySelector('button').click());expect(clicked).toHaveBeenCalledOnce()})
