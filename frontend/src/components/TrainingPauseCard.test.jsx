// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useStore, DEF } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { bindUI } from './ui.jsx'
import TrainingPauseCard from './TrainingPauseCard.jsx'
import { startFlow, beginWorkout } from '../sheets.jsx'
vi.mock('../lib/i18n.js',async original=>({...await original(),t:(s,...args)=>s.replace(/\{(\d+)\}/g,(_,i)=>args[i])}))
let root, host, originalFlush
beforeEach(()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-01-12T12:00:00'))
 localStorage.clear();originalFlush=useStore.getState().flushPersistence
 useStore.setState({S:structuredClone(DEF),flushPersistence:vi.fn().mockResolvedValue(undefined)})
 bindUI(useUI);useUI.setState({sheets:[]})
 host=document.createElement('div');document.body.append(host);root=createRoot(host)
})
afterEach(async()=>{await act(()=>root.unmount());host.remove();useStore.setState({flushPersistence:originalFlush});vi.clearAllTimers();vi.useRealTimers()})
it('pauses and resumes persistently without duplicating records',async()=>{
 await act(()=>root.render(<TrainingPauseCard />))
 await act(async()=>{host.querySelector('button').click();await Promise.resolve();await Promise.resolve()})
 expect(host.textContent).toContain('Resume training')
 expect(JSON.parse(localStorage.getItem('gym_state_v1')).trainingPauses).toHaveLength(1)
 await act(async()=>{host.querySelector('button').click();await Promise.resolve();await Promise.resolve()})
 expect(host.textContent).toContain('Pause training')
 expect(useStore.getState().S.trainingPauses[0]).toMatchObject({start:'2026-01-12',end:'2026-01-12'})
})
it('retries persistence instead of accidentally resuming after a native write failure',async()=>{
 useStore.setState({flushPersistence:vi.fn().mockRejectedValueOnce(new Error('full')).mockResolvedValue(undefined)})
 await act(()=>root.render(<TrainingPauseCard />))
 await act(async()=>{host.querySelector('button').click();await Promise.resolve();await Promise.resolve()})
 expect(host.textContent).toContain('Retry saving')
 await act(async()=>{host.querySelector('button').click();await Promise.resolve();await Promise.resolve()})
 expect(useStore.getState().S.trainingPauses).toHaveLength(1)
 expect(useStore.getState().S.trainingPauses[0].end).toBeNull()
 expect(host.textContent).toContain('Resume training')
})
it('does not pause an active workout and guards both workout entry paths while paused',async()=>{
 useStore.setState({S:{...structuredClone(DEF),active:{id:'w'}}})
 await act(()=>root.render(<TrainingPauseCard />))
 expect(host.querySelector('button').disabled).toBe(true)
 await act(()=>useStore.setState({S:{...structuredClone(DEF),trainingPauses:[{id:'p',start:'2026-01-12',end:null}]}}))
 act(()=>startFlow('r'))
 expect(useUI.getState().sheets).toHaveLength(1)
 act(()=>beginWorkout('r',80))
 expect(useStore.getState().S.active).toBeNull()
 expect(useUI.getState().sheets).toHaveLength(2)
})
