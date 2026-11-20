// @vitest-environment happy-dom
import React,{act,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import BodyWeightPicker from './BodyWeightPicker.jsx'
import {setLang,t} from '../lib/i18n.js'

let host,root,changed,validity,setCanonical,pointerTime
beforeEach(async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;await setLang('en');localStorage.clear()
 changed=vi.fn();validity=vi.fn();pointerTime=0;host=document.createElement('div');document.body.append(host);root=createRoot(host)
})
afterEach(async()=>{await act(()=>root.unmount());host.remove();vi.restoreAllMocks()})
function Controlled({initial=80,unit='kg',disabled=false}){
 const [value,setValue]=useState(initial);setCanonical=setValue
 return <BodyWeightPicker value={value} unit={unit} disabled={disabled} onValidityChange={validity} onChange={next=>{changed(next);setValue(next)}}/>
}
const mount=async props=>act(()=>root.render(<Controlled {...props}/>))
const field=()=>host.querySelector(`input[aria-label="${t('Weight')}"]`)
const ruler=()=>host.querySelector('[role=slider]')
const amount=()=>Number(ruler().getAttribute('aria-valuenow'))
const enter=async raw=>act(()=>{
 const input=field();input.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,raw)
 input.dispatchEvent(new Event('input',{bubbles:true}));input.blur()
})
const key=async value=>act(()=>ruler().dispatchEvent(new KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true})))
const pointer=async(type,x,y,id=1)=>{
 const event=new MouseEvent(type,{clientX:x,clientY:y,button:0,bubbles:true,cancelable:true})
 Object.defineProperties(event,{pointerId:{value:id},isPrimary:{value:true},timeStamp:{value:pointerTime+=200}})
 await act(()=>ruler().dispatchEvent(event))
 if(type==='pointermove')await act(()=>new Promise(requestAnimationFrame))
 return event
}

it.each([['kg',80,300],['lb',176.4,660]])('uses the configured %s unit with an accessible decimal field and no unit selector',async(unit,initial,max)=>{
 await mount({unit,initial})
 expect(field().inputMode).toBe('decimal');expect(field().getAttribute('aria-invalid')).toBeNull()
 expect(host.querySelectorAll('button,fieldset')).toHaveLength(0)
 expect(ruler().getAttribute('aria-label')).toBe(t('Weight ruler'));expect(ruler().tabIndex).toBe(0)
 expect(ruler().getAttribute('aria-orientation')).toBe('horizontal')
 expect(Number(ruler().getAttribute('aria-valuemin'))).toBe(1);expect(Number(ruler().getAttribute('aria-valuemax'))).toBe(max)
 expect(Number(ruler().getAttribute('aria-valuenow'))).toBe(initial);expect(ruler().getAttribute('aria-valuetext')).toBe(`${Math.round(initial)} ${unit}`)
 expect(field().value).toBe(String(Math.round(initial)))
 expect(document.getElementById(ruler().getAttribute('aria-describedby'))).not.toBeNull()
 expect(changed).not.toHaveBeenCalled();expect(validity).toHaveBeenLastCalledWith(true);expect(localStorage.getItem('gym_state_v1')).toBeNull()
})

it.each([[80.123,'kg',80],[176.456,'lb',176]])('focuses or blurs %s %s without rounding the controlled canonical value',async(initial,unit,display)=>{
 await mount({initial,unit})
 for(let i=0;i<8;i++)await act(()=>{field().focus();field().blur()})
 expect(Number(ruler().getAttribute('aria-valuenow'))).toBe(initial);expect(field().value).toBe(String(display))
 expect(changed).not.toHaveBeenCalled();expect(localStorage.getItem('gym_state_v1')).toBeNull()
})

it('formats a large legacy value without grouping or canonical drift when focused or blurred',async()=>{
 for(const lang of ['en','es']){
  await setLang(lang);await act(()=>root.render(<Controlled key={lang} initial={1000}/>))
  expect(field().value).toBe('1000');expect(ruler().getAttribute('aria-valuetext')).toBe('1000 kg')
  await act(()=>{field().focus();field().blur()});expect(changed).not.toHaveBeenCalled()
  expect(field().value).toBe('1000');expect(Number(ruler().getAttribute('aria-valuenow'))).toBe(1000)
 }
 expect(changed).not.toHaveBeenCalled();expect(localStorage.getItem('gym_state_v1')).toBeNull()
})

it.each([['kg','80.123',80.123],['lb','176.567',176.567]])('edits %s directly in that configured canonical unit without conversion',async(unit,text,expected)=>{
 await mount({unit});await enter(text)
 expect(changed).toHaveBeenCalledExactlyOnceWith(expected)
 expect(Number(ruler().getAttribute('aria-valuenow'))).toBe(expected)
 expect(ruler().getAttribute('aria-valuetext')).toMatch(new RegExp(` ${unit}$`))
})

it('accepts a comma decimal and uses its locale for the accessible ruler value',async()=>{
 await setLang('es');await mount();await enter('80,5')
 expect(changed).toHaveBeenCalledExactlyOnceWith(80.5);expect(ruler().getAttribute('aria-valuetext')).toBe('81 kg');expect(field().value).toBe('81')
})

it.each(['','bad','0','Infinity','301'])('keeps invalid draft %j visible and invalid instead of emitting a stale or coerced value',async raw=>{
 await mount();await enter(raw)
 expect(changed).not.toHaveBeenCalled();expect(validity).toHaveBeenLastCalledWith(false)
 expect(field().getAttribute('aria-invalid')).toBe('true');expect(host.querySelector('[role=alert]')).not.toBeNull()
 expect(document.getElementById(field().getAttribute('aria-describedby')).getAttribute('role')).toBe('alert')
 await act(()=>{field().focus();field().blur()});expect(field().value).toBe(raw);expect(changed).not.toHaveBeenCalled();expect(validity).toHaveBeenLastCalledWith(false)
})

it.each([['kg',80,300],['lb',176.4,660]])('steps the configured %s unit from keyboard and respects both limits',async(unit,initial,max)=>{
 await mount({unit,initial})
 const tick=n=>Number((initial+n).toFixed(1)),width=field().style.width
 for(const [pressed,expected] of [['ArrowRight',tick(.1)],['ArrowUp',tick(.2)],['ArrowLeft',tick(.1)],['ArrowDown',initial],['PageUp',tick(1)],['PageDown',initial],['Home',1],['ArrowDown',1],['End',max],['ArrowUp',max]]){
  await key(pressed);expect(amount()).toBe(expected);expect(field().style.width).toBe(width)
 }
})

it('previews a horizontal drag locally and commits its canonical value exactly once on release',async()=>{
 await mount();ruler().setPointerCapture=vi.fn();ruler().releasePointerCapture=vi.fn()
 await pointer('pointerdown',200,30);expect(amount()).toBe(80);expect(changed).not.toHaveBeenCalled()
 const move=await pointer('pointermove',170,32);expect(move.defaultPrevented).toBe(true)
 expect(amount()).toBe(80.3);expect(changed).not.toHaveBeenCalled();expect(ruler().setPointerCapture).toHaveBeenCalledOnce()
 await pointer('pointerup',170,32);expect(changed).toHaveBeenCalledExactlyOnceWith(80.3);expect(ruler().releasePointerCapture).toHaveBeenCalledOnce()
 expect(localStorage.getItem('gym_state_v1')).toBeNull()
})

it.each(['pointercancel','lostpointercapture'])('restores the original reading after %s without committing a preview',async type=>{
 await mount();await pointer('pointerdown',200,30);await pointer('pointermove',170,30);expect(amount()).toBe(80.3)
 await pointer(type,170,30);expect(amount()).toBe(80);expect(changed).not.toHaveBeenCalled()
})

it.each(['pointerup','pointercancel'])('keeps the primary drag when a second touch emits %s',async type=>{
 await mount();await pointer('pointerdown',200,30);await pointer('pointermove',170,30)
 await pointer(type,100,30,2)
 expect(amount()).toBe(80.3);expect(changed).not.toHaveBeenCalled()
 await pointer('pointermove',150,30);await pointer('pointerup',150,30)
 expect(changed).toHaveBeenCalledExactlyOnceWith(80.5)
})

it.each(['en','es'])('shows whole weights in %s and exposes the exact draft only while editing',async lang=>{
 await setLang(lang);await mount({initial:80.123456})
 expect(field().value).toBe('80')
 await act(()=>field().focus())
 expect(field().value).toBe(lang==='es'?'80,123456':'80.123456')
 expect(field().selectionStart).toBe(0);expect(field().selectionEnd).toBe(field().value.length)
 await act(()=>field().blur());expect(field().value).toBe('80')
 expect(changed).not.toHaveBeenCalled();expect(amount()).toBe(80.123456)
})

it('allows a vertical gesture and a tap without changing weight or taking pointer capture',async()=>{
 await mount();ruler().setPointerCapture=vi.fn()
 await pointer('pointerdown',200,30);const move=await pointer('pointermove',202,80);await pointer('pointerup',202,80)
 expect(move.defaultPrevented).toBe(false);expect(ruler().setPointerCapture).not.toHaveBeenCalled();expect(changed).not.toHaveBeenCalled()
 await pointer('pointerdown',200,30);await pointer('pointerup',200,30);expect(changed).not.toHaveBeenCalled();expect(amount()).toBe(80)
})

it('cancels an in-progress preview when a newer controlled value arrives',async()=>{
 await mount();await pointer('pointerdown',200,30);await pointer('pointermove',170,30)
 await act(()=>setCanonical(85));await pointer('pointerup',170,30)
 expect(amount()).toBe(85);expect(changed).not.toHaveBeenCalled()
})

it('disables text and ruler interaction without emitting edits',async()=>{
 await mount({disabled:true});expect(field().disabled).toBe(true);expect(host.querySelectorAll('button,fieldset')).toHaveLength(0)
 expect(ruler().getAttribute('aria-disabled')).toBe('true');expect(ruler().tabIndex).toBe(-1)
 await key('ArrowRight');await pointer('pointerdown',200,30);await pointer('pointermove',170,30);await pointer('pointerup',170,30)
 expect(changed).not.toHaveBeenCalled();expect(amount()).toBe(80)
})

it.each([[.5,'kg'],[350,'kg'],[720,'lb']])('preserves legacy value %s %s outside the ordinary ruler bounds',async(initial,unit)=>{
 await mount({initial,unit});expect(amount()).toBe(initial)
 expect(Number(ruler().getAttribute('aria-valuemin'))).toBeLessThanOrEqual(initial)
 expect(Number(ruler().getAttribute('aria-valuemax'))).toBeGreaterThanOrEqual(initial)
 expect(changed).not.toHaveBeenCalled();expect(validity).toHaveBeenLastCalledWith(true)
})

it.each([[300,'kg','300','300.1'],[660,'lb','660','660.1']])('accepts the configured endpoint %s %s and rejects a larger reading',async(initial,unit,text,outside)=>{
 await mount({initial,unit});expect(amount()).toBe(Number(text));expect(changed).not.toHaveBeenCalled()
 await enter('');expect(validity).toHaveBeenLastCalledWith(false)
 await enter(text);expect(validity).toHaveBeenLastCalledWith(true);expect(changed).toHaveBeenCalledExactlyOnceWith(initial)
 await enter(outside);expect(validity).toHaveBeenLastCalledWith(false);expect(changed).toHaveBeenCalledOnce()
})
