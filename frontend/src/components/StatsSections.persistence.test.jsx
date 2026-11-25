// @vitest-environment happy-dom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {StatsCustomizationPanel} from './StatsSections.jsx'
import Toast from './Toast.jsx'
import {DEF,useStore} from '../store/useStore.js'
import {useUI} from '../store/useUI.js'

vi.mock('../lib/i18n.js',()=>({t:(value,...args)=>value.replace(/\{(\d+)\}/g,(_,index)=>args[index]??'')}))
let host,root,before,raw,close,navigate
const originalWrite=localStorage.setItem,originalUpdate=useStore.getState().update
beforeEach(()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;vi.useFakeTimers();localStorage.clear()
 before={...structuredClone(DEF),statsSections:['history','bodyweight'],statsSectionOrder:['history','bodyweight'],workouts:[{id:'kept-history',entries:[]}]}
 useStore.setState({S:structuredClone(before),update:originalUpdate,storageError:null});useUI.setState({sheets:[],toastMsg:''})
 raw=JSON.stringify(before);localStorage.setItem('gym_state_v1',raw)
 host=document.createElement('div');document.body.append(host);root=createRoot(host);close=vi.fn();navigate=vi.fn()
 act(()=>root.render(<><StatsCustomizationPanel close={close} onSelect={navigate} activeId="history"/><Toast/></>))
})
afterEach(()=>{act(()=>root.unmount());host.remove();vi.clearAllTimers();vi.useRealTimers();vi.restoreAllMocks();Object.defineProperty(localStorage,'setItem',{value:originalWrite,writable:true,configurable:true});useStore.setState({update:originalUpdate});localStorage.clear()})

it.each(['reorder','enable and open'])('preserves the Stats panel, active section and profile when %s cannot be persisted',operation=>{
 const order=[...host.querySelectorAll('[data-stats-option]')].map(row=>row.dataset.statsOption)
 const blocked=vi.spyOn(localStorage,'setItem').mockImplementation(function(key,value){if(key==='gym_state_v1')throw new DOMException('Synthetic full storage','QuotaExceededError');return originalWrite.call(this,key,value)})
 const target=operation==='reorder'?host.querySelector('[data-stats-option="history"] .stats-order-actions button:last-child'):host.querySelector('[data-stats-option="effort"] .stats-section-jump')
 act(()=>target.click());expect(blocked).toHaveBeenCalled();expect(close).not.toHaveBeenCalled();expect(navigate).not.toHaveBeenCalled()
 expect(host.querySelector('#toast').textContent).toBe('Could not save changes. Try again.');expect(host.querySelector('#toast').classList.contains('show')).toBe(true)
 expect([...host.querySelectorAll('[data-stats-option]')].map(row=>row.dataset.statsOption)).toEqual(order)
 expect(host.querySelector('[data-stats-option="history"] .stats-section-jump').getAttribute('aria-current')).toBe('page')
 expect(host.querySelector('[data-stats-option="effort"] [role="checkbox"]').getAttribute('aria-checked')).toBe('false')
 expect(useStore.getState().S).toEqual(before);expect(localStorage.getItem('gym_state_v1')).toBe(raw)
})
