import { MUSCLES, INERT } from './muscles.js'
// Positions are fractions of the existing front-view artwork, not new anatomy.
export const MEASUREMENT_ZONES={neck:[.5,.145],shoulders:[.68,.21],chest:[.5,.255],waist:[.5,.39],hips:[.5,.45],armLeft:[.76,.31],armRight:[.24,.31],forearmLeft:[.84,.435],forearmRight:[.16,.435],thighLeft:[.605,.59],thighRight:[.395,.59],calfLeft:[.61,.79],calfRight:[.39,.79]}
export const CHANGE_STYLES={increase:{symbol:'↑',label:'Increasing',color:'#bb5712'},decrease:{symbol:'↓',label:'Decreasing',color:'#2878d0'},stable:{symbol:'=',label:'Stable',color:'#687587'},unknown:{symbol:'·',label:'Insufficient Data',color:'#687587'}}
export function measurementChange(metric) {
  if(metric.delta==null)return 'unknown'
  const threshold=metric.unit==='in'?.1/2.54:.1
  return Math.abs(metric.delta)<threshold?'stable':metric.delta>0?'increase':'decrease'
}
export function measurementPosition(key,viewBox,body='male') {
  const [x,y,w,h]=viewBox.split(' ').map(Number),[px,py]=MEASUREMENT_ZONES[key]
  return [x+px*w,y+(body==='female'?py*.95+.025:py)*h]
}

export function measurementMapSvg(geometry,body,metrics) {
  const view=(geometry?.[body]||geometry?.male)?.front
  if(!view)return ''
  const shapes=[...INERT,...MUSCLES].flatMap(key=>(view.p[key]||[]).map(d=>`<path d="${d}" fill="${INERT.includes(key)?'#b8bec6':'#dce2e9'}" stroke="white" stroke-width="2.5"/>`)).join('')
  const marks=metrics.map(m=>{const [x,y]=measurementPosition(m.key,view.vb,body),style=CHANGE_STYLES[measurementChange(m)];return `<circle cx="${x}" cy="${y}" r="26" fill="white" stroke="${style.color}" stroke-width="4"/><text x="${x}" y="${y+10}" text-anchor="middle" font-family="Arial" font-size="30" font-weight="700" fill="${style.color}">${style.symbol}</text>`}).join('')
  return `<svg x="58" y="0" width="270" height="360" viewBox="${view.vb}">${shapes}${marks}</svg>`
}
