// Presentation diagnostics stay in the open import flow. Never copy the profile,
// prescriptions or embedded resources into an error report.
const chainOf = error => {
  const chain = [], seen = new Set()
  for (let current = error; current && !seen.has(current) && chain.length < 8; current = current.cause) {
    seen.add(current); chain.push(current)
  }
  return chain
}

export function routineImportErrorKind(error, stage = 'persist') {
  const chain = chainOf(error)
  if (chain.some(item => item.kind === 'quota' || item.name === 'QuotaExceededError' || item.name === 'NS_ERROR_DOM_QUOTA_REACHED' || item.code === 22 || item.code === 1014 || /^(?:QuotaExceededError|The quota has been exceeded)\.?$/i.test(item.message || ''))) return 'quota'
  if (chain.some(item => item.kind === 'permission' || ['SecurityError', 'NotAllowedError', 'NoModificationAllowedError'].includes(item.name))) return 'permission'
  if (chain.some(item => item.kind === 'validation' || item.name === 'SyntaxError')) return 'validation'
  if (chain.some(item => item.kind === 'conversion')) return 'conversion'
  return stage === 'read' ? 'read' : stage === 'conversion' ? 'conversion' : 'persist'
}

export function routineImportFailureMessage(error, stage, t) {
  const kind = routineImportErrorKind(error, stage)
  const messages = {
    quota: 'The import could not be saved because the storage quota for TGym was exceeded. Your previous data is unchanged.',
    permission: 'The browser did not permit TGym to access storage or the selected file. Your previous data is unchanged.',
    validation: 'The file does not pass routine format validation. Review the file errors or choose another TGym export. Your previous data is unchanged.',
    conversion: 'TGym could not apply the selected import adaptations safely. Review your choices and retry. Your previous data is unchanged.',
    read: 'TGym could not read the selected file. Check access to the file and select it again. Your previous data is unchanged.',
    persist: 'TGym could not save the complete import. Your previous data is unchanged. Keep this review open and retry, or cancel.'
  }
  return { kind, message: t(messages[kind]) }
}

const textOnly = value => typeof value === 'string' ? value.replace(/data:[^\s"']+/g, '[embedded resource]').slice(0, 16000) : typeof value === 'number' || typeof value === 'boolean' ? value : '[detail unavailable]'
const diagnosticKeys = ['stage', 'backend', 'key', 'database', 'store', 'operation', 'bytes', 'attemptedBytes', 'originalAttemptedBytes', 'initialStorageError', 'previousBytes', 'localStorageBytes', 'errorName', 'mediaBytes', 'resourceBytes', 'resourceCount', 'transaction']
const diagnosticOf = item => ({
  name: textOnly(item.name || 'Error'), message: textOnly(item.message || String(item)), stack: textOnly(item.stack || ''),
  ...Object.fromEntries(diagnosticKeys.filter(key => item[key] != null).map(key => [key, textOnly(item[key])])),
  ...Object.fromEntries(diagnosticKeys.filter(key => item.diagnostics?.[key] != null).map(key => [key, textOnly(item.diagnostics[key])]))
})
export function routineImportDiagnostics(error, context = {}) {
  return {
    ...context,
    failures: chainOf(error).map(diagnosticOf),
    ...(error?.initialStorageFailure ? { initialFailure: chainOf(error.initialStorageFailure).map(diagnosticOf) } : {})
  }
}

export function routineAdaptationMessage(item, t) {
  const effortLabel = value => value === 'none' ? t('None') : String(value).toUpperCase()
  if (item.key === 'effort') return t('Effort scale differs ({0} → {1}). Destination preferences remain unchanged; imported RIR prescriptions are preserved.', effortLabel(item.source), effortLabel(item.destination))
  // These stable source messages also cover file-level legacy resource warnings.
  return t(item.message)
}
