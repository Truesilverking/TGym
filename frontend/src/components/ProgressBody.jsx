import { useState } from 'react'
import { compareBody, BODY_PATH, BODY_ZONES } from '../lib/body-report.js'
import { t } from '../lib/i18n.js'
import { fmtDate, fmtNum } from '../lib/format.js'

const val=(n,u)=>n==null?'—':`${fmtNum(n)} ${t(u)}`
const delta=m=>m.delta==null?t('More data needed'):`${m.delta>0?'+':''}${val(m.delta,m.unit)} · ${m.percent>0?'+':''}${fmtNum(m.percent)}%`
export default function ProgressBody({records,selection,onSelection,disabled=false}) {
  const c=compareBody(records,selection.before,selection.after),[zone,setZone]=useState('')
  const selected=c.metrics.find(m=>m.key===zone)||c.metrics[0]
  if(!records.length)return <p className="empty">{t('No comparable history in this period.')}</p>
  return <div className="progress-body">
    <div className="progress-controls body-dates">
      <label>{t('Before')}<select className="input" disabled={disabled} value={c.before.id} onChange={e=>onSelection({before:e.target.value,after:c.after.id})}>{records.filter(r=>r.d<=c.after.d).map(r=><option key={r.id} value={r.id}>{fmtDate(r.d,false,true)} · {records.indexOf(r)+1}</option>)}</select></label>
      <label>{t('After')}<select className="input" disabled={disabled} value={c.after.id} onChange={e=>onSelection({before:c.before.id,after:e.target.value})}>{records.filter(r=>r.d>=c.before.d).map(r=><option key={r.id} value={r.id}>{fmtDate(r.d,false,true)} · {records.indexOf(r)+1}</option>)}</select></label>
    </div>
    <p className="small dim">{t('Select a body zone to compare its recorded measurements.')}</p>
    <div className="body-dashboard">
      <svg className="body-model" viewBox="40 0 220 400" role="group" aria-label={t('Body measurements')}>
        <path d={BODY_PATH} fill="var(--acc)" fillOpacity=".12" stroke="var(--acc)" strokeWidth="1.5"/>
        {c.metrics.map((m,i)=>{const [x,y]=BODY_ZONES[m.key];return <g key={m.key} role="button" tabIndex="0" aria-label={`${t(m.label)}: ${val(m.last,m.unit)}`} aria-pressed={selected?.key===m.key} onClick={()=>setZone(m.key)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setZone(m.key)}}}><title>{t(m.label)} · {val(m.last,m.unit)}</title><circle cx={x} cy={y} r="15" fill={selected?.key===m.key?'var(--acc)':'var(--surface)'} stroke="var(--acc)" strokeWidth="2"/><text x={x} y={y+4} textAnchor="middle" fontSize="11" fill={selected?.key===m.key?'var(--on-acc,white)':'var(--label)'}>{i+1}</text></g>})}
      </svg>
      <div className="body-zone-list" aria-label={t('Body measurements')}>{c.metrics.map((m,i)=><button type="button" key={m.key} className="body-zone" aria-pressed={selected?.key===m.key} onClick={()=>setZone(m.key)}><span><small>{i+1}</small>{t(m.label)}</span><b>{val(m.last,m.unit)}</b></button>)}</div>
    </div>
    {selected&&<article className="progress-metric body-detail" aria-live="polite"><h3>{t(selected.label)}</h3><div className="progress-values"><div><small>{t('Before')}</small><b>{val(selected.first,selected.unit)}</b><time>{fmtDate(c.before.d,false,true)}</time></div><span>→</span><div><small>{t('After')}</small><b>{val(selected.last,selected.unit)}</b><time>{fmtDate(c.after.d,false,true)}</time></div></div><p className="progress-change">{delta(selected)}</p></article>}
    <div className="progress-summary body-stats">
      {[[t('First record'),fmtDate(records[0].d,false,true)],[t('Current record'),fmtDate(c.after.d,false,true)],[t('Records'),fmtNum(c.count)],[t('Elapsed days'),c.days==null?'—':fmtNum(c.days)]].map(([label,v])=><div key={label}><b>{v}</b><span>{label}</span></div>)}
    </div>
    <dl className="body-changes">{[[t('Largest increase'),c.increase],[t('Largest decrease'),c.decrease]].map(([label,m])=><div key={label}><dt>{label}</dt><dd>{m?`${t(m.label)} · ${delta(m)}`:'—'}</dd></div>)}<div><dt>{t('No significant change')}</dt><dd>{c.stable.length?c.stable.map(m=>t(m.label)).join(', '):'—'}</dd></div></dl>
    <p className="small dim">{t('Changes below 0.1 cm are treated as unchanged. Missing values are not zero.')}</p>
  </div>
}
