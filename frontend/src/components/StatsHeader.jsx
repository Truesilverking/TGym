import {useStore} from '../store/useStore.js'
import {useUI} from '../store/useUI.js'
import {t} from '../lib/i18n.js'
import {nav} from '../lib/nav.js'
import {MOBILE} from '../lib/mobile.js'
import {inBodySheet} from '../sheets.jsx'
import ReportsExport from './ReportsExport.jsx'
import Icon from './Icon.jsx'

export default function StatsHeader({state,filters,body=false}) {
  const live=useStore(s=>s.S),S=state||live
  return <div className="hdr stats-header"><div><h1>{t(body?'Body':'Stats')}</h1><div className="sub">{t(body?'Weight, measurements and composition':'Progress & history')}</div></div>
    <div className="row stats-header-actions" data-tour="stats-actions" style={{gap:3}}>
      <button className="iconbtn" onClick={()=>useUI.getState().openSheet(close=><ReportsExport S={S} pdf statsFilters={filters?.()||{}} close={close}/>)} aria-label={t('Export Reports')} title={t('Export Reports')}><Icon name="download"/></button>
      {!MOBILE&&<button className="iconbtn" onClick={()=>window.print()} aria-label={t('Print / Save as PDF')} title={t('Print / Save as PDF')}><Icon name="clipboard"/></button>}
      <button className="iconbtn" onClick={()=>nav('/progress')} aria-label={t('Progress Report')} title={t('Progress Report')}><Icon name="chart"/></button>
      <button className="iconbtn" data-tour="history" onClick={()=>nav('/history')} aria-label={t('History')} title={t('History')}><Icon name="history"/></button>
      <button className="iconbtn" data-tour="inbody" onClick={inBodySheet} aria-label={t('InBody history')} title={t('InBody history')}><Icon name="person"/></button>
    </div>
  </div>
}
