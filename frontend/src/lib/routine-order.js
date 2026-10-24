// Presentation order only: schedule arrays, history and routine records are untouched.
export function orderedRoutines(S) {
 const rows=S.routines || [], byId=new Map(rows.map(r=>[r.id,r]))
 const ids=[...new Set([...(Array.isArray(S.routineOrder)?S.routineOrder:[]),...rows.map(r=>r.id)])]
 return ids.map(id=>byId.get(id)).filter(Boolean)
}
export function reorderRoutine(S,id,targetId) {
 const ids=orderedRoutines(S).map(r=>r.id), from=ids.indexOf(id), to=ids.indexOf(targetId)
 if(from<0||to<0||from===to)return
 ids.splice(to,0,...ids.splice(from,1));S.routineOrder=ids
}
