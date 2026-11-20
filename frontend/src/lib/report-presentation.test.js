import { expect, it } from 'vitest'
import { reportDate, reportFileName } from './report-presentation.js'
it('uses a local DD/MM/YY display date and a portable filename without branding or time',()=>{
  const date=new Date(2026,10,4,0,1)
  expect(reportDate(date,'/')).toBe('04/11/26')
  expect(reportFileName('Streak Report','pdf',date)).toBe('Streak Report 04-11-26.pdf')
  expect(reportFileName('Informe de constancia','PNG',date)).toBe('Informe de constancia 04-11-26.png')
})
it('removes filesystem separators and rejects invalid dates or extensions',()=>{
  expect(reportFileName('Report / test','pdf',new Date(2026,0,2))).toBe('Report  test 02-01-26.pdf')
  expect(()=>reportFileName('Report','../pdf')).toThrow()
  expect(()=>reportFileName('Report','pdf',new Date(NaN))).toThrow()
})
