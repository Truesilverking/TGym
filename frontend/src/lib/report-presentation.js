// Dates use local calendar days. Slash separators cannot be used in file names.
export function reportDate(date = new Date(), separator = '-') {
  const value = date instanceof Date ? date : new Date(date)
  if (!Number.isFinite(value.getTime())) throw new Error('Invalid report date')
  return [String(value.getDate()).padStart(2, '0'), String(value.getMonth() + 1).padStart(2, '0'), String(value.getFullYear()).slice(-2)].join(separator)
}
export function reportFileName(title, format, date = new Date()) {
  const safe = String(title).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').trim()
  if (!safe || !/^[a-z0-9]+$/i.test(format)) throw new Error('Invalid report name')
  return `${safe} ${reportDate(date)}.${format.toLowerCase()}`
}
export function reportProgress(callback, value) {
  callback?.(Math.max(0, Math.min(100, Math.floor(value))))
}
