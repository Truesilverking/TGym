// A short-lived, inert DOM picture, never a second mounted React page. Retained
// pages keep their drafts while their hidden Activity effects remain suspended.
let serial = 0
export function motionSnapshot(source) {
  if (!source) return null
  const originals=[],copies=[]
  const visibleCopy=node=>{
    if(node.nodeType!==1)return node.cloneNode(false)
    // Do not even copy retained inactive pages/maps. Their DOM can be large,
    // and the picture only needs the visible page at the moment of release.
    if(node!==source&&(node.hasAttribute('hidden')||node.inert||node.style.display==='none'))return null
    if(node.matches('script,iframe'))return null
    const copy=node.cloneNode(false);originals.push(node);copies.push(copy)
    for(const child of node.childNodes){const next=visibleCopy(child);if(next)copy.append(next)}
    return copy
  }
  const clone=visibleCopy(source)
  if(!clone)return null
  const prefix=`motion-${++serial}-`,svgIds=new Map(originals.filter(node=>node.namespaceURI==='http://www.w3.org/2000/svg'&&node.id).map(node=>[node.id,prefix+node.id]))
  originals.forEach((node, index) => {
    const copy = copies[index]
    if (node.tagName === 'INPUT') {
      if(node.type!=='file')copy.value = node.type === 'password' ? '' : node.value
      if(node.type==='password')copy.removeAttribute('value')
      copy.checked = node.checked
    } else if (node.tagName === 'TEXTAREA' || node.tagName === 'SELECT') copy.value = node.value
    if (node.tagName === 'CANVAS') {
      try { copy.getContext('2d')?.drawImage(node, 0, 0) } catch { /* optional visual only */ }
    }
    if(node.namespaceURI==='http://www.w3.org/2000/svg'&&svgIds.has(node.id))copy.id=svgIds.get(node.id)
    else copy.removeAttribute('id')
    for(const attr of [...copy.attributes]){
      let value=attr.value
      for(const [id,replacement] of svgIds){
        if(value==='#'+id)value='#'+replacement
        for(const quote of ['',"'",'"'])value=value.replaceAll(`url(${quote}#${id}${quote})`,`url(${quote}#${replacement}${quote})`)
      }
      if(value!==attr.value)copy.setAttributeNS(attr.namespaceURI,attr.name,value)
    }
    copy.removeAttribute('name'); copy.removeAttribute('for')
    copy.removeAttribute('data-app-pane'); copy.removeAttribute('data-tour')
    copy.removeAttribute('data-stats-motion')
    if (copy.matches('video,audio')) { copy.removeAttribute('autoplay'); copy.removeAttribute('src'); copy.querySelectorAll('source').forEach(item => item.remove()) }
  })
  clone.removeAttribute('data-page-motion')
  clone.setAttribute('aria-hidden', 'true'); clone.inert = true
  clone.style.pointerEvents = 'none'
  return clone
}
