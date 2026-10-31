import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { fmtWeight } from '../lib/format.js'
import { weightStepFor } from '../lib/unit-conversion.js'
import { BAR_WEIGHTS, PLATE_SETS, platesPerSide, groupPlates, plateColor } from '../lib/plates.js'
import { Stepper, Segmented, Button } from './ui.jsx'

// Plates are drawn to scale against each other: every bumper shares the full diameter and
// differs in thickness; change plates shrink. Colours follow calibrated plates.
const plateShape = (plate, unit) => {
  const kg = unit === 'lb' ? plate / 2.2046 : plate
  const height = kg >= 10 ? 100 : kg >= 5 ? 72 : kg >= 2.5 ? 58 : kg >= 1.25 ? 48 : 40
  const width = Math.max(7, Math.round(6 + kg * 0.7))
  return { height: height + '%', width }
}

export default function PlateCalculator({ initialWeight, close }) {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const unit = S.unit === 'lb' ? 'lb' : 'kg'
  const bars = BAR_WEIGHTS[unit]
  const [target, setTarget] = useState(initialWeight > 0 ? initialWeight : unit === 'lb' ? 135 : 60)
  const [bar, setBarState] = useState(bars.includes(S.plateBar?.[unit]) ? S.plateBar[unit] : bars[0])
  const setBar = value => { setBarState(value); update(s => { s.plateBar = { ...(s.plateBar || {}), [unit]: value } }) }
  const result = platesPerSide(target, { unit, bar, plates: PLATE_SETS[unit] })
  const groups = groupPlates(result.perSide)

  return <div className="plate-calc">
    <h3>{t('Plate calculator')}</h3>
    <Stepper label={t('Total weight ({0})', unit)} value={target} displayValue={fmtWeight(target)} step={weightStepFor(unit)} onChange={setTarget} unit={unit} className="plate-target" />
    <div className="field-label" style={{ marginTop: 14 }}>{t('Bar')}</div>
    <Segmented value={bar} onChange={setBar} options={bars.map(b => ({ value: b, label: `${fmtWeight(b)} ${unit}` }))} />

    <div className="plate-bar" role="img" aria-label={result.perSide.length ? t('{0} per side', result.perSide.map(p => fmtWeight(p)).join(' + ') + ' ' + unit) : t('Empty bar')}>
      <span className="plate-sleeve" />
      <span className="plate-collar" />
      {result.perSide.map((plate, i) => {
        const shape = plateShape(plate, unit)
        return <span key={i} className={'plate-disc plate-' + plateColor(plate, unit)} style={{ height: shape.height, width: shape.width }}>
          {shape.width >= 14 && <b>{fmtWeight(plate)}</b>}
        </span>
      })}
      <span className="plate-sleeve end" />
    </div>

    {result.invalid ? <p className="plate-note warn">{t('Enter a valid load.')}</p> : result.belowBar ? <p className="plate-note warn">{t('That is lighter than the bar ({0} {1}).', fmtWeight(bar), unit)}</p>
      : groups.length ? <>
        <div className="field-label">{t('Each side')}</div>
        <div className="plate-list">
          {groups.map(g => <span key={g.plate} className="plate-chip"><i className={'plate-' + plateColor(g.plate, unit)} />{g.count} × {fmtWeight(g.plate)} {unit}</span>)}
        </div>
      </> : <p className="plate-note">{t('Just the bar.')}</p>}
    {result.remainder > 0 && !result.belowBar && <p className="plate-note warn">{t('Closest load: {0} {1}. These plates cannot make the last {2} {1}.', fmtWeight(result.achieved), unit, fmtWeight(result.remainder))}</p>}

    <div style={{ height: 14 }} />
    <Button onClick={close}>{t('Done')}</Button>
  </div>
}
