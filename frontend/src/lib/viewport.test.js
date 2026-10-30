// @vitest-environment happy-dom
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { installViewportLayout } from './viewport.js'
let stop, viewport
const css = name => document.documentElement.style.getPropertyValue(name)
const flush = async () => { await vi.advanceTimersByTimeAsync(32) }
const bounds=(node,top,width=390,height=84)=>{const rect={top,width,height};node.getBoundingClientRect=()=>rect;node.getClientRects=()=>[rect]}
beforeEach(() => {
  vi.useFakeTimers()
  document.body.innerHTML = '<div id="root"><main id="app"><input></main><nav id="tabbar"></nav></div>'
  Object.defineProperties(window, { innerWidth: {value:390,configurable:true}, innerHeight: {value:844,configurable:true} })
  viewport = new EventTarget()
  Object.assign(viewport,{height:844,offsetTop:0,scale:1})
  Object.defineProperty(window,'visualViewport',{value:viewport,configurable:true})
  bounds(document.getElementById('tabbar'),760)
})
afterEach(() => { stop?.(); vi.useRealTimers(); document.body.innerHTML='' })
it('reserves only the actual fixed controls and updates when a timer mounts or disappears', async () => {
  stop=installViewportLayout()
  expect(css('--bottom-clearance')).toBe('84px')
  const timer=document.createElement('div');timer.id='timer';bounds(timer,620,360,128)
  document.getElementById('root').append(timer);await flush()
  expect(css('--bottom-clearance')).toBe('224px')
  timer.remove();await flush();expect(css('--bottom-clearance')).toBe('84px')
})
it('adapts to a keyboard that shrinks only the visual viewport, then restores on close', async () => {
  stop=installViewportLayout();document.querySelector('input').focus()
  Object.assign(viewport,{height:390,offsetTop:40});viewport.dispatchEvent(new Event('resize'));await flush()
  expect(document.documentElement.dataset.keyboard).toBe('true')
  expect(css('--available-height')).toBe('390px');expect(css('--visual-top')).toBe('40px')
  document.querySelector('input').blur();Object.assign(viewport,{height:844,offsetTop:0});viewport.dispatchEvent(new Event('resize'));await flush()
  expect(document.documentElement.dataset.keyboard).toBe('false');expect(css('--available-height')).toBe('100dvh')
})
it('detects a keyboard that resizes the layout viewport without treating landscape as a keyboard', async () => {
  stop=installViewportLayout();document.querySelector('input').focus()
  Object.defineProperty(window,'innerHeight',{value:390,configurable:true});viewport.height=390;window.dispatchEvent(new Event('resize'));await flush()
  expect(document.documentElement.dataset.keyboard).toBe('true')
  document.querySelector('input').blur();Object.defineProperties(window,{innerWidth:{value:844,configurable:true},innerHeight:{value:390,configurable:true}})
  window.dispatchEvent(new Event('resize'));await flush();expect(document.documentElement.dataset.keyboard).toBe('false')
})
it('does not mistake pinch zoom for a keyboard or retain listeners after cleanup', async () => {
  stop=installViewportLayout();document.querySelector('input').focus()
  viewport.scale=2;viewport.height=422;viewport.dispatchEvent(new Event('resize'));await flush()
  expect(document.documentElement.dataset.keyboard).toBe('false');expect(css('--visual-height')).toBe('844px')
  stop();stop=null;viewport.scale=1;viewport.dispatchEvent(new Event('resize'));await flush()
  expect(css('--visual-height')).toBe('');expect(document.documentElement.dataset.keyboard).toBeUndefined()
})

it('reserves the actual nested Start hex above the dock while ignoring hidden module slots',async()=>{
 const nav=document.getElementById('tabbar');nav.className='navigation-dock'
 nav.innerHTML='<div class="navigation-dock-modules"><div class="navigation-dock-slot" inert aria-hidden="true"><button>Hidden module</button></div><button class="start"><span class="cir">Start</span></button></div><button id="navigation-dock-toggle">Lift</button>'
 bounds(nav.querySelector('.navigation-dock-modules'),760)
 bounds(nav.querySelector('.navigation-dock-slot'),400)
 bounds(nav.querySelector('.navigation-dock-slot button'),400)
 bounds(nav.querySelector('.start'),738,70,74);bounds(nav.querySelector('.cir'),728,60,52)
 bounds(nav.querySelector('#navigation-dock-toggle'),800,88,44)
 stop=installViewportLayout();expect(css('--nav-clearance')).toBe('116px');expect(css('--bottom-clearance')).toBe('116px')
 nav.querySelector('.cir').style.display='none';window.dispatchEvent(new Event('resize'));await flush()
 expect(css('--nav-clearance')).toBe('106px')
})

it('drops the dock clearance when the keyboard hides it or onboarding removes it',async()=>{
 const nav=document.getElementById('tabbar');nav.innerHTML='<button class="start"><span class="cir">Start</span></button>'
 bounds(nav.querySelector('.start'),738,70,74);bounds(nav.querySelector('.cir'),740,60,52)
 stop=installViewportLayout();expect(css('--nav-clearance')).toBe('106px')
 nav.style.display='none';window.dispatchEvent(new Event('resize'));await flush();expect(css('--nav-clearance')).toBe('0px')
 nav.remove();await flush();expect(css('--bottom-clearance')).toBe('0px')
})
