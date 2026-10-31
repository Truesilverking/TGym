import { forwardRef, memo, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { NumberField } from './ui.jsx'
import { dateLocale, t } from '../lib/i18n.js'
import { rulerPixelsPerUnit, rulerStep, snapRulerValue, rulerReleaseVelocity, rulerCoast } from '../lib/bodyweight-ruler.js'
import './BodyWeightPicker.css'

const PIXELS_PER_TICK = 10
const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const reduceMotion = () => document.documentElement.dataset.reduceMotion === 'true' || document.documentElement.classList.contains('reduceMotion') || !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

const RulerTicksGroup = memo(function RulerTicksGroup({ tile, min, max, formatter, step }) {
  return Array.from({ length:20 }, (_, index) => {
    const tick = tile * 20 + index
    const amount = tick * step, major = tick % 10 === 0, half = tick % 5 === 0
    return <span key={tick} className={'bodyweight-picker-tick' + (major ? ' major' : half ? ' half' : '') + (amount < min || amount > max ? ' outside' : '')}
      style={{ left:`${index * PIXELS_PER_TICK}px` }}>
      <i/>{major && <span>{formatter.format(amount)}</span>}
    </span>
  })
})

const RulerTicks = memo(function RulerTicks({ anchor, min, max, formatter, step }) {
  return Array.from({ length:7 }, (_, index) => {
    const tile = anchor + index - 3
    return <span key={tile} className="bodyweight-picker-tile" style={{ left:`calc(50% + ${(tile - anchor) * 20 * PIXELS_PER_TICK}px)` }}>
      <RulerTicksGroup tile={tile} min={min} max={max} formatter={formatter} step={step}/>
    </span>
  })
})

// Display and local draft use the configured profile unit. Conversion and
// rounding of saved history remain the parent editor's job.
const BodyWeightPicker = forwardRef(function BodyWeightPicker({ value, onChange, unit, disabled = false, onValidityChange, min:configuredMin, max:configuredMax, step:configuredStep = .1, label }, ref) {
  const canonicalUnit = unit === 'lb' ? 'lb' : 'kg'
  const shownUnit = canonicalUnit
  const step = rulerStep(configuredStep)
  // Weight readouts use whole units; the draft and loading grid retain their
  // exact precision. Focusing the field exposes that precision for editing.
  const digits = 0
  const pixelsPerUnit = rulerPixelsPerUnit(step)
  const [bounds] = useState(() => ({
    min: positive(value) ? Math.min(Number.isFinite(configuredMin) && configuredMin >= 0 ? configuredMin : 1, value) : Number.isFinite(configuredMin) && configuredMin >= 0 ? configuredMin : 1,
    max: Math.max(Number.isFinite(configuredMax) && configuredMax >= (configuredMin ?? 1) ? configuredMax : canonicalUnit === 'lb' ? 660 : 300, positive(value) ? value : 0),
  }))
  const [openWidthBound] = useState(() => Math.max(1000, (positive(value) ? value : 70) + step * 100))
  const [invalidText, setInvalidText] = useState(null)
  const [manualValue, setManualValue] = useState(null)
  const [inputLength, setInputLength] = useState(null)
  const [preview, setPreview] = useState(null)
  const [focused, setFocused] = useState(false)
  const ruler = useRef(null), gesture = useRef(null), lastEmitted = useRef(value)
  const root = useRef(null)
  const motion = useRef(null), frame = useRef(null), pointerFrame = useRef(null)
  const lastValid = useRef(positive(value) ? value : canonicalUnit === 'lb' ? 154 : 70)
  const hintId = useId(), errorId = useId()
  const validNumber = n => typeof n === 'number' && Number.isFinite(n) && n >= bounds.min && n <= bounds.max
  if (validNumber(value)) lastValid.current = value
  const valid = invalidText === null && validNumber(value)
  const canonicalShown = preview ?? (validNumber(value) ? value : lastValid.current)
  const shown = canonicalShown
  const min = bounds.min, max = bounds.max
  // Keep an imported boundary re-enterable if its whole-unit readout rounds outside
  // the exact legacy value. Only explicit edits are clamped to that boundary.
  const factor = 10 ** digits
  const manualMin = Math.min(min, Math.round(min * factor) / factor)
  const manualMax = Math.max(max, Math.round(max * factor) / factor)
  const validManual = next => typeof next === 'number' && Number.isFinite(next) && next >= manualMin && next <= manualMax
  // A frame may have queued a newer draft before React paints it. Read the
  // committed input for explicit actions so the saved weight matches the screen.
  const readVisible = () => {
    const input = root.current?.querySelector('input')
    const text = input?.value.replace(/,/g, '.') ?? ''
    const number = text.trim() === '' ? null : Number(text)
    if (!/^\d*(?:\.\d*)?$/.test(text) || !validManual(number)) return null
    // Read the exact value associated with the painted readout, including a
    // local animation frame. Whole-unit formatting must never round a saved
    // legacy value merely because the editor was opened and confirmed.
    const painted = input?.dataset.weightValue === undefined ? null : Number(input.dataset.weightValue)
    if (validNumber(painted) && [format(painted), editFormat(painted)].some(shown => text === shown.replace(/,/g, '.'))) return painted
    return clamp(number, min, max)
  }
  useImperativeHandle(ref, () => ({ getValue:readVisible }))
  const locale = dateLocale()
  const formatter = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: digits, useGrouping:false }), [locale, digits])
  const editFormatter = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits:20, useGrouping:false }), [locale])
  const format = n => formatter.format(n)
  const editFormat = n => editFormatter.format(n)
  const currentInvalid = preview === null && !valid
  const fieldValue = currentInvalid ? null : preview === null && manualValue !== null ? manualValue : preview !== null ? clamp(snapRulerValue(shown, step), min, max) : shown
  const fieldText = currentInvalid ? invalidText ?? (value == null ? '' : String(value)) : focused ? editFormat(fieldValue) : format(fieldValue)

  useEffect(() => { onValidityChange?.(valid) }, [valid, onValidityChange])

  const release = g => { try { ruler.current?.releasePointerCapture?.(g.id) } catch { /* Already released by the browser. */ } }
  const clearPointerFrame = () => {
    if (pointerFrame.current !== null) cancelAnimationFrame(pointerFrame.current)
    pointerFrame.current = null
  }
  const cancel = event => {
    const g = gesture.current
    if (!g) return
    if (event?.pointerId != null && event.pointerId !== g.id) return
    gesture.current = null
    clearPointerFrame()
    release(g)
    setPreview(null)
  }
  const stopMotion = (freezeVisible = true) => {
    const moving = motion.current
    let stopped = moving?.shown
    motion.current = null
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
    if (moving) {
      if (freezeVisible) {
        const visible = readVisible()
        if (visible !== null) { stopped = visible; publish(visible) }
      }
      // Disabling or changing only the unit must not emit an old value or lose
      // the painted local draft. A new controlled value takes precedence.
      setPreview(!freezeVisible && Object.is(lastEmitted.current, value) ? readVisible() : null)
    }
    return stopped
  }
  const stopAll = () => { stopMotion(); cancel() }
  useEffect(() => {
    // Capture starts only once horizontal intent is clear. A pending tap released
    // outside the ruler must still be discarded, without owning vertical scroll.
    const hidden = () => { if (document.hidden) stopAll() }
    const outside = event => { if (!ruler.current?.contains(event.target)) stopMotion() }
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const reduced = () => { if (reduceMotion()) stopMotion() }
    const observer = new MutationObserver(reduced)
    observer.observe(document.documentElement, { attributes:true, attributeFilter:['class','data-reduce-motion'] })
    media?.addEventListener?.('change', reduced)
    window.addEventListener('pointerup', cancel)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('pointerdown', outside, true)
    window.addEventListener('blur', stopAll)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      const g = gesture.current; gesture.current = null; if (g) release(g)
      motion.current = null
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      frame.current = null
      clearPointerFrame()
      observer.disconnect(); media?.removeEventListener?.('change', reduced)
      window.removeEventListener('pointerup', cancel)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('pointerdown', outside, true)
      window.removeEventListener('blur', stopAll)
      document.removeEventListener('visibilitychange', hidden)
    }
  }, [])
  useEffect(() => {
    const g = gesture.current
    if (g && (disabled || !Object.is(g.original, value) || g.unit !== canonicalUnit || g.step !== step)) cancel()
    if (motion.current && (disabled || motion.current.unit !== canonicalUnit || motion.current.step !== step || !Object.is(lastEmitted.current, value))) stopMotion(false)
    if (!Object.is(lastEmitted.current, value)) {
      setPreview(null); setInvalidText(null); setManualValue(null); setInputLength(null)
      lastEmitted.current = value
    }
  }, [value, canonicalUnit, disabled, step])

  const publish = (next, manual = null) => {
    if (disabled || !validNumber(next)) return
    lastEmitted.current = next
    lastValid.current = next
    setPreview(null); setInvalidText(null); setManualValue(manual)
    if (manual === null) setInputLength(null)
    onValidityChange?.(true)
    onChange(next)
  }
  const manualInput = event => {
    if (disabled) return
    stopMotion()
    setPreview(null)
    const raw = event.currentTarget.value, text = raw.replace(/,/g, '.')
    setInputLength(raw.length)
    const parsed = text.trim() === '' || text === '.' ? null : Number(text)
    const okay = /^\d*(?:\.\d*)?$/.test(text) && validManual(parsed)
    if (!okay) { setInvalidText(raw); setManualValue(null); onValidityChange?.(false) }
  }
  const edit = next => {
    if (disabled) return
    stopMotion()
    if (next == null) { setInvalidText(''); setManualValue(null); onValidityChange?.(false); return }
    if (!validManual(next)) return
    const canonical = clamp(next, bounds.min, bounds.max)
    publish(canonical, next)
  }
  const fromPointer = (event, g) => {
    return clamp(g.shown + (g.x - event.clientX) / pixelsPerUnit, g.min, g.max)
  }
  const remember = (event, g) => {
    g.samples.push({ x:event.clientX, t:event.timeStamp })
    g.samples = g.samples.filter(sample => sample.t >= event.timeStamp - 120).slice(-16)
  }
  const publishShown = (next, force = false) => {
    const canonical = clamp(snapRulerValue(next, step), min, max)
    if (!Object.is(canonical, lastEmitted.current) || force) publish(canonical)
  }
  const coast = (start, velocity) => {
    if (!velocity || reduceMotion()) return
    const moving = { shown:start, unit:canonicalUnit, step, started:performance.now() }
    motion.current = moving
    const animate = now => {
      if (motion.current !== moving) return
      const next = rulerCoast(start, velocity, now - moving.started, min, max, step)
      moving.shown = next.shown
      // Animation stays inside the picker. Explicit actions read the painted
      // input, and the parent receives the settled draft once rather than a
      // complete sheet rerender for every moving tenth.
      if (next.done) { publishShown(next.shown); motion.current = null; frame.current = null; setPreview(null); return }
      setPreview(next.shown)
      frame.current = requestAnimationFrame(animate)
    }
    frame.current = requestAnimationFrame(animate)
  }
  const pointerDown = event => {
    if (disabled || event.button !== 0 || event.isPrimary === false || gesture.current) return
    const starting = stopMotion() ?? shown
    setManualValue(null); setInputLength(null)
    gesture.current = { id:event.pointerId, x:event.clientX, y:event.clientY, original:lastEmitted.current, unit:canonicalUnit, step, shown:starting, min, max, horizontal:false, samples:[{ x:event.clientX, t:event.timeStamp }] }
  }
  const pointerMove = event => {
    const g = gesture.current
    if (!g || g.id !== event.pointerId) return
    remember(event, g)
    const x = Math.abs(event.clientX - g.x), y = Math.abs(event.clientY - g.y)
    if (!g.horizontal) {
      if (y > 6 && y >= x) { cancel(); return }
      if (x <= 6 || x <= y * 1.15) return
      g.horizontal = true
      try { event.currentTarget.setPointerCapture?.(g.id) } catch { /* Pointer may have ended. */ }
    }
    event.preventDefault()
    g.latest = fromPointer(event, g)
    if (pointerFrame.current === null) pointerFrame.current = requestAnimationFrame(() => {
      pointerFrame.current = null
      if (gesture.current === g) setPreview(g.latest)
    })
  }
  const pointerUp = event => {
    const g = gesture.current
    if (!g || g.id !== event.pointerId) return
    gesture.current = null; clearPointerFrame(); release(g); setPreview(null)
    if (!g.horizontal || disabled) return
    event.preventDefault()
    remember(event, g)
    const next = fromPointer(event, g)
    publishShown(next, !valid)
    coast(next, rulerReleaseVelocity(g.samples, event.timeStamp))
  }
  const keyDown = event => {
    if (event.key === 'Escape' && (gesture.current || motion.current)) { event.preventDefault(); event.stopPropagation(); stopAll(); return }
    if (disabled) return
    const change = ['ArrowRight','ArrowUp'].includes(event.key) ? step : ['ArrowLeft','ArrowDown'].includes(event.key) ? -step : event.key === 'PageUp' ? step * 10 : event.key === 'PageDown' ? -step * 10 : null
    if (change == null && !['Home','End'].includes(event.key)) return
    event.preventDefault(); event.stopPropagation()
    const current = stopMotion() ?? shown; cancel()
    const next = event.key === 'Home' ? min : event.key === 'End' ? max : clamp(snapRulerValue(current + change, step), min, max)
    const canonical = clamp(next, bounds.min, bounds.max)
    if (!Object.is(canonical, lastEmitted.current) || !valid) publish(canonical)
  }
  // Seven compact tiles keep both paint bounds and reused tick coordinates
  // local. Shifting the window moves six retained wrappers, not every mark.
  const railAnchor = Math.floor(shown / (20 * step))
  // Reserve enough room for the configured integer digits and a precise edit.
  // Crossing an integer must not move the unit during a fast flight.
  const widthBound = max < 1e7 ? max : Math.max(openWidthBound, shown)
  const readoutWidth = Math.min(8, Math.max(5.25, Math.floor(Math.log10(Math.max(1, widthBound))) + 3.25))
  const hint = label ? t('Slide the ruler or tap the number to enter the weight.') : t('Slide the ruler or tap the number to enter your weight.')

  return <div ref={root} className={'bodyweight-picker' + (disabled ? ' is-disabled' : '')} data-nodrag>
    <div className="bodyweight-picker-readout" onBlurCapture={() => { setFocused(false); setInputLength(null); if (valid) setManualValue(null) }}>
      <NumberField key={shownUnit} value={fieldValue} displayValue={fieldText} nullable retainInvalid
        data-weight-value={fieldValue ?? undefined}
        validation={{ min:manualMin, max:manualMax }} decimal disabled={disabled} aria-label={label || t('Weight')}
        aria-invalid={currentInvalid || undefined} aria-describedby={currentInvalid ? errorId : hintId}
        style={{ width:`${Math.max(readoutWidth, Math.min(8, (inputLength ?? 0) + .25))}ch` }}
        onFocus={event => { flushSync(() => { if (motion.current) stopMotion(); setFocused(true) }); event.currentTarget.select() }} onInput={manualInput} onChange={edit}/>
      <span className="bodyweight-picker-unit" aria-hidden="true">{shownUnit}</span>
    </div>
    <div ref={ruler} className="bodyweight-picker-ruler" role="slider" tabIndex={disabled ? -1 : 0}
      aria-label={t('Weight ruler')} aria-valuemin={min} aria-valuemax={max} aria-valuenow={preview !== null ? fieldValue : shown}
      aria-valuetext={`${format(preview !== null ? fieldValue : shown)} ${shownUnit}`} aria-orientation="horizontal" aria-disabled={disabled || undefined}
      aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown PageUp PageDown Home End"
      aria-describedby={hintId} data-nodrag data-interaction-quiet-ms="1800"
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={cancel} onLostPointerCapture={cancel} onKeyDown={keyDown}
      onContextMenu={event => event.preventDefault()}>
      <div className="bodyweight-picker-ticks" aria-hidden="true" style={{ transform:`translate3d(${(railAnchor * 20 * step - shown) * pixelsPerUnit}px,0,0)` }}><RulerTicks anchor={railAnchor} min={min} max={max} formatter={formatter} step={step}/></div>
      <span className="bodyweight-picker-marker" aria-hidden="true"/>
    </div>
    <p id={hintId} className="bodyweight-picker-hint">{hint}</p>
    {currentInvalid && <p id={errorId} className="bodyweight-picker-error" role="alert">{t('Enter a valid weight')}</p>}
  </div>
})

export default BodyWeightPicker
