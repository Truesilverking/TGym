import { describe,it,expect } from 'vitest'
import { buildProgressReport,progressRange,progressMetric,comparePerformance } from './progress-report.js'
import { progressReportHTML,progressReportPages,wrapProgressText } from './progress-export.js'
import { convertWeightState,convertMeasurementState } from './unit-conversion.js'
import { recordHeight } from './body-records.js'
import { createBackup,validateBackupState } from './backup.js'
const now=new Date('2026-09-26T12:00:00'), date=d=>new Date(d+'T12:00:00').getTime()
const base=()=>({unit:'kg',measurementUnit:'cm',routines:[],week:{},workouts:[],bodyweight:[],measurements:[],inbody:[]})
const workout=(id,d,w=80,r=8,rir=2,extra={})=>({id,d,start:date(d),end:date(d)+3600000,entries:[{id:'0025',target:{mode:'reps',bodyweight:false},sets:[{done:true,w,r,rir}]}],...extra})
const report=S=>buildProgressReport(S,{now})
describe('progress report: real history only',()=>{
 it('keeps new users empty and one reading insufficient',()=>{
  expect(report(base()).body).toEqual([])
  const s=base();s.measurements=[{d:'2026-09-01',neck:30}]
  const m=report(s).body[0];expect(m.delta).toBeNull();expect(m.percent).toBeNull();expect(m.status).toBe('Insufficient Data')
 })
 it('compares first and last valid samples without inventing benefit or mutating history',()=>{
  const s=base();s.measurements=[{d:'2026-09-03',neck:35},{d:'2026-09-01',neck:30},{d:'2026-09-02',neck:NaN},{d:'2099-01-01',neck:80}]
  const before=structuredClone(s),m=report(s).body[0];expect(m.delta).toBe(5);expect(m.percent).toBeCloseTo(16.6667);expect(m.status).toBe('Changed');expect(m.slope).toBeGreaterThan(0);expect(s).toEqual(before)
 })
 it('keeps every bodyweight sample and all legacy/bilateral/InBody metrics',()=>{
  const s=base();s.bodyweight=[{d:'2026-09-01',w:75,samples:[{w:70,t:date('2026-09-01')},{w:80,t:date('2026-09-01')+1000}]}];s.measurements=[{d:'2026-09-01',arm:30}];s.inbody=[{d:'2026-09-01',weight:70,skeletalMuscle:30,bodyFatMass:10,bodyFatPct:14,bodyWater:40,protein:10,minerals:3,bmr:1700,bmi:24,score:80,visceralFat:5}]
  const b=report(s).body;expect(b.find(m=>m.key==='weight').points).toHaveLength(2);expect(b.find(m=>m.key==='armLeft').last.y).toBe(30);expect(b.filter(m=>m.key.startsWith('inbody:'))).toHaveLength(11)
 })
 it('uses canonical InBody kg and stamped workout units with kg/lb and cm/in switches',()=>{
  const s=base();s.bodyweight=[{d:'2026-09-01',w:70},{d:'2026-09-03',w:75}];s.measurements=[{d:'2026-09-01',neck:30},{d:'2026-09-03',neck:35}];s.inbody=[{d:'2026-09-01',weight:70}];s.workouts=[workout('a','2026-09-01'),workout('b','2026-09-03',100)]
  convertWeightState(s,'lb');convertMeasurementState(s,'in');const r=report(s)
  expect(r.body.find(m=>m.key==='inbody:weight').last.y).toBeCloseTo(154.324)
  expect(r.body.find(m=>m.key==='neck').delta).toBeCloseTo(1.97,2)
  expect(r.exercises[0].metrics.find(m=>m.key==='w').percent).toBeCloseTo(25,1)
 })
 it.each(['all','1','3','6','12','custom'])('bounds %s by training start and the selected period',period=>{
  const s=base();s.trainingStartDate='2026-09-01';s.measurements=[{d:'2026-08-01',neck:10},{d:'2026-09-02',neck:30},{d:'2026-09-20',neck:35}]
  const r=buildProgressReport(s,{now,period,from:'2026-09-10',to:'2026-09-25'});expect(r.range.start>=s.trainingStartDate).toBe(true);expect(r.body[0].first.y).toBe(period==='custom'?35:30)
 })
 it('clamps calendar-month boundaries and rejects inverted custom ranges',()=>{
  expect(progressRange(base(),{period:'1',now:new Date('2026-03-31T12:00:00'),from:''}).start).toBe('2026-03-31')
  const s={...base(),trainingStartDate:'2020-01-01'};expect(progressRange(s,{period:'1',now:new Date('2026-03-31T12:00:00')}).start).toBe('2026-02-28')
  expect(progressRange(s,{period:'custom',from:'2026-09-30',to:'2026-09-01',now}).error).toBeTruthy()
 })
 it('retains dated height history and backups without assigning an undated baseline',()=>{
  const s={...base(),heightCm:170};recordHeight(s,175,'2026-09-01',date('2026-09-01'),'h1');recordHeight(s,180,'2026-09-03',date('2026-09-03'),'h2');convertMeasurementState(s,'in')
  expect(s.heightHistory.map(h=>h.cm)).toEqual([175,180]);expect(report(s).body.find(m=>m.key==='height').delta).toBeCloseTo(5/2.54)
  expect(validateBackupState(createBackup(s).data).heightHistory).toHaveLength(2)
 })
 it('avoids percentages for zero baselines and effort scales',()=>{
  const pts=[{d:'2026-09-01',t:1,y:0},{d:'2026-09-02',t:2,y:10}];expect(progressMetric('a','a','',pts).percent).toBeNull();expect(progressMetric('a','a','',pts,{percent:false}).percent).toBeNull()
 })
})
describe('exercise comparison and training aggregation',()=>{
 it('does not infer improvement from missing load and retains dated legacy height alone',()=>{
  expect(comparePerformance({w:null,r:8,rir:2},{w:10,r:8,rir:2})).toBe('Insufficient Data')
  const r=report({...base(),heightCm:170,heightRecordedAt:'2026-08-01'})
  expect(r.body.find(m=>m.key==='height').first.y).toBe(170);expect(r.training).toEqual([])
 })
 it('selects actual timed performance independently of unused load fields',()=>{
  const s=base(),a=workout('a','2026-09-01');a.entries[0].target={mode:'time'};a.entries[0].sets=[{done:true,w:0,sec:20},{done:true,w:0,sec:60}];s.workouts=[a]
  expect(report(s).exercises[0].metrics.find(m=>m.key==='sec').last.y).toBe(60)
 })
 it('does not invent a same-load rep record from missing or invalid loads',()=>{
  const s=base();s.workouts=[workout('a','2026-09-01',null,15),workout('b','2026-09-03',-10,20)]
  const r=report(s);expect(r.records).toEqual([]);expect(r.exercises[0].metrics.some(m=>m.key==='w')).toBe(false);expect(r.exercises[0].status).toBe('Insufficient Data')
 })
 it.each([[100,8,2,'Improved'],[80,8,3,'Improved'],[80,12,2,'Improved'],[90,6,2,'Changed'],[80,8,0,'Changed']])('compares load/reps/RIR jointly (%s,%s,%s)',(w,r,rir,status)=>{
  const s=base();s.workouts=[workout('a','2026-09-01'),workout('b','2026-09-03',w,r,rir)];const ex=report(s).exercises[0];expect(ex.status).toBe(status);expect(ex.metrics.find(m=>m.key==='est').last.y).toBeGreaterThan(0)
 })
 it('does not assert improvement with missing effort or compare rest-pause to straight sets',()=>{
  expect(comparePerformance({w:80,r:8,rir:null},{w:100,r:8,rir:null})).toBe('Changed')
  const s=base(),a=workout('a','2026-09-01'),b=workout('b','2026-09-03');b.entries[0].sets[0].type='restpause';s.workouts=[a,b];expect(report(s).exercises).toHaveLength(2)
 })
 it('preserves per-side display and legacy volume, ignores warmups and deduplicates equivalent PR sets',()=>{
  const s=base(),a=workout('a','2026-09-01',80,16),b=workout('b','2026-09-03',100,16)
  for(const w of [a,b])w.entries[0].target.side=true
  b.entries[0].sets.push({...b.entries[0].sets[0]},{done:true,w:200,r:20,phase:'warmup'});s.workouts=[a,b,structuredClone(b)]
  const r=report(s);expect(r.exercises[0].metrics.find(m=>m.key==='r').first.y).toBe(8);expect(r.summary.volume).toBe(4480);expect(r.records).toHaveLength(1);expect(r.summary.workouts).toBe(2)
 })
 it('keeps AMRAP actual reps but refuses high-rep 1RM and tracks bodyweight rep records',()=>{
  const s=base(),a=workout('a','2026-09-01',0,15),b=workout('b','2026-09-03',0,20)
  for(const w of [a,b])w.entries[0].target={mode:'reps',bodyweight:true,amrap:true};s.workouts=[a,b]
  const r=report(s);expect(r.exercises[0].metrics.some(m=>m.key==='est')).toBe(false);expect(r.records[0].label).toBe('Reps at the same load');expect(r.records[0].value).toBe(20)
 })
 it('uses equal complete weeks, includes zero weeks, labels partial weeks and respects multi-routine schedules',()=>{
  const s={...base(),trainingStartDate:'2026-09-01',routines:[{id:'a',name:'A'},{id:'b',name:'B'}],week:{1:['a','b']}}
  s.workouts=[workout('a1','2026-09-07',80,8,2,{routineId:'a'}),workout('b1','2026-09-07',80,8,2,{routineId:'b'})]
  const r=report(s);expect(r.weekly.filter(w=>!w.partial)).toHaveLength(2);expect(r.training.find(m=>m.key==='workouts').points.map(p=>p.y)).toEqual([2,0]);expect(r.summary.completed).toBe(2);expect(r.summary.activeDays).toBe(1);expect(r.summary.totalMinutes).toBe(120)
 })
 it('includes duration, muscle volume and additional continuous activity metrics',()=>{
  const s=base();s.workouts=[workout('a','2026-09-01'),workout('b','2026-09-03',80,8,2,{activity:{type:'running',distanceKm:5,averageHeartRate:145,calories:350,steps:6000,elevationM:20,hrZone:3,rpe:7}})]
  const r=report(s);expect(r.training.some(m=>m.key.startsWith('muscle:'))).toBe(true);expect(r.activities.map(m=>m.key)).toContain('running:averageHeartRate');expect(r.training.find(m=>m.key==='duration').last.y).toBe(60)
 })
 it('exports matching metrics/charts and safely escapes exercise names',()=>{
  const s=base();s.workouts=[workout('a','2026-09-01'),workout('b','2026-09-03',100)];s.workouts.forEach(w=>w.entries[0].exercise={id:'0025',n:'<script>bad</script>'})
  const html=progressReportHTML(report(s));expect(html).toContain('Estimated 1RM');expect(html).toContain('polyline');expect(html).not.toContain('<script>bad');expect(progressReportPages(s,{now}).length).toBeGreaterThan(1)
 })
})

 it('exports the selected report without rebuilding an all-time range',()=>{
  const s=base();s.measurements=[{d:'2026-07-01',neck:30},{d:'2026-09-20',neck:35}]
  const selected=buildProgressReport(s,{now,period:'custom',from:'2026-09-01',to:'2026-09-25'})
  const pages=progressReportPages(null,{report:selected})
  expect(pages[0].svg).toContain('2026-09-01 → 2026-09-25')
  expect(pages[0].svg).toContain('35 cm');expect(pages[0].svg).not.toContain('30 cm');expect(pages[0].svg).toContain('More data needed')
 })
 it('renders a valid single-page empty PDF layout and escapes imported text',()=>{
  const pages=progressReportPages(base(),{now});expect(pages).toHaveLength(1);expect(pages[0].svg).toContain('No comparable history in this period.');expect(pages[0].svg).not.toMatch(/NaN|undefined/)
  const s=base();s.workouts=[workout('a','2026-09-01')]
  const svg=progressReportPages(s,{now,name:()=>'<script>alert(1)</script>'}).map(p=>p.svg).join('')
  expect(svg).not.toContain('<script>');expect(svg).toContain('&lt;script&gt;')
 })

 it('wraps localized labels at spaces without splitting ordinary exercise names',()=>{
  expect(wrapProgressText('Récords personales · sentadilla profunda con barra',48)).toEqual(['Récords personales · sentadilla profunda con','barra'])
  expect(wrapProgressText('Promedio de entrenamientos por semana',23)).toEqual(['Promedio de','entrenamientos por','semana'])
 })
 it('bounds long unbroken imported names without losing characters',()=>{
  const name='x'.repeat(120),lines=wrapProgressText(name,48)
  expect(lines.every(l=>l.length<=48)).toBe(true);expect(lines.join('')).toBe(name)
 })

it('keeps bodyweight rep records per side without changing legacy totals',()=>{
 const s=base(),a=workout('a','2026-09-01',0,16),b=workout('b','2026-09-03',0,20)
 for(const w of [a,b])w.entries[0].target={mode:'reps',bodyweight:true,side:true}
 s.workouts=[a,b];const before=structuredClone(s),r=report(s)
 expect(r.records[0]).toMatchObject({previous:8,value:10,unit:'reps / side'})
 expect(s).toEqual(before)
 expect(progressReportPages(s,{now}).map(p=>p.svg).join('')).toContain('10 reps / side')
})
it('paginates every personal record in compact rows without dropping records',()=>{
 const r=report(base());r.records=Array.from({length:25},(_,i)=>({exercise:{n:'Unique exercise '+i},d:'2026-09-25',label:'Reps at the same load',previous:i,value:i+1,unit:'reps'}))
 const pages=progressReportPages(null,{report:r}),svg=pages.map(p=>p.svg).join('')
 expect(pages).toHaveLength(4)
 for(let i=0;i<25;i++)expect(svg).toContain('Unique exercise '+i+'</text>')
 expect(svg).toContain('4 / 4')
})
