// Measure only the space actually occupied by fixed app controls. Safe areas
// belong to CSS (or the native WebView's margins), never to guessed phone sizes.
export function installViewportLayout(win = window, doc = document) {
  const root = doc.documentElement, vv = win.visualViewport
  let frame = 0, baseline = win.innerHeight, width = win.innerWidth, observed = [], lastHeight = 0, lastFocus = null
  const set = (name, value) => { if (root.style.getPropertyValue(name) !== value) root.style.setProperty(name, value) }
  const editable = () => doc.activeElement?.matches?.('input:not([type=checkbox]):not([type=radio]):not([type=range]),textarea,[contenteditable="true"]')
  const visibleTop = el => {
    if (!el || win.getComputedStyle(el).display === 'none') return win.innerHeight
    return Math.min(el.getBoundingClientRect().top, ...[...el.children].map(child => child.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0).map(rect => rect.top))
  }
  const update = () => {
    frame = 0
    // Pinch zoom is not a keyboard. Do not resize/reposition the app under a zoom gesture.
    if (vv && Math.abs(vv.scale - 1) > .01) return
    const height = vv?.height || win.innerHeight
    if (Math.abs(win.innerWidth - width) > 1) { width = win.innerWidth; baseline = win.innerHeight }
    if (!editable()) baseline = win.innerHeight
    const keyboard = !!editable() && baseline - height > 100
    root.dataset.keyboard = String(keyboard)
    set('--visual-height', `${height}px`)
    set('--visual-top', `${vv?.offsetTop || 0}px`)
    set('--available-height', keyboard ? `${height}px` : '100dvh')
    const nav = doc.getElementById('tabbar'), timer = doc.getElementById('timer')
    const next = [nav, timer].filter(Boolean)
    if (next.length !== observed.length || next.some((el, i) => el !== observed[i])) {
      // Safe-area changes can alter padding without changing the content box.
      resize?.disconnect(); next.forEach(el => resize?.observe(el, { box: 'border-box' })); observed = next
    }
    const navSpace = Math.max(0, win.innerHeight - visibleTop(nav))
    set('--nav-clearance', `${navSpace}px`)
    // Setting nav clearance can move the timer; read its new position afterwards.
    set('--bottom-clearance', `${Math.max(navSpace, win.innerHeight - visibleTop(timer), 0)}px`)
    // Safari can shrink only the visual viewport. Scroll the focused field's
    // own container into view, without fighting later user scroll gestures.
    const focus = doc.activeElement
    if (keyboard && (height !== lastHeight || focus !== lastFocus)) {
      const rect = focus.getBoundingClientRect()
      const top = (vv?.offsetTop || 0) + (parseFloat(win.getComputedStyle(root).getPropertyValue('--sat')) || 0) + 12
      const bottom = (vv?.offsetTop || 0) + height - 12
      const delta = rect.bottom > bottom ? rect.bottom - bottom : rect.top < top ? rect.top - top : 0
      if (rect.height > 0 && Math.abs(delta) > 1) {
        let parent = focus.parentElement
        while (parent && parent !== doc.body && !(parent.scrollHeight > parent.clientHeight && /auto|scroll/.test(win.getComputedStyle(parent).overflowY))) parent = parent.parentElement
        ;(parent && parent !== doc.body ? parent : win).scrollBy({ top: delta, behavior: 'instant' })
      }
    }
    lastHeight = height; lastFocus = focus
  }
  const schedule = () => { if (!frame) frame = win.requestAnimationFrame(update) }
  const resize = win.ResizeObserver ? new win.ResizeObserver(schedule) : null
  const mutations = new win.MutationObserver(schedule)
  mutations.observe(doc.getElementById('root') || doc.body, { childList: true, subtree: true })
  win.addEventListener('resize', schedule)
  vv?.addEventListener('resize', schedule); vv?.addEventListener('scroll', schedule)
  doc.addEventListener('focusin', schedule); doc.addEventListener('focusout', schedule)
  update()
  return () => {
    win.cancelAnimationFrame(frame); resize?.disconnect(); mutations.disconnect()
    win.removeEventListener('resize', schedule)
    vv?.removeEventListener('resize', schedule); vv?.removeEventListener('scroll', schedule)
    doc.removeEventListener('focusin', schedule); doc.removeEventListener('focusout', schedule)
    delete root.dataset.keyboard
    for (const name of ['--visual-height', '--visual-top', '--available-height', '--nav-clearance', '--bottom-clearance']) root.style.removeProperty(name)
  }
}
