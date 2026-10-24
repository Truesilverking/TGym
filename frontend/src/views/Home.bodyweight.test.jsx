// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Home from './Home.jsx'
import Icon from '../components/Icon.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { bwSheet, goalSheet } from '../sheets.jsx'
import { setLang } from '../lib/i18n.js'

vi.mock('../sheets.jsx', async original => ({ ...await original(), bwSheet: vi.fn(), goalSheet: vi.fn() }))

let host, root, S
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-22T12:00:00-04:00'))
  localStorage.clear(); await setLang('en')
  S = { ...structuredClone(DEF), lang:'en', trainingStartDate:'2026-09-01', hasCompletedOnboarding:true, hasCompletedAppTour:true,
    bodyweight:[{d:'2026-10-19',w:79},{d:'2026-10-21',w:80}], targetW:85, unit:'kg', sound:false, vibration:false }
  useStore.setState({S,user:null});useUI.setState({sheets:[],appTourRequest:null})
  host=document.createElement('div');document.body.append(host);root=createRoot(host)
})
afterEach(async () => { await act(()=>root.unmount());host.remove();vi.clearAllTimers();vi.useRealTimers();vi.restoreAllMocks();vi.clearAllMocks() })
const mount = async () => { useStore.setState({S}); await act(async()=>root.render(<MemoryRouter><Home/></MemoryRouter>)) }
const card = () => host.querySelector('.home-bodyweight-card')
const text = selector => card().querySelector(selector)?.textContent

it('pairs current and goal without goal-distance text and shows one previous-record change',async()=>{
 const before=structuredClone(S);await mount()
 expect(text('.home-bodyweight-current')).toContain('80kg')
 expect(text('.home-bodyweight-target')).toContain('85kg')
 expect(card().querySelector('.home-bodyweight-gap')).toBeNull()
 expect(text('.home-bodyweight-change')).toBe('Since previous: 1 kg')
 expect(card().textContent).not.toContain('Last recorded')
 expect(card().querySelectorAll('.home-bodyweight-change')).toHaveLength(1)
 expect(card().querySelector('.home-bodyweight-heading .home-bodyweight-log')).not.toBeNull()
 expect(card().querySelector('.home-bodyweight-heading time')).toBeNull()
 expect(card().querySelector('.home-bodyweight-footer time')).toBe(card().querySelector('time'))
 expect(card().lastElementChild.classList.contains('home-bodyweight-footer')).toBe(true)
 expect(card().lastElementChild.previousElementSibling.classList.contains('home-bodyweight-change')).toBe(true)
 expect(card().querySelector('time').dateTime).toBe('2026-10-21')
 expect(card().querySelector('time').textContent).toBe('21 Oct')
 expect(useStore.getState().S).toEqual(before)
 expect(localStorage.getItem('gym_state_v1')).toBeNull()
})

it.each([
 [79,80,85,'arrowUp','var(--acc)'],[81,80,75,'arrowDown','var(--acc)'],
 [79,80,75,'arrowUp','var(--red)'],[81,80,85,'arrowDown','var(--red)'],
])('preserves direction and goal-relative color for %s → %s with goal %s',async(previous,current,goal,direction,color)=>{
 S.bodyweight[0].w=previous;S.bodyweight[1].w=current;S.targetW=goal;await mount()
 const change=card().querySelector('.home-bodyweight-change')
 expect(change.style.color).toBe(color)
 expect(change.querySelector('path').getAttribute('d')).toBe(Icon({name:direction}).props.children.props.d)
 expect(card().querySelector('.home-bodyweight-gap')).toBeNull()
})

it('keeps the goal action without inventing a target or goal distance',async()=>{
 S.targetW=null;await mount()
 expect(text('.home-bodyweight-target')).toContain('Goal')
 expect(card().querySelector('.home-bodyweight-gap')).toBeNull()
 expect(card().querySelector('.home-bodyweight-change').style.color).toBe('var(--label)')
})
it('omits a previous-record delta for a single record',async()=>{
 S.bodyweight=S.bodyweight.slice(-1);await mount()
 expect(card().querySelector('.home-bodyweight-change')).toBeNull()
 expect(card().querySelector('.home-bodyweight-gap')).toBeNull()
})
it('omits target-distance text and a misleading zero-change arrow at the goal',async()=>{
 S.bodyweight[0].w=80;S.targetW=80;await mount()
 expect(card().querySelector('.home-bodyweight-gap')).toBeNull()
 expect(card().querySelector('.home-bodyweight-change')).toBeNull()
})
it.each([null,85])('preserves the empty state and optional goal %j without invented current values',async(goal)=>{
 S.bodyweight=[];S.targetW=goal;await mount()
 expect(text('.home-bodyweight-current')).toContain('—')
 expect(text('.home-bodyweight-target')).toContain(goal?'85kg':'Goal')
 expect(text('.home-bodyweight-empty')).toContain('No entries yet')
 expect(card().querySelector('time,.home-bodyweight-change,.home-bodyweight-gap')).toBeNull()
})
it('retains existing training-boundary and future-record filtering',async()=>{
 S.bodyweight=[{d:'2026-08-31',w:200},{d:'2026-09-01',w:79},{d:'2026-10-01',w:80},{d:'2026-10-23',w:300}];await mount()
 expect(text('.home-bodyweight-current')).toContain('80kg')
 expect(text('.home-bodyweight-change')).toBe('Since previous: 1 kg')
 expect(card().querySelector('time').dateTime).toBe('2026-10-01')
 expect(useStore.getState().S.bodyweight).toHaveLength(4)
})
it('uses the most recent dated readings after an out-of-order import without rewriting history',async()=>{
 S.bodyweight=[{d:'2026-10-22',t:100,w:81},{d:'2026-10-19',w:75},{d:'2026-10-22',t:200,w:80},{d:'2026-10-20',w:78}]
 const before=structuredClone(S.bodyweight);await mount()
 expect(text('.home-bodyweight-current')).toContain('80kg')
 expect(text('.home-bodyweight-change')).toBe('Since previous: 1 kg')
 expect(card().querySelector('.home-bodyweight-change path').getAttribute('d')).toBe(Icon({name:'arrowDown'}).props.children.props.d)
 expect(card().querySelector('time').dateTime).toBe('2026-10-22')
 expect(useStore.getState().S.bodyweight).toEqual(before)
 expect(localStorage.getItem('gym_state_v1')).toBeNull()
})
it('uses the configured unit for both weights and preserves the downward delta',async()=>{
 S.unit='lb';S.bodyweight[0].w=188;S.bodyweight[1].w=187;S.targetW=195;await mount()
 expect(text('.home-bodyweight-current')).toContain('187lb')
 expect(text('.home-bodyweight-target')).toContain('195lb')
 expect(card().querySelector('.home-bodyweight-gap')).toBeNull()
 expect(text('.home-bodyweight-change')).toBe('Since previous: 1 lb')
 expect(card().querySelector('.home-bodyweight-change path').getAttribute('d')).toBe(Icon({name:'arrowDown'}).props.children.props.d)
})
it('keeps both existing edit actions and never saves just by opening them',async()=>{
 await mount();const before=structuredClone(useStore.getState().S)
 await act(()=>card().querySelector('.home-bodyweight-log').click())
 await act(()=>card().querySelector('.home-bodyweight-goal').click())
 expect(bwSheet).toHaveBeenCalledOnce();expect(goalSheet).toHaveBeenCalledOnce()
 expect(useStore.getState().S).toEqual(before);expect(localStorage.getItem('gym_state_v1')).toBeNull()
})
it('reuses Spanish labels and numeric formatting',async()=>{
 await setLang('es');S.lang='es';S.bodyweight[0].w=79.5;S.bodyweight[1].w=80.5;S.targetW=85.5;await mount()
 expect(text('.home-bodyweight-current')).toContain('Actual80,5kg')
 expect(text('.home-bodyweight-target')).toContain('Peso objetivo85,5kg')
 expect(card().querySelector('.home-bodyweight-gap')).toBeNull()
 expect(text('.home-bodyweight-change')).toBe('Desde la anterior: 1 kg')
 expect(card().textContent).not.toContain('Último registro')
 expect(card().querySelector('time').textContent).toBe('21 oct')
})
