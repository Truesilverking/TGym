import { calendarDay } from '../lib/calendar-data.js'
import { nextScheduledWorkout } from '../lib/consistency.js'
import { nextDailyRoutine } from '../lib/daily-plan.js'
import DailyPlan from '../components/DailyPlan.jsx'
import { statisticsState, isUntracked } from '../lib/training-history.js'
import { TrainingPauseAction } from '../components/TrainingPauseCard.jsx'
import { isTrainingPaused } from '../lib/training-pause.js'
import { routineConsistency } from '../lib/stats-insights.js'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { effectiveRoutineId, lastBW, setsDoneActive, effortValue } from '../lib/history.js'
import { fmtNum, fmtDate, isoOf, weekKey, DAYS } from '../lib/format.js'
import { useLocalNow } from '../lib/use-local-now.js'
import { t, dateLocale } from '../lib/i18n.js'
import { bwSheet, dayOverrideSheet, startFlow, guidedPlansSheet, bwDeltaColor, streakDetailSheet, homeCalendarSheet } from '../sheets.jsx'
import { routineMuscleSheet } from '../components/RoutineMusclePreview.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { glyphOf } from '../lib/glyphs.js'
import { deloadStatus, streakTier, trainingStreak } from '../lib/training-plan.js'
import StreakFlame from '../components/StreakFlame.jsx'
import { streakStatusText } from '../components/StreakStatus.jsx'
import { getDailyNutrition } from '../lib/nutrition.js'

// Home = what to do now + a quick glance. Deep charts & history live in Stats.
export default function Home() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const today = useLocalNow(), todayIso = isoOf(today)
  const statsState = statisticsState(S,todayIso)
  const [weekOffset, setWeekOffset] = useState(0)

  const nextDate = nextScheduledWorkout(S, today)
  const routine = nextDate ? nextDailyRoutine(S, nextDate) : null
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
  const nextLabel = S.active ? t('Today') : nextDate === todayIso ? t('Today') : nextDate === isoOf(tomorrow) ? t('Tomorrow') : nextDate ? fmtDate(nextDate, true) : t('Next workout')
  const todayOvr = nextDate && S.dayPlan[nextDate] !== undefined
  const bw = lastBW(statsState)
  const prevBW = statsState.bodyweight.length > 1 ? statsState.bodyweight[statsState.bodyweight.length - 2] : null
  const delta = bw && prevBW ? bw.w - prevBW.w : null
  const streak = trainingStreak(S,today)
  const deload = deloadStatus(S,todayIso)
  const paused = isTrainingPaused(S,todayIso)
  const dailyNutri = getDailyNutrition(S, todayIso)
  const consistency = routineConsistency(S, 56, today)
  const consistencyPct = consistency.rate == null ? null : Math.round(consistency.rate * 100)
  const nutriCalsPct = Math.min(100, Math.round((dailyNutri.totals.calories / Math.max(1, dailyNutri.goals.calories)) * 100))

  const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7)
  const strip = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday); d.setDate(monday.getDate() + i)
    const iso = isoOf(d)
    const eff = effectiveRoutineId(S, iso), ovr = S.dayPlan[iso] !== undefined, status = calendarDay(S,iso,today).status, done = status === 'completed'
    const pausedDay = isTrainingPaused(S,iso)
    const dot = isUntracked(S,iso,todayIso) ? '' : done ? ' done' : ovr && eff ? ' ovr' : eff ? ' plan' : ''
    strip.push(<button type="button" key={i} className={'wday' + (pausedDay ? ' paused' : status === 'partial' ? ' partial' : '') + (iso === todayIso ? ' today' : '')} aria-label={fmtDate(iso,true)} aria-current={iso === todayIso ? 'date' : undefined} title={pausedDay ? t('Training paused') : undefined} onClick={() => dayOverrideSheet(iso)}>
      <span className="lbl">{t(DAYS[d.getDay()])}</span><span className="num">{d.getDate()}</span><span className={'dot' + dot} /></button>)
  }
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
  const wkLabel = weekOffset === 0 ? t('This week') : `${monday.getDate()} ${monday.toLocaleDateString(dateLocale(), { month: 'short' })} – ${sunday.getDate()} ${sunday.toLocaleDateString(dateLocale(), { month: 'short' })}`

  // today's session shown right under the week strip
  const onToday = () => { if (S.active) nav('/workout'); else if (routine && nextDate === todayIso) startFlow(routine.id); else if (routine) dayOverrideSheet(nextDate); else dayOverrideSheet(todayIso) }

  return <div className="narrow">
    <header className="home-hdr">
      <div className="hdr-center" style={{ minWidth: 0 }}>
        <span className="eyebrow sub">{today.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        <h1>{t('Today')}</h1>
      </div>
      <div className="home-hdr-actions">
        <button className={'header-streak streak-' + streakTier(streak.current)} data-streak-state={streak.state} onClick={streakDetailSheet} aria-label={`${t('Training days in this streak')}: ${streak.current}. ${streakStatusText(streak)}`} title={streakStatusText(streak)}><StreakFlame value={streak.current} /><b>{streak.current}</b></button>
        <button className="iconbtn" onClick={() => nav('/settings')} aria-label={t('Settings')}><Icon name="gear" /></button>
      </div>
    </header>

    {S.deload?.on && (deload.active || (deload.daysUntil != null && deload.daysUntil <= 7)) && <div className="card" style={{ border: '1px solid color-mix(in srgb,var(--orange) 55%,transparent)' }}><div className="row" style={{ gap: 9 }}><Icon name="arrowDown" style={{ color: 'var(--orange)' }} /><div><b>{deload.active ? t('Deload week') : t('Deload week starts soon')}</b><div className="small dim">{deload.active ? t('Load {0}% · Working sets {1}% · RIR {2}', deload.config.loadPct, deload.config.setPct, effortValue('rir', deload.config.targetRir)) : t('Starts in {0} days.', deload.daysUntil) + ' · ' + deload.start + ' – ' + deload.end}</div></div></div></div>}

    <div className="card plate" data-tour="calendar">
      <div className="row between" style={{ marginBottom: 8 }}>
        <button className="iconbtn" style={{ width: 30, height: 30, fontSize: 15 }} onClick={() => setWeekOffset(w => w - 1)} aria-label={t('Previous week')}><Icon name="chevronLeft" /></button>
        <button className="week-expand" onClick={() => homeCalendarSheet(monday)} aria-label={t('Expand calendar')}>{wkLabel}<Icon name="chevronRight" /></button>
        <button className="iconbtn" style={{ width: 30, height: 30, fontSize: 15 }} onClick={() => setWeekOffset(w => w + 1)} aria-label={t('Next week')}><Icon name="chevronRight" /></button>
      </div>
      <div className="week">{strip}</div>
      <div className="row" style={{ gap: 8 }}>
        <button type="button" className={'today-row' + (S.active ? ' is-active' : '')} style={{ flex: 1 }} onClick={onToday}>
          <div className="row" style={{ gap: 9, minWidth: 0 }}>
            <span className="lrow-i" style={{ background: S.active ? 'var(--orange)' : routine ? 'var(--acc)' : 'var(--surface-3)', color: S.active ? '#000' : routine ? 'var(--on-acc)' : 'var(--label-2)' }}>
              <Icon name={S.active ? 'timer' : routine ? glyphOf(routine.emoji) : 'moon'} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="lbl2">{nextLabel}</div>
              <div className="ttl">{S.active ? t('{0} — in progress', S.active.name)
                : routine ? routine.name : paused ? t('Training paused') : t('No upcoming workout')}{todayOvr && routine ? ' · ' + t('rescheduled') : ''}</div>
            </div>
          </div>
          {S.active ? <span className="tag" style={{ color: 'var(--orange)', background: 'color-mix(in srgb,var(--orange) 16%,transparent)', fontWeight: 650 }}>{t('Resume')}</span>
            : routine ? <span className="tag acc">{t(nextDate === todayIso ? 'Start' : 'Scheduled')}</span>
            : <Icon name="plus" className="chev" />}
        </button>
        {routine && <button type="button" className="iconbtn" aria-label={t('Muscles trained')} title={t('Muscles trained')} onClick={() => routineMuscleSheet(routine.id)}><Icon name="info" /></button>}
      </div>
    </div>

    <DailyPlan date={todayIso} compact onStart={startFlow}/>


    {!S.routines.length && !S.active && (
      <div className="card">
        <div className="row" style={{ gap: 10, marginBottom: 6 }}>
          <span className="lrow-i"><Icon name="sparkles" /></span>
          <div className="big" style={{ fontSize: 22 }}>{t('Welcome!')}</div>
        </div>
        <div className="muted small" style={{ marginBottom: 12 }}>{t('Set up your weekly routine to get going — or load a ready-made Push / Pull / Legs plan.')}</div>
        <Button variant="primary" icon="sparkles" onClick={guidedPlansSheet}>{t('Choose a guided plan')}</Button>
        <div style={{ height: 8 }} /><Button onClick={() => nav('/plan')}>{t('Build my own plan')}</Button>
      </div>
    )}

    <div className="section-head"><h2>{t('Summary')}</h2><button type="button" onClick={() => nav('/stats')}>{t('See progress')}</button></div>
    <div className="metric-grid">
      {/* links, not buttons: each tile opens its module and carries a real <dl> */}
      <a className="metric" href="#/stats" style={{ '--meter': 'var(--acc)' }}>
        <Icon name="target" />
        <dl><dt className="metric-label">{t('Completion')}</dt><dd className="metric-value">{consistencyPct ?? '–'}{consistencyPct != null && <small>%</small>}</dd></dl>
        <span className="nutri-meter" aria-hidden="true"><i style={{ width: (consistencyPct ?? 0) + '%' }} /></span>
      </a>
      <button type="button" className="metric" onClick={() => bwSheet()} style={{ '--meter': 'var(--teal)' }} aria-label={bw ? undefined : t('Log weight')}>
        <Icon name="scale" />
        <span className="metric-value">{bw ? fmtNum(bw.w) : '–'}{bw && <small>{S.unit}</small>}</span>
        <span className="metric-label">{bw && delta ? <span style={{ color: bwDeltaColor(delta, bw.w) }}>{(delta > 0 ? '+' : '−') + fmtNum(Math.abs(delta))} </span> : null}{t('Body Weight')}</span>
      </button>
      <a className="metric" href="#/nutrition" style={{ '--meter': 'var(--orange)' }}>
        <Icon name="fork" />
        <dl><dt className="metric-label">{t('of {0} kcal', dailyNutri.goals.calories)}</dt><dd className="metric-value">{dailyNutri.totals.calories}<small>kcal</small></dd></dl>
        <span className="nutri-meter" aria-hidden="true"><i style={{ width: nutriCalsPct + '%' }} /></span>
      </a>
    </div>

    <TrainingPauseAction onlyPaused />
  </div>
}
