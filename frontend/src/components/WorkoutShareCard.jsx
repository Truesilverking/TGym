import { useRef, useState } from 'react'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'
import { t } from '../lib/i18n.js'
import { fmtVol, fmtDur } from '../lib/format.js'
import { plateColor } from '../lib/plates.js'

export default function WorkoutShareCard({ workout, prs = [], unit = 'kg', close }) {
  const cardRef = useRef(null)
  const [sharing, setSharing] = useState(false)

  const w = workout || {}
  const volume = w.entries ? w.entries.reduce((sum, e) => sum + (e.sets || []).reduce((sSum, s) => sSum + (s.done ? (s.w || 0) * (s.r || 0) : 0), 0), 0) : 0
  const durationSec = Math.round(((w.end || Date.now()) - (w.start || Date.now())) / 1000)
  const totalSets = (w.entries || []).reduce((sum, e) => sum + (e.sets || []).filter(s => s.done).length, 0)

  const handleShare = async () => {
    setSharing(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      if (!cardRef.current) return
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: '#0a0a0c',
        useCORS: true,
      })
      canvas.toBlob(async blob => {
        if (!blob) return
        const file = new File([blob], `tgym-workout-${w.d || 'session'}.png`, { type: 'image/png' })
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: 'Mi entrenamiento en TGym',
              text: `${w.name || 'Entrenamiento'} completado en TGym! 💪`,
            })
          } catch {
            // Dismissed
          }
        } else {
          // Download fallback
          const a = document.createElement('a')
          a.href = URL.createObjectURL(blob)
          a.download = `tgym-workout-${w.d || 'session'}.png`
          a.click()
        }
      })
    } catch (e) {
      console.error(e)
    } finally {
      setSharing(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
      <div
        ref={cardRef}
        style={{
          width: 320,
          aspectRatio: '9/16',
          maxHeight: '68vh',
          background: 'radial-gradient(circle at top right, #1f1f28, #0e0e12 70%)',
          borderRadius: 20,
          border: '1.5px solid var(--border-subtle)',
          padding: '24px 20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          color: '#fff',
          boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
          boxSizing: 'border-box',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Top Header */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.12em', color: 'var(--acc)', textTransform: 'uppercase' }}>
              TGym Workout
            </span>
            <span style={{ fontSize: 12, color: 'var(--label-2)' }}>{w.d}</span>
          </div>
          <h2 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
            {w.name || t('Entrenamiento')}
          </h2>
        </div>

        {/* Big Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, margin: '14px 0' }}>
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--label-2)', textTransform: 'uppercase' }}>{t('Volumen')}</div>
            <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>{fmtVol(volume)}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--label-2)', textTransform: 'uppercase' }}>{t('Series')}</div>
            <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>{totalSets}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--label-2)', textTransform: 'uppercase' }}>{t('Tiempo')}</div>
            <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>{fmtDur(durationSec)}</div>
          </div>
        </div>

        {/* PRs Section */}
        {prs.length > 0 && (
          <div style={{ background: 'rgba(255, 215, 0, 0.08)', border: '1px solid rgba(255, 215, 0, 0.3)', borderRadius: 12, padding: '10px 12px' }}>
            <div style={{ fontSize: 11, fontWeight: 750, color: '#ffd700', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
              <Icon name="sparkles" style={{ fontSize: 12 }} />
              <span>{t('¡Récords Personales!')}</span>
            </div>
            <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {prs.slice(0, 3).map((pr, idx) => (
                <div key={idx} style={{ overflowWrap: 'anywhere' }}>
                  • {pr.entry?.name || pr.id}: <b>{pr.bestWeight?.w || pr.best1RM?.est} {unit}</b>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Plate Bar Accent */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 10 }}>
          {[25, 20, 15, 10, 5, 2.5].map(p => (
            <div
              key={p}
              style={{
                flex: 1,
                height: 5,
                borderRadius: 2,
                background: plateColor(p, unit) === 'red' ? '#ef4444' :
                            plateColor(p, unit) === 'blue' ? '#3b82f6' :
                            plateColor(p, unit) === 'yellow' ? '#eab308' :
                            plateColor(p, unit) === 'green' ? '#22c55e' : '#94a3b8',
              }}
            />
          ))}
        </div>

        {/* Footer brand */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--label-3)' }}>Local-First · Private · Open</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--acc)' }}>TGym</span>
        </div>
      </div>

      <div className="row" style={{ gap: 8, width: '100%', maxWidth: 320 }}>
        <Button variant="primary" icon="upload" onClick={handleShare} disabled={sharing} style={{ flex: 1 }}>
          {sharing ? t('Generando...') : t('Compartir Historia')}
        </Button>
        <Button onClick={close}>{t('Cerrar')}</Button>
      </div>
    </div>
  )
}
