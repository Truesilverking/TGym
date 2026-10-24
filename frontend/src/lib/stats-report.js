import { measurementInUnit } from './body-report.js'
import { hybridSummary } from './activities.js'
import { statisticsState, historySummary } from './training-history.js'
import { EXIDX } from './exercises.js'
import { lastBW, setLabel } from './history.js'
import { fmtNum, fmtDate, fmtVol, todayISO } from './format.js'
import { t, getLang } from './i18n.js'
import { exerciseNameFor } from './i18n-core.js'
import { bmiFor, MEASURE_FIELDS, routineConsistency } from './stats-insights.js'
import { trainingStreak } from './training-plan.js'
import { workoutElapsedMs } from './workout-time.js'

export function statsReportHTML(S) {
  S = statisticsState(S)
  const history = historySummary(S)
  const esc = x => String(x).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
  const td = x => `<td>${esc(x ?? '—')}</td>`
  const last = lastBW(S), consistency = routineConsistency(S), streak = trainingStreak(S)
  const bmi = bmiFor(last?.w, S.unit, S.heightCm, S.measurementUnit)
  const measureHead = MEASURE_FIELDS.map(([, label]) => `<th>${esc(t(label))}</th>`).join('')
  const measureRows = [...(S.measurements || [])].reverse().map(m => `<tr>${td(fmtDate(m.d, true))}${MEASURE_FIELDS.map(([key]) => td(measurementInUnit(m, key, S.measurementUnit || 'cm') ?? '—')).join('')}</tr>`).join('')
  const weightRows = [...(S.bodyweight || [])].reverse().map(b => `<tr>${td(fmtDate(b.d, true))}${td(`${fmtNum(b.w)} ${S.unit}`)}${td(bmiFor(b.w, S.unit, S.heightCm, S.measurementUnit) || '—')}</tr>`).join('')
  const workoutRows = [...(S.workouts || [])].reverse().map(w => `<tr>${td(fmtDate(w.d, true))}${td(w.name)}${td(Math.max(0, Math.round(workoutElapsedMs(w) / 60000)) + ' min')}${td(fmtVol(w.vol || 0, S.unit))}${td((w.entries || []).map(e => `${exerciseNameFor((S.customEx || []).find(ex => ex.id === e.id) || EXIDX[e.id] || { id: e.id, n: e.n || e.exercise?.n || e.muscleSnapshot?.n || e.id }, S, { entry: e, routineId: w.routineId })}: ${(e.sets || []).filter(s => s.done).map(s => setLabel(e.id, s, e.target)).join(', ')}`).join(' | '))}</tr>`).join('')
  const inbodyFields = [['weight','Weight'],['skeletalMuscle','Skeletal muscle mass'],['bodyFatMass','Body fat mass'],['bodyFatPct','Body fat percentage'],['bmi','BMI'],['visceralFat','Visceral fat level'],['bodyWater','Total body water'],['protein','Protein'],['minerals','Minerals'],['bmr','Basal metabolic rate'],['score','InBody score']]
  const inbodyRows = [...(S.inbody || [])].reverse().map(r => `<tr>${td(fmtDate(r.d, true))}${inbodyFields.map(([key]) => td(r[key] ?? '—')).join('')}</tr>`).join('')
  const activity = hybridSummary(S.workouts)
  const activityReport = `<h2>${esc(t('Training overview'))}</h2><section class="summary">${[['Strength sessions',activity.strength],['Runs',activity.running],['Other cardio',activity.cardio],['Recovery sessions',activity.recovery],['Active days',activity.days],['Total time (min)',Math.round(activity.minutes)],['Distance (km)',fmtNum(activity.distanceKm)]].map(([label,value])=>`<div class="box">${esc(t(label))}<b>${esc(value)}</b></div>`).join('')}</section>`
  const html = `<!doctype html><html lang="${esc(getLang())}"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>TGym Stats ${todayISO()}</title><style>body{font:15px system-ui;margin:32px;color:#171717}h1{color:#d82727}h2{margin-top:32px}section{break-inside:avoid}.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.box{padding:14px;border:1px solid #ddd;border-radius:10px}.box b{display:block;font-size:24px;margin-top:5px}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border:1px solid #ddd;padding:7px;text-align:left;vertical-align:top}th{background:#f3f3f3}small{color:#666}.scroll{overflow-x:auto}@media print{body{margin:12mm}.scroll{overflow:visible}}</style><body><h1>TGym · ${esc(t('Stats'))}</h1><small>${esc(fmtDate(todayISO(), true))}</small><p>${esc(t('Training since {0}',history.start))} · ${esc(t('{0} recorded · {1} estimated before tracking',history.trackedWorkouts,history.historicalWorkouts))}</p><section class="summary"><div class="box">${esc(t('Total workouts'))}<b>${history.total}</b></div><div class="box">${esc(t('Training streak'))}<b>${streak.current}</b></div><div class="box">${esc(t('Completion'))}<b>${consistency.rate == null ? '—' : Math.round(consistency.rate * 100) + '%'}</b><small>${consistency.activeDays} / ${consistency.activeDays + consistency.missedDays}</small></div><div class="box">${esc(t('Body weight'))}<b>${last ? esc(fmtNum(last.w) + ' ' + S.unit) : '—'}</b></div><div class="box">${esc(t('BMI'))}<b>${bmi || '—'}</b></div></section><h2>${esc(t('Body weight'))}</h2><div class="scroll"><table><thead><tr><th>${esc(t('Date'))}</th><th>${esc(t('Weight'))}</th><th>${esc(t('BMI'))}</th></tr></thead><tbody>${weightRows || `<tr>${td(t('No data yet'))}</tr>`}</tbody></table></div><h2>${esc(t('Body measurements'))}</h2><small>${esc(S.measurementUnit || 'cm')}</small><div class="scroll"><table><thead><tr><th>${esc(t('Date'))}</th>${measureHead}</tr></thead><tbody>${measureRows || `<tr>${td(t('No data yet'))}</tr>`}</tbody></table></div><h2>${esc(t('InBody history'))}</h2><div class="scroll"><table><thead><tr><th>${esc(t('Date'))}</th>${inbodyFields.map(([,label]) => `<th>${esc(t(label))}</th>`).join('')}</tr></thead><tbody>${inbodyRows || `<tr>${td(t('No data yet'))}</tr>`}</tbody></table></div><h2>${esc(t('Workout history'))}</h2><div class="scroll"><table><thead><tr><th>${esc(t('Date'))}</th><th>${esc(t('Routine'))}</th><th>${esc(t('Duration'))}</th><th>${esc(t('Volume'))}</th><th>${esc(t('Exercises'))}</th></tr></thead><tbody>${workoutRows || `<tr>${td(t('No workouts yet'))}</tr>`}</tbody></table></div>${activityReport}</body></html>`
  return html
}
