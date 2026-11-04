const KEY = 'framegym_last_import_undo_v1'
export function saveImportUndo(state) { try { sessionStorage.setItem(KEY, JSON.stringify(state)); return true } catch { return false } }
export function canUndoImport() { try { return !!sessionStorage.getItem(KEY) } catch { return false } }
export function consumeImportUndo() { try { const raw = sessionStorage.getItem(KEY); if (!raw) return null; sessionStorage.removeItem(KEY); return JSON.parse(raw) } catch { return null } }
// Keep the recovery snapshot until the primary profile write has succeeded. A
// quota/permission failure must leave Undo available for the next attempt.
export function restoreImportUndo(replaceState) {
  let raw
  try { raw = sessionStorage.getItem(KEY) } catch { return false }
  if (!raw) return false
  const previous = JSON.parse(raw)
  replaceState(previous, true)
  try { sessionStorage.removeItem(KEY) } catch { /* The restored profile is safe. */ }
  return true
}
