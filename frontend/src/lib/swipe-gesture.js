// Presentation-only recognition. A clear vertical start belongs to scrolling;
// a small diagonal or a pause before movement is still undecided.
export function beginSwipe(x,y,at,width) {
  return {x,y,at,width,state:'pending',dx:0,dy:0,min:0,max:0,samples:[{x,at}]}
}
export function moveSwipe(g,x,y,at) {
  if(g.state==='rejected')return g.state
  const dx=x-g.x,dy=y-g.y,ax=Math.abs(dx),ay=Math.abs(dy)
  g.dx=dx;g.dy=dy;g.min=Math.min(g.min,dx);g.max=Math.max(g.max,dx)
  g.samples.push({x,at});g.samples=g.samples.filter(point=>point.at>=at-110).slice(-24)
  if(g.state==='pending') {
    if(ay>=12&&ay>=ax*1.15){g.state='rejected';return g.state}
    if(ax>=12&&ax>=ay*1.35)g.state='horizontal'
  }else if(ay>Math.max(40,ax*.9))g.state='rejected'
  return g.state
}
export function swipeStep(g,x,y,at) {
  moveSwipe(g,x,y,at)
  if(g.state!=='horizontal')return 0
  const distance=Math.abs(g.dx),samples=g.samples.filter(point=>point.at>=at-100)
  const first=samples[0],last=samples.at(-1)
  const velocity=samples.length>1&&last.at>first.at?(last.x-first.x)/(last.at-first.at):0
  // A deliberate reversal means "stay", even after a long outward drag.
  const peak=g.dx<0?-g.min:g.max
  if(velocity*g.dx<0&&Math.abs(velocity)>.22)return 0
  if(peak-distance>=Math.max(24,g.width*.06)&&distance<peak*.8)return 0
  const threshold=Math.min(96,Math.max(56,g.width*.17))
  if(distance<threshold&&!(distance>=30&&Math.abs(velocity)>=.5))return 0
  return g.dx<0?1:-1
}
export function swipeOffset(g) {
  const distance=Math.max(0,Math.abs(g.dx)-10),limit=Math.min(96,g.width*.24)
  return Math.sign(g.dx)*Math.min(Math.min(150,g.width*.38),distance<=limit?distance:limit+(distance-limit)*.22)
}
