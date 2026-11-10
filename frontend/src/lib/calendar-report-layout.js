import { MONTHS_LONG } from './format.js'
import { calendarGrid, calendarSvgLegend, calendarText as text, calendarRect as rect, escapeCalendarText as escape } from './calendar-grid.js'
import { TRACKING_START_MARKER } from './calendar-visual.js'
import { STREAK_FLAME_PATH, STREAK_FLAME_INNER_PATH, STREAK_FLAME_CORE_PATH, STREAK_FLAME_COLORS as flameColors } from './streak-flame-path.js'

const NAVY = '#18324f', MUTED = '#52647c', BLUE = '#115bb2'
export const calendarTextWidth = (value, size) => [...String(value)].reduce((width, char) => width + size * (/\s/.test(char) ? .3 : /[ilIt.,:!|]/.test(char) ? .3 : /[MW@%]/.test(char) ? .85 : char.codePointAt(0) > 0x2e80 ? 1 : .57), 0)
export function calendarWrappedText(x, y, value, maxWidth, size, lineHeight, weight = 400, fill = MUTED) {
  const lines = []
  const push = word => {
    if (!lines.length || calendarTextWidth(lines.at(-1) + ' ' + word, size) > maxWidth) lines.push(word)
    else lines[lines.length - 1] += ' ' + word
  }
  for (const word of String(value).split(/\s+/)) {
    if (calendarTextWidth(word, size) <= maxWidth) push(word)
    else { let part = ''; for (const char of word) { if (part && calendarTextWidth(part + char, size) > maxWidth) { push(part); part = '' }; part += char }; if (part) push(part) }
  }
  return lines.map((line, i) => text(x, y + i * lineHeight, line, size, weight, 'start', fill)).join('')
}

function flame(value, x, y) {
  const active = Number(value) > 0
  return `<svg data-streak-flame="${active ? 'active' : 'inactive'}" x="${x}" y="${y}" width="66" height="72" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="report-streak-fill" x1="30%" y1="0%" x2="65%" y2="100%"><stop offset="0%" stop-color="${flameColors.tip}"/><stop offset="38%" stop-color="${flameColors.orange}"/><stop offset="72%" stop-color="${flameColors.red}"/><stop offset="100%" stop-color="${flameColors.base}"/></linearGradient><linearGradient id="report-streak-inner" x1="50%" y1="0%" x2="50%" y2="100%"><stop offset="0%" stop-color="${flameColors.orange}"/><stop offset="65%" stop-color="${flameColors.inner}"/><stop offset="100%" stop-color="${flameColors.core}"/></linearGradient></defs><path d="${STREAK_FLAME_PATH}" fill="${active ? 'url(#report-streak-fill)' : '#e3e8ef'}" stroke="${active ? '#ad3213' : '#718096'}" stroke-width="${active ? '.45' : '1.2'}" stroke-linejoin="round"/>${active ? `<path d="${STREAK_FLAME_INNER_PATH}" fill="url(#report-streak-inner)"/><path d="${STREAK_FLAME_CORE_PATH}" fill="${flameColors.core}"/>` : ''}</svg>`
}

function reportProfile(profile, top, palette) {
  if (!profile) return null
  // Keep imported profiles read-only. Only embedded raster photos enter exports.
  const name = typeof profile.name === 'string' ? [...profile.name.trim()].slice(0, 80).join('') : ''
  const photo = typeof profile.photo === 'string' && profile.photo.length <= 350000 && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(profile.photo) ? profile.photo : ''
  if (!name && !photo) return null
  const size = 224, center = 48 + size / 2, cy = top + size / 2
  const initials = name.split(/\s+/).slice(0, 2).map(part => [...part][0]).join('').toLocaleUpperCase()
  const wrapped = name ? calendarWrappedText(308, 0, name, 644, 44, 50, 750, palette.ink) : ''
  const nameLines = wrapped.match(/<text /g)?.length || 0
  const height = Math.max(size, nameLines * 50)
  const nameY = top + (height - nameLines * 50) / 2 + 41
  let markup = '<g data-report-profile="true"><defs><clipPath id="report-profile-circle"><circle cx="' + center + '" cy="' + cy + '" r="112"/></clipPath></defs>'
  markup += `<circle cx="${center}" cy="${cy}" r="112" fill="${palette.card}" stroke="${palette.border}" stroke-width="3"/>`
  markup += `<text data-profile-initials="true" x="${center}" y="${cy}" dominant-baseline="central" text-anchor="middle" font-size="68" font-weight="700" fill="${palette.accent}">${escape(initials)}</text>`
  if (photo) markup += `<image data-profile-photo="true" x="48" y="${top}" width="${size}" height="${size}" href="${escape(photo)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#report-profile-circle)"/>`
  markup += `<g data-profile-name="true">${name ? calendarWrappedText(308, nameY, name, 644, 44, 50, 750, palette.ink) : ''}</g></g>`
  return { markup, bottom: top + height }
}

export function calendarReportPeriod(start, end, { week = false, t = x => x } = {}) {
  if (week) return `${Number(start.slice(-2))} - ${Number(end.slice(-2))}`
  if (start.slice(0, 7) === end.slice(0, 7)) return t(MONTHS_LONG[Number(start.slice(5, 7)) - 1])
  if (start.slice(0, 4) === end.slice(0, 4)) return start.slice(0, 4)
  return `${start.slice(0, 4)} - ${end.slice(0, 4)}`
}

// Presentation is shared by every Streak/Consistency option. Date statuses,
// summaries and chronology continue to come from the existing pure builders.
export function calendarReportLayout({ kind, days, start, end, metrics, trackingSince = '', emptyMessage = '', format = 'pdf', week = false, layout = 'calendar', year, profile, theme = 'light', t = x => x }) {
  const black = theme === 'black'
  const palette = black
    ? { background: '#000000', ink: '#f5f7fa', muted: '#b6c1cf', card: '#171a1f', border: '#343d49', accent: '#68a8ff' }
    : { background: '#ffffff', ink: NAVY, muted: MUTED, card: '#eef3fa', border: '#dce3ec', accent: BLUE }
  const grouped = new Map()
  for (const day of days) {
    const key = week ? 'week' : day.iso.slice(0, 7)
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(day)
  }
  const months = [...grouped.values()], chunks = []
  const limit = format === 'png' ? months.length : kind === 'streak' ? 12 : 4
  for (let i = 0; i < months.length; i += limit) chunks.push(months.slice(i, i + limit))
  return chunks.map((groups, pageIndex) => {
    const columns = kind === 'streak' ? groups.length > 4 ? 3 : groups.length > 1 ? 2 : 1 : format === 'pdf' && groups.length > 1 ? 2 : 1
    const annual = columns === 3, compact = columns > 1
    const rowHeight = annual ? 318 : compact ? 420 : week ? 200 : 706
    const columnWidth = annual ? (904 - 48) / 3 : compact ? 440 : 904
    const columnStep = annual ? columnWidth + 24 : 464
    const cardWidth = (904 - 16 * (metrics.length - 1)) / metrics.length
    const metricLabels = metrics.map(([label], i) => calendarWrappedText(0, 0, t(label), cardWidth - (kind === 'streak' && i === 0 ? 102 : 36), 20, 22, 500, palette.ink))
    const metricExtra = Math.max(0, ...metricLabels.map(label => (label.match(/<text /g)?.length || 1) - 1)) * 22
    const metricTop = 110, metricBottom = metricTop + 108 + metricExtra
    const identity = kind === 'streak' ? reportProfile(profile, metricBottom + 28, palette) : null
    const periodY = (identity?.bottom || metricBottom) + 54
    const gridTop = periodY + 58
    const bodyEnd = gridTop + Math.ceil(groups.length / columns) * rowHeight
    const legendY = bodyEnd + 14
    const height = Math.max(week ? 720 : compact && groups.length > 2 ? 1414 : 980, bodyEnd + 182)
    const title = t(kind === 'streak' ? 'Streak Report' : 'Consistency Report')
    const visibleDays = groups.flat(), visibleStart = visibleDays.some(day => day.iso === trackingSince)
    // A long custom Streak report can cover several years. Each page names and
    // counts its own displayed period; a complete-year report keeps its year.
    const pagedStreak = kind === 'streak' && chunks.length > 1
    const count = (pagedStreak ? visibleDays : days).filter(day => day.status === 'completed' || kind === 'consistency' && day.status === 'partial').length
    const period = calendarReportPeriod(pagedStreak ? visibleDays[0].iso : start, pagedStreak ? visibleDays.at(-1).iso : end, { week, t })
    const periodWidth = calendarTextWidth(period, 36), countWidth = calendarTextWidth(count, 38)
    const periodLeft = (1000 - periodWidth - 26 - countWidth) / 2
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="${height}" viewBox="0 0 1000 ${height}" role="img" aria-label="${escape(title)}" data-layout="${layout}" data-columns="${columns}" data-part="${pageIndex + 1}" data-theme="${black ? 'black' : 'light'}"${year ? ` data-year="${year}"` : ''}><g font-family="Arial, sans-serif">`
    svg += rect(0, 0, 1000, height, palette.background, 0)
    svg += `<g data-report-title="true">${text(500, 72, title, 44, 750, 'middle', palette.ink)}</g>`
    metrics.forEach(([label, value], i) => {
      const x = 48 + i * (cardWidth + 16), hasFlame = kind === 'streak' && i === 0, left = x + (hasFlame ? 84 : 18)
      svg += `<g data-summary="${escape(label)}" data-value="${escape(value)}">` + rect(x, metricTop, cardWidth, 108 + metricExtra, palette.card, 12)
      if (hasFlame) svg += flame(value, x + 8, metricTop + 20 + metricExtra / 2)
      svg += calendarWrappedText(left, metricTop + 34, t(label), cardWidth - (hasFlame ? 102 : 36), 20, 22, 500, palette.ink)
      svg += text(left, metricTop + 88 + metricExtra, value, 42, 750, 'start', palette.accent) + '</g>'
    })
    if (identity) svg += identity.markup
    svg += `<g data-report-period="true">${text(periodLeft, periodY, period, 36, 750, 'start', palette.ink)}${text(periodLeft + periodWidth + 26, periodY, count, 38, 750, 'start', palette.accent)}</g>`
    groups.forEach((monthDays, i) => {
      const date = new Date(monthDays[0].iso + 'T12:00:00')
      // The selected single period is already named above its grid.
      const monthTitle = groups.length === 1 ? '' : t(MONTHS_LONG[date.getMonth()])
      const x = 48 + i % columns * columnStep, y = gridTop + Math.floor(i / columns) * rowHeight
      svg += `<g data-month="${monthDays[0].iso.slice(0, 7)}">`
      svg += calendarGrid({ days: monthDays, title: monthTitle, period: week ? 'week' : 'month', x, y, width: columnWidth, kind, t, trackingSince,
        geometry: annual
          ? { cell: 36, gap: 4, daySize: 28, titleSize: 22, weekdaySize: 22, weekdayOffset: 30, daysOffset: 44, titleFill: palette.ink, titleAnchor: 'middle', weekdayFill: palette.muted }
          : { cell: compact ? 48 : 92, gap: compact ? 7 : 10, daySize: compact ? 30 : 34, titleSize: compact ? 26 : 30, weekdaySize: compact ? 21 : 23, weekdayOffset: 36, daysOffset: 54, titleFill: palette.ink, titleAnchor: 'middle', weekdayFill: palette.muted } }) + '</g>'
    })
    svg += `<line x1="48" y1="${legendY - 36}" x2="952" y2="${legendY - 36}" stroke="${palette.border}"/>` + calendarSvgLegend({ y: legendY, kind, t, fill: palette.ink, fontSize: 24 })
    if (emptyMessage) svg += text(48, height - 55, emptyMessage, 19, 400, 'start', palette.muted)
    // A tracking boundary belongs only to the page containing that actual day.
    if (visibleStart) svg += `<g data-tracking-start="${escape(trackingSince)}"><circle cx="53" cy="${height - 31}" r="5" fill="${TRACKING_START_MARKER.fill}" stroke="${TRACKING_START_MARKER.border}"/>` + text(66, height - 25, t('Tracking since {0}').replace('{0}', trackingSince), 17, 500, 'start', palette.muted) + '</g>'
    svg += text(952, height - 25, `${pageIndex + 1} / ${chunks.length}`, 18, 500, 'end', palette.muted)
    return { svg: svg + '</g></svg>', width: 1000, height, background: palette.background }
  })
}
