import { CATALOGUE, isBodyweightEq } from './exercises.js'
import { policyFor, loadingStepFor, DEFAULT_SEC_INCREMENT } from './progression.js'
import { restSeconds } from './rest-policy.js'
import { strictRepsFor, withBackoffRepsMode, defaultDeload } from './training-plan.js'
import { effortOf } from './history.js'

const object = value => value && typeof value === 'object' && !Array.isArray(value)
const clone = value => JSON.parse(JSON.stringify(value))
const excluded = new Set(['__proto__', 'prototype', 'constructor', 'accessToken', 'refreshToken', 'idToken', 'password', 'pin', 'pinHash', 'recoveryKey', 'credentials', 'authorization', 'apiKey', 'privateKey', 'secret', 'token'])
const clean = value => Array.isArray(value) ? value.map(clean) : object(value) ? Object.fromEntries(Object.entries(value).filter(([key]) => !excluded.has(key)).map(([key, child]) => [key, clean(child)])) : value
const pick = (value, keys) => Object.fromEntries(keys.filter(key => Object.hasOwn(value || {}, key) && value[key] !== undefined).map(key => [key, clean(clone(value[key]))]))

export const CUSTOM_TRANSFER_KEYS = ['id', 'n', 'custom', 'bp', 'eq', 'tg', 'mg', 'desc', 'cues', 'img', 'gif', 'sm', 'st', 'primaries', 'primaryMuscles', 'primary', 'secondaries', 'secondaryMuscles', 'secondary', 'muscleGroups', 'muscles', 'targetMuscles', 'muscleWeights', 'legacyNames', 'activityType']
const routineKeys = ['id', 'name', 'note', 'emoji', 'prog', 'restSec', 'betweenRestSec', 'warmupRestSec', 'supersetMoveRestSec', 'supersetRoundRestSec', 'guideSlots']
const exerciseKeys = ['id', 'n', 'sg', 'note', 'tempo', 'mode', 'activityType', 'side', 'repsPerSide', 'prog', 'inc', 'loadingStep', 'unit', 'bodyweight', 'strictReps', 'amrap', 'supersetMoveRestSec', 'supersetRoundRestSec', 'intensifier', 'sets', 'warmup', 'warmupSets', 'setScheme', 'topSets', 'backoffSets', 'reps', 'repsMin', 'repsMax', 'repRange', 'topRepsMin', 'topRepsMax', 'backoffRepsMin', 'backoffRepsMax', 'weight', 'rest', 'restSec', 'afterRestSec', 'setRestSec', 'warmupRestSec', 'targetRir', 'targetRirMin', 'targetRirMax', 'topRir', 'topRirMin', 'topRirMax', 'backoffRir', 'backoffRirMin', 'backoffRirMax', 'backoffPct', 'autoBackoffReps', 'backoffRepsMode', 'backoffRepsOverride', 'backoffRepOffset', 'sec', 'min', 'speed']
const ruleKeys = ['backoffRepsMode', 'strictReps', 'effort', 'restSec', 'restAdvanced', 'warmup', 'step', 'deload']
function requireSupported(record, keys, label) {
  const unknown=Object.keys(record).filter(key=>!keys.includes(key) && !excluded.has(key))
  if (unknown.length) throw new Error(`${label}: unsupported transfer fields (${unknown.join(', ')}). Keep a full backup and remove or convert these fields before exporting; they cannot be silently omitted.`)
}
// Match the profile overlay for a partial source/template without importing the store.
// Explicit zero rests and explicitly supplied legacy advanced objects retain their meaning.
const sourceContext = S => ({unit:'kg',restSec:90,restAdvanced:{warmup:45,supersetMove:0,supersetRound:120},...S})

export function portableRoutineRules(S) {
  S=sourceContext(S)
  const rules = pick(S, ruleKeys)
  rules.backoffRepsMode = S.backoffRepsMode === 'same' ? 'same' : 'increased'
  rules.strictReps = !!S.strictReps
  rules.effort = effortOf(S)
  rules.restSec = restSeconds({state:S})
  rules.restAdvanced = {warmup:restSeconds({state:S,warmup:true}),supersetMove:restSeconds({state:S,phase:'supersetMove'}),supersetRound:restSeconds({state:S,phase:'supersetRound'})}
  rules.deload = {...defaultDeload(),startDate:null,...pick(rules.deload, ['on', 'notifications', 'normalWeeks', 'deloadWeeks', 'loadPct', 'setPct', 'targetRir', 'startDate'])}
  const date=rules.deload.startDate
  if (rules.deload.on && (typeof date!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0,10)!==date)) throw new Error('Source deload is enabled without a valid startDate. Set the cycle start date or disable deload before exporting; its schedule cannot be guessed.')
  return rules
}

/** Snapshot plan rules, never historical loads/results or destination-wide settings. */
export function materializeRoutinePrescription(S, routine) {
  S=sourceContext(S)
  const definitions = new Map([...CATALOGUE, ...(S.customEx || [])].map(ex => [ex.id, ex]))
  requireSupported(routine,[...routineKeys,'ex'],`Routine ${routine.name || routine.id}`)
  const result = pick(routine, routineKeys)
  result.ex = (routine.ex || []).map(original => {
    requireSupported(original,exerciseKeys,`Routine ${routine.name || routine.id}, exercise ${original.id}`)
    const definition = definitions.get(original.id), cfg = pick(original, exerciseKeys)
    cfg.mode = ['reps', 'time', 'cardio'].includes(original.mode) ? original.mode : definition?.bp === 'cardio' ? 'cardio' : 'reps'
    cfg.bodyweight = original.bodyweight == null ? isBodyweightEq(definition) : !!original.bodyweight
    cfg.strictReps = strictRepsFor(S, original)
    cfg.prog = policyFor(cfg, routine, cfg.mode)
    const loadingStep = loadingStepFor(cfg, S.unit || 'kg', definition)
    cfg.loadingStep = loadingStep
    if (!(cfg.inc > 0)) cfg.inc = cfg.mode === 'time' ? DEFAULT_SEC_INCREMENT : loadingStep
    cfg.restSec = restSeconds({state:S, routine, target:original})
    cfg.warmupRestSec = restSeconds({state:S, routine, target:original, warmup:true})
    cfg.supersetMoveRestSec = restSeconds({state:S, routine, target:original, phase:'supersetMove'})
    cfg.supersetRoundRestSec = restSeconds({state:S, routine, target:original, phase:'supersetRound'})
    if (cfg.setScheme === 'topback' && cfg.autoBackoffReps !== false) {
      const effective = withBackoffRepsMode(cfg, S)
      Object.assign(cfg, effective, {backoffRepsOverride:true})
    }
    return cfg
  })
  return result
}

const mediaLimit = 5_000_000
const bytesMatch = (bytes, offset, text) => [...text].every((char, i) => bytes[offset + i] === char.charCodeAt(0))
const uint32 = (bytes, offset, little = false) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, little)
function completeGif(bytes) {
  if (bytes.length < 14 || !['GIF87a', 'GIF89a'].some(header => bytesMatch(bytes,0,header)) || !(bytes[6] | bytes[7]) || !(bytes[8] | bytes[9])) return false
  let offset=13 + (bytes[10] & 128 ? 3 * 2 ** ((bytes[10] & 7) + 1) : 0), images=0
  const blocks=()=> { while(offset < bytes.length) { const size=bytes[offset++]; if (!size) return true; offset+=size; if (offset > bytes.length) return false } return false }
  while (offset < bytes.length) {
    const marker=bytes[offset++]
    if (marker === 0x3b) return images > 0 && offset === bytes.length
    if (marker === 0x21) { if (offset >= bytes.length) return false; offset++; if (!blocks()) return false }
    else if (marker === 0x2c) {
      if (offset + 9 >= bytes.length || !(bytes[offset+4] | bytes[offset+5]) || !(bytes[offset+6] | bytes[offset+7])) return false
      const packed=bytes[offset+8]; offset+=9 + (packed & 128 ? 3 * 2 ** ((packed & 7) + 1) : 0)
      if (offset >= bytes.length || bytes[offset] < 2 || bytes[offset++] > 8 || !blocks()) return false
      images++
    } else return false
  }
  return false
}
function completePng(bytes) {
  if (bytes.length < 45 || bytes[0] !== 137 || !bytesMatch(bytes,1,'PNG\r\n\x1a\n')) return false
  let offset=8, header=false, image=false
  while(offset + 12 <= bytes.length) {
    const size=uint32(bytes,offset),end=offset+12+size
    if (end > bytes.length) return false
    let crc=0xffffffff
    for (let i=offset+4;i<end-4;i++) { crc^=bytes[i]; for(let bit=0;bit<8;bit++) crc=(crc>>>1)^((crc&1)?0xedb88320:0) }
    if (((crc^0xffffffff)>>>0) !== uint32(bytes,end-4)) return false
    if (!header) { if (!bytesMatch(bytes,offset+4,'IHDR') || size!==13 || !uint32(bytes,offset+8) || !uint32(bytes,offset+12)) return false; header=true }
    if (bytesMatch(bytes,offset+4,'IDAT')) image=true
    if (bytesMatch(bytes,offset+4,'IEND')) return size===0 && image && end===bytes.length
    offset=end
  }
  return false
}
function completeJpeg(bytes) {
  if (bytes.length<12 || bytes[0]!==255 || bytes[1]!==216) return false
  let offset=2,frame=false,scan=false
  while(offset<bytes.length) {
    if(bytes[offset++]!==255) return false
    while(bytes[offset]===255) offset++
    const marker=bytes[offset++]
    if(marker===217) return frame && scan && offset===bytes.length
    if(marker===0 || marker===216 || offset+2>bytes.length) return false
    const length=bytes[offset]*256+bytes[offset+1]
    if(length<2 || offset+length>bytes.length) return false
    if(marker>=192 && marker<=207 && ![196,200,204].includes(marker)) {
      if(length<8 || !(bytes[offset+3] | bytes[offset+4]) || !(bytes[offset+5] | bytes[offset+6]) || !bytes[offset+7] || length!==8+3*bytes[offset+7]) return false
      frame=true
    }
    if(marker===218 && (length<6 || !bytes[offset+2] || length!==6+2*bytes[offset+2])) return false
    offset+=length
    if(marker===218) {
      scan=true
      const start=offset
      while(offset<bytes.length) {
        if(bytes[offset]!==255) { offset++;continue }
        if(bytes[offset+1]===0 || bytes[offset+1]>=208 && bytes[offset+1]<=215) { offset+=2;continue }
        break
      }
      if(offset===start) return false
    }
  }
  return false
}
function publicMediaURL(value) {
  if (value !== value.trim() || !/^https:\/\//i.test(value)) return false
  try {
    const url = new URL(value), host = url.hostname.toLowerCase()
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash &&
      !host.includes(':') && !/^\d+(?:\.\d+){3}$/.test(host) && host.includes('.') &&
      !/(?:^|\.)(?:localhost|local|internal|invalid|test)$/.test(host) && !/^localhost\./.test(host)
  } catch { return false }
}
function portableMedia(value) {
  if (value === '') return true
  if (typeof value !== 'string') return false
  if (publicMediaURL(value)) return true
  const match = /^data:image\/(png|jpeg|jpg|gif|webp|bmp|avif|x-icon);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value)
  if (!match || match[2].length % 4 || match[2].length > Math.ceil(mediaLimit / 3) * 4) return false
  let decoded
  try { decoded = atob(match[2]); if (btoa(decoded) !== match[2]) return false } catch { return false }
  if (!decoded.length || decoded.length > mediaLimit) return false
  const bytes = Uint8Array.from(decoded, char => char.charCodeAt(0)), type = match[1].toLowerCase()
  if (type === 'gif') return completeGif(bytes)
  if (type === 'png') return completePng(bytes)
  if (type === 'jpeg' || type === 'jpg') return completeJpeg(bytes)
  if (type === 'webp') return bytes.length >= 20 && bytesMatch(bytes,0,'RIFF') && uint32(bytes,4,true)+8===bytes.length && bytesMatch(bytes,8,'WEBP')
  if (type === 'bmp') return bytes.length >= 26 && bytesMatch(bytes,0,'BM') && uint32(bytes,2,true)===bytes.length && uint32(bytes,10,true)<bytes.length
  if (type === 'avif') return bytes.length >= 32 && bytesMatch(bytes,4,'ftyp') && ['avif','avis'].some(brand=>bytesMatch(bytes,8,brand)) && uint32(bytes,0)<=bytes.length
  if (bytes.length<22 || bytes[0]!==0 || bytes[1]!==0 || bytes[2]!==1 || bytes[3]!==0) return false
  const icons=bytes[4]+bytes[5]*256
  return icons>0 && 6+icons*16<=bytes.length && Array.from({length:icons},(_,i)=>6+i*16).every(offset=>uint32(bytes,offset+12,true)>=6+icons*16 && uint32(bytes,offset+12,true)+uint32(bytes,offset+8,true)<=bytes.length)
}

export function customTransferIssues(definition, {version = 2} = {}) {
  if (!object(definition)) return [{field:'definition', message:'Include the complete custom exercise definition.'}]
  const issues = []
  for (const key of Object.keys(definition)) if (excluded.has(key) || version >= 2 && !CUSTOM_TRANSFER_KEYS.includes(key)) issues.push({field:key, message:'Remove unsupported or private fields from the custom exercise definition.'})
  const privateFields = (value, path, depth=0) => {
    if (!value || typeof value !== 'object' || depth>30) return
    for (const [key,child] of Object.entries(value)) {
      if (excluded.has(key)) issues.push({field:`${path}.${key}`,message:'Remove private fields from the custom exercise definition.'})
      else privateFields(child,`${path}.${key}`,depth+1)
    }
  }
  for (const [key,value] of Object.entries(definition)) if (!excluded.has(key)) privateFields(value,key)
  for (const field of ['img', 'gif']) if (definition[field] != null && !portableMedia(definition[field])) issues.push({field, message:'Use a valid embedded raster image/GIF of at most 5 MB, or a public HTTPS media URL without credentials or temporary parameters. Blob, file and device-local references cannot be transferred.'})
  return issues
}

export function portableCustomDefinition(definition) {
  requireSupported(definition,CUSTOM_TRANSFER_KEYS,`Custom exercise ${definition.n || definition.id}`)
  const portable = pick(definition, CUSTOM_TRANSFER_KEYS)
  const issues = customTransferIssues(portable)
  if (issues.length) throw new Error(`Custom exercise ${definition.n || definition.id}: ${issues.map(issue => `${issue.field}: ${issue.message}`).join(' ')}`)
  return portable
}

export function portableExchangeCatalogue(S, used, {fullCatalog = false} = {}) {
  const map = new Map(CATALOGUE.map(ex => [ex.id, {id:ex.id, n:ex.n, custom:false}]))
  for (const original of S.customEx || []) {
    if (!fullCatalog && !used.has(original.id)) continue
    const definition = portableCustomDefinition(original)
    if (map.has(original.id)) throw new Error(`Custom exercise ${original.n || original.id} collides with a built-in exercise ID. Give the custom exercise a distinct ID before exporting.`)
    map.set(original.id, {id:original.id, n:original.n, custom:true, definition})
  }
  return [...map.values()].map(ex => {
    const include = fullCatalog || used.has(ex.id), alias = include && Object.hasOwn(S.exerciseAliases || {}, ex.id) ? S.exerciseAliases[ex.id] : ''
    return {...ex, alias, aliasPresent:include && Object.hasOwn(S.exerciseAliases || {}, ex.id), ...(include && Object.hasOwn(S.exNotes || {}, ex.id) ? {libraryNote:S.exNotes[ex.id]} : {}), selector:`${ex.n} [${ex.id}]`}
  })
}
