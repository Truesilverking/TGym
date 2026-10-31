import { t } from '../lib/i18n.js'
import { parseMetrics } from '../lib/body-records.js'
import WeightField from './WeightField.jsx'
export default function MetricFields({ groups, values, onChange, prefix = 'metric' }) {
  return groups.map(([title, fields]) => <fieldset className="metric-group" key={title}><legend>{t(title)}</legend><div className="metric-fields">{fields.map(([key,label,unit]) => {
    const invalid = parseMetrics({[key]:values[key]},[[key]]) == null
    if (unit === 'kg' || unit === 'lb') {
      const raw = values[key]
      const numeric = raw == null || String(raw).trim() === '' ? null : Number(String(raw).replace(',', '.'))
      return <div id={prefix+'-'+key} key={key}><WeightField showLabel label={t(label)} unit={unit} value={Number.isFinite(numeric) ? numeric : raw ?? null}
        nullable min={0.01} precision={2} step={0.1} aria-invalid={invalid || undefined} placeholder="—"
        onInput={event=>onChange({...values,[key]:event.currentTarget.value})}
        onChange={value=>onChange({...values,[key]:value})} />{invalid && <small className="metric-error">{t('Enter a positive number.')}</small>}</div>
    }
    return <label id={prefix+'-'+key} key={key}><span>{t(label)} {unit && <small>({unit})</small>}</span><input className="input" inputMode="decimal" aria-invalid={invalid || undefined} value={values[key] ?? ''} placeholder="—" onChange={e=>onChange({...values,[key]:e.target.value})} />{invalid && <small className="metric-error">{t(['bodyFatPct','score'].includes(key) ? 'Enter a value above 0 and up to 100.' : 'Enter a positive number.')}</small>}</label>
  })}</div></fieldset>)
}
