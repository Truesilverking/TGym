import { DAYS, fmtDate, isoOf } from '../lib/format.js'
import { dateLocale, t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import './TodayWeekCalendar.css'

const mondayOf = date => {
  const monday = new Date(date)
  monday.setHours(12, 0, 0, 0)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return monday
}

// The same compact calendar surface serves Today and Nutrition. Its callers
// own selection, marks and actions; browsing a week never writes profile data.
export default function TodayWeekCalendar({ today, anchor = today, selectedDate = isoOf(today), weekOffset = 0,
  onWeekOffsetChange, onExpand, onDay, getDayState = () => ({}), selectable = false, children, className = '', ...props }) {
  const monday = mondayOf(anchor)
  monday.setDate(monday.getDate() + weekOffset * 7)
  const sunday = new Date(monday); sunday.setDate(sunday.getDate() + 6)
  const title = isoOf(monday) === isoOf(mondayOf(today)) ? t('This week')
    : `${monday.getDate()} ${monday.toLocaleDateString(dateLocale(), { month: 'short' })} – ${sunday.getDate()} ${sunday.toLocaleDateString(dateLocale(), { month: 'short' })}`
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday); date.setDate(monday.getDate() + index)
    const iso = isoOf(date), state = getDayState(date, iso)
    return <button type="button" key={iso} className={'wday' + (state.className ? ' ' + state.className : '') + (iso === selectedDate ? ' today' : '')}
      data-date={iso} data-recorded={state.recorded} title={state.title} aria-label={state.ariaLabel || fmtDate(iso, true)}
      aria-current={iso === isoOf(today) ? 'date' : undefined} aria-pressed={selectable ? iso === selectedDate : undefined} onClick={() => onDay?.(iso)}>
      <span className="lbl">{t(DAYS[date.getDay()])}</span><span className="num">{date.getDate()}</span><span className={'dot' + (state.dotClassName ? ' ' + state.dotClassName : '')} />
    </button>
  })
  return <div {...props} className={'card plate today-week-calendar' + (className ? ' ' + className : '')}>
    <div className="row between" style={{ marginBottom: 8 }}>
      <button className="iconbtn" style={{ width: 30, height: 30, fontSize: 15 }} onClick={() => onWeekOffsetChange(offset => offset - 1)} aria-label={t('Previous week')}><Icon name="chevronLeft" /></button>
      <button className="week-expand" onClick={() => onExpand(monday)} aria-label={t('Expand calendar')}>{title}<Icon name="chevronRight" /></button>
      <button className="iconbtn" style={{ width: 30, height: 30, fontSize: 15 }} onClick={() => onWeekOffsetChange(offset => offset + 1)} aria-label={t('Next week')}><Icon name="chevronRight" /></button>
    </div>
    <div className="week">{days}</div>
    {children}
  </div>
}
