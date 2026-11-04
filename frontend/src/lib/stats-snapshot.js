// Stats excludes the running session from recorded history. Input-only clock
// aliases do not change a chart, filter or workout; keep their snapshot stable.
// Pause/finish/correction, entries and all real preferences remain observable.
const inputClock = new Set(['lastUserInteractionAt', 'lastActivityAt', 'accumulatedActiveDuration'])
function sameFields(a, b, ignored) {
  if (a === b) return true
  if (!a || !b) return false
  const aKeys = Object.keys(a).filter(key => !ignored.has(key))
  const bKeys = Object.keys(b).filter(key => !ignored.has(key))
  return aKeys.length === bKeys.length && aKeys.every(key => Object.hasOwn(b,key) && Object.is(a[key],b[key]))
}
const rootClock = new Set(['_ts', 'active'])
export function createStatsSnapshotSelector() {
  let previous
  return state => {
    if (previous && sameFields(previous, state, rootClock) && sameFields(previous.active, state.active, inputClock)) return previous
    previous = state
    return state
  }
}
