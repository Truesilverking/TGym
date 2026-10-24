import { t } from '../lib/i18n.js'
import { parseMetrics } from '../lib/body-records.js'
export default function MetricFields({ groups, values, onChange, prefix = 'metric' }) {
  return groups.map(([title, fields]) => <fieldset className="metric-group" key={title}><legend>{t(title)}</legend><div className="metric-fields">{fields.map(([key,label,unit]) => {
    const invalid = parseMetrics({[key]:values[key]},[[key]]) == null
    return <label id={prefix+'-'+key} key={key}><span>{t(label)} {unit && <small>({unit})</small>}</span><input className="input" inputMode="decimal" aria-invalid={invalid || undefined} value={values[key] ?? ''} placeholder="—" onChange={e=>onChange({...values,[key]:e.target.value})} />{invalid && <small className="metric-error">{t(['bodyFatPct','score'].includes(key) ? 'Enter a value above 0 and up to 100.' : 'Enter a positive number.')}</small>}</label>
  })}</div></fieldset>)
}
