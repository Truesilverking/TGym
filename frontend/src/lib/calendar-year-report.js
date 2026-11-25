import { calendarReportLayout } from './calendar-report-layout.js'

// Complete years reuse each annual calculation, split into readable month pages.
export function calendarYearReportPages({ year, ...options }) {
  return calendarReportLayout({ ...options, start: `${year}-01-01`, end: `${year}-12-31`, year, format: 'pdf', layout: 'complete-year' })
}
