import { CATALOGUE } from './exercises.js'
import { createRoutineExchange } from './routine-exchange.js'

// Generated raster data is anonymous. Comment blocks increase the size of a
// valid one-pixel GIF without copying a user's exercise images or descriptions.
function anonymousGif(targetCharacters, marker) {
  const image = atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7')
  const prefix = 'data:image/gif;base64,'
  const targetBytes = Math.floor((targetCharacters - prefix.length) / 4) * 3
  const available = targetBytes - image.length - 3
  let padding = Math.max(0, available - Math.ceil(available / 256))
  while (padding + Math.ceil(padding / 255) > available) padding--
  const blocks = []
  for (let remaining = padding; remaining > 0;) {
    const length = Math.min(255, remaining)
    blocks.push(String.fromCharCode(length), marker.repeat(length))
    remaining -= length
  }
  return prefix + btoa(image.slice(0, -1) + '\x21\xfe' + blocks.join('') + '\x00\x3b')
}

export function anonymousQuotaSource({largeMedia = true} = {}) {
  const targetSizes = largeMedia ? [906866, 9459, 1710178, 1511258, 217322, 372959] : Array(6).fill(150)
  const customEx = Array.from({length:7}, (_, index) => ({id:`quota-custom-${index + 1}`, n:`Anonymous exercise ${index + 1}`, custom:true, bp:'back', eq:'cable', desc:'Generated quota regression resource', ...(index < 6 ? {img:anonymousGif(targetSizes[index], String.fromCharCode(65 + index))} : {})}))
  const identities = [...customEx, ...CATALOGUE.slice(0, 25)]
  const routines = Array.from({length:6}, (_, ri) => ({id:`quota-routine-${ri + 1}`, name:`Anonymous routine ${ri + 1}`, note:'Keep this prescription note 🙂', ex:Array.from({length:8}, (_, ei) => {
    const index = ri * 8 + ei, exercise = identities[index % identities.length]
    if (index < 8) return {id:exercise.id, mode:'time', sets:2, sec:45 + index, weight:10, inc:5, prog:'time', targetRirMin:1,targetRirMax:2,restSec:30, note:'Keep this timed target'}
    return {id:exercise.id, mode:'reps', sets:3, reps:8, repsMin:6, repRange:true, weight:100, inc:5, loadingStep:5, unit:'lb', targetRirMin:1,targetRirMax:2,restSec:90, note:'Keep the rep and RIR ranges', ...(index < 10 ? {setScheme:'topback', topSets:1,backoffSets:2,topRepsMin:6,topRepsMax:8,topRirMin:1,topRirMax:2,backoffRirMin:2,backoffRirMax:3,backoffPct:15,autoBackoffReps:true,backoffRepsOverride:true,backoffRepsMode:index === 8 ? 'same' : 'increased'} : {})}
  })}))
  return {unit:'lb',routines,routineOrder:routines.map(r=>r.id), customEx, exerciseAliases:{}, exNotes:Object.fromEntries(customEx.slice(0,6).map(ex=>[ex.id,'Keep this anonymous library note'])),week:Object.fromEntries(routines.map((r,index)=>[index + 1,[r.id]])),dayPlan:{},workouts:[],active:null, effort:'rir',strictReps:true,backoffRepsMode:'same',restSec:90,restAdvanced:{warmup:45,supersetMove:0,supersetRound:120}}
}

export const anonymousQuotaExchange = options => createRoutineExchange(anonymousQuotaSource(options))
