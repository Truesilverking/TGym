// Portable training state only. Device credentials and authentication are never portable.
export const BACKUP_SCHEMA = 1
const blocked = new Set(['__proto__', 'prototype', 'constructor', 'accessToken', 'refreshToken', 'password', 'pin', 'pinHash', 'recoveryKey', 'idToken'])
function clean(value) {
  if (Array.isArray(value)) return value.map(clean)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([k]) => !blocked.has(k)).map(([k,v]) => [k,clean(v)]))
  return value
}
const canonical = value => JSON.stringify(value, function (_, v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k,v[k]])) : v
})
// CRC32 detects accidental corruption; it is not a signature or encryption.
export function backupChecksum(value) {
  let crc = 0xffffffff
  for (const byte of new TextEncoder().encode(canonical(value))) {
    crc ^= byte
    for (let i=0;i<8;i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8,'0')
}
export function portableState(state) {
  const data = clean(JSON.parse(JSON.stringify(state)))
  delete data._ts
  if (data.cloudSync) data.cloudSync = { on: false, provider: 'google-drive', clientId: data.cloudSync.clientId || '' }
  return data
}
export function validateBackupState(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.workouts) || !Array.isArray(data.routines)) throw new Error('Invalid backup data')
  for (const key of ['workouts','routines','customEx','bodyweight','measurements','inbody','equipProfiles']) {
    if (data[key] !== undefined && (!Array.isArray(data[key]) || data[key].some(v => !v || typeof v !== 'object' || Array.isArray(v)))) throw new Error(`Invalid backup field: ${key}`)
  }
  if (data.unit !== undefined && !['kg','lb'].includes(data.unit)) throw new Error('Invalid weight unit')
  if (data.active !== undefined && data.active !== null && (typeof data.active !== 'object' || Array.isArray(data.active))) throw new Error('Invalid active workout')
  return clean(data)
}
export function createBackup(state, now = new Date()) {
  const data = validateBackupState(portableState(state))
  return { tgym_backup: true, schemaVersion: BACKUP_SCHEMA, createdAt: now.toISOString(), checksumAlgorithm: 'crc32', checksum: backupChecksum(data), data }
}
export function readBackup(parsed) {
  if (!parsed?.tgym_backup) return null
  if (parsed.schemaVersion !== BACKUP_SCHEMA) throw new Error('Unsupported backup version')
  if (parsed.checksumAlgorithm !== 'crc32' || parsed.checksum !== backupChecksum(parsed.data)) throw new Error('Backup checksum does not match')
  return validateBackupState(parsed.data)
}
