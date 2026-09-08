import { parsePlan } from './plan-share.js'
import { t } from './i18n-core.js'
import { readBackup, validateBackupState } from './backup.js'

/** Identify the two JSON files TGym accepts without making the user choose
 * the right importer first: a complete device backup or a shared weekly plan. */
export function parseTGymJson(raw) {
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
  const snapshot = readBackup(parsed)
  if (snapshot) return { kind: 'backup', data: snapshot }

  if (parsed && (parsed.framegym_plan || parsed.opengym_plan) && Array.isArray(parsed.routines)) {
    return { kind: 'plan', bundle: parsePlan(parsed) }
  }

  if (parsed && typeof parsed === 'object') {
    const { framegym_backup, opengym_backup, ...data } = parsed
    if (Array.isArray(data.workouts) && Array.isArray(data.routines)) {
      return { kind: 'backup', data: validateBackupState(data) }
    }
  }

  throw new Error(t('not a TGym or openGym backup or plan'))
}
