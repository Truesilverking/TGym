import { dateLocale } from './i18n-core.js'

export const measurementNumber = value => value == null ? '—' : new Intl.NumberFormat(dateLocale(), {maximumFractionDigits:2}).format(value)

export function measurementDeltaPresentation(metric) {
  if (metric.delta == null) return { arrow:'', value:null }
  const value = Math.round(metric.delta * 100) / 100 || 0
  return { arrow:value>0?'↑':value<0?'↓':'', value }
}
