// @vitest-environment happy-dom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import StatsSections,{normalizeStatsControlPosition,statsControlPlacement} from './StatsSections.jsx'
import {DEF,useStore} from '../store/useStore.js'
import {useUI} from '../store/useUI.js'
import {bindUI} from './ui.jsx'
import {setLang} from '../lib/i18n.js'

const effectTiming=vi.hoisted(()=>({hold:false,pending:[]}))
const nativeExclusion=vi.hoisted(()=>({sync:vi.fn()}))
vi.mock('../lib/system-appearance.js',()=>({syncStatsGestureExclusion:nativeExclusion.sync}))
vi.mock('react',async original=>{
 const actual=await original()
 return {...actual,useEffect:(callback,dependencies)=>actual.useEffect(()=>{
  // Simulate the browser input arriving after a bounds render but before its
  // passive effect. Execute the component's real callback, not a copied guard.
  if(effectTiming.hold&&dependencies?.length===4&&dependencies.every(Number.isFinite)){effectTiming.pending.push(callback);return}
  return callback()
 },dependencies)}
})

let host,root,nav,originalWidth,originalHeight
const rect=(x,y,width,height)=>({x,y,width,height,left:x,top:y,right:x+width,bottom:y+height,toJSON(){return this}})
function Sheets(){return useUI(s=>s.sheets).map(sheet=><div key={sheet.id} data-test-sheet>{sheet.render(()=>useUI.getState().closeSheet(sheet.id))}</div>)}
const trigger=()=>host.querySelector('#stats-sections-trigger'),control=()=>host.querySelector('.stats-view-control')
const mount=async()=>{await act(async()=>root.render(<><StatsSections/><Sheets/></>))}
const pointer=async(type,x,y,id=1)=>{const event=new MouseEvent(type,{bubbles:true,clientX:x,clientY:y,button:0});Object.defineProperties(event,{pointerId:{value:id},isPrimary:{value:true}});await act(()=>trigger().dispatchEvent(event))}
const click=async(detail=1)=>{await act(()=>trigger().dispatchEvent(new MouseEvent('click',{bubbles:true,detail})))}
const key=async(value,repeat=false)=>{await act(()=>trigger().dispatchEvent(new KeyboardEvent('keydown',{key:value,repeat,bubbles:true})))}
beforeEach(async()=>{
 effectTiming.hold=false;effectTiming.pending=[]
 nativeExclusion.sync.mockClear()
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;await setLang('en');localStorage.clear();sessionStorage.clear()
 originalWidth=Object.getOwnPropertyDescriptor(window,'innerWidth');originalHeight=Object.getOwnPropertyDescriptor(window,'innerHeight')
 Object.defineProperty(window,'innerWidth',{configurable:true,value:1000});Object.defineProperty(window,'innerHeight',{configurable:true,value:800})
 useStore.setState({S:{...structuredClone(DEF),statsSections:['history','consistency'],statsControlPosition:undefined},user:null,storageWarning:null});useUI.setState({sheets:[],timer:null,work:null,appTourWorkoutPreview:false});bindUI(useUI)
 host=document.createElement('div');host.id='app';document.body.append(host);vi.spyOn(host,'getBoundingClientRect').mockReturnValue(rect(100,0,800,1200))
 nav=document.createElement('nav');nav.id='tabbar';document.body.append(nav);vi.spyOn(nav,'getBoundingClientRect').mockReturnValue(rect(100,700,800,90))
 root=createRoot(host)
})
afterEach(async()=>{await act(()=>root.unmount());host.remove();nav.remove();useUI.getState().closeAll();vi.restoreAllMocks();vi.unstubAllGlobals();if(originalWidth)Object.defineProperty(window,'innerWidth',originalWidth);if(originalHeight)Object.defineProperty(window,'innerHeight',originalHeight)})

it('normalizes saved side/fraction and converts it into safe bounds',()=>{
 expect(normalizeStatsControlPosition(undefined)).toEqual({side:'right',y:.5})
 expect(normalizeStatsControlPosition({side:'invalid',y:Infinity})).toEqual({side:'right',y:.5})
 expect(normalizeStatsControlPosition({side:'left',y:5})).toEqual({side:'left',y:1})
 expect(statsControlPlacement({side:'left',y:.25},{left:100,right:856,top:8,bottom:648})).toEqual({x:100,y:168})
})
it('opens by click with a movement hint and keeps normal selection persistence',async()=>{
 await mount();expect(trigger().getAttribute('aria-label')).toBe('Stats view settings');expect(trigger().getAttribute('aria-keyshortcuts')).toContain('ArrowUp')
 expect(host.querySelector('.stats-control-hint').textContent).toContain('Drag or use arrow keys')
 expect(localStorage.getItem('gym_state_v1')).toBeNull();await click();expect(trigger().getAttribute('aria-expanded')).toBe('true')
 const box=[...host.querySelectorAll('[role=checkbox]')].find(node=>node.getAttribute('aria-label')==='Body Weight');await act(()=>box.click())
 expect(useStore.getState().S.statsSections).toEqual(['history','consistency','bodyweight'])
 expect(useStore.getState().S.statsSectionOrder).toEqual(['history','consistency','bodyweight'])
 await click();expect(trigger().getAttribute('aria-expanded')).toBe('false')
})
it('moves ephemerally, saves once at release, snaps left and suppresses the following click',async()=>{
 await mount();const edit=vi.spyOn(useStore.getState(),'update'),before=structuredClone(useStore.getState().S.workouts)
 await pointer('pointerdown',878,350);await pointer('pointermove',450,120);await pointer('pointermove',110,80)
 expect(edit).not.toHaveBeenCalled();expect(localStorage.getItem('gym_state_v1')).toBeNull();expect(control().dataset.dragging).toBe('true')
 await pointer('pointerup',110,80);expect(edit).toHaveBeenCalledOnce();expect(useStore.getState().S.statsControlPosition.side).toBe('left')
 const stored=JSON.parse(localStorage.getItem('gym_state_v1')).statsControlPosition;expect(stored).toEqual(useStore.getState().S.statsControlPosition);expect(stored.y).toBeGreaterThanOrEqual(0);expect(stored.y).toBeLessThan(1)
 await click();expect(trigger().getAttribute('aria-expanded')).toBe('false');expect(useStore.getState().S.workouts).toEqual(before)
 await click(0);expect(trigger().getAttribute('aria-expanded')).toBe('true')
})
it('treats eight pixels as jitter and opens normally without a position write',async()=>{
 await mount();await pointer('pointerdown',878,350);await pointer('pointermove',886,350);await pointer('pointerup',886,350);await click()
 expect(trigger().getAttribute('aria-expanded')).toBe('true');expect(useStore.getState().S.statsControlPosition).toBeUndefined();expect(localStorage.getItem('gym_state_v1')).toBeNull()
})
it.each(['pointercancel','lostpointercapture','Escape'])('cancels %s without saving or opening',async(reason)=>{
 await mount();const before=control().style.left;await pointer('pointerdown',878,350);await pointer('pointermove',200,100)
 if(reason==='Escape')await key('Escape');else await pointer(reason,200,100)
 expect(control().style.left).toBe(before);expect(localStorage.getItem('gym_state_v1')).toBeNull();await click();expect(trigger().getAttribute('aria-expanded')).toBe('false')
})
it('restores the saved proportional position after remount and adapts resize without writing',async()=>{
 useStore.setState({S:{...useStore.getState().S,statsControlPosition:{side:'left',y:.25}}});await mount()
 expect(control().style.left).toBe('100px');const before=control().style.top
 await act(()=>root.render(null));await mount();expect(control().style.top).toBe(before)
 vi.mocked(host.getBoundingClientRect).mockReturnValue(rect(0,0,390,1000));vi.mocked(nav.getBoundingClientRect).mockReturnValue(rect(0,600,390,80));Object.defineProperty(window,'innerWidth',{configurable:true,value:390});Object.defineProperty(window,'innerHeight',{configurable:true,value:700})
 await act(async()=>{window.dispatchEvent(new Event('resize'));await new Promise(resolve=>setTimeout(resolve,30))})
 expect(control().style.left).toBe('0px');expect(control().style.top).not.toBe(before);expect(useStore.getState().S.statsControlPosition).toEqual({side:'left',y:.25});expect(localStorage.getItem('gym_state_v1')).toBeNull()
})
it('cancels a real safe-bound change during dragging without saving or opening',async()=>{
 await mount();trigger().setPointerCapture=vi.fn();trigger().releasePointerCapture=vi.fn()
 await pointer('pointerdown',878,350);await pointer('pointermove',450,120)
 expect(control().dataset.dragging).toBe('true')
 vi.mocked(nav.getBoundingClientRect).mockReturnValue(rect(100,600,800,90))
 await act(async()=>{window.dispatchEvent(new Event('resize'));await new Promise(resolve=>setTimeout(resolve,30))})
 expect(control().dataset.dragging).toBeUndefined();expect(trigger().releasePointerCapture).toHaveBeenCalledWith(1)
 await pointer('pointerup',450,120);await click()
 expect(trigger().getAttribute('aria-expanded')).toBe('false');expect(useStore.getState().S.statsControlPosition).toBeUndefined();expect(localStorage.getItem('gym_state_v1')).toBeNull()
})
it('continues a gesture when an earlier passive effect sees the same bounds used at pointerdown',async()=>{
 effectTiming.hold=true;await mount();expect(effectTiming.pending.length).toBeGreaterThan(0)
 const update=vi.spyOn(useStore.getState(),'update').mockClear();trigger().releasePointerCapture=vi.fn()
 await pointer('pointerdown',878,350);await pointer('pointermove',200,100)
 expect(control().dataset.dragging).toBe('true')
 await act(()=>{for(const callback of effectTiming.pending.splice(0))callback()})
 expect(control().dataset.dragging).toBe('true');expect(trigger().releasePointerCapture).not.toHaveBeenCalled();expect(update).not.toHaveBeenCalled();expect(localStorage.getItem('gym_state_v1')).toBeNull()
 await pointer('pointerup',200,100);expect(update).toHaveBeenCalledOnce();expect(useStore.getState().S.statsControlPosition.side).toBe('left')
 expect(trigger().getAttribute('aria-expanded')).toBe('false')
})
it('supports keyboard edges and vertical steps without drift or repeated-key writes',async()=>{
 await mount();await key('ArrowLeft');expect(useStore.getState().S.statsControlPosition).toEqual({side:'left',y:.5})
 await key('ArrowUp',true);expect(useStore.getState().S.statsControlPosition.y).toBe(.5)
 for(let i=0;i<20;i++)await key('ArrowUp');for(let i=0;i<10;i++)await key('ArrowDown');await key('ArrowRight')
 expect(useStore.getState().S.statsControlPosition).toEqual({side:'right',y:.5})
 await click(0);expect(trigger().getAttribute('aria-expanded')).toBe('true')
})
it('retains the shared bottom sheet on mobile and closes it when unmounted',async()=>{
 vi.spyOn(window,'matchMedia').mockReturnValue({matches:true,addEventListener(){},removeEventListener(){}});await mount();await click()
 expect(host.querySelector('.stats-customization-sheet')).not.toBeNull();expect(host.querySelector('.stats-customization-popover')).toBeNull();expect(useUI.getState().sheets).toHaveLength(1)
 await act(()=>root.render(null));expect(useUI.getState().sheets).toHaveLength(0)
})
it('limits the first desktop popup to the remaining safe space before measuring its real height',async()=>{
 useStore.setState({S:{...useStore.getState().S,statsControlPosition:{side:'right',y:1}}});await mount();await click()
 const popup=host.querySelector('.stats-customization-popover'),popupTop=parseFloat(control().style.top)+parseFloat(popup.style.top)
 expect(parseFloat(popup.style.getPropertyValue('--stats-popover-max-height'))+popupTop+2).toBeLessThanOrEqual(692)
 expect(parseFloat(popup.style.getPropertyValue('--stats-popover-max-height'))).toBeLessThan(684)
})

function measureTrigger(){
 vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(){
  if(this.id==='stats-sections-trigger')return rect(parseFloat(this.parentElement.style.left),parseFloat(this.parentElement.style.top),44,44)
  return rect(0,0,0,0)
 })
}
it('publishes only the actual visible control bounds and clears the native area on popup and unmount',async()=>{
 measureTrigger();const before=useStore.getState().S
 await mount()
 expect(nativeExclusion.sync).toHaveBeenCalledWith(expect.objectContaining({left:856,top:328,right:900,bottom:372}),{width:1000,height:800})
 await click();expect(nativeExclusion.sync).toHaveBeenLastCalledWith(null)
 await click();expect(nativeExclusion.sync.mock.calls.at(-1)[0].width).toBe(44)
 await act(()=>root.render(null));expect(nativeExclusion.sync).toHaveBeenLastCalledWith(null)
 expect(useStore.getState().S).toBe(before);expect(localStorage.getItem('gym_state_v1')).toBeNull()
})
it('does not call the native bridge for pointer moves and refreshes only after the saved placement changes',async()=>{
 measureTrigger();await mount();nativeExclusion.sync.mockClear()
 await pointer('pointerdown',878,350);await pointer('pointermove',450,120);await pointer('pointermove',110,80)
 expect(nativeExclusion.sync).not.toHaveBeenCalled();expect(localStorage.getItem('gym_state_v1')).toBeNull()
 await pointer('pointerup',110,80)
 expect(nativeExclusion.sync).toHaveBeenCalledOnce()
 expect(nativeExclusion.sync.mock.calls[0][0]).toMatchObject({left:100,width:44,height:44})
})
it('removes the native gesture area while another sheet or the tour covers Stats and restores it without writes',async()=>{
 measureTrigger();await mount();const before=useStore.getState().S
 await act(()=>useUI.getState().openSheet(()=>null));expect(nativeExclusion.sync).toHaveBeenLastCalledWith(null)
 await act(()=>useUI.getState().closeAll());expect(nativeExclusion.sync.mock.calls.at(-1)[0].width).toBe(44)
 await act(()=>useUI.setState({appTourWorkoutPreview:true}));expect(nativeExclusion.sync).toHaveBeenLastCalledWith(null)
 await act(()=>useUI.setState({appTourWorkoutPreview:false}));expect(nativeExclusion.sync.mock.calls.at(-1)[0].width).toBe(44)
 expect(useStore.getState().S).toBe(before);expect(localStorage.getItem('gym_state_v1')).toBeNull()
})
