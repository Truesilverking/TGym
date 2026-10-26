import { useState, useEffect } from 'react'
import Icon from './Icon.jsx'
import { t, getLang } from '../lib/i18n.js'
import { weightStepFor } from '../lib/unit-conversion.js'

export function speakAnnouncement(text, lang = 'es') {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  try {
    window.speechSynthesis.cancel() // stop any previous utterance
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang.startsWith('es') ? 'es-ES' : 'en-US'
    utterance.rate = 1.0
    window.speechSynthesis.speak(utterance)
  } catch (e) {
    // Ignore speech failure
  }
}

export default function HandsFreeConsole({
  exerciseName,
  setIndex,
  totalSets,
  weight,
  reps,
  unit = 'kg',
  onCompleteSet,
  onAdjustWeight,
  onAdjustReps,
  onClose,
}) {
  const [voiceOn, setVoiceOn] = useState(true)
  const weightStep = weightStepFor(unit)
  useEffect(() => () => { window.speechSynthesis?.cancel?.() }, [])

  const handleComplete = () => {
    onCompleteSet?.()
    if (voiceOn) {
      speakAnnouncement(t('Set {0} completed. Start resting.', setIndex + 1), getLang())
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 2000,
      background: '#09090b',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: 'calc(var(--sat) + 16px) 20px calc(var(--sab) + 20px)',
      boxSizing: 'border-box',
    }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--acc)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {t('Hands-free mode')} · {t('Set')} {setIndex + 1} / {totalSets}
          </div>
          <h1 style={{ margin: '4px 0 0', fontSize: 26, fontWeight: 800, lineHeight: 1.1 }}>
            {exerciseName}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="iconbtn"
            onClick={() => { if (voiceOn) window.speechSynthesis?.cancel?.(); setVoiceOn(!voiceOn) }}
            aria-label={t('Voice')}
            aria-pressed={voiceOn}
            style={{ color: voiceOn ? 'var(--acc)' : 'var(--label-3)', width: 48, height: 48 }}
          >
            <Icon name={voiceOn ? 'bell' : 'bell'} />
          </button>
          <button
            className="iconbtn"
            onClick={onClose}
            aria-label={t('Exit')}
            style={{ width: 48, height: 48 }}
          >
            <Icon name="xmark" />
          </button>
        </div>
      </div>

      {/* Gigantic Controls for Chalky Hands */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, margin: '20px 0' }}>
        {/* Weight Console */}
        <div style={{
          background: '#18181b',
          borderRadius: 20,
          padding: '20px 12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #27272a',
        }}>
          <div style={{ fontSize: 13, color: 'var(--label-2)', textTransform: 'uppercase', fontWeight: 700 }}>
            {t('Load')} ({unit})
          </div>
          <div style={{ fontSize: 56, fontWeight: 900, fontFamily: 'var(--font-display)', margin: '8px 0', color: 'var(--acc)' }}>
            {weight}
          </div>
          <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 160 }}>
            <button
              onClick={() => onAdjustWeight?.(-weightStep)}
              aria-label={t('Decrease load')}
              style={{
                flex: 1,
                minHeight: 52,
                borderRadius: 12,
                border: 'none',
                background: '#27272a',
                color: '#fff',
                fontSize: 22,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              −
            </button>
            <button
              onClick={() => onAdjustWeight?.(weightStep)}
              aria-label={t('Increase load')}
              style={{
                flex: 1,
                minHeight: 52,
                borderRadius: 12,
                border: 'none',
                background: '#27272a',
                color: '#fff',
                fontSize: 22,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              +
            </button>
          </div>
        </div>

        {/* Reps Console */}
        <div style={{
          background: '#18181b',
          borderRadius: 20,
          padding: '20px 12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #27272a',
        }}>
          <div style={{ fontSize: 13, color: 'var(--label-2)', textTransform: 'uppercase', fontWeight: 700 }}>
            {t('Reps')}
          </div>
          <div style={{ fontSize: 56, fontWeight: 900, fontFamily: 'var(--font-display)', margin: '8px 0' }}>
            {reps}
          </div>
          <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 160 }}>
            <button
              onClick={() => onAdjustReps?.(-1)}
              aria-label={t('Decrease reps')}
              style={{
                flex: 1,
                minHeight: 52,
                borderRadius: 12,
                border: 'none',
                background: '#27272a',
                color: '#fff',
                fontSize: 22,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              −
            </button>
            <button
              onClick={() => onAdjustReps?.(1)}
              aria-label={t('Increase reps')}
              style={{
                flex: 1,
                minHeight: 52,
                borderRadius: 12,
                border: 'none',
                background: '#27272a',
                color: '#fff',
                fontSize: 22,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Massive Complete Set Action */}
      <button
        onClick={handleComplete}
        style={{
          width: '100%',
          minHeight: 76,
          borderRadius: 18,
          border: 'none',
          background: 'var(--acc)',
          color: 'var(--on-acc)',
          fontSize: 22,
          fontWeight: 900,
          letterSpacing: '0.02em',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          boxShadow: '0 8px 24px color-mix(in srgb, var(--acc) 35%, transparent)',
        }}
      >
        <Icon name="check" style={{ fontSize: 26 }} />
        <span>{t('Complete set')}</span>
      </button>
    </div>
  )
}
