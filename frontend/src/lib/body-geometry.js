let pending
// Share the existing lazy asset. A failed load must not poison later retries.
export function loadBodyGeometry() {
  if (!pending) pending=import('./body-paths.js').then(m=>m.default).catch(error=>{pending=null;throw error})
  return pending
}
