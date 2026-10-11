import { routineExchangeRows, ROUTINE_EXCHANGE_VERSION } from './routine-exchange.js'
import { reportPagesFile } from './report-file.js'
import { displayReps, isBw, modeOf } from './history.js'
import { restSeconds } from './rest-policy.js'
import { policyFor, loadingStepFor } from './progression.js'
import { routineIds } from './daily-plan.js'
import { withBackoffRepsMode } from './training-plan.js'

const WIDTH = 794, HEIGHT = 1123, LEFT = 48, INNER = 698, TOP = 112, BOTTOM = 1044
const COLUMN_WIDTHS = [40, 87, 253, 115, 85, 118]
const COLORS = { ink: '#202b25', muted: '#546357', accent: '#354c3c', pale: '#edf2ee', border: '#d9e2db' }
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]))
const number = value => Number.isFinite(Number(value)) ? String(Number(Number(value).toFixed(3))) : String(value ?? '')
const range = (min, max, e) => min === max ? number(displayReps(max, e)) : `${number(displayReps(min, e))}-${number(displayReps(max, e))}`
const text = (x, y, value, size = 14, color = COLORS.ink, weight = 400) => `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}">${esc(value)}</text>`

// SVG text never wraps itself. Measure real browser fonts; plain-Node tests use conservative
// Arial advances. The previous one-em-per-ASCII estimate doubled many short table lines.
function wrapper() {
  let context, currentFont
  const advances = new Map()
  try { context = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null } catch { context = null }
  const advance = char => {
    if (advances.has(char)) return advances.get(char)
    const base = char.normalize('NFD')[0]
    const factor = /\p{Mark}/u.test(char) ? 0 : /[MWmw@]/.test(base) ? .95 : /[ilI!.,:;|'\s]/.test(base) ? .3 : /[A-Z]/.test(base) ? .75 : /[a-z0-9/()\[\]{}+%-]/.test(base) ? .6 : /\p{Extended_Pictographic}/u.test(char) ? 1.5 : 1
    advances.set(char, factor)
    return factor
  }
  const measured = (value, size, weight) => {
    if (context) {
      const font = `${weight} ${size}px Arial, sans-serif`
      if (font !== currentFont) { context.font = font; currentFont = font }
      return context.measureText(value).width
    }
    return Array.from(value).reduce((width, char) => width + advance(char) * size * (weight >= 600 ? 1.04 : 1), 0)
  }
  return (value, maxWidth = INNER, size = 14, weight = 400) => String(value ?? '').split(/\r?\n/).flatMap(paragraph => {
    const lines = [], chars = Array.from(paragraph)
    if (!chars.length) return ['']
    let offset = 0
    while (offset < chars.length) {
      // Bound searches to roughly one visible line. Measuring half the remaining paragraph
      // or splicing its front on every line makes a long pasted note quadratic in length.
      const remaining = chars.length - offset
      const fits = length => measured(chars.slice(offset, offset + length).join(''), size, weight) <= maxWidth - 3
      let low = 1, high = Math.min(32, remaining)
      while (high < remaining && fits(high)) { low = high; high = Math.min(remaining, high * 2) }
      while (low < high) { const mid = Math.ceil((low + high) / 2); if (fits(mid)) low = mid; else high = mid - 1 }
      let length = low
      if (length < remaining) { const space = chars.slice(offset, offset + length).lastIndexOf(' '); if (space > length / 2) length = space + 1 }
      lines.push(chars.slice(offset, offset + length).join('').trimEnd())
      offset += length
    }
    return lines
  })
}

/** Read-only presentation of prescriptions. No history, active rows or completed results. */
export function routinePDFPages(data) {
  const wrap = wrapper(), catalog = new Map(data.catalog.map(ex => [ex.id, ex]))
  const table = routineExchangeRows(data), series = new Map()
  for (const row of table.Series) { const rows = series.get(row[0]) || []; rows.push(row); series.set(row[0], rows) }
  const pages = []; let svg = '', y = TOP, hasContent = false, routineContext = '', exerciseContext = ''
  const start = () => { svg = ''; y = TOP; hasContent = false }
  const finish = () => { if (hasContent) pages.push(svg) }
  const shorten = value => Array.from(value).length > 115 ? Array.from(value).slice(0, 112).join('') + '...' : value
  const next = (continued = true) => {
    finish(); start()
    for (const value of (continued ? [routineContext && `Continued routine: ${shorten(routineContext)}`, exerciseContext && `Exercise: ${shorten(exerciseContext)}`] : []).filter(Boolean)) {
      for (const line of wrap(value, INNER, 12)) { svg += text(LEFT, y + 12, line, 12, COLORS.muted); y += 17 }
    }
    y += 7
  }
  const ensure = (height, continued = true) => { if (hasContent && y + height > BOTTOM) next(continued) }
  const add = (height, draw) => { ensure(height); svg += draw(y); y += height; hasContent = true }
  const gap = height => { y += height }
  const paragraph = (value, { size = 14, weight = 400, color = COLORS.muted, keepNext = 0, marker = '' } = {}) => {
    const lines = wrap(value, INNER, size, weight), height = size + 6
    for (const [index, line] of lines.entries()) {
      // The last heading line remains with its table/first row. Oversized names and notes
      // still flow fully rather than truncating or making a page-sized indivisible block.
      ensure(height + (index === lines.length - 1 ? keepNext : 0))
      add(height, top => `<g ${index === lines.length - 1 ? marker : ''} ${index ? '' : `aria-label="${esc(value)}"`}>${text(LEFT, top + size, line, size, color, weight)}</g>`)
    }
  }
  const cellsFor = (row, e, ex) => {
    const [, order, type, min, max, weight, unit, rirMin, rirMax, rest, , , , , sec, minutes, speed] = row
    const side = e.side ? ' / side' : ''
    const target = type === 'Warm-up' ? 'Automatic TGym warm-up' : sec !== '' ? `${number(sec)} s${side}` : minutes !== '' ? `${number(minutes)} min @ ${number(speed)} km/h\nDistance ${number(Number(minutes) * Number(speed) / 60)} km` : `${range(min, max, e)} reps${side}${e.amrap ? ' (AMRAP)' : ''}`
    const bodyweight = isBw(e)
    const load = weight === '' || minutes !== '' ? '-' : bodyweight ? `Bodyweight${Number(weight) ? ` +${number(weight)} ${unit}` : ''}` : `${number(weight)} ${unit}`
    return [String(order), type, target, load, rirMin === '' ? '-' : rirMin === rirMax ? number(rirMax) : `${number(rirMin)}-${number(rirMax)}`, `${number(rest)} s`]
  }
  const cellLines = cells => cells.map((value, index) => wrap(value, COLUMN_WIDTHS[index] - 14, 14))
  const rowHeight = cells => Math.max(...cellLines(cells).map(lines => lines.length)) * 19 + 9
  const drawCells = (cells, top, header = false) => {
    let x = LEFT
    return cellLines(cells).map((lines, index) => {
      const value = `<g aria-label="${esc(cells[index])}">${lines.map((line, i) => text(x + 7, top + 20 + i * 19, line, 14, header ? '#ffffff' : COLORS.ink, header ? 700 : 400)).join('')}</g>`
      x += COLUMN_WIDTHS[index]; return value
    }).join('')
  }
  const tableHeader = instance => add(32, top => `<g data-series-header="${esc(instance)}"><rect x="${LEFT}" y="${top}" width="${INNER}" height="32" rx="3" fill="${COLORS.accent}"/>${drawCells(['Set', 'Type', 'Prescription', 'Load', 'RIR', 'Rest'], top, true)}</g>`)

  start()
  data.routines.forEach((routine, ri) => {
    exerciseContext = ''; routineContext = routine.name
    const heading = `${ri + 1}. ${routine.name}`, first = routine.ex[0]
    const firstName = first ? catalog.get(first.id) : null
    const firstHeading = first ? `1. ${data.exerciseNameMode === 'original' ? firstName?.n || first.id : firstName?.alias || firstName?.n || first.id}` : ''
    const firstRow = first ? series.get(`${routine.id}:1`)?.[0] : null
    const reserve = firstRow ? wrap(firstHeading, INNER, 18, 700).length * 24 + 32 + rowHeight(cellsFor(firstRow, first, firstName)) + 6 : 28
    // A short routine title never occupies the bottom of the previous routine's page.
    ensure(Math.min(420, wrap(heading, INNER, 23, 700).length * 29 + reserve + 45), false)
    paragraph(heading, { size: 23, weight: 700, color: COLORS.accent, keepNext: Math.min(reserve, 240), marker: `data-routine-heading="${esc(routine.id)}"` })
    const week = Object.entries(data.week || {}).filter(([, ids]) => routineIds(ids).includes(routine.id)).map(([day]) => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][Number(day)])
    if (week.length) paragraph(`Schedule: ${week.join(', ')}`, { keepNext: Math.min(reserve, 150) })
    const dates = Object.entries(data.dayPlan || {}).filter(([, ids]) => routineIds(ids).includes(routine.id)).map(([date]) => date)
    if (dates.length) paragraph(`Dates: ${dates.join(', ')}`, { keepNext: Math.min(reserve, 150) })
    if (!routine.ex.length) paragraph('No exercises.')
    gap(6)
    routine.ex.forEach((e, ei) => {
      const ex = catalog.get(e.id), instance = `${routine.id}:${ei + 1}`, mode = modeOf(e)
      const exerciseName = data.exerciseNameMode === 'original' ? ex?.n || e.id : ex?.alias || ex?.n || e.id
      exerciseContext = ''
      const rows = series.get(instance) || []
      const cells = rows.map(row => cellsFor(row, e, ex))
      if (e.intensifier?.type === 'restpause' && mode === 'reps') cells[0][2] = `${number(displayReps(rows[0][3], e))} reps${e.side ? ' / side' : ''} (activation)`
      const alias = ex?.alias ? data.exerciseNameMode === 'original' ? `Alias: ${ex.alias}` : `Original: ${ex.n}` : ''
      const heading = `${ei + 1}. ${exerciseName}`, headingHeight = wrap(heading, INNER, 18, 700).length * 24
      const aliasHeight = alias ? wrap(alias, INNER, 13).length * 19 : 0
      const reserve = 32 + (cells.length ? rowHeight(cells[0]) : 0)
      // Keep a complete ordinary exercise heading, original identity, table header and first
      // set together. Huge names are the only headings permitted to flow between pages.
      ensure(Math.min(620, headingHeight + aliasHeight + reserve + 8))
      exerciseContext = exerciseName
      paragraph(heading, { size: 18, weight: 700, color: COLORS.ink, keepNext: aliasHeight + reserve, marker: `data-exercise-heading="${esc(instance)}"` })
      if (alias) paragraph(alias, { size: 13, keepNext: reserve })
      if (cells.length) {
        ensure(reserve); tableHeader(instance)
        cells.forEach((values, index) => {
          const height = rowHeight(values)
          if (y + height > BOTTOM) { next(); tableHeader(instance) }
          add(height, top => `<g data-series-instance="${esc(instance)}" data-set-order="${rows[index][1]}"><rect x="${LEFT}" y="${top}" width="${INNER}" height="${height}" fill="${index % 2 ? '#ffffff' : COLORS.pale}"/><line x1="${LEFT}" y1="${top + height}" x2="${LEFT + INNER}" y2="${top + height}" stroke="${COLORS.border}"/>${drawCells(values, top)}</g>`)
        })
      }
      gap(5)
      const backoff = rows.find(row => row[2] === 'Back-off')
      if (backoff) {
        const tops = rows.filter(row => row[2] === 'Top').map(row => row[1]), top = tops.length === 1 ? `set ${tops[0]}` : `sets ${tops[0]}-${tops.at(-1)}`
        let rule = 'independent range'
        if (backoff[13]) {
          const inherited = backoff[12] === 'inherit', mode = inherited ? withBackoffRepsMode(e, data.rules).backoffRepsMode : backoff[12]
          rule = mode === 'increased' ? `increased (+2${e.side ? ' / side' : ''})` : mode.startsWith('legacy:') ? `legacy (+${number(displayReps(Number(mode.split(':')[1]), e))}${e.side ? ' / side' : ''})` : mode
          if (inherited) rule += ' (follow app setting)'
        }
        paragraph(`Top association: ${top} | Load reduction ${backoff[11]}% | Reps ${rule}`)
      }
      const policy = policyFor(e, routine, mode)
      const loadingStep = loadingStepFor(e, data.unit, ex?.definition)
      paragraph(`Progression: ${policy}${policy !== 'off' ? ` | Increment ${number(e.inc || (mode === 'time' ? 5 : loadingStep))} ${mode === 'time' ? 's' : data.unit}` : ''}${mode !== 'cardio' ? ` | Load step ${number(loadingStep)} ${data.unit}` : ''}${mode === 'reps' ? ` | Strict rep targets: ${(e.strictReps ?? data.rules.strictReps) ? 'on' : 'off'}${e.amrap ? ' | AMRAP (target limit does not apply)' : ''}` : ''}`)
      if (e.intensifier?.type === 'dropset') paragraph(`Drop-set: ${e.intensifier.count || 1} drops after each work set | Load reduction ${e.intensifier.pct ?? 20}% per drop`)
      if (e.intensifier?.type === 'restpause') paragraph(`Rest-pause: activation + one working set | Total ${number(displayReps(e.intensifier.totalReps || 1, e))} reps${e.side ? ' / side' : ''} | Cluster rest ${e.intensifier.restSec || 15} s`)
      if (e.sg) paragraph(`Superset: ${e.sg} | Superset move rest: ${restSeconds({ state: data.rules, routine, target: e, phase: 'supersetMove' })} s | Round rest: ${restSeconds({ state: data.rules, routine, target: e, phase: 'supersetRound' })} s`)
      if (e.note) paragraph(`Notes: ${e.note}`)
      if (ex?.libraryNote) paragraph(`Library note: ${ex.libraryNote}`)
      if (ei < routine.ex.length - 1) gap(10)
    })
    exerciseContext = ''
    if (routine.note) paragraph(`Routine notes: ${routine.note}`)
    gap(18)
  })
  finish()
  return pages.map((body, index) => ({ width: WIDTH, height: HEIGHT, fullPage: true, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}"><rect width="${WIDTH}" height="${HEIGHT}" fill="white"/><g font-family="Arial, sans-serif"><rect width="${WIDTH}" height="6" fill="${COLORS.accent}"/>${text(LEFT, 47, 'TGym - Routine prescriptions', 23, COLORS.accent, 700)}${text(LEFT, 73, `${data.exported || ''} | ${data.routines.length} routines | ${data.unit}`, 13, COLORS.muted)}${text(LEFT, 93, 'Prescriptions only. No recorded workout results.', 12, COLORS.muted)}<g data-prescription-content="true">${body}</g><line x1="${LEFT}" y1="1063" x2="${LEFT + INNER}" y2="1063" stroke="${COLORS.border}"/>${text(LEFT, 1084, `TGym routine exchange v${data.tgym_routine_exchange || ROUTINE_EXCHANGE_VERSION} - Page ${index + 1} / ${pages.length}`, 12, COLORS.muted)}</g></svg>` }))
}

export async function routinePDFFile(data, name, { signal, onProgress = () => {} } = {}) {
  if (signal?.aborted) throw new DOMException('Canceled', 'AbortError')
  const pages = routinePDFPages(data); onProgress(50)
  const file = await reportPagesFile(pages, name, { title: 'TGym routine prescriptions' })
  if (signal?.aborted) throw new DOMException('Canceled', 'AbortError')
  onProgress(100); return file
}
