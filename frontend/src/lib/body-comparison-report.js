import { MUSCLES, INERT } from './muscles.js'
import { measurementCalloutSlots, measurementPosition, measurementChange, CHANGE_STYLES } from './measurement-map.js'
import { measurementNumber } from './measurement-display.js'

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]))
const text = (x, y, value, size = 17, color = '#17212f', weight = 400, extra = '') => `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}" ${extra}>${esc(value)}</text>`
const compactDate = value => value?.split('-').reverse().map((part,index) => index === 2 ? part.slice(-2) : part).join('/') || '—'

// The same front-view geometry and external leaders as the app. Values remain
// a separate before/after table, so missing readings cannot look like zero.
export function bodyComparisonReportPanel(geometry, body, comparison, { t = value => value, formatNumber = measurementNumber } = {}) {
  const metrics = comparison.metrics, height = Math.max(480, 164 + metrics.length * 29)
  const value = number => number == null ? '—' : formatNumber(number)
  const view = (geometry?.[body] || geometry?.male)?.front
  let svg = `<rect x="44" y="0" width="912" height="${height}" rx="14" fill="white" stroke="#dce2e9"/>`
  if (view) {
    const [vx,vy,vw,vh] = view.vb.split(' ').map(Number), scale = Math.min(212/vw,400/vh), x = 113, y = 55
    const shapes = [...INERT,...MUSCLES].flatMap(key => (view.p[key] || []).map(d => `<path d="${esc(d)}" fill="${INERT.includes(key)?'#9da6b2':'#cbd3de'}" stroke="white" stroke-width="2.5"/>`)).join('')
    svg += `<svg data-body-comparison-model="current" x="${x}" y="${y}" width="212" height="400" viewBox="${view.vb}">${shapes}</svg>`
    const {slots,rows} = measurementCalloutSlots(metrics)
    for (const {metric,side,row} of slots) {
      const [ax,ay] = measurementPosition(metric.key,view.vb,body), cx=x+106+(ax-vx-vw/2)*scale, cy=y+200+(ay-vy-vh/2)*scale
      const lx=side==='left'?75:338, ly=72+(row-1)*Math.min(49,340/Math.max(1,rows-1)), color=CHANGE_STYLES[measurementChange(metric)].color
      svg += `<polyline points="${cx},${cy} ${side==='left'?98:319},${ly} ${lx},${ly}" fill="none" stroke="${color}" stroke-width="1.3"/>` + text(lx,ly-5,value(metric.last),14,color,600,`text-anchor="${side==='left'?'start':'end'}"`)
    }
  }
  svg += text(367,31,t('Body measurements'),21,'#17212f',700)
  svg += text(367,59,t('Before')+': '+compactDate(comparison.before?.d)+'  →  '+t('After')+': '+compactDate(comparison.after?.d),16,'#536174')
  const columns=[367,645,747,848]
  ;[t('Measurement'),t('Before'),t('After'),t('Change')].forEach((label,index)=>{svg+=text(columns[index],91,label,14,'#536174',600)})
  metrics.forEach((metric,index)=>{
    const y=116+index*29, change=measurementChange(metric), delta=metric.delta
    svg += `<g data-measurement="${esc(metric.key)}" data-before="${esc(metric.first ?? '')}" data-after="${esc(metric.last ?? '')}" data-unit="${esc(metric.unit)}"><path d="M367 ${y+9}H930" stroke="#edf0f4"/>`
    svg += text(columns[0],y,t(metric.label),16) + text(columns[1],y,value(metric.first),17) + text(columns[2],y,value(metric.last),17,'#17212f',700)
    svg += text(columns[3],y,delta==null?'—':(delta>0?'+':'')+value(delta),17,CHANGE_STYLES[change].color,600) + '</g>'
  })
  svg += text(367,height-21,t('Unit')+': '+(metrics[0]?.unit||'cm')+' · '+t('Records')+': '+comparison.count,15,'#536174')
  if (metrics.some(metric => metric.delta == null)) svg += text(367,height-43,'— '+t('More data needed'),14,'#536174')
  return { height:height+12, draw:top=>`<g data-body-comparison="compact" transform="translate(0 ${top})">${svg}</g>` }
}
