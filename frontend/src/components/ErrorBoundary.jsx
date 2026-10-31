import { Component } from 'react'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'

/**
 * Last line of defence: one bad render used to blank the whole app, with no way back —
 * a workout referencing an exercise the build doesn't know would white-screen and, since
 * the running workout is persisted, do it again on every reload.
 *
 * Sits inside #app so the tab bar stays usable. Route changes and retained-page
 * reactivation allow retrying the affected screen without discarding its data.
 */
export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false } }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(err) { console.error('TGym render error:', err) }
  componentDidMount() {
    // React Activity replays class mount/unmount lifecycles when hiding/revealing
    // retained pages, while preserving the instance and its error state.
    if (this.wasHidden && this.state.failed) this.setState({failed:false})
    this.wasHidden = false
  }
  componentWillUnmount() { this.wasHidden = true }
  componentDidUpdate(previous) {
    if (this.state.failed && (previous.resetKey !== this.props.resetKey || (previous.active === false && this.props.active === true))) this.setState({failed:false})
  }

  render() {
    if (!this.state.failed) return this.props.children
    const active = useStore.getState().S.active
    return (
      <div className="narrow">
        <div className="empty" style={{ marginTop: '18vh' }}>
          <div className="ico"><Icon name="info" /></div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{t('Something went wrong')}</div>
          {t('This screen could not be drawn. Your data is safe on this device.')}
        </div>
        <Button variant="primary" icon="reset" onClick={() => location.reload()}>{t('Reload TGym')}</Button>
        {active && this.props.allowDiscardWorkout && <>
          <div style={{ height: 8 }} />
          <Button variant="danger" icon="trash" onClick={() => {
            useStore.getState().update(s => { s.active = null })
            location.reload()
          }}>{t('Discard the running workout')}</Button>
        </>}
      </div>
    )
  }
}
