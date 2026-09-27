import BodyMap from './BodyMap.jsx'
import { CHANGE_STYLES, measurementChange, measurementPosition } from '../lib/measurement-map.js'
import { fmtNum } from '../lib/format.js'
import { t } from '../lib/i18n.js'

export default function MeasurementBodyMap({metrics,selected,onSelect,body='male'}) {
  return <div className="measurement-map">
    <BodyMap body={body} frontOnly label={t('Body measurements')} renderOverlay={view=>metrics.map(m=>{
      const [x,y]=measurementPosition(m.key,view.vb,body),style=CHANGE_STYLES[measurementChange(m)]
      return <g key={m.key} role="button" tabIndex="0" aria-pressed={selected===m.key} aria-label={`${t(m.label)}: ${m.last==null?'—':fmtNum(m.last)+' '+t(m.unit)} · ${t(style.label)}`} onClick={()=>onSelect(m.key)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(m.key)}}}>
        <title>{t(m.label)}</title><circle cx={x} cy={y} r="40" fill="transparent"/><circle cx={x} cy={y} r="25" fill="var(--surface)" stroke={selected===m.key?'var(--acc)':style.color} strokeWidth={selected===m.key?8:4}/><text x={x} y={y+10} textAnchor="middle" fontSize="29" fontWeight="700" fill={style.color}>{style.symbol}</text>
      </g>
    })}/>
    <div className="measurement-legend">{Object.entries(CHANGE_STYLES).map(([key,s])=><span key={key}><b style={{color:s.color}}>{s.symbol}</b> {t(s.label)}</span>)}</div>
  </div>
}
