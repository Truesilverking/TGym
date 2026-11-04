import { calendarReportPages, reportFilename } from './calendar-report.js'
import { streakReportPages, streakFilename } from './streak-report.js'
import { reportPagesFile } from './report-file.js'

export async function buildCalendarExport(S, anchor, period, format, options = {}) {
  const settings = { ...options, anchor, period, format }
  options.onProgress?.(0)
  const pages = streakReportPages(S, settings)
  options.onProgress?.(15)
  return reportPagesFile(pages, streakFilename(settings), { format, imageType: 'PNG', fullPage: true, onProgress: value => options.onProgress?.(15 + value * .85) })
}
export async function buildConsistencyExport(S, anchor, period, format, options = {}) {
  options.onProgress?.(0)
  const pages = calendarReportPages(S, anchor, period, format, options)
  options.onProgress?.(15)
  return reportPagesFile(pages, reportFilename(anchor, period, format, options), { format, imageType: 'PNG', fullPage: true, onProgress: value => options.onProgress?.(15 + value * .85) })
}
