// Presentation-only recognition: vertical/ambiguous starts never become page
// navigation later in the same contact.
export function beginSwipe(x,y,at,width) {
  return {x,y,at,width,state:'pending',dx:0,dy:0,min:0,max:0,samples:[{x,at}]}
}
export function moveSwipe(g,x,y,at) {
  if(g.state==='rejected')return g.state
  const dx=x-g.x,dy=y-g.y,ax=Math.abs(dx),ay=Math.abs(dy)
  g.dx=dx;g.dy=dy;g.min=Math.min(g.min,dx);g.max=Math.max(g.max,dx)
  g.samples.push({x,at});g.samples=g.samples.filter(point=>point.at>=at-110).slice(-24)
  if(g.state==='pending') {
    if(at-g.at>500){g.state='rejected';return g.state}
    if(ay>=10&&ay>=ax/1.2){g.state='rejected';return g.state}
    if(ax>=14&&ax>=ay*1.6)g.state='horizontal'
    else if(Math.max(ax,ay)>=24)g.state='rejected'
  }else if(ay>Math.max(40,ax*.9))g.state='rejected'
  return g.state
}
export function swipeStep(g,x,y,at) {
  if(g.state!=='horizontal')return 0
  moveSwipe(g,x,y,at)
  if(g.state!=='horizontal')return 0
  const distance=Math.abs(g.dx),samples=g.samples.filter(point=>point.at>=at-100)
  const first=samples[0],last=samples.at(-1)
  const velocity=samples.length>1&&last.at>first.at?(last.x-first.x)/(last.at-first.at):0
  // A deliberate reversal means "stay", even after a long outward drag.
  const peak=g.dx<0?-g.min:g.max
  if(velocity*g.dx<0&&Math.abs(velocity)>.22)return 0
  if(peak-distance>=Math.max(24,g.width*.06)&&distance<peak*.8)return 0
  const threshold=Math.min(108,Math.max(64,g.width*.2))
  if(distance<threshold&&!(distance>=32&&Math.abs(velocity)>=.5))return 0
  return g.dx<0?1:-1
}
export function swipeOffset(g) {
  const distance=Math.max(0,Math.abs(g.dx)-10),limit=Math.min(96,g.width*.24)
  return Math.sign(g.dx)*Math.min(Math.min(150,g.width*.38),distance<=limit?distance:limit+(distance-limit)*.22)
}
