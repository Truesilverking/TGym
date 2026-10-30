// @vitest-environment happy-dom
import React, { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import WeightField from './WeightField.jsx'
import { useUI } from '../store/useUI.js'
import { setLang, t } from '../lib/i18n.js'

let host, root, changed, replace, pointerTime
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  await setLang('en'); localStorage.clear(); useUI.setState({ sheets:[] })
  changed = vi.fn(); pointerTime = 0
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(() => root.unmount()); useUI.getState().closeAll(); host.remove(); vi.restoreAllMocks() })
function Harness({ initial = 42.75, ...props }) {
  const [value, setValue] = useState(initial); replace = setValue
  const sheets = useUI(state => state.sheets)
  return <><WeightField value={value} onChange={next => { changed(next); setValue(next) }} label="Load" {...props}/>
    {sheets.map(sheet => <section key={sheet.id}>{sheet.render(() => useUI.getState().closeSheet(sheet.id))}</section>)}</>
}
const mount = props => act(() => root.render(<Harness {...props}/>))
const inline = () => host.querySelector('.weight-field input')
const editor = () => host.querySelector('.weight-field-editor')
const input = () => editor().querySelector('input')
const open = () => act(() => host.querySelector('.weight-field-open').click())
const action = text => [...editor().querySelectorAll('button')].find(button => button.textContent === t(text))
const enter = async raw => act(() => {
  const field = input(); field.focus()
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, raw)
  field.dispatchEvent(new Event('input', { bubbles:true })); field.blur()
})
const key = pressed => act(() => editor().querySelector('[role=slider]').dispatchEvent(new KeyboardEvent('keydown', { key:pressed, bubbles:true, cancelable:true })))
const pointer = async (type, x, y = 30) => {
  const event = new MouseEvent(type, { clientX:x, clientY:y, button:0, bubbles:true, cancelable:true })
  Object.defineProperties(event, { pointerId:{ value:1 }, isPrimary:{ value:true }, timeStamp:{ value:pointerTime += 200 } })
  await act(() => editor().querySelector('[role=slider]').dispatchEvent(event))
  if (type === 'pointermove') await act(() => new Promise(requestAnimationFrame))
}

it('keeps manual decimals and a changed ruler draft isolated until confirmation', async () => {
  await mount({ step:2.5 }); await open()
  expect(input().value).toBe('43'); expect(changed).not.toHaveBeenCalled()
  await enter('43.25'); expect(inline().value).toBe('43'); expect(changed).not.toHaveBeenCalled()
  await act(() => action('Done').click())
  expect(changed).toHaveBeenCalledExactlyOnceWith(43.25); expect(inline().value).toBe('43'); expect(editor()).toBeNull()
  expect(localStorage.getItem('gym_state_v1')).toBeNull()
})

it('does not round an unchanged imported value to its display precision or loading step', async () => {
  await mount({ initial:42.750000123, precision:2, step:2.5 }); await open()
  expect(input().value).toBe('43'); await act(() => { input().focus(); input().blur() })
  await act(() => action('Done').click())
  expect(changed).toHaveBeenCalledExactlyOnceWith(42.750000123)
})

it('accepts zero and large legacy loads without the bodyweight upper limit', async () => {
  await mount({ initial:0, min:0, unit:'lb' }); await open()
  expect(input().value).toBe('0'); expect(action('Done').disabled).toBe(false)
  await enter('1234.567891'); await act(() => action('Done').click())
  expect(changed).toHaveBeenCalledExactlyOnceWith(1234.567891)
  await open(); await key('Home'); await act(() => action('Done').click())
  expect(changed).toHaveBeenLastCalledWith(0)
})

it('uses the caller increment for ruler and keyboard without writing on moving frames', async () => {
  await mount({ initial:40, step:.25 }); await open()
  await pointer('pointerdown',200); await pointer('pointermove',180)
  expect(input().value).toBe('41'); expect(Number(editor().querySelector('[role=slider]').getAttribute('aria-valuenow'))).toBe(40.5); expect(changed).not.toHaveBeenCalled()
  await pointer('pointerup',180); await key('ArrowRight')
  expect(input().value).toBe('41'); expect(Number(editor().querySelector('[role=slider]').getAttribute('aria-valuenow'))).toBe(40.75); expect(changed).not.toHaveBeenCalled()
  await act(() => action('Done').click()); expect(changed).toHaveBeenCalledExactlyOnceWith(40.75)
})

it('settles a fling on the caller grid while keeping all animated drafts local', async () => {
  const frames = new Map(); let sequence = 0, now = 0
  vi.spyOn(performance,'now').mockImplementation(() => now)
  vi.spyOn(globalThis,'requestAnimationFrame').mockImplementation(callback => { const id = ++sequence; frames.set(id,callback); return id })
  vi.spyOn(globalThis,'cancelAnimationFrame').mockImplementation(id => frames.delete(id))
  await mount({ initial:40, step:2.5 }); await open()
  const ruler = editor().querySelector('[role=slider]'), width = input().style.width
  const dispatch = async (type,x,time) => {
    now = time
    const event = new MouseEvent(type,{clientX:x,clientY:30,button:0,bubbles:true,cancelable:true})
    Object.defineProperties(event,{pointerId:{value:1},isPrimary:{value:true},timeStamp:{value:1000+time}})
    await act(() => ruler.dispatchEvent(event))
  }
  await dispatch('pointerdown',200,0); await dispatch('pointermove',170,30); await dispatch('pointerup',160,50)
  expect(input().value).toBe('50'); expect(changed).not.toHaveBeenCalled()
  now = 250; const pending = [...frames.values()]; frames.clear(); await act(() => pending.forEach(callback => callback(now)))
  const moving = Number(ruler.getAttribute('aria-valuenow')); expect(moving).toBeGreaterThan(50); expect(moving/2.5).toBe(Math.round(moving/2.5))
  expect(input().value).toBe(String(Math.round(moving))); expect(ruler.getAttribute('aria-valuetext')).toBe(`${Math.round(moving)} kg`)
  expect(input().style.width).toBe(width); expect(changed).not.toHaveBeenCalled()
  now = 2050; const remaining = [...frames.values()]; frames.clear(); await act(() => remaining.forEach(callback => callback(now)))
  const settled = Number(ruler.getAttribute('aria-valuenow')); expect(settled/2.5).toBe(Math.round(settled/2.5)); expect(frames.size).toBe(0)
  await act(() => action('Done').click()); expect(changed).toHaveBeenCalledExactlyOnceWith(settled)
})

it('cancels edited values and canceled gestures without publishing the draft', async () => {
  await mount(); await open(); await enter('80.25'); await act(() => action('Cancel').click())
  expect(changed).not.toHaveBeenCalled(); expect(inline().value).toBe('43')
  await open(); await pointer('pointerdown',200); await pointer('pointermove',170); await pointer('pointercancel',170)
  expect(input().value).toBe('43'); await act(() => action('Cancel').click()); expect(changed).not.toHaveBeenCalled()
})

it.each([{unit:'lb'}, {disabled:true}, {contextKey:'other-row'}, {step:5}, {min:2}, {max:500}])('closes a stale editor when the caller changes %j', async changedProps => {
  await mount({ contextKey:'first-row' }); await open(); await enter('80')
  await mount({ contextKey:'first-row', ...changedProps })
  expect(editor()).toBeNull(); expect(changed).not.toHaveBeenCalled()
})

it('closes when its controlled value changes or the field unmounts', async () => {
  await mount(); await open(); await enter('80'); await act(() => replace(90))
  expect(editor()).toBeNull(); expect(inline().value).toBe('90'); expect(changed).not.toHaveBeenCalled()
  await open(); await act(() => root.render(<div/>)); expect(useUI.getState().sheets).toHaveLength(0)
})

it('keeps invalid input invalid and supports explicit nullable clearing', async () => {
  await mount({ nullable:true }); await open(); await enter('')
  expect(action('Done').disabled).toBe(true); expect(changed).not.toHaveBeenCalled()
  await act(() => action('Clear').click()); expect(changed).toHaveBeenCalledExactlyOnceWith(null)
  expect(inline().value).toBe('')
})

it('keeps the draft open for retry if the caller cannot save', async () => {
  changed.mockImplementationOnce(() => { throw new Error('Quota exceeded') })
  await mount(); await open(); await enter('43.25'); await act(() => action('Done').click())
  expect(editor()).not.toBeNull(); expect(input().value).toBe('43'); expect(editor().querySelector('[role=alert]')).not.toBeNull()
  await act(() => action('Done').click()); expect(changed).toHaveBeenCalledTimes(2)
  expect(inline().value).toBe('43'); expect(editor()).toBeNull()
})

it.each(['en','es'])('preserves an exact existing %s load while inline and ruler focus expose its precision', async lang => {
  await setLang(lang); await mount({ initial:42.750000123, precision:6 })
  expect(inline().value).toBe('43')
  await act(() => inline().focus()); expect(inline().value).toBe('42.750000123')
  await act(() => inline().blur()); expect(inline().value).toBe('43')
  expect(changed).not.toHaveBeenCalled()
  await open(); expect(input().value).toBe('43')
  await act(() => input().focus()); expect(input().value).toBe(lang === 'es' ? '42,750000123' : '42.750000123')
  await act(() => input().blur()); expect(input().value).toBe('43')
  await act(() => action('Done').click())
  expect(changed).toHaveBeenCalledExactlyOnceWith(42.750000123)
})

it('retains labeled inline controls, generated label association and precise increments', async () => {
  await mount({ initial:.000001, step:.000001, showLabel:true })
  expect(host.querySelector('label').htmlFor).toBe(inline().id)
  expect(inline().getAttribute('aria-label')).toBe('Load')
  const increase = [...host.querySelectorAll('.weight-field button')].find(button => button.getAttribute('aria-label') === t('Increase'))
  await act(() => increase.click()); expect(changed).toHaveBeenCalledExactlyOnceWith(.000002)
  expect(host.querySelector('.weight-field-open').getAttribute('aria-haspopup')).toBe('dialog')
})
