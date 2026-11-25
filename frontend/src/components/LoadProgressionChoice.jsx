import { t } from '../lib/i18n.js'
import { fmtWeight } from '../lib/format.js'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'
import './LoadProgressionChoice.css'

export default function LoadProgressionChoice({ progression, unit, topBack, disabled, onChoose }) {
  if (progression?.status !== 'pending') return null
  return <section className="load-progression-choice" aria-label={t('Weight increase')}>
    <div className="load-progression-question"><Icon name="arrowUp" /><strong>{t('Ready to increase the weight?')}</strong></div>
    <div className="load-progression-values">
      <span>{t('Current weight')}<b>{fmtWeight(progression.previousWeight)} <small>{unit}</small></b></span>
      <Icon name="chevronRight" />
      <span>{t('Proposed weight')}<b>{fmtWeight(progression.nextWeight)} <small>{unit}</small></b></span>
    </div>
    <p>{t(topBack
      ? 'Your choice sets the Top load and its automatic Back-off loads. Your current weight stays until you choose.'
      : 'Your current weight stays until you choose. Increase only if you feel ready for the next load.')}</p>
    <p>{t('Completed sets and manual entries stay as logged.')}</p>
    <div className="load-progression-actions">
      <Button size="sm" data-load-choice="decline" disabled={disabled} onClick={() => onChoose(false)}>{t('Keep current weight')}</Button>
      <Button size="sm" data-load-choice="accept" variant="primary" icon="arrowUp" disabled={disabled} onClick={() => onChoose(true)}>{t('Yes, increase')}</Button>
    </div>
  </section>
}
