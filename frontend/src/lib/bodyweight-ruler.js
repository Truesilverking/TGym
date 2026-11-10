// Presentation physics only: positions are in the currently displayed weight
// unit, while velocity samples use CSS pixels and monotonic event timestamps.
export const RULER_PIXELS_PER_UNIT = 100
const DECAY_MS = 275
const STOP_SPEED = .015
const RELEASE_SPEED = .28
const SOFT_SPEED = 1.2
const MAX_SPEED = 2.4
const MAX_DURATION_MS = 1800
const clamp = (value,min,max) => Math.max(min,Math.min(max,value))
const tenth = value => Number.isFinite(value*10) ? Math.round(value*10)/10 : value

// A tick is ten CSS pixels whatever the caller's loading increment. Manual
// entries are not quantized; this grid applies only to ruler interactions.
export const rulerStep = step => Number.isFinite(step) && step > 0 ? step : .1
export const rulerPixelsPerUnit = step => 10 / rulerStep(step)
export function snapRulerValue(value, step = .1) {
  step = rulerStep(step)
  if (step === .1) return tenth(value)
  const ratio = value / step
  if (!Number.isFinite(ratio)) return value
  const snapped = Math.round(ratio) * step
  return Number.isFinite(snapped) ? Number(snapped.toPrecision(15)) : value
}

const coastVelocity = velocity => Number.isFinite(velocity) && Math.abs(velocity)>=RELEASE_SPEED
  ? clamp(velocity,-MAX_SPEED,MAX_SPEED) : 0

export function rulerReleaseVelocity(samples, releasedAt) {
  if(!Array.isArray(samples) || !Number.isFinite(releasedAt))return 0
  const recent = samples.filter(sample => Number.isFinite(sample?.x) && Number.isFinite(sample?.t) && sample.t >= releasedAt - 100 && sample.t <= releasedAt).sort((a,b)=>a.t-b.t)
  if (recent.length < 2) return 0
  const first = recent[0], last = recent.at(-1), elapsed = last.t - first.t
  if (elapsed < 16 || releasedAt - last.t > 70) return 0
  const speed = (first.x - last.x) / elapsed
  if(!Number.isFinite(speed) || Math.abs(speed)<RELEASE_SPEED)return 0
  // Preserve ordinary flick strength, then approach the limit smoothly rather
  // than giving every stronger release the same abruptly clipped velocity.
  const magnitude=Math.abs(speed)
  const softened=magnitude<=SOFT_SPEED ? magnitude : SOFT_SPEED+(MAX_SPEED-SOFT_SPEED)*-Math.expm1(-(magnitude-SOFT_SPEED)/(MAX_SPEED-SOFT_SPEED))
  return Math.sign(speed)*softened
}

export function rulerCoastDuration(velocity) {
  const speed=Math.abs(coastVelocity(velocity))
  return speed ? Math.min(MAX_DURATION_MS,DECAY_MS*Math.log(speed/STOP_SPEED)) : 0
}

function stopped(start,min,max,step) {
  const finite=Number.isFinite(start)?start:Number.isFinite(min)?min:Number.isFinite(max)?max:0
  const validBounds=Number.isFinite(min)&&Number.isFinite(max)&&min<=max
  const value=validBounds?clamp(finite,min,max):finite
  // An inherited bound may fall between ticks. Rounding away from that bound
  // would move backwards at the very moment an outward coast stops.
  const shown=validBounds && (value===min || value===max) ? value : validBounds?clamp(snapRulerValue(value,step),min,max):snapRulerValue(value,step)
  return{shown,done:true}
}

export function rulerCoast(start, velocity, elapsed, min, max, step = .1) {
  if(![start,elapsed,min,max].every(Number.isFinite) || min>max)return stopped(start,min,max,step)
  const speed=coastVelocity(velocity),duration=rulerCoastDuration(speed),origin=clamp(start,min,max)
  if(!duration || speed>0&&origin>=max || speed<0&&origin<=min)return stopped(origin,min,max,step)
  const time=clamp(elapsed,0,duration)
  const residual=Math.exp(-duration/DECAY_MS)
  // Integral of exp(-t/tau)-residual. Its derivative decreases continuously to
  // zero at duration, avoiding an abrupt cutoff at a fixed animation lifetime.
  const fullArea=DECAY_MS*-Math.expm1(-duration/DECAY_MS)-duration*residual
  const distance=speed*fullArea/((1-residual)*rulerPixelsPerUnit(step))
  const endpoint=snapRulerValue(origin+distance,step)
  if(!Number.isFinite(endpoint) || (endpoint-origin)*speed<=0)return stopped(origin,min,max,step)
  const area=DECAY_MS*-Math.expm1(-time/DECAY_MS)-time*residual
  // Aim at the rounded endpoint throughout the flight: final snapping cannot
  // reverse direction or jump from an already-rendered fractional endpoint.
  const position=time>=duration?endpoint:origin+(endpoint-origin)*clamp(area/fullArea,0,1)
  const shown=clamp(position,min,max)
  // Follow the unbounded trajectory until it actually hits the boundary. Scaling
  // the entire flight to a nearby boundary would make it creep there for a second.
  return{shown,done:time>=duration || speed>0&&position>=max || speed<0&&position<=min}
}
