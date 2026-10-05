// @vitest-environment happy-dom
import { describe, expect, it, vi, afterEach } from 'vitest'
import { calendarReportPages } from './calendar-report.js'
import { buildProgressReport } from './progress-report.js'
import { progressReportPages, progressReportHTML } from './progress-export.js'
import { PROGRESS_SECTIONS } from './progress-sections.js'
import { statsReportHTML } from './stats-report.js'
import { historyCsv, filteredHistory } from '../views/History.jsx'
import { buildPlanBundle, planPrintHTML } from './plan-share.js'
import { createBackup, readBackup } from './backup.js'

const now = new Date('2026-09-26T12:00:00')
const workout = (id, d, name = 'WORKOUT_ONLY') => ({ id, d, name, routineId: 'r', start: +new Date(d + 'T12:00:00'), end: +new Date(d + 'T13:00:00'), entries: [{ id: '0025', target: { mode: 'reps' }, sets: [{ done: true, w: 42, r: 8 }] }] })
const fixture = () => ({ unit: 'kg', measurementUnit: 'cm', trainingStartDate: '2026-01-01', trainingHistory: { trackedFrom: '2026-01-01', historicalWorkouts: 0, workoutsPerWeek: 3 }, routines: [{ id: 'r', name: 'PLAN_ONLY', ex: [{ id: '0025', sets: 3, reps: 8 }] }], week: { 1: 'r' }, workouts: [workout('a', '2026-09-01'), workout('b', '2026-09-20')], bodyweight: [{ d: '2026-09-01', w: 83 }], measurements: [{ d: '2026-09-01', neck: 31 }, { d: '2026-09-20', neck: 34 }], inbody: [{ d: '2026-09-20', score: 81 }], customEx: [] })
const doc = svg => new DOMParser().parseFromString(svg, 'image/svg+xml')
afterEach(() => vi.useRealTimers())

describe('independent report sources', () => {
 it.each([['week','png',1],['week','pdf',1],['month','png',1],['month','pdf',1],['year','png',1],['year','pdf',3],['full','pdf',4]])('isolates calendar %s/%s', (period, format, count) => {
  const s = fixture(), before = structuredClone(s), pages = calendarReportPages(s, now, period, format, { now })
  expect(pages).toHaveLength(count)
  for (const p of pages) {
   expect(doc(p.svg).querySelector('parsererror')).toBeNull()
   expect(p.svg).toContain('Consistency Report')
   for (const forbidden of ['Progress Report','Body Progress','InBody history','WORKOUT_ONLY','PLAN_ONLY','31 cm','34 cm']) expect(p.svg).not.toContain(forbidden)
  }
  expect(s).toEqual(before)
 })
 it('rejects unsupported formats, dates and full PNG instead of silently omitting pages', () => {
  for (const [date,period,format] of [['invalid','month','pdf'],[now,'full','png'],[now,'other','pdf'],[now,'month','html']]) expect(() => calendarReportPages(fixture(),date,period,format)).toThrow()
 })
 it('does not change calendar content when body or InBody datasets change', () => {
  const s=fixture(),pages=calendarReportPages(s,now,'full','pdf',{now})
  const unrelated={...s,bodyweight:[{d:'2026-09-01',w:999}],measurements:[{d:'2026-09-01',neck:123}],inbody:[{d:'2026-09-01',score:999}],heightHistory:[{d:'2026-09-01',cm:199}]}
  expect(calendarReportPages(unrelated,now,'full','pdf',{now})).toEqual(pages)
 })
 it.each(['1','3','6','12','all','custom'])('keeps progress %s within its own snapshot', period => {
  const s = fixture(), before = structuredClone(s), report = buildProgressReport(s,{now,period,from:'2026-09-15',to:'2026-09-25'})
  const pages = progressReportPages(null,{report}), html = progressReportHTML(report)
  expect(pages.length).toBeGreaterThan(0)
  for (const p of pages) { expect(p.svg).toContain('Progress Report'); expect(p.svg).not.toContain('data-period='); expect(p.svg).not.toContain('Consistency Report'); expect(doc(p.svg).querySelector('parsererror')).toBeNull() }
  expect(html).not.toContain('Consistency Report');expect(html).not.toContain('TGym Stats')
  if (period === 'custom') { expect(report.range.start).toBe('2026-09-15');expect(pages.map(p=>p.svg).join('')).not.toContain('31 cm') }
  expect(s).toEqual(before)
 })
 it('isolates stats HTML, deduplicates workouts and applies the statistics date boundaries', () => {
  vi.useFakeTimers();vi.setSystemTime(now)
  const s = fixture();s.workouts.push(structuredClone(s.workouts[0]),workout('future','2026-10-01','FUTURE_ONLY'),workout('cancel','2026-09-21','CANCEL_ONLY'),workout('active','2026-09-22','ACTIVE_ONLY'))
  s.workouts.at(-2).cancelled=true;s.active={id:'active'}
  s.measurements.push({d:'2026-10-01',neck:999})
  const before=structuredClone(s),html=statsReportHTML(s),dom=new DOMParser().parseFromString(html,'text/html')
  expect(dom.querySelectorAll('h1')).toHaveLength(1)
  expect([...dom.querySelectorAll('h2')].map(h=>h.textContent)).toEqual(['Body weight','Body measurements','InBody history','Workout history','Training overview'])
  expect((html.match(/WORKOUT_ONLY/g)||[])).toHaveLength(2)
  for(const forbidden of ['Progress Report','Consistency Report','FUTURE_ONLY','CANCEL_ONLY','ACTIVE_ONLY','999'])expect(html).not.toContain(forbidden)
  expect(s).toEqual(before)
 })
 it('uses the same date, search and alias filters for visible History and CSV', () => {
  const s=fixture();s.workouts.push(workout('old','2026-06-01','OLD_ONLY'),workout('other','2026-09-21','OTHER_ONLY'))
  s.exerciseAliases={'0025':'ALIAS_ONLY'}
  const filters={query:'workout_only',period:'30',now:+now},before=structuredClone(s)
  expect(filteredHistory(s,filters).map(w=>w.id)).toEqual(['a','b'])
  const csv=historyCsv(s,filters)
  expect(csv.charCodeAt(0)).toBe(0xfeff);expect(csv.split('\r\n')).toHaveLength(3)
  expect(csv).toContain('ALIAS_ONLY');for(const forbidden of ['OLD_ONLY','OTHER_ONLY','Body measurements','Progress Report','Consistency Report'])expect(csv).not.toContain(forbidden)
  expect(filteredHistory(s,{query:'alias_only'})).toHaveLength(4)
  expect(historyCsv(s,{query:'missing'}).split('\r\n')).toHaveLength(1)
  expect(s).toEqual(before)
 })
 it('keeps plan JSON and print isolated, while a full backup retains its explicitly complete scope', () => {
  const s=fixture(),before=structuredClone(s),bundle=buildPlanBundle(s),html=planPrintHTML(s,'Test')
  expect(bundle.routines).toHaveLength(1)
  for(const key of ['workouts','bodyweight','measurements','inbody','active'])expect(bundle).not.toHaveProperty(key)
  for(const text of ['WORKOUT_ONLY','Progress Report','Consistency Report','Body measurements'])expect(html).not.toContain(text)
  const restored=readBackup(JSON.parse(JSON.stringify(createBackup(s,now))))
  expect(restored.workouts).toHaveLength(2);expect(restored.measurements).toHaveLength(2)
  expect(s).toEqual(before)
 })
})

it('exports all 255 nonempty Progress section selections without leaking unselected sections or repeating identical pages', () => {
 const s=fixture(),before=structuredClone(s),report=buildProgressReport(s,{now}),ids=PROGRESS_SECTIONS.map(([id])=>id)
 const translate=title=>{const section=PROGRESS_SECTIONS.find(([,label])=>label===title);return section?'SECTION_'+section[0]:title}
 for(let mask=1;mask<256;mask++) {
  const selected=ids.filter((_,i)=>mask&(1<<i)),pages=progressReportPages(null,{report,sections:selected,t:translate})
  expect(pages.length).toBeGreaterThan(0);expect(new Set(pages.map(p=>p.svg)).size).toBe(pages.length)
  const headings=pages.flatMap(p=>[...doc(p.svg).querySelectorAll('text[font-size="24"]')].map(h=>h.textContent)).join(' ')
  for(const id of ids)expect(headings.includes('SECTION_'+id),selected.join(',')+' / '+id).toBe(selected.includes(id))
 }
 expect(()=>progressReportPages(null,{report,sections:[]})).toThrow('Select at least one section.')
 expect(s).toEqual(before)
})
