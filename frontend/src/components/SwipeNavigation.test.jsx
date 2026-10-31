// @vitest-environment happy-dom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {MemoryRouter,useLocation,useNavigate} from 'react-router-dom'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import SwipeNavigation from './SwipeNavigation.jsx'
import {DEF,useStore} from '../store/useStore.js'
import {useUI} from '../store/useUI.js'

let root,host,clicked,navigate,frames,frameId,systemReduced,motionListeners,now
const visits=[]
const roles=['button','checkbox','switch','radio','tab','combobox','spinbutton','slider']
function Page(){
 const loc=useLocation();navigate=useNavigate()
 if(visits.at(-1)!==loc.key)visits.push(loc.key)
 return <>
  <SwipeNavigation>
   <p data-current onClick={clicked}>{loc.pathname+loc.search}</p>
   <button data-control onClick={clicked}>Control</button>
   <input aria-label="Input"/><textarea aria-label="Text"/><select aria-label="Select"><option>One</option></select>
   <a href="#test">Link</a><label data-label>Label</label>
   <details><summary>Disclosure</summary><p>Details</p></details>
   {roles.map(role=><div key={role} role={role} data-role={role}><span>Role control</span></div>)}
   <div contentEditable suppressContentEditableWarning data-editable>Editable</div>
   <div contentEditable={false} data-static-editable>Static text</div>
   <div draggable data-native-drag>Native drag</div>
   <svg className="chart-i"><g data-chart-child/></svg>
   <div className="bodymap tappable"><svg><path data-muscle/></svg></div>
   <div className="zoomcal"/><div className="stats-view-control"/><div className="swipe-content"/>
   <div data-nodrag/><div data-swipe-ignore/><div hidden data-hidden-pane/>
   <div aria-hidden="true" data-app-pane="retained"><span data-retained-child/></div>
   <div data-scroll style={{overflowX:'auto'}}><span data-scroll-child>Horizontal data</span></div>
   <table><tbody><tr><td data-static-table>Static table</td></tr></tbody></table>
   <svg data-static-figure><path/></svg>
   <dialog data-modal><h2 data-modal-text>Export options</h2></dialog>
   <div data-aria-modal><p data-aria-modal-text>Dialog content</p></div>
  </SwipeNavigation>
  <button data-outside onClick={()=>navigate('/nutrition')}>Dock</button>
 </>
}
beforeEach(()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;vi.useFakeTimers();localStorage.clear()
 useStore.setState({S:{...structuredClone(DEF),statsSections:['history','consistency']}})
 useUI.setState({sheets:[],appTourRequest:null,appTourWorkoutPreview:false})
 frames=new Map();frameId=0;visits.length=0;systemReduced=false;motionListeners=new Set();now=0
 vi.spyOn(performance,'now').mockImplementation(()=>now)
 vi.stubGlobal('requestAnimationFrame',callback=>{frames.set(++frameId,callback);return frameId})
 vi.stubGlobal('cancelAnimationFrame',id=>frames.delete(id))
 vi.spyOn(window,'matchMedia').mockImplementation(()=>({get matches(){return systemReduced},addEventListener:(_,callback)=>motionListeners.add(callback),removeEventListener:(_,callback)=>motionListeners.delete(callback)}))
 clicked=vi.fn();host=document.createElement('div');document.body.append(host);root=createRoot(host)
})
afterEach(async()=>{if(root)await act(()=>root.unmount());host.remove();window.getSelection()?.removeAllRanges();vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals()})
const current=()=>host.querySelector('[data-current]').textContent
const region=()=>host.querySelector('.swipe-navigation')
const phase=()=>region().dataset.swipePhase
const content=()=>host.querySelector('.swipe-navigation-content')
const mount=path=>act(()=>root.render(<MemoryRouter initialEntries={[path]}><Page/></MemoryRouter>))
async function point(type,x,y=100,{id=1,target=region(),pointerType='touch',buttons=type==='pointerup'?0:1,button=0,isPrimary=id===1}={}){
 const event=new MouseEvent(type,{bubbles:true,cancelable:true,button,buttons,clientX:x,clientY:y})
 Object.defineProperties(event,{pointerId:{value:id},isPrimary:{value:isPrimary},pointerType:{value:pointerType}})
 await act(()=>target.dispatchEvent(event));return event
}
const tick=ms=>{now+=ms;return act(()=>vi.advanceTimersByTime(ms))}
const frame=()=>act(()=>{const pending=[...frames];frames.clear();for(const [,callback] of pending)callback(now)})
const settle=async()=>{await frame();await tick(240)}
const end=(node=content(),property='transform')=>act(()=>{const event=new Event('transitionend',{bubbles:true});Object.defineProperty(event,'propertyName',{value:property});node.dispatchEvent(event)})
const click=(target,detail=1)=>act(()=>target.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,detail})))
const swipe=async(from=250,to=100)=>{await point('pointerdown',from);await tick(16);await point('pointermove',to);await tick(16);await point('pointerup',to)}
const expectUnmoved=()=>{expect(current()).toBe('/home');expect(phase()).toBe('idle');expect(content().style.transform).toBe('')}

it('moves modules immediately on release without writing the profile',async()=>{
 await mount('/home');const before=structuredClone(useStore.getState().S)
 await swipe();expect(current()).toBe('/plan');expect(phase()).toBe('preparing')
 await settle();expect(useStore.getState().S).toEqual(before);expect(localStorage.getItem('gym_state_v1')).toBeNull()
})
it('keeps touch when implicit capture transfers from a child to the navigation region',async()=>{
 await mount('/home');const target=host.querySelector('[data-current]')
 await point('pointerdown',250,100,{target});await point('pointermove',180,100,{target});await point('lostpointercapture',180,100,{target});await point('pointermove',80);await point('pointerup',80)
 expect(current()).toBe('/plan');await settle();expect(phase()).toBe('idle')
})
it.each([['/stats?section=history',100,260,'/nutrition'],['/progress',250,100,'/home']])('continues between Stats and its neighboring module from %s',async(path,from,to,target)=>{
 await mount(path);await swipe(from,to);expect(current()).toBe(target);await settle()
})
const excluded=['[data-control]','input','textarea','select','a','[data-label]','summary','[data-editable]','[data-native-drag]',...roles.map(role=>`[data-role="${role}"] span`),'[data-chart-child]','[data-muscle]','.zoomcal','.stats-view-control','.swipe-content','[data-nodrag]','[data-swipe-ignore]']
it.each(excluded)('leaves %s interaction to that control',async selector=>{
 await mount('/home');const target=host.querySelector(selector)
 const down=await point('pointerdown',260,100,{target});await point('pointermove',80,100,{target});await point('pointerup',80,100,{target});await settle()
 expectUnmoved();expect(down.defaultPrevented).toBe(false)
})
it.each(['[data-static-editable]','[data-static-table]','[data-static-figure]'])('allows deliberate navigation from static content %s',async selector=>{
 await mount('/home');const target=host.querySelector(selector)
 await point('pointerdown',260,100,{target});await point('pointermove',80,100,{target});await point('pointerup',80,100,{target});expect(current()).toBe('/plan')
})
it.each([[210,240],[220,120]])('permanently rejects a vertical or ambiguous diagonal start (%s,%s)',async(x,y)=>{
 await mount('/home');await point('pointerdown',200,100);await point('pointermove',x,y);await point('pointermove',50,110);await point('pointerup',50,110);await settle();expectUnmoved()
})
it.each([8,window.innerWidth-8])('preserves the system edge gesture at x=%s',async x=>{
 await mount('/home');await point('pointerdown',x);await point('pointermove',x<100?250:100);await point('pointerup',x<100?250:100);expectUnmoved()
})
it('cancels interrupted input and ignores an unrelated pointerup',async()=>{
 await mount('/home');await point('pointerdown',250);await point('pointermove',100);await point('pointerup',100,100,{id:2});expect(current()).toBe('/home')
 await point('pointercancel',100);await point('pointerup',100);await settle();expectUnmoved()
})
it.each([false,true])('aborts a second touch before or after horizontal lock (locked=%s)',async locked=>{
 await mount('/home');await point('pointerdown',260);if(locked){await point('pointermove',220);await frame()}
 await point('pointerdown',200,110,{id:2});await point('pointermove',80);await point('pointerup',80);await point('pointerup',200,110,{id:2});await settle();expectUnmoved()
 await swipe();expect(current()).toBe('/plan')
})
it('blocks navigation while a sheet covers the screen',async()=>{
 await mount('/home');await act(()=>useUI.setState({sheets:[{id:'cover'}]}));await swipe();expectUnmoved()
})
it.each(['native','aria'])('leaves an open %s modal and its content untouched',async kind=>{
 await mount('/home');const dialog=host.querySelector(kind==='native'?'[data-modal]':'[data-aria-modal]')
 if(kind==='native')dialog.setAttribute('open','');else{dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true')}
 const target=dialog.querySelector(kind==='native'?'h2':'p');await point('pointerdown',260,100,{target,pointerType:'mouse'});await point('pointermove',80,100,{target,pointerType:'mouse'});await point('pointerup',80,100,{target,pointerType:'mouse'});await settle();expectUnmoved()
 if(kind==='native')expect(dialog.hasAttribute('open')).toBe(true);else expect(dialog.getAttribute('aria-modal')).toBe('true')
})
it('does not complete a drag when a native modal opens before release',async()=>{
 await mount('/home');await point('pointerdown',260);await point('pointermove',100);await frame();host.querySelector('[data-modal]').setAttribute('open','');await point('pointerup',100);await settle();expectUnmoved()
})
it('leaves an overflowing horizontal container to its own scroll interaction',async()=>{
 await mount('/home');const scroller=host.querySelector('[data-scroll]'),target=host.querySelector('[data-scroll-child]')
 Object.defineProperties(scroller,{clientWidth:{value:120},scrollWidth:{value:360}})
 await point('pointerdown',260,100,{target});await point('pointermove',80,100,{target});await point('pointerup',80,100,{target});await settle();expectUnmoved()
})
it('does not exclude a container merely because overflow auto is set when its content fits',async()=>{
 await mount('/home');const scroller=host.querySelector('[data-scroll]'),target=host.querySelector('[data-scroll-child]')
 Object.defineProperties(scroller,{clientWidth:{value:120},scrollWidth:{value:120}})
 await point('pointerdown',260,100,{target});await point('pointermove',80,100,{target});await point('pointerup',80,100,{target});expect(current()).toBe('/plan')
})
it('does not start navigation during a recent native scroll but accepts a later contact',async()=>{
 await mount('/home');await act(()=>document.dispatchEvent(new Event('scroll')));await swipe();expectUnmoved();await tick(121);await swipe();expect(current()).toBe('/plan')
})
it('cancels a pending contact when native scrolling starts',async()=>{
 await mount('/home');await point('pointerdown',250);await act(()=>document.dispatchEvent(new Event('scroll')));await point('pointermove',80);await point('pointerup',80);expectUnmoved()
})
it('preserves a focused text input rather than treating another contact as navigation',async()=>{
 await mount('/home');host.querySelector('input').focus();await swipe();expectUnmoved();expect(document.activeElement).toBe(host.querySelector('input'))
})
it('preserves a selected text range without starting navigation',async()=>{
 await mount('/home');const range=document.createRange();range.selectNodeContents(host.querySelector('[data-current]'));window.getSelection().addRange(range);await swipe();expectUnmoved();expect(window.getSelection().toString()).toBe('/home')
})
it('does not swallow a later deliberate click after the compatibility guard expires',async()=>{
 await mount('/home');await swipe();await settle();await tick(401);await click(host.querySelector('[data-control]'));expect(clicked).toHaveBeenCalledOnce()
})
it.each([[250,100,'next',1,'/plan'],[100,260,'previous',-1,'/progress']])('commits on release and enters from a bounded short offset (%s to %s)',async(from,to,direction,sign,target)=>{
 await mount('/home');vi.spyOn(region(),'getBoundingClientRect').mockReturnValue({width:390})
 await point('pointerdown',from);await point('pointermove',to);expect(phase()).toBe('dragging');expect(content().style.transform).toBe('');expect(frames.size).toBe(1)
 await frame();const dragged=Number(content().style.transform.match(/\((-?[\d.]+)px/)[1]);expect(Math.sign(dragged)).toBe(-sign);expect(Math.abs(dragged)).toBeLessThan(Math.abs(to-from))
 await point('pointerup',to);expect(current()).toBe(target);expect(phase()).toBe('preparing');expect(content().style.opacity).toBe('0.78')
 const entry=Number(content().style.transform.match(/\((-?[\d.]+)px/)[1]);expect(Math.sign(entry)).toBe(sign);expect(Math.abs(entry)).toBeGreaterThan(0);expect(Math.abs(entry)).toBeLessThanOrEqual(56);expect(region().dataset.swipeDirection).toBe(direction)
 expect(frames.size).toBe(1);await frame();expect(phase()).toBe('entering');expect(content().style.transform).toBe('');expect(content().style.opacity).toBe('')
 await end();expect(phase()).toBe('idle');expect(region().hasAttribute('aria-busy')).toBe(false)
})
it('coalesces multiple drag updates into one compositor write using the latest point',async()=>{
 await mount('/home');await point('pointerdown',300);await point('pointermove',270);await point('pointermove',240);await point('pointermove',210)
 expect(content().style.transform).toBe('');expect(frames.size).toBe(1);await frame();expect(content().style.transform).toBe('translate3d(-80px,0,0)');expect(frames.size).toBe(0)
 await point('pointercancel',210);await settle();expectUnmoved()
})
it('uses the release point and cancels an unpainted drag frame before immediate navigation',async()=>{
 await mount('/home');await point('pointerdown',300);await point('pointermove',270);expect(frames.size).toBe(1);await point('pointerup',100)
 expect(current()).toBe('/plan');expect(phase()).toBe('preparing');expect(frames.size).toBe(1);await frame();expect(phase()).toBe('entering');expect(content().style.transform).toBe('')
})
it('bounds large drag resistance instead of moving an entire viewport',async()=>{
 await mount('/home');vi.spyOn(region(),'getBoundingClientRect').mockReturnValue({width:400})
 await point('pointerdown',350);await point('pointermove',50);await frame();const first=Math.abs(Number(content().style.transform.match(/\((-?[\d.]+)px/)[1]));expect(first).toBeGreaterThan(80);expect(first).toBeLessThanOrEqual(150)
 await point('pointermove',0);await frame();const second=Math.abs(Number(content().style.transform.match(/\((-?[\d.]+)px/)[1]));expect(second).toBeGreaterThanOrEqual(first);expect(second).toBeLessThanOrEqual(150)
 await point('pointerup',0);expect(current()).toBe('/plan');await settle()
})
it('returns an insufficient slow drag with a bounded smooth settling phase',async()=>{
 await mount('/home');await point('pointerdown',250);await tick(40);await point('pointermove',210);await frame();expect(content().style.transform).not.toBe('')
 await tick(200);await point('pointerup',210);expect(current()).toBe('/home');expect(phase()).toBe('settling');expect(content().style.transform).toBe('')
 await tick(239);expect(phase()).toBe('settling');await tick(1);expect(phase()).toBe('idle')
})
it('commits exactly once when transitionend and the fallback both become due',async()=>{
 await mount('/home');await swipe();expect(current()).toBe('/plan');await frame();await end();await end();await tick(1000)
 expect(current()).toBe('/plan');expect(visits).toHaveLength(2);expect(phase()).toBe('idle')
})
it('finishes entry at its bounded fallback without waiting to change routes',async()=>{
 await mount('/home');await swipe();expect(current()).toBe('/plan');await frame();await tick(239);expect(phase()).toBe('entering');await tick(1);expect(phase()).toBe('idle');expect(visits).toHaveLength(2)
})
it('ignores transitions from a child or a non-transform property',async()=>{
 await mount('/home');await swipe();await frame();await end(host.querySelector('[data-current]'));await end(content(),'opacity');expect(phase()).toBe('entering');await end();expect(phase()).toBe('idle')
})
it.each(['sheet','external route','outside press','blur','resize'])('invalidates entry work after %s without undoing committed navigation',async cause=>{
 await mount('/home');await swipe();expect(current()).toBe('/plan')
 if(cause==='sheet')await act(()=>useUI.setState({sheets:[{id:'cover'}]}))
 if(cause==='external route')await act(()=>navigate('/nutrition'))
 if(cause==='outside press')await point('pointerdown',150,100,{target:host.querySelector('[data-outside]')})
 if(cause==='blur'||cause==='resize')await act(()=>window.dispatchEvent(new Event(cause)))
 expect(frames.size).toBe(0);await settle();expect(current()).toBe(cause==='external route'?'/nutrition':'/plan');expect(phase()).toBe('idle');expect(content().style.transform).toBe('');expect(content().style.opacity).toBe('')
})
it.each(['blur','resize','route'])('invalidates an unpainted drag frame after %s',async cause=>{
 await mount('/home');const before=structuredClone(useStore.getState().S);await point('pointerdown',250);await point('pointermove',100);expect(frames.size).toBe(1)
 if(cause==='route')await act(()=>navigate('/nutrition'));else await act(()=>window.dispatchEvent(new Event(cause)))
 expect(frames.size).toBe(0);await frame();await point('pointerup',100);await tick(1000);expect(current()).toBe(cause==='route'?'/nutrition':'/home');expect(phase()).toBe('idle');expect(content().style.transform).toBe('');expect(useStore.getState().S).toEqual(before);expect(localStorage.getItem('gym_state_v1')).toBeNull()
})
it('cancels pointer input without scheduling an old navigation',async()=>{
 await mount('/home');await point('pointerdown',250);await point('pointermove',100);await frame();await point('pointercancel',100);await point('pointerup',100);await settle();expectUnmoved()
})
it.each(['app','system'])('navigates immediately without animation for %s reduced motion',async source=>{
 if(source==='app')useStore.setState({S:{...useStore.getState().S,reduceMotion:true}});else systemReduced=true
 await mount('/home');const before=structuredClone(useStore.getState().S);await swipe();expect(current()).toBe('/plan');expect(phase()).toBe('idle');expect(frames.size).toBe(0);expect(content().style.transform).toBe('');expect(useStore.getState().S).toEqual(before)
})
it('finishes a committed navigation when reduced motion becomes active during entry preparation',async()=>{
 await mount('/home');await swipe();await act(()=>{systemReduced=true;for(const listener of motionListeners)listener()});expect(current()).toBe('/plan');expect(phase()).toBe('idle');expect(frames.size).toBe(0);await settle();expect(visits).toHaveLength(2)
})
it.each(['preparing','entering'])('accepts the first deliberate repeated gesture during %s',async state=>{
 await mount('/home');await swipe();if(state==='entering')await frame();expect(phase()).toBe(state)
 await swipe();expect(current()).toBe('/library');await settle();expect(phase()).toBe('idle');expect(visits).toHaveLength(3)
})
it('lets a deliberate new gesture interrupt snapback without losing its pointerdown',async()=>{
 await mount('/home');await point('pointerdown',250);await tick(30);await point('pointermove',210);await frame();await tick(150);await point('pointerup',210);expect(phase()).toBe('settling')
 await swipe();expect(current()).toBe('/plan');await settle();expect(phase()).toBe('idle')
})
it('consumes a compatibility click but permits a fresh control press on the committed page',async()=>{
 await mount('/home');await swipe();const button=host.querySelector('[data-control]');await click(button);expect(clicked).not.toHaveBeenCalled()
 await point('pointerdown',150,100,{target:button});await click(button);expect(clicked).toHaveBeenCalledOnce();expect(current()).toBe('/plan');await settle();expect(phase()).toBe('idle')
})
it('preserves an ordinary non-drag tap and a keyboard activation',async()=>{
 await mount('/home');const text=host.querySelector('[data-current]');await point('pointerdown',200,100,{target:text});await point('pointerup',200,100,{target:text});await click(text);expect(clicked).toHaveBeenCalledOnce()
 await swipe();await click(host.querySelector('[data-control]'),0);expect(clicked).toHaveBeenCalledTimes(2)
})
it('rejects a stationary hold longer than500ms instead of converting it to navigation',async()=>{
 await mount('/home');await point('pointerdown',250);await tick(501);await point('pointermove',80);await point('pointerup',80);await settle();expectUnmoved()
})
it('recognizes a recent short flick independently of the earlier contact duration',async()=>{
 await mount('/home');await point('pointerdown',250);await tick(350);await point('pointermove',245);await tick(20);await point('pointermove',205);await tick(16);await point('pointerup',205);expect(current()).toBe('/plan')
})
it('does not use stale flick velocity after a release pause',async()=>{
 await mount('/home');await point('pointerdown',250);await tick(20);await point('pointermove',205);await frame();await tick(150);await point('pointerup',205);await settle();expectUnmoved()
})
it('treats a deliberate final reversal as staying on the current page',async()=>{
 await mount('/home');await point('pointerdown',300);await tick(20);await point('pointermove',150);await frame();await tick(20);await point('pointermove',220);await tick(16);await point('pointerup',220);await settle();expectUnmoved()
})
it.each(['[data-hidden-pane]','[data-retained-child]'])('ignores input in hidden retained content %s',async selector=>{
 await mount('/home');const target=host.querySelector(selector);await point('pointerdown',250,100,{target});await point('pointermove',100,100,{target});await point('pointerup',100,100,{target});await settle();expectUnmoved();expect(visits).toHaveLength(1)
})
it('prevents native text dragging only after confirmed horizontal intent',async()=>{
 await mount('/home');const text=host.querySelector('[data-current]')
 const drag=async()=>{const event=new Event('dragstart',{bubbles:true,cancelable:true});await act(()=>text.dispatchEvent(event));return event.defaultPrevented}
 expect(await drag()).toBe(false);await point('pointerdown',250,100,{target:text});expect(await drag()).toBe(false);await point('pointermove',180,100,{target:text});expect(await drag()).toBe(true);await point('pointercancel',180);expect(await drag()).toBe(false)
})
it('rejects released mouse movement and context-menu interruption without navigating',async()=>{
 await mount('/home');await point('pointerdown',250,100,{pointerType:'mouse'});await point('pointermove',100,100,{pointerType:'mouse',buttons:0});await point('pointerup',100,100,{pointerType:'mouse'});await settle();expectUnmoved()
 await point('pointerdown',250);await point('pointermove',100);await frame();await act(()=>region().dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true})));await point('pointerup',100);await settle();expectUnmoved()
})
it('supports focused keyboard navigation and does not steal inner-control arrow keys',async()=>{
 await mount('/home');await act(()=>host.querySelector('[data-control]').dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'ArrowRight'})));expectUnmoved()
 await act(()=>region().dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'ArrowRight'})));expect(current()).toBe('/plan');await settle();expect(visits).toHaveLength(2)
})

it('has a bounded preparation fallback even if no animation frame is ever delivered',async()=>{
 await mount('/home');await swipe();expect(current()).toBe('/plan');expect(phase()).toBe('preparing');expect(frames.size).toBe(1)
 await tick(239);expect(phase()).toBe('preparing');await tick(1);expect(phase()).toBe('idle');expect(frames.size).toBe(0);expect(content().style.transform).toBe('');expect(content().style.opacity).toBe('')
})
it('ignores a stale entry callback after direct navigation invalidates its generation',async()=>{
 await mount('/home');await swipe();const obsolete=[...frames.values()][0];await act(()=>navigate('/nutrition'));expect(phase()).toBe('idle')
 await act(()=>obsolete(now));expect(current()).toBe('/nutrition');expect(phase()).toBe('idle');expect(content().style.transform).toBe('');expect(content().style.opacity).toBe('')
})
it('does not let a replaced entry callback advance a newer preparation',async()=>{
 await mount('/home');await swipe();const obsolete=[...frames.values()][0];await swipe();expect(current()).toBe('/library');expect(phase()).toBe('preparing');const latestOffset=content().style.transform
 await act(()=>obsolete(now));expect(phase()).toBe('preparing');expect(content().style.transform).toBe(latestOffset);await frame();expect(phase()).toBe('entering');await end();expect(phase()).toBe('idle')
})
it('stops queued entry paint when a native dialog opens before the frame',async()=>{
 await mount('/home');await swipe();host.querySelector('[data-modal]').setAttribute('open','');await frame();expect(current()).toBe('/plan');expect(phase()).toBe('idle');expect(content().style.transform).toBe('');expect(content().style.opacity).toBe('');expect(frames.size).toBe(0)
})
it('does not paint a queued drag behind a newly opened native dialog',async()=>{
 await mount('/home');await point('pointerdown',250);await point('pointermove',100);expect(frames.size).toBe(1);host.querySelector('[data-modal]').setAttribute('open','');await frame();expectUnmoved();await point('pointerup',100);expect(current()).toBe('/home')
})
it('clears only text selection made after a contact becomes an intentional horizontal drag',async()=>{
 await mount('/home');const text=host.querySelector('[data-current]');await point('pointerdown',250,100,{target:text});const range=document.createRange();range.selectNodeContents(text);window.getSelection().addRange(range);expect(window.getSelection().toString()).toBe('/home')
 await point('pointermove',100,100,{target:text});expect(window.getSelection().toString()).toBe('');await point('pointerup',100);expect(current()).toBe('/plan')
})
it('aborts a pending first contact when a second touch starts outside the region',async()=>{
 await mount('/home');await point('pointerdown',250);await point('pointerdown',180,110,{id:2,target:host.querySelector('[data-outside]')});await point('pointermove',100);await point('pointerup',100);await point('pointerup',180,110,{id:2,target:host.querySelector('[data-outside]')});await settle();expectUnmoved()
})
it('cancels actual capture loss on the region without confusing it with child transfer',async()=>{
 await mount('/home');await point('pointerdown',250);await point('pointermove',100);await frame();await point('lostpointercapture',100);await point('pointerup',100);await settle();expectUnmoved()
})

it.each(['/workout','/settings','/plan/r/example'])('does not extend or navigate the blank region on shell-only route %s',async path=>{
 await mount(path);expect(region().hasAttribute('data-swipe-available')).toBe(false);await swipe();await settle();expect(current()).toBe(path);expect(phase()).toBe('idle');expect(content().style.transform).toBe('')
})
it.each([['/home','/plan'],['/stats?section=history','/stats?section=consistency']])('accepts a deliberate gesture directly on available blank space for %s',async(path,target)=>{
 await mount(path);expect(region().dataset.swipeAvailable).toBe('true');const y=window.innerHeight-40
 await point('pointerdown',250,y);await point('pointermove',100,y);await point('pointerup',100,y);expect(current()).toBe(target);await settle();expect(phase()).toBe('idle')
})
it('removes the full-height surface marker when navigating out of the module deck',async()=>{
 await mount('/home');expect(region().dataset.swipeAvailable).toBe('true');await act(()=>navigate('/settings'));expect(region().hasAttribute('data-swipe-available')).toBe(false)
 await act(()=>navigate('/stats?section=history'));expect(region().dataset.swipeAvailable).toBe('true')
})
it('measures document top rather than scrolled viewport top and refreshes it on resize',async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(window,'scrollY');let top=34
 Object.defineProperty(window,'scrollY',{configurable:true,value:120})
 vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(){return{top:this.classList.contains('swipe-navigation')?top:0,width:390}})
 try{await mount('/home');expect(region().style.getPropertyValue('--swipe-surface-top')).toBe('154px');top=54;await act(()=>window.dispatchEvent(new Event('resize')));expect(region().style.getPropertyValue('--swipe-surface-top')).toBe('174px')}
 finally{if(descriptor)Object.defineProperty(window,'scrollY',descriptor);else delete window.scrollY}
})
it('refreshes measured top on parent size changes and disconnects the observer on unmount',async()=>{
 let changed,top=28;const observer={observe:vi.fn(),disconnect:vi.fn()}
 vi.stubGlobal('ResizeObserver',class{constructor(callback){changed=callback;return observer}})
 vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(){return{top:this.classList.contains('swipe-navigation')?top:0,width:390}})
 await mount('/home');expect(observer.observe).toHaveBeenCalledWith(region().parentElement);expect(region().style.getPropertyValue('--swipe-surface-top')).toBe('28px')
 top=72;await act(()=>changed([]));expect(region().style.getPropertyValue('--swipe-surface-top')).toBe('28px');expect(frames.size).toBe(1);await frame();expect(region().style.getPropertyValue('--swipe-surface-top')).toBe('72px');const beforeDisconnect=observer.disconnect.mock.calls.length;await act(()=>root.unmount());root=null;expect(observer.disconnect).toHaveBeenCalledTimes(beforeDisconnect+1)
})

it.each(['add','remove'])('refreshes top after banner %s without requiring a parent-size change and cleans observers',async change=>{
 host.id='app';let resized,mutated;const watched=new Set(),banner=document.createElement('aside');banner.dataset.banner=''
 const sizeObserver={observe:vi.fn(node=>watched.add(node)),disconnect:vi.fn(()=>watched.clear())}
 const structureObserver={observe:vi.fn(),disconnect:vi.fn()}
 vi.stubGlobal('ResizeObserver',class{constructor(callback){resized=callback;return sizeObserver}})
 vi.stubGlobal('MutationObserver',class{constructor(callback){mutated=callback;return structureObserver}})
 vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(){return{top:this.classList.contains('swipe-navigation')?(banner.parentElement===host?76:28):0,width:390,height:844}})
 await mount('/home');expect(structureObserver.observe).toHaveBeenCalledWith(host,{childList:true});expect(watched.has(host)).toBe(true);expect(watched.has(region())).toBe(true);expect(frames.size).toBe(0);expect(region().style.getPropertyValue('--swipe-surface-top')).toBe('28px')
 if(change==='remove'){host.prepend(banner);await act(()=>mutated([{type:'childList',addedNodes:[banner],removedNodes:[]} ]));await frame();expect(region().style.getPropertyValue('--swipe-surface-top')).toBe('76px');expect(watched.has(banner)).toBe(true)}
 const previousTop=region().style.getPropertyValue('--swipe-surface-top')
 if(change==='add')host.prepend(banner);else banner.remove()
 const mutation={type:'childList',addedNodes:change==='add'?[banner]:[],removedNodes:change==='remove'?[banner]:[]}
 await act(()=>{mutated([mutation]);resized([]);mutated([mutation])})
 expect(region().style.getPropertyValue('--swipe-surface-top')).toBe(previousTop);expect(frames.size).toBe(1);await frame();expect(region().style.getPropertyValue('--swipe-surface-top')).toBe(change==='add'?'76px':'28px');expect(watched.has(banner)).toBe(change==='add');expect(frames.size).toBe(0)
 await act(()=>resized([]));expect(frames.size).toBe(1);await act(()=>root.unmount());root=null;expect(frames.size).toBe(0);expect(structureObserver.disconnect).toHaveBeenCalledOnce();expect(watched.size).toBe(0)
})
it('refreshes the empty-space surface after the parent entrance animation, ignoring child animations',async()=>{
 let top=14
 vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(){return{top:this.classList.contains('swipe-navigation')?top:0,width:390,height:844}})
 await mount('/home');expect(region().style.getPropertyValue('--swipe-surface-top')).toBe('14px')
 top=10
 await act(()=>content().dispatchEvent(new Event('animationend',{bubbles:true})))
 expect(region().style.getPropertyValue('--swipe-surface-top')).toBe('14px')
 await act(()=>region().parentElement.dispatchEvent(new Event('animationend',{bubbles:true})))
 expect(region().style.getPropertyValue('--swipe-surface-top')).toBe('10px')
})
