// @vitest-environment happy-dom
import React, {act} from 'react'
import {createRoot} from 'react-dom/client'
import {beforeEach,afterEach,expect,it,vi} from 'vitest'
import ReportDateRange from './ReportDateRange.jsx'
vi.mock('../lib/i18n.js',()=>({t:key=>key}))
let host,root
const value={period:'years',fromYear:'2025',toYear:'2026'}
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.append(host);root=createRoot(host)})
afterEach(()=>{act(()=>root.unmount());host.remove()})
it.each([[4,'Four months per PDF page.'],[12,'One year per PDF page.']])('describes the actual %i-month page layout without modifying the selected years', (monthsPerPage,hint)=>{
  const before=structuredClone(value),onChange=vi.fn()
  act(()=>root.render(<ReportDateRange value={value} onChange={onChange} periods={[['years','Complete years']]} monthsPerPage={monthsPerPage}/>))
  expect(host.querySelector('.small.dim').textContent).toBe(hint)
  expect([...host.querySelectorAll('input')].map(input=>input.value)).toEqual(['2025','2026'])
  expect(value).toEqual(before);expect(onChange).not.toHaveBeenCalled()
})
it('shows no complete-year pagination hint for a single-period report',()=>{
  act(()=>root.render(<ReportDateRange value={{period:'year'}} onChange={()=>{}} periods={[['year','Year']]} monthsPerPage={12}/>))
  expect(host.textContent).not.toContain('per PDF page')
})
