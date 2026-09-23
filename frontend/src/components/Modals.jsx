import { useEffect, useRef, useId } from 'react'
import { useUI } from '../store/useUI.js'
import Icon from './Icon.jsx'
import { t } from '../lib/i18n.js'

// One bottom sheet (or centered dialog) with swipe-to-dismiss.
function Sheet({ sheet, active }) {
  const { closeSheet } = useUI()
  const ref = useRef(null)
  const panel = useRef(null)
  const titleId = useId()
  const opener = useRef(null)
  useEffect(() => {
    if (!active || !panel.current) return
    const el = panel.current
    opener.current ||= document.activeElement
    const previous = opener.current
    const heading = el.querySelector('h1,h2,h3')
    if (heading) { heading.id ||= titleId; el.setAttribute('aria-labelledby', heading.id) }
    if (!el.contains(document.activeElement)) el.focus()
    const trap = e => {
      if (e.key !== 'Tab') return
      const controls = [...el.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')]
        .filter(node => node.getClientRects().length && !node.closest('[hidden],[inert]'))
      const first = controls[0], last = controls.at(-1)
      if (!first) { e.preventDefault(); el.focus(); return }
      if (e.shiftKey && (document.activeElement === first || document.activeElement === el)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && (document.activeElement === last || document.activeElement === el)) { e.preventDefault(); first.focus() }
    }
    el.addEventListener('keydown', trap)
    return () => { el.removeEventListener('keydown', trap); queueMicrotask(() => { if (previous?.isConnected && !previous.closest?.('[inert]')) previous.focus?.() }) }
  }, [active, titleId])
  const drag = useRef({ startY: null, delta: 0 })

  const onTouchStart = e => {
    const el = ref.current
    // a gesture that begins on a slider (or opted-out control) belongs to that control,
    // not to the sheet's swipe-to-dismiss — so it keeps working while you drag
    if (e.target.closest && e.target.closest('input[type=range], [data-nodrag]')) {
      drag.current = { startY: null, delta: 0 }
      return
    }
    drag.current = { startY: el.scrollTop <= 0 ? e.touches[0].clientY : null, delta: 0 }
  }
  const onTouchMove = e => {
    const el = ref.current, d = drag.current
    if (d.startY === null) return
    d.delta = e.touches[0].clientY - d.startY
    if (d.delta > 0 && el.scrollTop <= 0) {
      e.preventDefault()
      el.style.transition = 'none'
      el.style.transform = `translateY(${d.delta}px)`
    } else d.delta = 0
  }
  const onTouchEnd = () => {
    const el = ref.current, d = drag.current
    if (d.startY === null) return
    el.style.transition = 'transform .2s'
    if (d.delta > 90 && !sheet.locked) { el.style.transform = 'translateY(110%)'; setTimeout(() => closeSheet(sheet.id), 180) }
    else el.style.transform = ''
    d.startY = null
  }
  // Mouse drag (desktop testing / trackpads): same swipe-to-dismiss behaviour.
  const onMouseDown = e => {
    if (e.button !== 0) return
    if (e.target.closest && e.target.closest('input[type=range], [data-nodrag]')) {
      drag.current = { startY: null, delta: 0 }
      return
    }
    const el = ref.current
    drag.current = { startY: el.scrollTop <= 0 ? e.clientY : null, delta: 0 }
  }
  const onMouseMove = e => {
    const el = ref.current, d = drag.current
    if (d.startY === null) return
    d.delta = e.clientY - d.startY
    if (d.delta > 0 && el.scrollTop <= 0) {
      e.preventDefault()
      el.style.transition = 'none'
      el.style.transform = `translateY(${d.delta}px)`
    } else d.delta = 0
  }
  const onMouseUp = () => onTouchEnd()

  // non-passive touchmove so preventDefault works (bottom sheets only; centered dialogs have no ref)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      el.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  const close = () => closeSheet(sheet.id)
  const toolbar = <div className="sheet-tools" data-nodrag>
    {sheet.kind !== 'center' && <div className="grab" aria-hidden="true" />}
    {!sheet.locked && <button type="button" className="iconbtn sheet-close" aria-label={t('Close')} onClick={close}><Icon name="xmark" /></button>}
  </div>
  if (sheet.kind === 'center') {
    return (
      <div inert={!active} aria-hidden={!active || undefined}>
        <div className="mback" onClick={() => { if (!sheet.locked) close() }} />
        <div className="center" ref={panel} role="dialog" aria-label="TGym" aria-modal={active || undefined} tabIndex={-1}>{toolbar}{sheet.render(close)}</div>
      </div>
    )
  }
  return (
    <div inert={!active} aria-hidden={!active || undefined}>
      <div className="mback" onClick={() => { if (!sheet.locked) close() }} />
      <div className="sheet" role="dialog" aria-label="TGym" aria-modal={active || undefined} tabIndex={-1} ref={el => { ref.current = el; panel.current = el }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
        {toolbar}
        {sheet.render(close)}
      </div>
    </div>
  )
}

export default function Modals() {
  const sheets = useUI(s => s.sheets)
  const closeSheet = useUI(s => s.closeSheet)
  const prevLen = useRef(0)
  const suppressPop = useRef(false)
  const pushedEntries = useRef(0)
  const sheetEntries = useRef([])

  // Every opened sheet gets a history entry so Android back dismisses it instead of
  // leaving the page (issue #63). Keep the pushed-entry count and each active sheet's
  // live-entry status explicit: sheet count cannot tell whether popstate already spent
  // an entry (especially for a locked sheet) or whether several sheets opened at once.
  useEffect(() => {
    const prev = prevLen.current
    prevLen.current = sheets.length
    if (sheets.length > prev) {
      for (let i = prev; i < sheets.length; i++) {
        sheetEntries.current.push({ openedAt: location.href, live: true })
        history.pushState({ openGymSheet: true }, '')
        pushedEntries.current++
      }
    } else if (sheets.length < prev) {
      const closedEntries = sheetEntries.current.splice(sheets.length, prev - sheets.length)
      const rewind = closedEntries.filter(entry =>
        entry.live && !(typeof entry.openedAt === 'string' && location.href !== entry.openedAt)).length
      if (rewind > 0) {
        pushedEntries.current = Math.max(0, pushedEntries.current - rewind)
        suppressPop.current = true
        history.go(-rewind)
      }
      // Entries skipped because the app moved on remain in pushedEntries as deliberate
      // leaks until a later popstate consumes them with no corresponding active sheet.
    }
  }, [sheets.length])

  useEffect(() => {
    const onPop = () => {
      if (suppressPop.current) { suppressPop.current = false; return }
      if (pushedEntries.current <= 0) return
      pushedEntries.current--
      // The browser has already spent one pushed entry. Mark the latest live active
      // sheet entry spent even when the sheet is locked; with no active entry this is a
      // moved-on leak, which is still accounted for by the counter decrement above.
      for (let i = sheetEntries.current.length - 1; i >= 0; i--) {
        if (sheetEntries.current[i].live) {
          sheetEntries.current[i].live = false
          break
        }
      }
      const top = sheets[sheets.length - 1]
      if (top && !top.locked) closeSheet(top.id)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [sheets, closeSheet])

  // lock the page behind any open sheet (iOS-safe)
  useEffect(() => {
    if (!sheets.length) return
    const onKey = e => { if (e.key === 'Escape') { const top = useUI.getState().sheets[useUI.getState().sheets.length - 1]; if (top && !top.locked) useUI.getState().closeSheet(top.id) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheets.length])
  useEffect(() => {
    if (!sheets.length) return
    const behind = [...document.querySelectorAll('#app, #tabbar, #timer')].map(el => [el, el.hasAttribute('inert')])
    behind.forEach(([el]) => el.setAttribute('inert', ''))
    const y = window.scrollY || 0
    const b = document.body.style
    b.position = 'fixed'; b.top = -y + 'px'; b.left = '0'; b.right = '0'; b.width = '100%'
    return () => {
      behind.forEach(([el, wasInert]) => { if (!wasInert) el.removeAttribute('inert') })
      b.position = b.top = b.left = b.right = b.width = ''
      window.scrollTo(0, y)
    }
  }, [sheets.length > 0])

  if (!sheets.length) return null
  return (
    <div id="modal-root" className="open">
      {sheets.map((s, i) => <Sheet key={s.id} sheet={s} active={i === sheets.length - 1} />)}
    </div>
  )
}
