import { t } from '../lib/i18n.js'
import { isoOf } from '../lib/format.js'

export default function ReportDateRange({ value, onChange, periods, disabled, today = isoOf(new Date()) }) {
  const change = (key, next) => onChange({ ...value, [key]: next })
  return <div className="report-date-controls"><label>{t('Period')}<select className="input" disabled={disabled} value={value.period} onChange={e=>change('period',e.target.value)}>{periods.map(([id,label])=><option key={id} value={id}>{t(label)}</option>)}</select></label>{value.period==='custom'&&<><label>{t('From')}<input className="input" type="date" disabled={disabled} value={value.from} max={value.to || today} onChange={e=>change('from',e.target.value)}/></label><label>{t('To')}<input className="input" type="date" disabled={disabled} value={value.to} min={value.from} max={today} onChange={e=>change('to',e.target.value)}/></label></>}</div>
}
