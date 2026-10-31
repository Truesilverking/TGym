// Server reminder mirror of the portable [start, end) training-pause contract.
export function isTrainingPaused(state, iso) {
  const valid=d=>/^\d{4}-\d{2}-\d{2}$/.test(d || '') && Number.isFinite(Date.parse(d+'T12:00:00Z')) && new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d
  return (Array.isArray(state.trainingPauses)?state.trainingPauses:[]).some(p=>valid(p?.start) && p.start<=iso && (p.end==null || valid(p.end) && iso<p.end))
}
