// @vitest-environment happy-dom
import React, { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { goalSheet, topWeightSheet, exConfigSheet, workoutDetailSheet, inBodySheet } from './sheets.jsx'
import { exOr } from './lib/exercises.js'
import { setLang } from './lib/i18n.js'
import { bindUI } from './components/ui.jsx'
import MetricFields from './components/MetricFields.jsx'

vi.mock('./components/Media.jsx', () => ({ default: () => null, Thumb: () => null }))
let root, host, flush
function Sheets() { return useUI(s=>s.sheets).map(s=><section key={s.id}>{s.render(()=>useUI.getState().closeSheet(s.id))}</section>) }
const button = text => [...host.querySelectorAll('button')].filter(b=>b.textContent===text).at(-1)
const click = async text => act(async()=>{ expect(button(text)).toBeTruthy(); button(text).click() })
const field = label => host.querySelector(`input[aria-label="${label}"]`)
async function enter(node, text) {
  await act(()=>{ node.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,text); node.dispatchEvent(new Event('input',{bubbles:true})); node.blur() })
}
async function openRuler(label) { await act(()=>{ const trigger=field(label).closest('.weight-field').querySelector('.weight-field-open'); expect(trigger).toBeTruthy(); trigger.click() }) }
beforeEach(async()=>{
  globalThis.IS_REACT_ACT_ENVIRONMENT=true; vi.useFakeTimers(); await setLang('en'); localStorage.clear(); bindUI(useUI)
  flush=useStore.getState().flushPersistence
  const S=structuredClone(DEF); Object.assign(S,{lang:'en',targetW:77,bodyweight:[{d:'2026-10-20',w:80}],routines:[{id:'keep',name:'Keep',ex:[]}],workouts:[]})
  useStore.setState({S,user:null,flushPersistence:vi.fn().mockResolvedValue()}); useUI.setState({sheets:[],toastMsg:''})
  host=document.createElement('div'); document.body.append(host); root=createRoot(host); await act(()=>root.render(<Sheets/>))
})
afterEach(async()=>{ await act(()=>root.unmount()); host.remove(); useUI.getState().closeAll(); useStore.setState({flushPersistence:flush}); vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks() })

it('uses the body ruler for a target, blocks invalid input and saves only the visible goal',async()=>{
  const before=structuredClone(useStore.getState().S); await act(()=>goalSheet())
  expect(host.querySelector('.bodyweight-picker')).toBeTruthy(); expect(host.querySelector('.sld')).toBeNull()
  await enter(field('Weight'),''); expect(button('Save goal').disabled).toBe(true); expect(useStore.getState().S).toEqual(before)
  await enter(field('Weight'),'76,4'); await click('Save goal')
  expect(useStore.getState().S.targetW).toBe(76.4)
  expect(useStore.getState().S.routines).toEqual(before.routines); expect(useStore.getState().S.bodyweight).toEqual(before.bodyweight)
})
it('permits zero working weight and preserves an existing best and unrelated history',async()=>{
  const S=useStore.getState().S; S.active={id:'session',d:'2026-10-25',start:Date.now(),name:'Test',unit:'kg',cur:0,entries:[{id:'0025',target:{mode:'reps',weight:42.75},sets:[{w:42.75,r:8,done:false}]}]}; S.exWeights={'0025':{w:50,d:'2026-10-20'}}
  useStore.setState({S}); await act(()=>topWeightSheet(0))
  expect(Number(field('Weight').value)).toBe(50); expect(host.querySelector('[role=slider]').getAttribute('aria-valuemin')).toBe('0')
  await enter(field('Weight'),'0'); await click('Save weight')
  expect(useStore.getState().S.active.entries[0].topW).toBe(0); expect(useStore.getState().S.exWeights['0025'].w).toBe(50)
  expect(useStore.getState().S.workouts).toEqual([])
})
it('applies a precise routine load to its draft before the existing prescription Save',async()=>{
  const before=structuredClone(useStore.getState().S), saved=vi.fn()
  await act(()=>exConfigSheet(exOr('0025'),{sets:3,reps:8,weight:42.75,bodyweight:false,mode:'reps'},saved))
  await openRuler('Weight (kg)'); await enter(host.querySelector('.weight-field-editor input'),'43.25'); await click('Done')
  expect(Number(field('Weight (kg)').value)).toBe(43.25); expect(saved).not.toHaveBeenCalled(); expect(useStore.getState().S).toEqual(before)
  await click('Save'); expect(saved).toHaveBeenCalledWith(expect.objectContaining({weight:43.25,reps:8,sets:3}))
})
it('keeps history edits as a draft until the existing confirmation and retains workout identity',async()=>{
  const w={id:'keep-workout',name:'Test',d:'2026-10-20',start:Date.now()-60000,end:Date.now(),unit:'kg',entries:[{id:'0025',target:{mode:'reps',bodyweight:false},sets:[{w:42.75,r:8,done:true}]}]}
  useStore.setState({S:{...useStore.getState().S,workouts:[w]}}); await act(()=>workoutDetailSheet(w)); await click('Edit workout')
  await openRuler('Weight (kg)'); await enter(host.querySelector('.weight-field-editor input'),'43.25'); await click('Done')
  expect(useStore.getState().S.workouts[0].entries[0].sets[0].w).toBe(42.75)
  await click('Save changes'); await click('Save changes')
  expect(useStore.getState().S.workouts).toHaveLength(1); expect(useStore.getState().S.workouts[0]).toMatchObject({id:w.id,entries:[{id:'0025',sets:[{w:43.25,r:8,done:true}]}]})
})
it('uses report kilograms for optional InBody masses without filling blanks or changing percentages',async()=>{
  useStore.setState({S:{...useStore.getState().S,unit:'lb'}})
  const changed=vi.fn()
  function Form(){const [values,setValues]=useState({weight:null,bodyFatPct:'20'});return <><MetricFields values={values} groups={[["Body composition",[['weight','Weight','kg'],['bodyFatPct','Body fat','%']]]]} onChange={next=>{changed(next);setValues(next)}}/><Sheets/></>}
  await act(()=>root.render(<Form/>)); expect(field('Weight').value).toBe(''); expect(changed).not.toHaveBeenCalled()
  await openRuler('Weight'); expect(host.querySelector('.bodyweight-picker-unit').textContent).toBe('kg')
  await enter(host.querySelector('.bodyweight-picker input'),'80,25'); await click('Cancel'); expect(changed).not.toHaveBeenCalled()
  await openRuler('Weight'); await enter(host.querySelector('.bodyweight-picker input'),'80,25'); await click('Done')
  expect(changed).toHaveBeenLastCalledWith({weight:80.25,bodyFatPct:'20'}); expect(useStore.getState().S.unit).toBe('lb')
  await openRuler('Weight'); await click('Clear'); expect(changed).toHaveBeenLastCalledWith({weight:null,bodyFatPct:'20'})
})
it('blocks saving a report when its inline mass is invalid, then saves one corrected reading',async()=>{
  await act(()=>inBodySheet()); await click('Add')
  await enter(field('Weight'),'80.25'); await enter(field('Weight'),'bad')
  expect(field('Weight').getAttribute('aria-invalid')).toBe('true')
  await click('Save InBody result'); expect(useStore.getState().S.inbody).toEqual([])
  expect(useStore.getState().flushPersistence).not.toHaveBeenCalled()
  await enter(field('Weight'),'80,25'); await click('Save InBody result')
  expect(useStore.getState().S.inbody).toHaveLength(1)
  expect(useStore.getState().S.inbody[0].weight).toBe(80.25)
})
