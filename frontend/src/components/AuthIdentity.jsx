import Icon from './Icon.jsx'
import { t } from '../lib/i18n.js'

export default function AuthIdentity({ locked = false }) {
  return <header className="auth-identity">
    <div className="auth-orbit" aria-hidden="true"><span className="auth-orbit-track" /><span className="auth-orbit-core"><Icon name={locked ? 'lock' : 'dumbbell'} /></span><i /><i /></div>
    <div className="auth-eyebrow">{t(locked ? 'Your private training space' : 'Built around your progress')}</div>
    <h1>T<span>Gym</span><span className="auth-brand-dot" aria-hidden="true">.</span></h1>
    <div className="auth-identity-rule" aria-hidden="true"><span /><Icon name="bolt" /><span /></div>
  </header>
}
