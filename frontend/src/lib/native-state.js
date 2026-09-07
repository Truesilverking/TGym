/** The newest persisted copy wins. Fitness data is deliberately irrelevant here:
 * language and units are valuable first-run choices even before a routine exists. */
export function shouldRestoreNative(localState, nativeState) {
  if (!nativeState) return false
  return Number(nativeState._ts || 0) >= Number(localState?._ts || 0)
}
