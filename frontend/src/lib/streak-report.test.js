// @vitest-environment happy-dom
import { expect, it } from 'vitest'
import { buildStreakReport, streakRange, streakReportPages, streakFilename } from './streak-report.js'
import { trainingStreak } from './training-plan.js'

const now=new Date('2026-10-05T12:00:00'), anchor=new Date('2026-09-16T12:00:00')
const workout=(id,d,extra={})=>({id,d,routineId:'r',entries:[{id:'exercise',sets:[{done:true,r:8}]}],...extra})
const fixture=()=>({trainingStartDate:'2026-09-28',routines:[{id:'r',name:'PRIVATE ROUTINE'}],week:{1:'r',3:'r',5:'r'},workouts:[workout('a','2026-09-28'),workout('b','2026-09-30'),workout('c','2026-10-02'),workout('extra','2026-10-04',{routineId:null})]})
it.each([
 ['this-week','2026-10-05','2026-10-11'],['last-week','2026-09-28','2026-10-04'],
 ['this-month','2026-10-01','2026-10-31'],['last-month','2026-09-01','2026-09-30'],
 ['week','2026-09-14','2026-09-20'],['month','2026-09-01','2026-09-30'],['year','2026-01-01','2026-12-31'],['full','2026-01-01','2026-12-31']
])('resolves %s without confusing today with the calendar anchor',(period,start,end)=>expect(streakRange({period,now,anchor})).toMatchObject({start,end}))
it('handles year/month boundaries, leap days and inclusive custom ranges',()=>{
 expect(streakRange({period:'last-month',now:new Date('2026-01-01T12:00:00')})).toMatchObject({start:'2025-12-01',end:'2025-12-31'})
 expect(streakRange({period:'last-month',now:new Date('2024-03-01T12:00:00')})).toMatchObject({start:'2024-02-01',end:'2024-02-29'})
 const r=buildStreakReport(fixture(),{period:'custom',from:'2026-09-30',to:'2026-10-02',now})
 expect(r.days.map(d=>d.iso)).toEqual(['2026-09-30','2026-10-01','2026-10-02'])
 expect(streakFilename({period:'custom',from:'2026-09-30',to:'2026-10-02',now})).toBe('TGym-Streak-2026-09-30_2026-10-02.pdf')
})
it.each([['','2026-10-02'],['2026-02-30','2026-10-02'],['2026-10-03','2026-10-02'],['2026-10-02','2026-10-06']])('rejects invalid custom dates %s / %s',(from,to)=>{
 expect(streakRange({period:'custom',from,to,now}).error).toBeTruthy()
 expect(()=>streakReportPages({}, {period:'custom',from,to,now})).toThrow('Choose a valid date range.')
})
it('matches Home, preserves carry-in and deduplicates activity while excluding unrelated data',()=>{
 const S=fixture(),before=structuredClone(S)
 S.workouts.push(S.workouts[0],workout('same','2026-10-04',{routineId:null}),workout('active','2026-10-03',{active:true}),workout('zero','2026-10-03',{entries:[{sets:[{done:true,r:0}]}]}))
 const r=buildStreakReport(S,{period:'this-month',now})
 expect(r.current).toBe(trainingStreak(S,now).current);expect(r.current).toBe(4)
 expect(r.days.filter(d=>d.status==='completed')).toHaveLength(2)
 const dirty={...S,bodyweight:[{d:'2026-10-02',w:999}],measurements:[{d:'2026-10-02',neck:999}],inbody:[{d:'2026-10-02',score:999}]}
 expect(buildStreakReport(dirty,{period:'this-month',now})).toEqual(r)
 const svg=streakReportPages(dirty,{period:'this-month',now})[0].svg
 for(const forbidden of ['Consistency Report','Completion','Body','PRIVATE ROUTINE','999','Progress Report'])expect(svg).not.toContain(forbidden)
 expect(svg).toContain('Streak Report');expect(before.workouts[0]).toEqual(S.workouts[0])
})
it('resets at a missed historical endpoint and keeps pause/rest neutral',()=>{
 const S=fixture();S.workouts=S.workouts.filter(w=>w.d!=='2026-10-02')
 expect(buildStreakReport(S,{period:'custom',from:'2026-09-30',to:'2026-10-02',now})).toMatchObject({current:0,best:2})
 S.trainingPauses=[{start:'2026-10-02',end:'2026-10-04'}]
 const r=buildStreakReport(S,{period:'custom',from:'2026-09-30',to:'2026-10-02',now})
 expect(r.current).toBe(2);expect(r.days.at(-1).status).toBe('paused')
})
it('marks empty/untracked periods and splits PDF dates without duplicates',()=>{
 const options={period:'full',now,anchor}, pages=streakReportPages({},options)
 const dates=pages.flatMap(p=>[...p.svg.matchAll(/data-date="([^"]+)"/g)].map(m=>m[1]))
 expect(dates).toHaveLength(365);expect(new Set(dates).size).toBe(365)
 expect(buildStreakReport({},options).noData).toBe(true)
 expect(pages[0].svg).toContain('No recorded activity in this period.')
 for(const page of pages)expect(new DOMParser().parseFromString(page.svg,'image/svg+xml').querySelector('parsererror')).toBeNull()
})
it('preserves compact Year and detailed Full Report, and rejects unsafe PNG spans',()=>{
 expect(streakReportPages(fixture(),{period:'year',now,anchor})).toHaveLength(3)
 expect(streakReportPages(fixture(),{period:'full',now,anchor})).toHaveLength(9)
 expect(streakRange({period:'month',anchor:'2026-02-30',now}).error).toBeTruthy()
 expect(()=>streakReportPages({}, {period:'custom',from:'2024-01-01',to:'2026-10-05',now,format:'png'})).toThrow('Use PDF')
})
