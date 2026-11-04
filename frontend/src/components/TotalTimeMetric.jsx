import { useEffect, useRef, useState } from 'react'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { dateLocale } from '../lib/i18n-core.js'
import Icon from './Icon.jsx'
import './TotalTimeMetric.css'

export function totalTimePresentation(minutes, preference = 'auto') {
  const amount = Number.isFinite(minutes) && minutes > 0 ? minutes : 0
  const unit = ['minutes', 'hours', 'days'].includes(preference) ? preference : amount < 60 ? 'minutes' : amount < 1440 ? 'hours' : 'days'
  return { unit, value: amount / (unit === 'days' ? 1440 : unit === 'hours' ? 60 : 1) }
}

const labels = { minutes: 'Minutes', hours: 'Hours', days: 'Days' }

// The shared activity summary supplies elapsed minutes. This component changes
// only the displayed unit, never the underlying workout or duration calculation.
export default function TotalTimeMetric({ minutes }) {
  const [preference, setPreference] = useState('auto')
  const press = useRef(null), timer = useRef(0), picker = useRef(null)
  const shown = totalTimePresentation(minutes, preference)
  const cancel = () => { clearTimeout(timer.current); timer.current = 0; press.current = null }
  const open = () => {
    cancel()
    if (picker.current) return
    picker.current = useUI.getState().openSheet(close => <div className="total-time-picker">
      <h3>{t('Time unit')}</h3>
      <div className="sect-b">{[['auto', 'Automatic'], ...Object.entries(labels)].map(([value, label]) => <button type="button" key={value}
        className="lrow tap" aria-pressed={preference === value} onClick={() => { setPreference(value); close() }}>
        <span className="lrow-m"><span className="lrow-t">{t(label)}</span></span>{preference === value && <Icon name="check" />}
      </button>)}</div>
    </div>, { onClose: () => { picker.current = null } })
  }
  useEffect(() => {
    const hidden = () => { if (document.hidden) cancel() }
    document.addEventListener('scroll', cancel, true)
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('blur', cancel)
    window.addEventListener('pointerup', cancel)
    window.addEventListener('pointercancel', cancel)
    return () => {
      cancel(); picker.current?.close()
      document.removeEventListener('scroll', cancel, true)
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('blur', cancel)
      window.removeEventListener('pointerup', cancel)
      window.removeEventListener('pointercancel', cancel)
    }
  }, [])
  const start = event => {
    cancel()
    if (event.button !== 0 || event.isPrimary === false) return
    press.current = { x: event.clientX, y: event.clientY }
    timer.current = setTimeout(open, 3000)
  }
  const move = event => {
    if (press.current && Math.hypot(event.clientX - press.current.x, event.clientY - press.current.y) > 8) cancel()
  }
  const hint = t('Hold for 3 seconds or press Enter to choose time units.')
  const number = new Intl.NumberFormat(dateLocale(), shown.value > 0 && shown.value < .1 ? {maximumSignificantDigits:2} : {maximumFractionDigits:1}).format(shown.value)
  return <button type="button" className="total-time-metric" data-time-unit={shown.unit} aria-haspopup="dialog" title={hint}
    aria-label={`${t('Total time')}: ${number} ${t(labels[shown.unit])}. ${hint}`}
    onPointerDown={start} onPointerMove={move} onPointerUp={cancel} onPointerLeave={cancel} onPointerCancel={cancel}
    onTouchCancel={cancel} onContextMenu={event => event.preventDefault()} onClick={event => { if (event.detail === 0) open() }}>
    <small>{t('Total time')} <span>({t(labels[shown.unit])})</span></small><b>{number}</b>
  </button>
}
