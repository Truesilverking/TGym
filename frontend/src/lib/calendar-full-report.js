import { calendarReportLayout } from './calendar-report-layout.js'
export { calendarWrappedText, calendarTextWidth } from './calendar-report-layout.js'

// Existing full-year data/metrics; presentation paginates rather than shrinking cells.
export function calendarFullReportPages(options) {
  return calendarReportLayout({ ...options, format: 'pdf', layout: 'full-year' })
}
