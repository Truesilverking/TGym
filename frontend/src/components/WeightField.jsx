import { useEffect, useId, useRef, useState } from 'react'
import BodyWeightPicker from './BodyWeightPicker.jsx'
import Icon from './Icon.jsx'
import { Button, NumberField } from './ui.jsx'
import { t } from '../lib/i18n.js'
import { useUI } from '../store/useUI.js'
import './WeightField.css'

const finite = value => typeof value === 'number' && Number.isFinite(value)
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

function WeightEditor({ snapshot, current, close }) {
  const [draft, setDraft] = useState(snapshot.value)
  const [valid, setValid] = useState(false)
  const [error, setError] = useState(false)
  const picker = useRef(null), confirmed = useRef(false)
  const confirm = (clear = false) => {
    if (confirmed.current || !snapshot.matches(current.current)) { close(); return }
    const entered = clear && snapshot.nullable ? null : picker.current?.getValue()
    if (entered == null ? !snapshot.nullable || !clear : !finite(entered)) return
    confirmed.current = true
    try { current.current.onChange(entered); close() }
    catch { confirmed.current = false; setError(true) }
  }
  return <div className="weight-field-editor">
    <h2>{snapshot.title || snapshot.label || t('Weight')}</h2>
    <BodyWeightPicker ref={picker} value={draft} unit={snapshot.unit} min={snapshot.min} max={snapshot.max}
      step={snapshot.step} precision={snapshot.precision} label={snapshot.label}
      onChange={setDraft} onValidityChange={setValid}/>
    {error && <p className="bodyweight-picker-error" role="alert">{t('Could not save. Check available storage and try again.')}</p>}
    <div className="weight-field-actions" data-nodrag>
      {snapshot.nullable && <Button variant="ghost" onClick={() => confirm(true)}>{t('Clear')}</Button>}
      <Button variant="tinted" onClick={close}>{t('Cancel')}</Button>
      <Button variant="primary" onClick={() => confirm()} disabled={!valid}>{t('Done')}</Button>
    </div>
  </div>
}

// Values stay in the caller's unit and storage model. The sheet owns an isolated
// draft; only its explicit confirmation calls the normal persisted field setter.
export default function WeightField({ value, onChange, unit = 'kg', min = 0, max = Number.MAX_SAFE_INTEGER,
  step = .1, precision = 6, nullable = false, label, title, id, disabled = false, contextKey,
  showLabel = false, className = '', displayValue, ...inputProps }) {
  const generatedId = useId()
  const fieldId = id || generatedId
  const open = useRef(null)
  const current = useRef(null)
  current.current = { value, onChange, unit, min, max, step, precision, nullable, disabled, contextKey }
  const matches = snapshot => !current.current.disabled && ['value','unit','min','max','step','precision','nullable','contextKey'].every(key => Object.is(snapshot[key], current.current[key]))
  useEffect(() => {
    if (open.current && !matches(open.current.snapshot)) open.current.handle.close()
  }, [value, unit, min, max, step, precision, nullable, disabled, contextKey])
  useEffect(() => () => open.current?.handle.close(), [])

  const openPicker = () => {
    if (disabled || open.current) return
    const snapshot = { ...current.current, label:inputProps['aria-label'] || label, title }
    snapshot.matches = latest => !latest.disabled && ['value','unit','min','max','step','precision','nullable','contextKey'].every(key => Object.is(snapshot[key], latest[key]))
    const handle = useUI.getState().openSheet(close => <WeightEditor snapshot={snapshot} current={current} close={close}/>, {
      onClose:() => { if (open.current?.snapshot === snapshot) open.current = null },
    })
    open.current = { snapshot, handle }
  }
  const adjust = direction => {
    if (disabled) return
    const increment = finite(step) && step > 0 ? step : .1
    // Remove arithmetic noise without imposing a loading grid on manual input.
    const next = Number(((finite(value) ? value : 0) + direction * increment).toPrecision(15))
    onChange(clamp(next, min, max))
  }
  const name = inputProps['aria-label'] || label || t('Weight')
  return <div className={'weight-field-wrap' + (showLabel ? ' stp-w' : '')}>
    {showLabel && label && <label className="stp-l" htmlFor={fieldId}>{label}</label>}
    <div className={'stp weight-field ' + className} data-nodrag>
      <button type="button" disabled={disabled} onClick={() => adjust(-1)} aria-label={t('Decrease')}><Icon name="minus"/></button>
      <span className="val">
        <NumberField {...inputProps} id={fieldId} value={value} displayValue={displayValue} nullable={nullable}
          decimal retainInvalid disabled={disabled} aria-label={name} validation={{ min, max }}
          onChange={next => { if (!disabled) onChange(next) }}/>
        {unit && <i>{unit}</i>}
      </span>
      <button type="button" disabled={disabled} onClick={() => adjust(1)} aria-label={t('Increase')}><Icon name="plus"/></button>
      <button type="button" className="weight-field-open" disabled={disabled} onClick={openPicker}
        aria-label={`${t('Weight ruler')}: ${name}`} aria-haspopup="dialog" data-unit={unit}><Icon name="scale"/></button>
    </div>
  </div>
}
