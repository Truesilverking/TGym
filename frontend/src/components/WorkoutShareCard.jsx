import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'
import { t } from '../lib/i18n.js'
import { fmtVol, fmtDur } from '../lib/format.js'
import { plateColor } from '../lib/plates.js'
import { workoutVolume } from '../lib/history.js'
import { workoutElapsedMs } from '../lib/workout-time.js'
import { isWarmupRow } from '../lib/workout-model.js'
import { saveReportFile } from '../lib/report-file.js'

export default function WorkoutShareCard({ workout, prs = [], unit = 'kg', close }) {
  const cardRef = useRef(null)
  const [sharing, setSharing] = useState(false)
  const [error, setError] = useState(false)
  const sharingRef = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  const w = workout || {}
  const entries = (w.entries || []).map(e => ({ ...e, sets: e.sets || [] }))
  const volume = workoutVolume({ ...w, entries })
  const duration = w.start != null && w.start !== '' && Number.isFinite(Number(w.start)) ? fmtDur(workoutElapsedMs(w)) : '—'
  const totalSets = entries.reduce((sum, e) => sum + e.sets.filter(s => s.done && !isWarmupRow(s)).length, 0)

  const handleShare = async () => {
    if (sharingRef.current) return
    sharingRef.current = true
    setSharing(true)
    setError(false)
    try {
      const { toBlob } = await import('html-to-image')
      if (!mounted.current || !cardRef.current) return
      const blob = await toBlob(cardRef.current, {
        pixelRatio: 2,
        backgroundColor: '#0a0a0c',
      })
      if (!mounted.current) return
      if (!blob) throw new Error('Share image was empty')
      await saveReportFile({ blob, name: `tgym-workout-${w.d || 'session'}.png` }, { share: true })
    } catch (e) {
      if (mounted.current && e?.name !== 'AbortError' && !/^Share cancel(?:led|ed)$/i.test(e?.message || '')) setError(true)
    } finally {
      sharingRef.current = false
      if (mounted.current) setSharing(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
      <div
        ref={cardRef}
        style={{
          width: '100%',
          maxWidth: 320,
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
            {w.name || t('Workout')}
          </h2>
        </div>

        {/* Big Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, margin: '14px 0' }}>
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--label-2)', textTransform: 'uppercase' }}>{t('Volume')}</div>
            <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>{fmtVol(volume, unit)}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--label-2)', textTransform: 'uppercase' }}>{t('Sets')}</div>
            <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>{totalSets}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--label-2)', textTransform: 'uppercase' }}>{t('Time')}</div>
            <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>{duration}</div>
          </div>
        </div>

        {/* PRs Section */}
        {prs.length > 0 && (
          <div style={{ background: 'rgba(255, 215, 0, 0.08)', border: '1px solid rgba(255, 215, 0, 0.3)', borderRadius: 12, padding: '10px 12px' }}>
            <div style={{ fontSize: 11, fontWeight: 750, color: '#ffd700', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
              <Icon name="sparkles" style={{ fontSize: 12 }} />
              <span>{t('Personal records')}</span>
            </div>
            <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {prs.slice(0, 3).map((pr, idx) => (
                <div key={idx} style={{ overflowWrap: 'anywhere' }}>
                  • {pr.entry?.n || pr.entry?.name || pr.id}: <b>{pr.bestWeight?.w || pr.best1RM?.est} {unit}</b>
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
          {sharing ? t('Generating…') : t('Share story')}
        </Button>
        <Button onClick={close}>{t('Close')}</Button>
      </div>
      {error && <p role="alert">{t('Could not create the share image. Please try again.')}</p>}
    </div>
  )
}
