import { reportPagesFile } from './report-file.js'
import { loadBodyGeometry } from './body-geometry.js'
import { progressReportPages } from './progress-export.js'
import { PROGRESS_SECTIONS } from './progress-sections.js'
export { saveReportFile as saveProgressFile } from './report-file.js'

// Build from the exact selected report, not a second all-time calculation.
export async function buildProgressFile(report, options = {}) {
  if (!report.summary || report.range.error) throw new Error('Invalid report period')
  const sections = PROGRESS_SECTIONS.map(([id]) => id).filter(id => !options.sections || options.sections.includes(id))
  if (!sections.length) throw new Error('Select at least one section.')
  const bodyGeometry = sections.includes('body') ? await loadBodyGeometry() : undefined
  const pages = progressReportPages(null, { ...options, sections, report, bodyGeometry })
  const suffix = sections.length === 1 ? '-' + sections[0] : sections.length < PROGRESS_SECTIONS.length ? '-selected' : ''
  const name = `TGym-Progress-Report-${report.range.start}_${report.range.end}${suffix}.pdf`
  return reportPagesFile(pages, name, { fullPage: true, title: 'TGym Progress Report' })
}
