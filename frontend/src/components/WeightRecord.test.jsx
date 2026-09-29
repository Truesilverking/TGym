// @vitest-environment happy-dom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {DEF,useStore} from '../store/useStore.js'
import {useUI} from '../store/useUI.js'
import {bwSheet} from '../sheets.jsx'
let root,host,flush
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;localStorage.clear();flush=useStore.getState().flushPersistence;useStore.setState({S:{...structuredClone(DEF),lang:'en'},user:null,flushPersistence:vi.fn().mockRejectedValueOnce(Error('mirror unavailable')).mockResolvedValue()});useUI.setState({sheets:[]});host=document.createElement('div');document.body.append(host);root=createRoot(host)})
afterEach(()=>{act(()=>root.unmount());host.remove();useStore.setState({flushPersistence:flush})})
function Sheets(){return useUI(s=>s.sheets).map(s=><div key={s.id}>{s.render(()=>useUI.getState().closeSheet(s.id))}</div>)}
it('retries a failed durable weight save without duplicating the sample',async()=>{
 act(()=>{root.render(<Sheets/>);bwSheet({initialDate:'2026-01-01'})});const save=()=>act(async()=>{[...host.querySelectorAll('button')].find(b=>b.textContent==='Save').click()});await save();expect(useStore.getState().S.bodyweight).toHaveLength(1);await save();const records=useStore.getState().S.bodyweight;expect(records).toHaveLength(1);expect(records[0].samples).toHaveLength(1);expect(records[0].d).toBe('2026-01-01');expect(useUI.getState().sheets).toHaveLength(0)
})
it('keeps the pre-workout weigh-in callback synchronous and single-shot',()=>{
 const onDone=vi.fn();act(()=>{root.render(<Sheets/>);bwSheet({required:true,onDone})});act(()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Save & start workout').click());expect(onDone).toHaveBeenCalledTimes(1);expect(useUI.getState().sheets).toHaveLength(0);expect(useStore.getState().flushPersistence).not.toHaveBeenCalled();expect(useStore.getState().S.bodyweight).toHaveLength(1)
})
