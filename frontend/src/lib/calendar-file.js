import { calendarReportPages, reportFilename } from './calendar-report.js'
import { streakReportPages, streakFilename } from './streak-report.js'
import { reportPagesFile } from './report-file.js'

export async function buildCalendarExport(S, anchor, period, format, options = {}) {
  const settings = { ...options, anchor, period, format }
  return reportPagesFile(streakReportPages(S, settings), streakFilename(settings), { format, imageType: 'JPEG' })
}
export async function buildConsistencyExport(S, anchor, period, format, options = {}) {
  return reportPagesFile(calendarReportPages(S, anchor, period, format, options), reportFilename(anchor, period, format), { format, imageType: 'JPEG' })
}
