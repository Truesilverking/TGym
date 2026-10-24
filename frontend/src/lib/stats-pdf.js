import { STATS_SECTIONS } from './stats-sections.js'
import { statisticsState, historySummary } from './training-history.js'
import { trainingStreak } from './training-plan.js'
import { hybridSummary } from './activities.js'
import { routineConsistency, routineDurationSummary, bmiFor, bmiBand } from './stats-insights.js'
import { bodyRecords, compareBody } from './body-report.js'
import { measurementMapSvg } from './measurement-map.js'
import { EXIDX } from './exercises.js'
import { loadOfWorkouts, rankOf, MUSCLES, INERT, MUSCLE_NAME, levelsOf } from './muscles.js'
import { fatigueOf, strengthOf, STRENGTH_FLOOR, LB_TO_KG } from './recovery.js'
import { fatigueStateOf } from './recovery-view.js'
import { strengthExerciseRowsForMuscle } from './strength-exercises.js'
import { displayScale, scaleName, toScale, avgRir, effortSummary, effortWeeks, effortHistogram, isHardSet, HARD_RIR } from './effort.js'
import { lastBW, modeOf, metricModeForEntry, metricRowsForEntry, bestWeightForEntry, displayReps, effortLabel, setLabel, setsDone } from './history.js'
import { e1rmSeries, best1RM } from './onerm.js'
import { workoutElapsedMs } from './workout-time.js'
import { fmtDate, fmtNum, fmtDur, fmtVol, isoOf, weekKey, ACCENTS } from './format.js'
import { wrapReportText } from './progress-export.js'
import { exerciseNameFor, originalExerciseNameFor } from './i18n-core.js'

const WIDTH = 1000, HEIGHT = 1414, LEFT = 44, INNER = 912, BOTTOM = 1330
const DAY = 86400000
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]))
const interpolate = (key, ...args) => String(key).replace(/\{(\d+)\}/g, (match, n) => args[n] ?? match)
const timestamp = row => Number(row.t || row.start || new Date(row.d).getTime())
const periodDays = (value, fallback) => [0, 7, 30, 90, 365].includes(Number(value)) ? Number(value) : fallback
const inRollingWindow = (rows, days, now) => rows.filter(row => !days || timestamp(row) > now - days * DAY)

// A read-only PDF projection of the existing Stats cards. Visibility preferences are
// deliberately absent: callers choose report sections independently of S.statsSections.
export function statsReportPages(rawState, {
  now = new Date(), t = interpolate, formatNumber = fmtNum, name = (exercise, context) => exerciseNameFor(exercise, rawState, context),
  sections = STATS_SECTIONS.map(([id]) => id), filters = {}, bodyGeometry,
} = {}) {
  const date = new Date(now), nowMs = date.getTime(), today = isoOf(date)
  if (!Number.isFinite(nowMs)) throw new Error('Choose a valid date range.')
  const enabled = new Set(STATS_SECTIONS.map(([id]) => id).filter(id => sections?.includes(id)))
  if (!enabled.size) throw new Error('Select at least one section.')
  const S = statisticsState(rawState, today)
  const unit = S.unit || 'kg', measurementUnit = S.measurementUnit || 'cm'
  const accent = ACCENTS[S.accent] || ACCENTS.red
  const pages = [], titles = Object.fromEntries(STATS_SECTIONS)
  const text = (x, y, value, size = 18, color = '#18202c', weight = 400, extra = '') => `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}" ${extra}>${esc(value)}</text>`
  const wrap = (value, width = 88, size = 17, weight = 400, maxWidth = Math.min(INNER - 32, width * 10)) => wrapReportText(value, maxWidth, size, weight)
  const lines = (x, y, values, size = 18, color = '#18202c', weight = 400) => values.map((value, i) => text(x, y + i * (size + 5), value, size, color, weight)).join('')
  const number = value => value == null || !Number.isFinite(Number(value)) ? '—' : formatNumber(Number(value))
  const val = (value, suffix = '') => number(value) + (value != null && suffix ? ' ' + t(suffix) : '')
  const rect = (x, y, width, height) => `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="14" fill="white" stroke="#dce2e9"/>`
  const duration = value => value < 60000 ? Math.round(value / 1000) + 's' : fmtDur(value)
  const period = days => days === 7 ? t('Week') : days === 0 ? t('All time') : days === 30 ? t('Last 30 days') : days === 90 ? t('Last 3 months') : t('Last 12 months')
  let svg = '', y = 0, hasContent = false
  const startPage = () => {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" aria-label="${esc(t('Stats'))}"><rect width="${WIDTH}" height="${HEIGHT}" fill="#f8fafc"/><g font-family="Arial,sans-serif"><rect width="${WIDTH}" height="8" fill="${accent}"/>`
    svg += text(LEFT, 47, 'TGym', 22, accent, 700) + text(LEFT, 91, t('Stats'), 32, '#18202c', 700) + text(LEFT, 121, fmtDate(today, true, true), 17, '#536174')
    y = 155; hasContent = false
  }
  const finishPage = () => { if (hasContent) pages.push(svg) }
  const nextPage = () => { finishPage(); startPage() }
  const section = (id, subtitle, rows) => {
    if (!enabled.has(id)) return
    const heading = wrap(t(titles[id]), 61, 24, 700, INNER), sub = wrap(subtitle, 93, 17, 400, INNER)
    const headingHeight = heading.length * 30 + sub.length * 23 + 23
    let first = true
    for (const row of rows) {
      if (y + row.height + (first ? headingHeight : 0) > BOTTOM) { nextPage(); first = true }
      if (first) {
        svg += `<g data-stats-section="${id}">` + lines(LEFT, y + 25, heading, 25, '#18202c', 700)
        y += heading.length * 30
        svg += lines(LEFT, y + 20, sub, 18, '#536174') + '</g>'
        y += sub.length * 23 + 23; first = false
      }
      svg += row.draw(y); y += row.height; hasContent = true
    }
    y += 18
  }
  const notes = values => values.flatMap(value => {
    const rows = wrap(value)
    // Long free text is flowed as individual lines, rather than a card larger
    // than a PDF page. Every line therefore remains selectable content.
    return rows.map(line => ({ height: 25, draw: top => text(LEFT + 16, top + 19, line, 17, '#536174') }))
  })
  const tiles = values => {
    const rows = []
    for (let i = 0; i < values.length; i += 3) {
      const cells = values.slice(i, i + 3).map(([label, value]) => ({ label: wrap(t(label), 26, 17, 400, 263), value: wrap(String(value), 18, 27, 700, 263) }))
      const height = Math.max(...cells.map(cell => cell.label.length * 22 + cell.value.length * 31 + 30))
      rows.push({ height: height + 12, draw: top => cells.map((cell, j) => {
        const x = LEFT + j * 309
        return rect(x, top, 295, height) + lines(x + 16, top + 36, cell.value, 27, '#18202c', 700) + lines(x + 16, top + cell.value.length * 31 + 31, cell.label, 17, '#536174')
      }).join('') })
    }
    return rows
  }
  const detailCard = (heading, details) => {
    const titleLines = wrap(heading, 73, 21, 700, INNER - 36), title = titleLines.slice(0, 3)
    const body = [...titleLines.slice(3), ...details.flatMap(value => wrap(value, 91, 18, 400, INNER - 36))]
    const rows = [], maxLines = 34
    for (let i = 0; i < Math.max(1, body.length); i += maxLines) {
      const chunk = body.slice(i, i + maxLines), height = title.length * 26 + chunk.length * 23 + 38
      rows.push({ height: height + 12, draw: top => rect(LEFT, top, INNER, height) + lines(LEFT + 18, top + 28, title, 21, '#18202c', 700) + lines(LEFT + 18, top + title.length * 26 + 29, chunk, 18, '#536174') })
    }
    return rows
  }
  const bars = values => {
    const rows = [], scale = Math.max(1, ...values.map(row => Number(row.value) || 0))
    for (const { label, value, detail, color = accent } of values) {
      const title = wrap(label, 48, 19, 400, 602), reading = wrap(detail ?? number(value), 24, 19, 700, INNER - 650)
      const height = Math.max(title.length * 24, reading.length * 24) + 34
      rows.push({ height: height + 8, draw: top => rect(LEFT, top, INNER, height) + lines(LEFT + 16, top + 26, title, 19) + lines(LEFT + 634, top + 26, reading, 19, '#18202c', 700) + `<rect x="${LEFT + 16}" y="${top + height - 15}" width="${INNER - 32}" height="4" rx="2" fill="#edf0f4"/><rect x="${LEFT + 16}" y="${top + height - 15}" width="${Math.min(INNER - 32, Math.max(0, value) / scale * (INNER - 32))}" height="4" rx="2" fill="${color}"/>` })
    }
    return rows
  }
  const chart = (points, { title = '', suffix = '', goal, invert = false, color = accent, formatValue } = {}) => {
    const pts = points.filter(point => Number.isFinite(Number(point.t)) && Number.isFinite(Number(point.y))).map(point => ({ ...point, t: Number(point.t), y: Number(point.y) }))
    if (!pts.length) return detailCard(title || t('Trend'), [t('No data yet')])
    const titleRows = wrap(title, 73, 21, 700, INNER - 36), height = 274 + titleRows.length * 26
    return [{ height: height + 12, draw: top => {
      const left = LEFT + 96, right = WIDTH - 70, chartTop = top + 38 + titleRows.length * 26, chartHeight = 172
      let low = Math.min(...pts.map(point => point.y)), high = Math.max(...pts.map(point => point.y))
      if (goal != null && Number.isFinite(Number(goal))) { low = Math.min(low, Number(goal)); high = Math.max(high, Number(goal)) }
      if (low === high) { low -= 1; high += 1 }
      const padding = (high - low) * 0.12; low -= padding; high += padding
      const t0 = pts[0].t, t1 = pts.at(-1).t || t0 + 1
      const X = time => t1 === t0 ? (left + right) / 2 : left + (time - t0) / (t1 - t0) * (right - left)
      const Y = value => chartTop + (invert ? (value - low) / (high - low) : 1 - (value - low) / (high - low)) * chartHeight
      const labels = formatValue || (value => val(value, suffix))
      let result = rect(LEFT, top, INNER, height) + lines(LEFT + 18, top + 29, titleRows, 21, '#18202c', 700)
      for (let i = 0; i <= 3; i++) {
        const value = low + (high - low) * i / 3, cy = Y(value)
        result += `<line x1="${left}" y1="${cy}" x2="${right}" y2="${cy}" stroke="#dce2e9" stroke-dasharray="3 5"/>` + text(left - 12, cy + 6, number(value), 15, '#536174', 400, 'text-anchor="end"')
      }
      if (goal != null && Number.isFinite(Number(goal))) result += `<line x1="${left}" y1="${Y(goal)}" x2="${right}" y2="${Y(goal)}" stroke="#b77900" stroke-width="2" stroke-dasharray="7 4"/>` + text(right, Y(goal) - 8, t('Goal') + ': ' + labels(goal), 16, '#926300', 700, 'text-anchor="end"')
      const coordinates = pts.map(point => `${X(point.t)},${Y(point.y)}`).join(' ')
      result += `<polyline points="${coordinates}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round"/>`
      for (const point of pts) if (point.m != null) result += `<circle cx="${X(point.t)}" cy="${Y(point.y)}" r="${3 + point.m * 3}" fill="${color}" opacity="${0.3 + point.m * 0.7}"/>`
      const last = pts.at(-1)
      result += `<circle cx="${X(last.t)}" cy="${Y(last.y)}" r="5" fill="${color}"/>` + text(right, top + height - 49, labels(last.y), 19, color, 700, 'text-anchor="end"')
      result += text(left, top + height - 19, pts[0].d || isoOf(new Date(t0)), 16, '#536174') + text(right, top + height - 19, last.d || isoOf(new Date(last.t)), 16, '#536174', 400, 'text-anchor="end"')
      return result
    } }]
  }
  startPage()

  if (enabled.has('history')) {
    const h = historySummary(rawState, today), recentWeight = inRollingWindow(S.bodyweight, 30, nowMs), streak = trainingStreak(S, date)
    const delta = recentWeight.length > 1 ? recentWeight.at(-1).w - recentWeight[0].w : null
    const month = S.workouts.filter(workout => String(workout.d || '').slice(0, 7) === today.slice(0, 7)).length
    section('history', t('Training since {0}', fmtDate(h.start, false, true)), [
      ...tiles([['Total workouts', number(h.total)], ['Average workouts per week', number(Math.round(h.averagePerWeek * 10) / 10)], ['Currently scheduled per week', number(h.scheduledPerWeek)]]),
      ...notes([t('{0} recorded · {1} estimated before tracking', h.trackedWorkouts, h.historicalWorkouts), t('Weekly average includes all calendar days since your start, including breaks.')]),
      ...tiles([['Recorded workouts', number(S.workouts.length)], ['This month', number(month)], ['Training streak', number(streak.current)], ['Weight 30d', delta == null ? '—' : (delta > 0 ? '+' : '') + val(delta, unit)]]),
    ])
  }
  if (enabled.has('consistency')) {
    const c = routineConsistency(S, 56, date), percent = c.rate == null ? null : Math.round(c.rate * 100)
    section('consistency', t('Last 8 weeks'), [
      ...tiles([['Active days', number(c.activeDays)], ['Completion', percent == null ? '—' : percent + '%'], ['Planned', number(c.planned)], ['Missed', number(c.missed)], ['Extra', number(c.extra)]]),
      ...notes([t('Activity counts once per day, including planned and extra sessions.'), ...(percent == null ? [t('No scheduled sessions to evaluate yet.')] : [])]),
    ])
  }
  if (enabled.has('overview')) {
    const chosen = filters.overviewPeriod ?? '30', days = chosen === 'all' ? 0 : periodDays(chosen, 30)
    const cutoff = isoOf(new Date(nowMs - days * DAY)), a = hybridSummary(S.workouts.filter(workout => !days || workout.d >= cutoff))
    section('overview', period(days), [
      ...tiles([['Strength sessions', number(a.strength)], ['Runs', number(a.running)], ['Other cardio', number(a.cardio)], ['Recovery sessions', number(a.recovery)], ['Active days', number(a.days)], ['Total time (min)', number(Math.round(a.minutes))], ['Distance (km)', number(a.distanceKm)]]),
      ...notes([...(a.ratedActivities ? [t('Activity effort load (minutes × RPE)') + ': ' + number(Math.round(a.load)) + ' · ' + t('{0} rated activities', a.ratedActivities)] : []), t('Hybrid sessions may appear in several categories. Total time and active days are counted once. Activity effort is separate from strength volume.')]),
    ])
  }
  if (enabled.has('duration')) {
    const days = periodDays(filters.durationRange, 90)
    const rows = routineDurationSummary(S.workouts, { routines: S.routines, activeId: S.active?.id, days, now: nowMs })
    section('duration', period(days), rows.length ? rows.flatMap(row => detailCard(row.name || t('Freestyle'), [t(row.count === 1 ? '{0} workout' : '{0} workouts', row.count), t('Average duration') + ': ' + duration(row.meanMs), t('Median') + ': ' + duration(row.medianMs)])) : notes([t('No completed workouts with a valid duration in this period.')]))
  }
  if (enabled.has('muscles')) {
    const days = periodDays(filters.musclesRange, 7), view = ['balance', 'fatigue', 'strength'].includes(filters.musclesView) ? filters.musclesView : 'balance'
    const workouts = S.workouts.filter(workout => days === 0 || (days === 7 ? weekKey(workout.d) === weekKey(today) : timestamp(workout) > nowMs - days * DAY))
    const rated = workouts.some(workout => (workout.entries || []).some(entry => (entry.sets || []).some(set => set.done && isHardSet(set))))
    const hard = !!filters.musclesHard && rated
    const load = loadOfWorkouts(workouts, hard ? isHardSet : null), { worked, missed } = rankOf(load)
    const latest = [...S.bodyweight].sort((a, b) => String(a.d).localeCompare(String(b.d))).at(-1)
    const bodyweightKg = latest?.w > 0 ? latest.w * (unit === 'lb' ? LB_TO_KG : 1) : null
    const values = view === 'fatigue' ? fatigueOf(S.workouts, nowMs, { bodyweightKg, unit }) : view === 'strength' ? strengthOf(S.workouts, nowMs, { bodyweightKg, unit }) : load
    const thresholds = view === 'fatigue' ? [{ at: 0, level: 0 }, { at: 0.15, level: 1 }, { at: 0.25, level: 2 }, { at: 0.4, level: 3 }, { at: 0.55, level: 4, exclusive: true }] : view === 'strength' ? [{ at: STRENGTH_FLOOR, level: 0 }, { at: 0.625, level: 1 }, { at: 0.75, level: 2 }, { at: 0.875, level: 3 }, { at: 1, level: 4 }] : undefined
    const levels = levelsOf(values, thresholds), geometry = bodyGeometry?.[S.body] || bodyGeometry?.male
    const selected = MUSCLES.includes(filters.musclesSelected) ? filters.musclesSelected : null
    const mapColor = level => view === 'fatigue' ? ['#e6e9ed', '#f6e8b0', '#ffd60a', '#ff9f0a', '#ff453a'][level] : view === 'strength' && level === 4 ? '#ffd60a' : accent
    const mapOpacity = level => view === 'fatigue' || view === 'strength' && level === 4 ? 1 : level ? 0.15 + level * 0.2 : 0.07
    const map = geometry ? [{ height: 426, draw: top => {
      const drawings = ['front', 'back'].map((side, i) => {
        const model = geometry[side]
        if (!model) return ''
        const paths = [...INERT, ...MUSCLES].flatMap(slug => (model.p[slug] || []).map(path => `<path d="${esc(path)}" fill="${INERT.includes(slug) ? '#b8bec6' : mapColor(levels[slug])}" fill-opacity="${INERT.includes(slug) ? 1 : mapOpacity(levels[slug])}" stroke="${selected === slug ? '#18202c' : 'white'}" stroke-width="${selected === slug ? 7 : 2.5}"/>`)).join('')
        return `<svg x="${LEFT + 190 + i * 294}" y="${top + 12}" width="250" height="356" viewBox="${esc(model.vb)}">${paths}</svg>`
      }).join('')
      const legend = view === 'fatigue' ? t('Fatigued') + ' · ' + t('Recovering') + ' · ' + t('Ready') : view === 'strength' ? '1 ' + t('full') + ' · ' + number(STRENGTH_FLOOR) + ' ' + t('floor') : t('Less') + ' → ' + t('More')
      return rect(LEFT, top, INNER, 414) + drawings + text(500, top + 401, legend, 17, '#536174', 400, 'text-anchor="middle"')
    } }] : []
    let rows
    if (view === 'balance') rows = workouts.length ? [...map, ...bars((selected ? [selected] : worked.slice(0, 4)).map(slug => ({ label: t(MUSCLE_NAME[slug]), value: load[slug] || 0, detail: load[slug] ? t('{0} sets', Math.round(load[slug] * 10) / 10) : t(hard ? 'no hard sets' : 'not trained') }))), ...notes(missed.length ? [t(hard ? 'No hard sets in this period' : 'Not trained in this period') + ': ' + missed.map(slug => t(MUSCLE_NAME[slug])).join(', ')] : [t(hard ? 'Every muscle group got at least one hard set in this period.' : 'Every muscle group got some work in this period.')])] : notes([t('No workouts in this period yet.')])
    else if (view === 'fatigue') rows = [...map, ...bars((selected ? [selected] : MUSCLES).map(slug => ({ label: t(MUSCLE_NAME[slug]), value: values[slug], detail: t(fatigueStateOf(values[slug]) === 'ready' ? 'Ready' : fatigueStateOf(values[slug]) === 'recovering' ? 'Recovering' : 'Fatigued') }))), ...notes([t('Fatigue shows how recently each muscle was trained. High means rest.')])]
    else {
      const vol90 = loadOfWorkouts(inRollingWindow(S.workouts, 90, nowMs)), exercises = selected ? strengthExerciseRowsForMuscle(S, nowMs, selected) : []
      rows = [...map, ...notes([t('Strength shows retained muscle strength. Train again to reset it.')]),
        ...(selected ? exercises.length ? exercises.flatMap(row => detailCard(row.name, [t('Est. 1RM') + ': ' + val(row.est, unit) + ' · ' + fmtDate(row.estDate, true, true), val(row.current, unit) + ' · ' + Math.round(row.decay * 100) + '%'])) : notes([t('No exercises with an estimated 1RM yet.')]) : []),
        ...bars(rankOf(values).worked.filter(slug => values[slug] < 1).map(slug => ({ label: t(MUSCLE_NAME[slug]), value: values[slug], detail: t('{0} sets', vol90[slug] || 0) }))),
      ]
    }
    section('muscles', view === 'balance' ? period(days) + ' · ' + t(hard ? 'by hard sets' : 'by sets worked') : t(view === 'fatigue' ? 'Fatigue' : 'Strength'), rows)
  }
  if (enabled.has('effort')) {
    const days = periodDays(filters.effortRange, 90), windowState = { ...S, workouts: inRollingWindow(S.workouts, days, nowMs) }
    // Existing helpers own every effort statistic; selecting the window first
    // lets a single caller-supplied clock drive a whole export snapshot.
    const sum = effortSummary(windowState, 0), weeks = effortWeeks(windowState, 0), histogram = effortHistogram(windowState, 0)
    const kind = displayScale(S), hd = scaleName(kind)
    section('effort', period(days) + ' · ' + t('how close to failure'), sum.rated ? [
      ...tiles([['average effort', effortLabel(kind, toScale(kind, sum.avg))], [t('at {0} {1} or harder', hd, number(toScale(kind, HARD_RIR))), sum.hardPct == null ? '—' : Math.round(sum.hardPct * 100) + '%']]),
      ...notes([t('{0} of {1} finished sets rated', sum.rated, sum.done)]),
      ...(weeks.length > 1 ? chart(weeks.map(week => ({ t: week.t, y: toScale(kind, week.rir) })), { title: t('Week by week'), suffix: hd, color: '#b77900', invert: kind === 'rir', formatValue: value => effortLabel(kind, value) }) : []),
      ...bars(histogram.map(bin => ({ label: kind === 'rir' && bin.rir === 0 ? effortLabel(kind, 0) : `${hd} ${kind === 'rpe' ? bin.tail ? '≤ 6' : 10 - bin.rir : bin.tail ? bin.rir + '+' : bin.rir}`, value: bin.n, detail: bin.n ? bin.n + ' · ' + Math.round(bin.pct * 100) + '%' : '—', color: bin.rir <= HARD_RIR ? '#b77900' : '#687587' }))),
    ] : notes([t('No rated sets in this period.')]))
  }
  if (enabled.has('bodyweight')) {
    const days = periodDays(filters.bodyweightRange ?? filters.range, 90)
    const points = inRollingWindow(S.bodyweight, days, nowMs).map(row => ({ t: timestamp(row), y: row.w, d: row.d }))
    section('bodyweight', period(days), chart(points, { title: t('Body Weight'), suffix: unit, goal: S.targetW }))
  }
  if (enabled.has('measurements')) {
    const records = bodyRecords(S, { start: '0001-01-01', end: today })
    const selection = filters.bodySelection || filters.measurementSelection || {}, comparison = compareBody(records, selection.before, selection.after)
    const map = bodyGeometry && comparison.metrics.length ? [{ height: 384, draw: top => rect(LEFT, top, INNER, 372) + `<g transform="translate(0 ${top + 5})">${measurementMapSvg(bodyGeometry, S.body, comparison.metrics)}</g>` + lines(LEFT + 368, top + 33, wrap(t('Before') + ': ' + comparison.before.d + ' → ' + t('After') + ': ' + comparison.after.d, 42), 20, '#18202c', 700) + lines(LEFT + 368, top + 108, wrap(t('Changes below 0.1 cm are treated as unchanged. Missing values are not zero.'), 44), 18, '#536174') }] : []
    section('measurements', comparison.before ? t('Before') + ': ' + comparison.before.d + ' · ' + t('After') + ': ' + comparison.after.d : measurementUnit, comparison.metrics.length ? [
      ...map, ...tiles([['Records', number(comparison.count)], ['Elapsed days', number(comparison.days)]]),
      ...comparison.metrics.flatMap(metric => detailCard(t(metric.label), [t('Before') + ': ' + val(metric.first, metric.unit) + ' → ' + t('After') + ': ' + val(metric.last, metric.unit), metric.delta == null ? t('More data needed') : (metric.delta > 0 ? '+' : '') + val(metric.delta, metric.unit) + ' · ' + (metric.percent > 0 ? '+' : '') + val(metric.percent, '%')])),
      ...notes([t('Changes below 0.1 cm are treated as unchanged. Missing values are not zero.')]),
    ] : notes([t('No measurements logged yet.')]))
  }
  if (enabled.has('bmi')) {
    const weight = lastBW(S), bmi = bmiFor(weight?.w, unit, S.heightCm, measurementUnit)
    const points = S.heightCm ? S.bodyweight.map(row => ({ t: row.t || new Date(row.d + 'T12:00:00').getTime(), d: row.d, y: bmiFor(row.w, unit, S.heightCm, measurementUnit) })).filter(point => point.y) : []
    section('bmi', bmi ? t(bmiBand(bmi)) : '', bmi ? [
      ...tiles([['BMI', number(bmi)], ['Body Weight', val(weight.w, unit)], ['Height', val(S.heightCm, measurementUnit)]]),
      ...notes([t('Calculated from {0} and {1} {2}.', val(weight.w, unit), number(S.heightCm), measurementUnit)]),
      ...chart(points, { title: t('BMI'), color: '#b77900' }),
      ...notes([t('BMI is an orientation only. It can read high in muscular people and does not measure body-fat percentage.')]),
    ] : notes([t(!S.heightCm ? 'Add your height to calculate BMI from your latest body weight.' : 'Log your body weight to calculate BMI.')]))
  }
  if (enabled.has('exercise')) {
    const exerciseOf = id => {
      const entry = S.workouts.flatMap(workout => workout.entries || []).find(entry => entry.id === id)
      return (S.customEx || []).find(exercise => exercise.id === id) || EXIDX[id] || { id, n: entry?.n || entry?.exercise?.n || entry?.muscleSnapshot?.n || id }
    }
    const nameOf = id => name(exerciseOf(id))
    const currentOf = id => {
      for (let i = S.workouts.length - 1; i >= 0; i--) {
        const entry = (S.workouts[i].entries || []).find(entry => entry.id === id)
        if (!entry) continue
        const mode = metricModeForEntry(entry) || modeOf({ id }), rows = metricRowsForEntry(entry, mode)
        const current = mode === 'reps' ? bestWeightForEntry(entry) : Math.max(0, ...rows.map(set => mode === 'cardio' ? set.speed || 0 : set.sec || 0))
        if (current > 0) return current
        if (mode === 'reps') { const reps = Math.max(0, ...rows.map(set => displayReps(Number(set.r) || 0, entry.target))); if (reps > 0) return reps }
      }
      return 0
    }
    const ids = [...new Set(S.workouts.flatMap(workout => (workout.entries || []).map(entry => entry.id)))].filter(id => EXIDX[id] || originalExerciseNameFor(exerciseOf(id)) !== id)
    const current = Object.fromEntries(ids.map(id => [id, currentOf(id)]))
    ids.sort((a, b) => current[b] - current[a] || originalExerciseNameFor(exerciseOf(a)).localeCompare(originalExerciseNameFor(exerciseOf(b))))
    const chosen = filters.exId && ids.includes(filters.exId) ? filters.exId : ids[0]
    if (!chosen) section('exercise', '', notes([t('Finish your first workout to see progress curves here.')]))
    else {
      const latest = [...S.workouts].reverse().map(workout => (workout.entries || []).find(entry => entry.id === chosen)).filter(Boolean)
      const mode = latest.map(entry => metricModeForEntry(entry)).find(Boolean) || modeOf({ id: chosen })
      const repsOnly = mode === 'reps' && !S.workouts.some(workout => { const entry = (workout.entries || []).find(entry => entry.id === chosen); return entry && bestWeightForEntry(entry) > 0 })
      const suffix = mode === 'cardio' ? 'km/h' : mode === 'time' ? 's' : repsOnly ? t('reps') : unit
      const sessions = S.workouts.flatMap(workout => {
        const entry = (workout.entries || []).find(entry => entry.id === chosen)
        if (!entry || metricModeForEntry(entry) !== mode) return []
        const sets = metricRowsForEntry(entry, mode)
        const best = mode === 'reps' ? repsOnly ? Math.max(0, ...sets.map(set => displayReps(Number(set.r) || 0, entry.target))) : bestWeightForEntry(entry) : Math.max(0, ...sets.map(set => mode === 'cardio' ? set.speed || 0 : set.sec || 0))
        return best > 0 ? [{ t: workout.start, d: workout.d, y: best, sets, target: entry.target }] : []
      })
      const kind = displayScale(S), hd = scaleName(kind), estimates = mode === 'reps' ? e1rmSeries(S, chosen) : []
      const efforts = sessions.map(session => avgRir(session.sets)), showEffort = efforts.filter(value => value != null).length >= 3
      const useEffort = filters.exMetric === 'effort' && showEffort, useEstimate = filters.exMetric === 'e1rm' && estimates.length > 0
      const points = useEstimate ? estimates : useEffort ? sessions.flatMap((session, i) => efforts[i] == null ? [] : [{ ...session, y: toScale(kind, efforts[i]) }]) : sessions.map((session, i) => ({ ...session, m: efforts[i] == null ? null : 1 - Math.min(4, Math.max(0, efforts[i])) / 4 }))
      const best = useEstimate ? best1RM(S, chosen)?.est : Math.max(0, ...sessions.map(session => session.y))
      section('exercise', nameOf(chosen) + ' · ' + t(useEffort ? 'Effort' : useEstimate ? 'Est. 1RM' : 'Top set'), [
        ...chart(points, { title: nameOf(chosen), suffix: useEffort ? hd : useEstimate ? unit : suffix, color: useEffort ? '#b77900' : '#2878d0', invert: useEffort && kind === 'rir', ...(useEffort ? { formatValue: value => effortLabel(kind, value) } : {}) }),
        ...notes([t(useEffort ? 'Average effort per workout' : useEstimate ? 'Estimated 1RM per workout' : mode === 'cardio' ? 'Top speed per workout' : mode === 'time' ? 'Longest hold per workout' : repsOnly ? 'Most reps in a set per workout' : 'Best set weight per workout') + (useEffort ? '' : ' · ' + t('Best:') + ' ' + val(best, useEstimate ? unit : suffix))]),
        ...sessions.slice(-5).reverse().flatMap(session => detailCard(fmtDate(session.d, true, true) + ' · ' + t('Recent sessions'), session.sets.map((set, i) => String(i + 1).padStart(2, '0') + ' · ' + setLabel(chosen, set, session.target)))),
      ])
    }
  }
  if (enabled.has('recent')) {
    const rows = [...S.workouts].reverse().slice(0, 6)
    section('recent', '', rows.length ? rows.flatMap(workout => {
      const durationMs = workoutElapsedMs(workout), info = [fmtDate(workout.d, true, true), ...(durationMs >= 60000 ? [fmtDur(durationMs)] : [])]
      if (workout.activity && !workout.activity.preservesWorkout) info.push(...[workout.activity.distanceKm != null ? number(workout.activity.distanceKm) + ' km' : null, workout.activity.source === 'manual' ? t('Manual') : 'Health Connect'].filter(Boolean))
      else info.push(t('{0} sets', setsDone(workout)), fmtVol(workout.vol || 0, unit))
      if (workout.prs?.length) info.push(workout.prs.length + ' PR')
      return detailCard(workout.name || t('Freestyle'), [info.join(' · ')])
    }) : notes([t('No workouts yet')]))
  }
  finishPage()
  return pages.map((page, i) => ({ svg: page + text(LEFT, 1381, 'TGym · ' + t('Stats'), 16, '#536174') + text(956, 1381, (i + 1) + ' / ' + pages.length, 16, '#536174', 400, 'text-anchor="end"') + '</g></svg>', width: WIDTH, height: HEIGHT }))
}
