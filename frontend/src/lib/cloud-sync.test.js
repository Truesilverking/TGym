import { describe, expect, it } from 'vitest'
import { cloudBackupDue, WEEK_MS } from './cloud-sync.js'

describe('weekly cloud backup schedule', () => {
  const now = new Date('2026-09-01T12:00:00Z').getTime()
  it('is due on first connection and again after seven days', () => {
    expect(cloudBackupDue({ cloudSync: { on: true, clientId: 'client', lastBackupAt: null } }, now)).toBe(true)
    expect(cloudBackupDue({ cloudSync: { on: true, clientId: 'client', lastBackupAt: now - WEEK_MS } }, now)).toBe(true)
  })
  it('does not run early, while disabled, or before configuration', () => {
    expect(cloudBackupDue({ cloudSync: { on: true, clientId: 'client', lastBackupAt: now - WEEK_MS + 1 } }, now)).toBe(false)
    expect(cloudBackupDue({ cloudSync: { on: false, clientId: 'client' } }, now)).toBe(false)
    expect(cloudBackupDue({ cloudSync: { on: true, clientId: '' } }, now)).toBe(false)
    expect(cloudBackupDue({ cloudSync: { on: true, clientId: 'client', needsAuth: true, lastBackupAt: 0 } }, now)).toBe(false)
    expect(cloudBackupDue({ cloudSync: { on: true, clientId: 'client', lastAttemptAt: now - 1000, lastBackupAt: 0 } }, now)).toBe(false)
  })
})
