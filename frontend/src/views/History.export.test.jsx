// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import History from './History.jsx'
import { useStore, DEF } from '../store/useStore.js'
import { reportFileName } from '../lib/report-presentation.js'
const mock=vi.hoisted(()=>({save:vi.fn()}))
vi.mock('../lib/report-file.js',()=>({saveReportFile:(...args)=>mock.save(...args)}))
let root,host,frame,previous
const button=()=>host.querySelector('[aria-label="Export for Excel"]')
beforeEach(()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true
 previous=useStore.getState().S
 useStore.setState({S:{...structuredClone(DEF),lang:'en',workouts:[],routines:[]}})
 mock.save.mockReset().mockResolvedValue(undefined)
 vi.stubGlobal('requestAnimationFrame',callback=>{frame=callback;return 1})
 host=document.createElement('div');document.body.append(host);root=createRoot(host)
 act(()=>root.render(<MemoryRouter><History/></MemoryRouter>))
})
afterEach(()=>{act(()=>root.unmount());host.remove();useStore.setState({S:previous});vi.unstubAllGlobals()})
it('shows 0 then 100 for the actual CSV creation, keeps its name, and blocks duplicate export',async()=>{
 let saved;mock.save.mockImplementation(()=>new Promise(resolve=>{saved=resolve}))
 act(()=>{button().click();button().click()})
 expect(host.querySelector('[role="status"]').textContent).toBe('0% · CSV')
 expect(button().disabled).toBe(true);expect(mock.save).not.toHaveBeenCalled()
 await act(async()=>frame(0))
 expect(mock.save).toHaveBeenCalledOnce()
 expect(mock.save.mock.calls[0][0].name).toBe(reportFileName('Workout history','csv'))
 expect(mock.save.mock.calls[0][0].blob.type).toBe('text/csv;charset=utf-8')
 expect(host.querySelector('[role="status"]').textContent).toBe('100% · CSV')
 expect(button().disabled).toBe(true)
 await act(async()=>saved());expect(button().disabled).toBe(false)
})
it('shows a recoverable save error and allows a retry without treating share dismissal as failure',async()=>{
 mock.save.mockRejectedValueOnce(new Error('disk unavailable'))
 act(()=>button().click());await act(async()=>frame(0))
 expect(host.querySelector('[role="alert"]').textContent).toContain('Could not export')
 mock.save.mockRejectedValueOnce(new Error('Share canceled'))
 act(()=>button().click());await act(async()=>frame(0))
 expect(host.querySelector('[role="alert"]')).toBeNull();expect(button().disabled).toBe(false)
})
it('does not start a save if the view unmounts before generation',async()=>{
 act(()=>button().click());act(()=>root.render(null));await act(async()=>frame(0))
 expect(mock.save).not.toHaveBeenCalled()
})
