// @vitest-environment happy-dom
import { expect, it } from 'vitest'
import { streakReportPages, buildStreakReport, STREAK_PERIODS } from './streak-report.js'
import { calendarReportPages } from './calendar-report.js'
import { bodyComparisonReportPanel } from './body-comparison-report.js'
import { statsReportPages } from './stats-pdf.js'
import { progressReportPages } from './progress-export.js'
import { bodyRecords, compareBody } from './body-report.js'
import { MEASURE_FIELDS } from './stats-insights.js'
import geometry from './body-paths.js'

const now = new Date('2026-11-04T12:00:00')
const state = () => ({ unit:'kg', measurementUnit:'cm', body:'male', streakCalendarShowProfile:true,
  profile:{name:'Synthetic Athlete'}, trainingStartDate:'2026-09-27',
  routines:[{id:'r',name:'Routine'}], week:{1:'r',3:'r',5:'r'}, workouts:[], bodyweight:[], measurements:[], inbody:[] })
const parse = svg => new DOMParser().parseFromString(svg,'image/svg+xml')
const cells = pages => pages.flatMap(page => [...parse(page.svg).querySelectorAll('[data-date]')].map(cell=>[cell.getAttribute('data-date'),cell.getAttribute('data-status')]))

it.each(['light','black'])('keeps every Streak option and profile choice consistent in the %s theme', theme => {
  const S=state(), before=structuredClone(S)
  for(const [period] of STREAK_PERIODS) for(const show of [true,false]) {
    const options={period,now,anchor:'2026-11-04',from:'2026-09-01',to:'2026-11-04',fromYear:'2025',toYear:'2026',theme}
    const source={...S,streakCalendarShowProfile:show}, pages=streakReportPages(source,options)
    expect(cells(pages)).toEqual(buildStreakReport(source,options).days.map(day=>[day.iso,day.status]))
    for(const page of pages) {
      const doc=parse(page.svg)
      expect(doc.querySelector('parsererror')).toBeNull()
      expect(doc.documentElement.getAttribute('data-theme')).toBe(theme)
      expect(page.background).toBe(theme==='black'?'#000000':'#ffffff')
      expect(doc.querySelector('[data-report-title] text').getAttribute('text-anchor')).toBe('middle')
      expect(Boolean(doc.querySelector('[data-report-profile]'))).toBe(show)
      expect(page.svg).not.toContain('TGym')
      expect(page.svg).not.toContain('Training days in this streak')
      const tracking=doc.querySelector('[data-tracking-start]')
      expect(Boolean(tracking)).toBe(Boolean(doc.querySelector('[data-date="2026-09-27"]')))
      expect(Boolean(doc.querySelector('[data-tracking-day]'))).toBe(Boolean(tracking))
      for(const month of doc.querySelectorAll('[data-month] [data-period]>text:first-child')) {
        expect(month.textContent).not.toMatch(/\d{4}/)
        expect(month.getAttribute('text-anchor')).toBe('middle')
      }
    }
  }
  expect(S).toEqual(before)
})

it.each(['week','month','year','full','years'])('shows the tracking start only on its own Consistency %s page', period => {
  const S=state(), pages=calendarReportPages(S,now,period,'pdf',{now,fromYear:'2025',toYear:'2026',theme:'black'})
  for(const page of pages) {
    const doc=parse(page.svg)
    expect(doc.querySelector('parsererror')).toBeNull()
    expect(page.svg).not.toContain('TGym')
    expect(page.svg).not.toContain('Training since')
    expect(page.svg).not.toContain('No scheduled workout')
    expect(Boolean(doc.querySelector('[data-tracking-start]'))).toBe(Boolean(doc.querySelector('[data-date="2026-09-27"]')))
    expect(Boolean(doc.querySelector('[data-tracking-day]'))).toBe(Boolean(doc.querySelector('[data-tracking-start]')))
  }
  expect(pages.filter(page=>parse(page.svg).querySelector('[data-tracking-start]')).length).toBe(['week','month'].includes(period)?0:1)
})

it('identifies each displayed year of a long custom Streak report after removing years from month names',()=>{
  const S=state(),pages=streakReportPages(S,{period:'custom',from:'2024-01-01',to:'2026-11-04',now})
  expect(pages.map(page=>parse(page.svg).querySelector('[data-report-period] text').textContent)).toEqual(['2024','2025','2026'])
})

it.each(['male','female'])('keeps all 13 %s measurements on one page with the current app anatomy and missing values intact', body => {
  const S=state();S.body=body
  S.measurements=[{d:'2026-09-28',...Object.fromEntries(MEASURE_FIELDS.map(([key],index)=>[key,30+index]))},
    {d:'2026-11-04',...Object.fromEntries(MEASURE_FIELDS.map(([key],index)=>[key,index===12?null:31+index]))}]
  const before=structuredClone(S)
  const comparison=compareBody(bodyRecords(S,{start:'2026-01-01',end:'2026-11-04'}))
  const panel=bodyComparisonReportPanel(geometry,body,comparison)
  const rendered=parse('<svg xmlns="http://www.w3.org/2000/svg">'+panel.draw(0)+'</svg>')
  expect(rendered.querySelectorAll('[data-measurement]')).toHaveLength(13)
  expect(rendered.querySelector('[data-body-comparison-model="current"] path')).not.toBeNull()
  expect(rendered.querySelector('[data-measurement="calfRight"]').getAttribute('data-after')).toBe('')
  const lastRow=rendered.querySelector('[data-measurement="calfRight"] text')
  const notes=[...rendered.querySelectorAll('text')].filter(node=>node.textContent.includes('More data needed')||node.textContent.includes('Unit:'))
  for(const note of notes) expect(+note.getAttribute('y')).toBeGreaterThan(+lastRow.getAttribute('y')+18)
  const stats=statsReportPages(S,{now,sections:['measurements'],bodyGeometry:geometry})
  const progress=progressReportPages(S,{now,sections:['body'],bodyGeometry:geometry})
  for(const pages of [stats,progress]) {
    expect(pages).toHaveLength(1)
    const doc=parse(pages[0].svg)
    expect(doc.querySelectorAll('[data-measurement]')).toHaveLength(13)
    expect(doc.querySelector('parsererror')).toBeNull()
    expect(pages[0].svg).not.toContain('TGym')
  }
  expect(S).toEqual(before)
})
