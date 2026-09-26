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
// small, static poster; never insert the animation while reduced motion is on.
function usePoster(source) {
  const [poster, setPoster] = useState(null)
  useEffect(() => {
    setPoster(null)
    if (!source) return
    let cancelled = false
    const image = new Image()
    image.onload = () => {
      if (cancelled) return
      try {
        const canvas = document.createElement('canvas')
        const scale = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight))
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
        setPoster(canvas.toDataURL('image/png'))
        canvas.width = canvas.height = 0
      } catch { /* Keep the accessible placeholder if a poster cannot be decoded. */ }
    }
    image.src = source
    return () => { cancelled = true; image.onload = null }
  }, [source])
  return poster
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
  const poster = usePoster(customAnimation ? ex.img : null)
  const [requestedPlayback, setRequestedPlayback] = useState(null)
  const playing = requestedPlayback ?? !reduced
  useEffect(() => setRequestedPlayback(null), [ex.id, reduced])
  const gifSize = useStore(s => s.S.gifSize)
  const update = useStore(s => s.update)
  if (!ex.gif && !customAnimation) return ex.img ? <div className={'exmedia' + (compact ? ' compact' : '')}><img decoding="async" src={imgSrc(ex)} alt={exerciseNameFor(ex)} /></div> : null
  const source = playing ? (customAnimation ? ex.img : gifSrc(ex)) : (customAnimation ? poster : imgSrc(ex))
  const mini = minimizable && gifSize === 'mini'
  const toggleSize = e => { e.stopPropagation(); update(s => { s.gifSize = mini ? 'full' : 'mini' }) }
  return (
    <div className={'exmedia' + (compact ? ' compact' : '') + (mini ? ' mini' : '')} id={id}>
      <button type="button" className="media-playback" aria-label={t(playing ? 'Pause animation' : 'Play animation')} onClick={() => setRequestedPlayback(!playing)}>
        {source ? <img decoding="async" src={source} alt={exerciseNameFor(ex)} /> : <span className="media-placeholder" role="img" aria-label={exerciseNameFor(ex)}><Icon name="dumbbell" /></span>}
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
  return <img className="thumb" loading="lazy" decoding="async" src={imgSrc(ex)} alt="" />
}

function CustomThumb({ ex }) {
  const reduced = useReducedMotion()
  const poster = usePoster(ex.img)
  const source = reduced ? poster : ex.img
  return source ? <img className="thumb" src={source} alt="" /> : <div className="thumb thumb-x" aria-hidden="true"><Icon name="dumbbell" /></div>
}
