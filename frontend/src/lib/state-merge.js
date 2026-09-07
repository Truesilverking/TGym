const localOnlyRoots = new Set(['lang', 'theme', 'accent', 'sound', 'vibration', 'reduceMotion', 'keepAwake', 'reminder', 'cloudSync'])
const identity = value => value?.id ?? value?.uuid ?? value?.date ?? value?.at ?? value?.ts ?? value?.createdAt ?? null
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

export function mergeTGymStates(local, remote) {
  const conflicts = []
  const walk = (a, b, path = []) => {
    if (same(a, b)) return structuredClone(a)
    if (a == null) return structuredClone(b)
    if (b == null) return structuredClone(a)
    if (path.length === 1 && localOnlyRoots.has(path[0])) return structuredClone(a)
    if (Array.isArray(a) && Array.isArray(b)) {
      if (![...a, ...b].some(value => value && typeof value === 'object')) return [...new Set([...a, ...b])]
      const keyed = [...a, ...b].every(value => identity(value) != null)
      if (!keyed) {
        const out = [...a]
        for (const value of b) if (!out.some(existing => same(existing, value))) out.push(structuredClone(value))
        return out
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
    conflicts.push({ path: path.join('.'), local: structuredClone(a), remote: structuredClone(b) })
    return structuredClone(a)
  }
  const merged = walk(local, remote)
  merged._ts = Math.max(Number(local?._ts || 0), Number(remote?._ts || 0), Date.now())
  return { merged, conflicts }
}

export function applyRemoteConflicts(state, conflicts) {
  const out = structuredClone(state)
  for (const conflict of conflicts) {
    const parts = conflict.path.split('.').filter(Boolean)
    let node = out
    for (let i = 0; i < parts.length - 1; i++) node = node?.[parts[i]]
    if (node && parts.length) node[parts.at(-1)] = structuredClone(conflict.remote)
  }
  return out
}

