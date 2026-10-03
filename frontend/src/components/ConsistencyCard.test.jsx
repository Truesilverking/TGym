// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ConsistencyCard from './ConsistencyCard.jsx'
import Heatmap from './Heatmap.jsx'
vi.mock('../lib/i18n.js',()=>({t:s=>s}))
let root,host
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-21T12:00:00'));host=document.createElement('div');document.body.append(host);root=createRoot(host)})
afterEach(()=>{act(()=>root.unmount());host.remove();vi.useRealTimers()})
it('shows planned edits as completed activity without additional sessions, then counts a separate extra once',()=>{
 const d='2026-09-21',origin={type:'planned',routineId:'r'}
 const w={id:'planned',d,routineId:'r',sessionOrigin:origin,entries:['replacement','new1','new2','new3'].map(id=>({id,sets:[{done:true,r:12,w:60}]}))}
 const S={trainingStartDate:d,routines:[{id:'r',name:'Routine',ex:[{id:'original'}]}],week:{1:['r']},workouts:[w]}
 const render=()=>act(()=>root.render(<><ConsistencyCard S={S}/><Heatmap S={S} onDay={()=>{}}/></>))
 const metric=label=>[...host.querySelectorAll('dt')].find(dt=>dt.textContent===label)?.nextElementSibling.textContent
 render();expect(metric('Planned')).toBe('1');expect(metric('Extra')).toBe('0');expect(metric('Active days')).toBe('1');expect(metric('Completion')).toBe('100%')
 expect(host.querySelector('.hm-c.today').classList.contains('complete')).toBe(true)
 S.workouts.push({...w,id:'extra',routineId:null,sessionOrigin:{type:'extra',routineId:null}})
 render();expect(metric('Planned')).toBe('1');expect(metric('Extra')).toBe('1');expect(metric('Active days')).toBe('1');expect(metric('Completion')).toBe('100%')
 S.workouts=[S.workouts[1]];render();expect(metric('Extra')).toBe('1');expect(metric('Completion')).toBe('100%');expect(host.querySelector('.hm-c.today').classList.contains('extra')).toBe(true)
})
