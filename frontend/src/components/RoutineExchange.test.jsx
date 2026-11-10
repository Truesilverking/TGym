// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import RoutineExchange from './RoutineExchange.jsx'
vi.mock('../lib/i18n.js',()=>({t:key=>key}))
vi.mock('./RoutineImport.jsx',()=>({default:({onSaving})=><div className="import-probe"><button onClick={()=>onSaving(true)}>Save probe</button><button onClick={()=>onSaving(false)}>Finish probe</button></div>}))
vi.mock('./RoutineExport.jsx',()=>({default:()=> <div className="export-probe">Export tools</div>}))
let host,root
const render=props=>{host=document.createElement('div');document.body.append(host);root=createRoot(host);act(()=>root.render(<RoutineExchange close={()=>{}} {...props}/>))}
const button=text=>[...host.querySelectorAll('button')].find(el=>el.textContent===text)
afterEach(()=>{act(()=>root.unmount());host.remove()})
it('opens only the requested mode and preserves the mounted import when switching',()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;render({mode:'export'})
 expect(host.querySelector('.import-probe').parentElement.hidden).toBe(true)
 act(()=>button('Import routines').click());expect(host.querySelector('.import-probe').parentElement.hidden).toBe(false)
 act(()=>button('Export routines').click());expect(host.querySelector('.export-probe').parentElement.hidden).toBe(false)
})
it('locks mode changes and forwards the outer sheet lock during atomic saving',()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const onSaving=vi.fn();render({onSaving})
 act(()=>button('Save probe').click());expect(button('Export routines').disabled).toBe(true);expect(onSaving).toHaveBeenLastCalledWith(true)
 act(()=>button('Finish probe').click());expect(button('Export routines').disabled).toBe(false);expect(onSaving).toHaveBeenLastCalledWith(false)
})
