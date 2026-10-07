import { routineExchangeRows } from './routine-exchange.js'
import { reportPagesFile } from './report-file.js'
import { displayReps, modeOf } from './history.js'
import { restSeconds } from './rest-policy.js'

const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
// Wrapping is by Unicode codepoint, including long unbroken names/notes. Every line is paginated.
function wrap(text, fontSize = 14, measure) {
  const lines = []
  for (const paragraph of String(text).split(/\r?\n/)) {
    let rest = Array.from(paragraph)
    if (!rest.length) lines.push('')
    while (rest.length) {
      let size = 0, width = 0
      while (size < rest.length) {
        const nextWidth = measure ? measure(rest.slice(0, size + 1).join(''), fontSize) : width + fontSize * (/^[\x20-\x7e]$/.test(rest[size]) ? 0.95 : 1.3)
        if (nextWidth > 698 && size > 0) break
        width = nextWidth; size++
      }
      if (size < rest.length) { const space = rest.slice(0, size).lastIndexOf(' '); if (space > size / 2) size = space + 1 }
      lines.push(rest.splice(0, size).join('').trimEnd())
    }
  }
  return lines
}
export function routinePDFPages(data) {
  let context
  try { context = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null } catch { context = null }
  const measure = context ? (text, fontSize) => { context.font = `${fontSize === 14 ? 400 : 700} ${fontSize}px Arial, sans-serif`; return context.measureText(text).width } : null
  const table = routineExchangeRows(data), catalog = new Map(data.catalog.map(ex => [ex.id, ex]))
  const pages = []; let lines = [], count = 0, currentRoutine = '', currentExercise = ''
  const flush = () => { if (lines.length) { pages.push(lines); lines = []; count = 0 } }
  const breakPage = () => {
    flush()
    for (const text of [`Continued routine: ${currentRoutine}`, currentExercise ? `Exercise: ${currentExercise}` : ''].filter(Boolean)) {
      const short = Array.from(text).length > 100 ? Array.from(text).slice(0, 100).join('') + '…' : text
      for (const line of wrap(short, 14, measure)) { lines.push({ text: line, kind: 'normal', y: 110 + count }); count += 21 }
    }
    count += 12
  }
  const add = (text, kind = 'normal') => {
    for (const line of wrap(text, kind === 'routine' ? 21 : kind === 'exercise' ? 17 : 14, measure)) {
      const height = kind === 'routine' ? 31 : kind === 'exercise' ? 25 : 21
      if (count + height > 930) breakPage()
      lines.push({ text: line, kind, y: 110 + count }); count += height
    }
  }
  data.routines.forEach((routine, ri) => {
    if (ri && count > 690) flush()
    currentRoutine = routine.name; currentExercise = ''
    add(`${ri + 1}. ${routine.name}`, 'routine')
    const week = Object.entries(data.week || {}).filter(([, ids]) => ids.includes(routine.id)).map(([day]) => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][Number(day)])
    if (week.length) add(`Schedule: ${week.join(', ')}`)
    const dates = Object.entries(data.dayPlan || {}).filter(([, ids]) => ids.includes(routine.id)).map(([date]) => date)
    if (dates.length) add(`Dates: ${dates.join(', ')}`)
    if (routine.note) add(`Notes: ${routine.note}`)
    if (!routine.ex.length) add('No exercises.')
    routine.ex.forEach((e, ei) => {
      currentExercise = ''
      if (count > 840) breakPage()
      const ex = catalog.get(e.id), instance = `${routine.id}:${ei + 1}`
      currentExercise = data.exerciseNameMode === 'original' ? ex?.n || e.id : ex?.alias || ex?.n || e.id
      add(`${ei + 1}. ${currentExercise}`, 'exercise')
      if (ex?.alias) add(data.exerciseNameMode === 'original' ? `Alias: ${ex.alias}` : `Original: ${ex.n}`)
      if (ex?.libraryNote) add(`Library note: ${ex.libraryNote}`)
      if (e.sg) add(`Superset: ${e.sg}`)
      if (e.note) add(`Notes: ${e.note}`)
      const rows = table.Series.filter(row => row[0] === instance)
      rows.forEach(row => {
        const [, order, type, min, max, weight, unit, rirMin, rirMax, rest, top, pct, rule, automatic, sec, minutes, speed] = row
        const range = min === max ? displayReps(max, e) : `${displayReps(min, e)}-${displayReps(max, e)}`
        let text = `Set ${order} | ${type} | `
        text += type === 'Warm-up' ? 'Automatic TGym warm-up' : sec !== '' ? `${sec} s` : minutes !== '' ? `${minutes} min @ ${speed} km/h` : `${range} reps${e.side ? ' / side' : ''}`
        if (weight !== '' && minutes === '') text += ` | ${weight} ${unit}`
        if (rirMin !== '') text += ` | RIR ${rirMin === rirMax ? rirMax : `${rirMin}-${rirMax}`}`
        text += ` | Rest ${rest} s`
        add(text)
        if (top) add(`  Top association: ${top} | Load reduction ${pct}% | Reps ${automatic ? rule : 'independent range'}`)
      })
      if (e.prog && e.prog !== 'off') add(`Progression: ${e.prog}${e.inc ? ` | Increment ${e.inc} ${modeOf(e) === 'time' ? 's' : data.unit}` : ''}`)
      if (e.intensifier) add(`Intensity technique: ${e.intensifier.type} | ${JSON.stringify(e.intensifier)}`)
      if (e.sg) add(`Superset move rest: ${restSeconds({ state: data.rules, routine, target: e, phase: 'supersetMove' })} s | Round rest: ${restSeconds({ state: data.rules, routine, target: e, phase: 'supersetRound' })} s`)
      count += 12
    })
    count += 16
  })
  flush()
  return pages.map((rows, index) => ({ width: 794, height: 1123, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="794" height="1123" viewBox="0 0 794 1123"><rect width="794" height="1123" fill="white"/><g fill="#20251b" font-family="Arial, sans-serif"><text x="48" y="46" font-size="22" font-weight="700">TGym - Routine prescriptions</text><text x="48" y="75" font-size="13" fill="#56634a">${esc(data.exported || '')} | ${data.routines.length} routines | ${esc(data.unit)} | No recorded workout results</text>${rows.map(row => `<text x="48" y="${row.y}" font-size="${row.kind === 'routine' ? 21 : row.kind === 'exercise' ? 17 : 14}" font-weight="${row.kind === 'normal' ? 400 : 700}">${esc(row.text)}</text>`).join('')}<text x="48" y="1080" font-size="12" fill="#56634a">TGym routine exchange v1 - Page ${index + 1} / ${pages.length}</text></g></svg>` }))
}
export async function routinePDFFile(data, name, { signal, onProgress = () => {} } = {}) {
  if (signal?.aborted) throw new DOMException('Canceled', 'AbortError')
  const pages = routinePDFPages(data); onProgress(50)
  const file = await reportPagesFile(pages, name, { title: 'TGym routine prescriptions' })
  if (signal?.aborted) throw new DOMException('Canceled', 'AbortError')
  onProgress(100); return file
}
