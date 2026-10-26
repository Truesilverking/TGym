import { useEffect, useState, useSyncExternalStore } from 'react'
import { imgSrc, gifSrc } from '../lib/exercises.js'
import { useStore } from '../store/useStore.js'
import { t, exerciseNameFor } from '../lib/i18n.js'
import Icon from './Icon.jsx'

const motionQuery = '(prefers-reduced-motion: reduce)'
const systemReducesMotion = () => !!window.matchMedia?.(motionQuery).matches
const subscribeMotion = listener => {
  const query = window.matchMedia?.(motionQuery)
  query?.addEventListener?.('change', listener)
  return () => query?.removeEventListener?.('change', listener)
}
function useReducedMotion() {
  const app = useStore(s => !!s.S.reduceMotion)
  const system = useSyncExternalStore(subscribeMotion, systemReducesMotion, () => false)
  return app || system
}
const animatedCustomImage = ex => !ex.gif && /^data:image\/(gif|webp)[;,]/i.test(ex.img || '')
// Custom uploads have no separate still frame. Decode offscreen and retain a
// static poster; never insert the animation while reduced motion is on. Cache
// exact source values, not exercise IDs: an edited upload cannot reuse old art.
// Pending decodes share subscribers too. Bounds include both source strings and
// encoded PNG strings (conservative UTF-16 bytes); no profile/storage writes.
const POSTER_LIMIT = 24, POSTER_BYTES = 32 * 1024 * 1024
const posters = new Map()
let posterBytes = 0
const touchPoster = (source, entry) => { posters.delete(source); posters.set(source, entry) }
function removePoster(source, entry) {
  if (posters.get(source) !== entry) return
  posters.delete(source); posterBytes -= entry.bytes
}
function trimPosters() {
  while (posters.size > POSTER_LIMIT || posterBytes > POSTER_BYTES) {
    const [source, entry] = posters.entries().next().value
    removePoster(source, entry)
  }
}
function cachedPoster(source) {
  const entry = posters.get(source)
  if (!entry?.poster) return null
  touchPoster(source, entry)
  return entry.poster
}
function subscribePoster(source, listener) {
  const existing = posters.get(source)
  if (existing) {
    touchPoster(source, existing)
    if (existing.poster) listener(existing.poster)
    else existing.listeners.add(listener)
    return () => existing.listeners.delete(listener)
  }
  const entry = {bytes:source.length * 2,poster:null,listeners:new Set([listener])}
  if (entry.bytes <= POSTER_BYTES) { posters.set(source, entry); posterBytes += entry.bytes; trimPosters() }
  const image = new Image()
  let settled = false
  const finish = poster => {
    if (settled) return
    settled = true; image.onload = image.onerror = null
    if (poster) {
      if (posters.get(source) === entry) {
        posterBytes += poster.length * 2; entry.bytes += poster.length * 2; entry.poster = poster
        touchPoster(source, entry); trimPosters()
      }
      for (const notify of entry.listeners) notify(poster)
    } else removePoster(source, entry) // A later mount may retry a failed decode.
    entry.listeners.clear()
  }
  if (/^https?:\/\//i.test(source)) image.crossOrigin = 'anonymous'
  image.onload = () => {
    let canvas
    try {
      if (!(image.naturalWidth > 0 && image.naturalHeight > 0)) { finish(null); return }
      canvas = document.createElement('canvas')
      const scale = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight))
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
      const poster = canvas.toDataURL('image/png')
      finish(/^data:image\/png[;,]/i.test(poster) ? poster : null)
    } catch { finish(null) } // Retain the accessible placeholder; do not cache failure.
    finally { if (canvas) canvas.width = canvas.height = 0 }
  }
  image.onerror = () => finish(null)
  try { image.src = source } catch { finish(null) }
  // Unmount removes only this subscriber. An already-running shared decode may
  // finish for another consumer/remount, without setting unmounted React state.
  return () => entry.listeners.delete(listener)
}
function usePoster(source, resetKey) {
  const [poster, setPoster] = useState(null)
  const usableSource = typeof source === 'string' && source ? source : null
  const cached = usableSource ? cachedPoster(usableSource) : null
  useEffect(() => {
    if (!usableSource) return
    let cancelled = false
    const unsubscribe = subscribePoster(usableSource, value => {
      if (!cancelled) setPoster({source:usableSource,resetKey,value})
    })
    return () => { cancelled = true; unsubscribe() }
  }, [usableSource, resetKey])
  // A paused catalogue animation deliberately drops its decoding source and
  // keeps its poster. Changing the exercise or a nonempty source clears it now,
  // including the render before effects run; unknown resource refs stay blank.
  return cached || (poster?.resetKey === resetKey && (source == null || poster.source === usableSource) ? poster.value : null)
}

function MediaImage({src,alt='',className='',...props}) {
 const [failed,setFailed]=useState(null),[retry,setRetry]=useState(0)
 useEffect(()=>{const online=()=>{setFailed(null);setRetry(n=>n+1)};window.addEventListener('online',online);return()=>window.removeEventListener('online',online)},[])
 return src&&failed!==src ? <img {...props} key={src+retry} src={src} alt={alt} className={className} onError={()=>setFailed(src)}/> : <span className={className==='thumb'?'thumb thumb-x':'media-placeholder'} role="img" aria-label={alt||t('Exercises')}><Icon name="dumbbell"/></span>
}

// Big autoplaying animation; tap toggles to the still frame. `compact` shrinks it (superset cards).
// Custom GIF/WebP uploads get a decoded poster so they can pause too. Reduced
// motion starts with the still frame; a deliberate play action remains available.
// `minimizable` (workout view) adds a persistent minimize/expand control so the animation stops
// eating the screen; the chosen size is saved to settings and carries across exercises and
// future workouts (issue #12).
export default function Media({ ex, id, compact, minimizable }) {
  const reduced = useReducedMotion()
  const customAnimation = animatedCustomImage(ex)
  const [requestedPlayback, setRequestedPlayback] = useState(null)
  const playing = requestedPlayback ?? !reduced
  const poster = usePoster(customAnimation ? ex.img : (playing ? gifSrc(ex) : null), ex.id)
  useEffect(() => setRequestedPlayback(null), [ex.id, reduced])
  const S = useStore(s => s.S)
  const gifSize = S.gifSize
  const update = useStore(s => s.update)
  if (!ex.gif && !customAnimation) return ex.img ? <div className={'exmedia' + (compact ? ' compact' : '')}><MediaImage fetchPriority="high" width="360" height="360" decoding="async" src={imgSrc(ex)} alt={exerciseNameFor(ex)} /></div> : null
  const source = playing ? (customAnimation ? ex.img : gifSrc(ex)) : (customAnimation ? poster : (poster || imgSrc(ex)))
  const mini = minimizable && gifSize === 'mini'
  const toggleSize = e => { e.stopPropagation(); update(s => { s.gifSize = mini ? 'full' : 'mini' }) }
  return (
    <div className={'exmedia' + (compact ? ' compact' : '') + (mini ? ' mini' : '')} id={id}>
      <button type="button" className="media-playback" aria-label={t(playing ? 'Pause animation' : 'Play animation')} onClick={() => setRequestedPlayback(!playing)}>
        {source ? <MediaImage fetchPriority="high" width="360" height="360" decoding="async" src={source} alt={exerciseNameFor(ex)} /> : <span className="media-placeholder" role="img" aria-label={exerciseNameFor(ex)}><Icon name="dumbbell" /></span>}
      </button>
      {minimizable && (
        <button className="giftoggle" onClick={toggleSize}>
          <Icon name={mini ? 'expand' : 'minimize'} />{mini ? t('Expand') : t('Minimize')}
        </button>
      )}
      {!mini && (
        <span className="gifhint">
          <Icon name={playing ? 'pause' : 'play'} />{playing ? t('tap to pause') : t('tap to play')}
        </span>
      )}
    </div>
  )
}

export function Thumb({ ex }) {
  if (!ex.img) return <div className="thumb thumb-x"><Icon name="dumbbell" /></div>
  if (animatedCustomImage(ex)) return <CustomThumb ex={ex} />
  return <MediaImage className="thumb" width="52" height="52" loading="lazy" decoding="async" src={imgSrc(ex)} alt="" />
}

function CustomThumb({ ex }) {
  const reduced = useReducedMotion()
  const poster = usePoster(reduced ? ex.img : null, ex.id)
  const source = reduced ? poster : ex.img
  return source ? <MediaImage className="thumb" src={source} alt="" /> : <div className="thumb thumb-x" aria-hidden="true"><Icon name="dumbbell" /></div>
}
