const localOnlyRoots = new Set(['lang', 'theme', 'accent', 'sound', 'soundVolume', 'soundMuted', 'sounds', 'customSounds', 'vibration', 'reduceMotion', 'keepAwake', 'reminder', 'cloudSync'])
const identity = value => value?.id ?? value?.uuid ?? value?.date ?? value?.d ?? value?.at ?? value?.ts ?? value?.createdAt ?? null
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

export function mergeTGymStates(local, remote) {
  const conflicts = []
  const conflict = (a, b, path) => {
    conflicts.push({ path: path.join('.'), segments: [...path], local: structuredClone(a), remote: structuredClone(b) })
    return structuredClone(a)
  }
  const walk = (a, b, path = []) => {
    if (same(a, b)) return structuredClone(a)
    if (a === undefined) return structuredClone(b)
    if (b === undefined) return structuredClone(a)
    // A closed pause always wins over a stale open copy; concurrent resumptions
    // use the earliest date, never silently extending an excused period.
    if (path[0] === 'trainingPauses' && path.at(-1) === 'end') {
      if (a === null) return structuredClone(b)
      if (b === null) return structuredClone(a)
      if (typeof a === 'string' && typeof b === 'string') return a < b ? a : b
    }
    if (path.length === 1 && localOnlyRoots.has(path[0])) return structuredClone(a)
    // A session's clock, sets and derived totals belong to the same snapshot. Merging
    // individual rows would combine two versions of a set and inflate training data.
    if ((path.length === 2 && path[0] === 'workouts') || (path.length === 1 && path[0] === 'active') ||
        (path.length === 3 && path[0] === 'routines' && path[2] === 'ex')) return conflict(a, b, path)
    // Explicitly cleared values are edits, not missing fields from an older schema.
    if (a === null || b === null) return conflict(a, b, path)
    // A day's ordered plan is atomic: union would resurrect removed routines or erase a rest override.
    if (path.length === 2 && ['week','dayPlan','daySkipped'].includes(path[0])) {
      return conflict(a, b, path)
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      if (![...a, ...b].some(value => value && typeof value === 'object')) return [...new Set([...a, ...b])]
      const keyed = [...a, ...b].every(value => identity(value) != null) &&
        [a, b].every(rows => new Set(rows.map(value => String(identity(value)))).size === rows.length)
      if (!keyed) {
        // Ambiguous legacy rows cannot safely be unioned or keyed by date alone.
        // Preserve every local row and let the user choose the other snapshot.
        return conflict(a, b, path)
      }
      const left = new Map(a.map(value => [String(identity(value)), value]))
      const right = new Map(b.map(value => [String(identity(value)), value]))
      return [...new Set([...left.keys(), ...right.keys()])].map(key => walk(left.get(key), right.get(key), [...path, key]))
    }
    if (typeof a === 'object' && typeof b === 'object') {
      const out = {}
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) out[key] = walk(a[key], b[key], [...path, key])
      return out
    }
    return conflict(a, b, path)
  }
  const merged = walk(local, remote)
  merged._ts = Math.max(Number(local?._ts || 0), Number(remote?._ts || 0), Date.now())
  return { merged, conflicts }
}

export function applyRemoteConflicts(state, conflicts) {
  const out = structuredClone(state)
  for (const conflict of conflicts) {
    // Segments retain imported IDs containing dots. Array paths identify records,
    // never their current position: another device can store a different order.
    const parts = conflict.segments || conflict.path.split('.').filter(Boolean)
    let node = out
    const keyFor = (parent, part) => Array.isArray(parent) ? parent.findIndex(value => String(identity(value)) === part) : part
    for (let i = 0; i < parts.length - 1; i++) node = node?.[keyFor(node, parts[i])]
    if (node && parts.length) {
      const key = keyFor(node, parts.at(-1))
      if (key !== -1 && Object.hasOwn(node, key)) node[key] = structuredClone(conflict.remote)
    }
  }
  return out
}

