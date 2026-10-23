import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'
import { isPro, validateProCode, setMembershipTier } from '../lib/membership.js'

const FREE_FEATURES = ['Up to 3 routines', 'Unlimited workouts', 'Calorie & water goals', 'History & charts']
const PRO_FEATURES = ['Unlimited routines', 'Full macros (P/C/F)', 'Metabolic TDEE calculator', 'Advanced techniques', 'Pro badge & exclusive themes']

export default function ProUpgradeSheet({ close }) {
  const S = useStore(s => s.S)
  const toast = useUI(s => s.toast)
  const pro = isPro(S)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleApplyCode = () => {
    setError('')
    setSuccess('')
    if (!code.trim()) {
      setError(t('Enter a code'))
      return
    }
    if (validateProCode(code)) {
      setMembershipTier('pro', code.trim().toUpperCase())
      setSuccess(t('TGym Pro activated successfully!'))
      toast(t('TGym Pro activated'))
      setTimeout(() => close?.(), 1200)
    } else {
      setError(t('Invalid code. Try TGYM-PRO or ELITE'))
    }
  }

  const handleToggleDemoPro = () => {
    if (pro) {
      setMembershipTier('free')
      toast(t('Free mode restored'))
    } else {
      setMembershipTier('pro', 'DEMO-LOCAL')
      toast(t('TGym Pro activated! Enjoy every feature'))
    }
    close?.()
  }

  return (
    <div className="pro-sheet">
      <div className="pro-hero">
        <span className="pro-badge"><Icon name="sparkles" />Pro</span>
        <h3>{pro ? t('TGym Pro is active') : t('Unlock TGym Pro')}</h3>
        <p className="dim small">{t('100% local and private, with no recurring subscription.')}</p>
      </div>

      <div className="pro-tiers">
        <div className="pro-tier">
          <div className="lbl2">{t('Free mode')}</div>
          <ul>{FREE_FEATURES.map(f => <li key={f}><Icon name="check" />{t(f)}</li>)}</ul>
        </div>
        <div className="pro-tier featured">
          <div className="lbl2">TGym Pro</div>
          <ul>{PRO_FEATURES.map(f => <li key={f}><Icon name="check" />{t(f)}</li>)}</ul>
        </div>
      </div>

      <div className="pro-code">
        <label className="field-label" htmlFor="pro-code">{t('Activate with a licence code')}</label>
        <div className="pro-code-row">
          <input id="pro-code" className="field" type="text" placeholder={t('e.g. TGYM-PRO or ELITE')} value={code} autoComplete="off"
            onChange={e => { setCode(e.target.value); setError(''); setSuccess('') }}
            onKeyDown={e => { if (e.key === 'Enter') handleApplyCode() }} />
          <Button variant="primary" onClick={handleApplyCode}>{t('Activate')}</Button>
        </div>
        {error && <p className="pro-msg error" role="alert">{error}</p>}
        {success && <p className="pro-msg ok" role="status">{success}</p>}
      </div>

      <div className="pro-actions">
        <Button variant="tinted" icon={pro ? 'reset' : 'bolt'} onClick={handleToggleDemoPro}>
          {pro ? t('Switch back to free mode (testing)') : t('Try TGym Pro instantly (offline)')}
        </Button>
        <Button onClick={close}>{t('Close')}</Button>
      </div>
    </div>
  )
}
