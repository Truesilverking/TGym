const KEY = 'framegym_last_import_undo_v1'
export function saveImportUndo(state) { try { sessionStorage.setItem(KEY, JSON.stringify(state)); return true } catch { return false } }
export function canUndoImport() { try { return !!sessionStorage.getItem(KEY) } catch { return false } }
export function consumeImportUndo() { try { const raw = sessionStorage.getItem(KEY); if (!raw) return null; sessionStorage.removeItem(KEY); return JSON.parse(raw) } catch { return null } }
