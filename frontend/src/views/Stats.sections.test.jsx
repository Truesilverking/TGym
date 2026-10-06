// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore, DEF } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { bindUI } from '../components/ui.jsx'
import { setLang } from '../lib/i18n.js'
import { STATS_SECTIONS } from '../lib/stats-sections.js'
import Stats from './Stats.jsx'

vi.mock('../sheets.jsx', () => ({
  bwSheet: () => {}, goalSheet: () => {}, measurementsSheet: () => {}, heightSheet: () => {},
  sessionTimingSheet: () => {}, inBodySheet: () => {}, confirmSheet: () => {}, workoutDetailSheet: () => {},
  WorkoutRow: ({ w }) => React.createElement('div', null, w.name), bwDeltaColor: () => 'inherit',
}))
vi.mock('../components/LineChart.jsx', () => ({ default: () => React.createElement('div') }))
vi.mock('../components/MeasurementBodyMap.jsx', () => ({ default: () => React.createElement('div') }))
vi.mock('../components/BodyMap.jsx', () => ({
  default: () => React.createElement('div'), BodyMapLegend: () => React.createElement('div'),
}))

const NOW = new Date('2026-10-06T12:00:00-04:00').getTime()
let host
let root

function state() {
  return {
    ...structuredClone(DEF), lang: 'en', effort: 'rir', hasCompletedOnboarding: true,
    trainingStartDate: '2026-09-01',
    routines: [{ id: 'routine', name: 'Saved routine', ex: [] }], routineOrder: ['routine'],
    workouts: [{
      id: 'workout', routineId: 'routine', name: 'Saved routine', d: '2026-10-05',
      start: NOW - 86400000, end: NOW - 86400000 + 3600000, unit: 'kg',
      entries: [{ id: '1254', target: { mode: 'reps' }, sets: [{ done: true, w: 80, r: 8, rir: 2 }] }],
    }],
    bodyweight: [{ d: '2026-10-05', w: 80 }],
    measurements: [{ id: 'measurement', d: '2026-10-05', waist: 85 }],
  }
}

async function renderStats(show = true) {
  await act(async () => { root.render(<MemoryRouter>{show && <Stats />}<TestSheets /></MemoryRouter>) })
}

function TestSheets() {
  const sheets = useUI(s => s.sheets)
  return sheets.map(sheet => <div key={sheet.id} data-test-sheet>{sheet.render(() => useUI.getState().closeSheet(sheet.id))}</div>)
}

function section(id) {
  return host.querySelector(`[data-stats-section="${id}"]`)
}

function visibleSections() {
  return [...host.querySelectorAll('[data-stats-section]')].filter(node => !node.hidden)
    .map(node => node.dataset.statsSection)
}

function checkbox(id) {
  const label = STATS_SECTIONS.find(([value]) => value === id)?.[1]
  return [...host.querySelectorAll('[role="checkbox"]')].find(node => node.getAttribute('aria-label') === label)
}

function sectionsTrigger() {
  return host.querySelector('.stats-sections-trigger')
}

function sectionsMenu() {
  return host.querySelector('#stats-sections-menu')
}

async function click(node) {
  expect(node).toBeTruthy()
  await act(async () => { node.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
}

async function toggle(id) {
  await openSections()
  await click(checkbox(id))
}

async function openSections() {
  if (sectionsTrigger().getAttribute('aria-expanded') !== 'true') await click(sectionsTrigger())
}

function button(scope, text) {
  return [...scope.querySelectorAll('button')].find(node => node.textContent.trim() === text)
}

beforeEach(async () => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  localStorage.clear()
  useStore.setState({ S: state(), user: null, ready: true, storageWarning: null })
  useUI.setState({ sheets: [] })
  bindUI(useUI)
  await setLang('en')
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => { root.unmount() })
  host.remove()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('configurable Stats sections', () => {
  it.each([undefined, null, [], ['retired-section'], 'history', {}])('uses only the initial selection for invalid preference %j', async preference => {
    const S = state()
    if (preference !== undefined) S.statsSections = preference
    else delete S.statsSections
    useStore.setState({ S })
    await renderStats()

    expect(visibleSections()).toEqual(['history', 'consistency'])
    await openSections()
    expect(checkbox('history').getAttribute('aria-checked')).toBe('true')
    expect(checkbox('consistency').getAttribute('aria-checked')).toBe('true')
    expect(useStore.getState().S.statsSections).toEqual(preference)
    expect(localStorage.getItem('gym_state_v1')).toBeNull()
  })

  it('starts with a closed compact selector before the section content', async () => {
    await renderStats()
    expect(sectionsTrigger().getAttribute('aria-expanded')).toBe('false')
    expect(sectionsTrigger().getAttribute('aria-controls')).toBe('stats-sections-menu')
    expect(sectionsMenu()).toBeNull()
    expect(host.querySelectorAll('[role="checkbox"]')).toHaveLength(0)
    expect(sectionsTrigger().compareDocumentPosition(section('history')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(host.querySelector('.stats-sections-label').textContent).toBe('Sections')
    expect(sectionsTrigger().querySelector('.lrow-v').textContent).toBe('2 sections selected')
    expect(visibleSections()).toEqual(['history', 'consistency'])
  })

  it('opens all existing section choices in a labeled group', async () => {
    await renderStats()
    await openSections()
    expect(sectionsTrigger().getAttribute('aria-expanded')).toBe('true')
    expect(sectionsMenu().getAttribute('role')).toBe('group')
    expect(sectionsMenu().getAttribute('aria-label')).toBe('Sections')
    expect(sectionsMenu().getAttribute('role')).not.toBe('menu')
    expect(host.querySelectorAll('[role="checkbox"]')).toHaveLength(STATS_SECTIONS.length)
    for (const [id] of STATS_SECTIONS) expect(checkbox(id)).toBeTruthy()
    expect(checkbox('history').compareDocumentPosition(section('history')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(host.textContent).toContain('Sections')
    expect(host.textContent).toContain('Select at least one section.')
  })

  it('renders one saved nondefault section without reactivating either initial section', async () => {
    useStore.setState({ S: { ...state(), statsSections: ['bodyweight', 'retired-section', 'bodyweight'] } })
    await renderStats()
    expect(visibleSections()).toEqual(['bodyweight'])
    expect(sectionsTrigger().querySelector('.lrow-v').textContent).toBe('Body Weight')
    await openSections()
    expect(checkbox('history').getAttribute('aria-checked')).toBe('false')
    expect(checkbox('consistency').getAttribute('aria-checked')).toBe('false')
  })

  it('allows both initial sections to be deselected and keeps the selector accessible', async () => {
    await renderStats()
    await toggle('bodyweight')
    await toggle('history')
    await toggle('consistency')

    expect(visibleSections()).toEqual(['bodyweight'])
    expect(section('history').hidden).toBe(true)
    expect(section('consistency').hidden).toBe(true)
    expect(checkbox('history').closest('[hidden]')).toBeNull()
    expect(checkbox('consistency').closest('[hidden]')).toBeNull()
    expect(useStore.getState().S.statsSections).toEqual(['bodyweight'])
  })

  it('keeps multiple selections in their original order without duplicates', async () => {
    await renderStats()
    await toggle('recent')
    await toggle('exercise')
    await toggle('overview')
    await toggle('duration')

    expect(visibleSections()).toEqual(['history', 'consistency', 'overview', 'duration', 'exercise', 'recent'])
    for (const id of visibleSections()) expect(host.querySelectorAll(`[data-stats-section="${id}"]`)).toHaveLength(1)
    expect(visibleSections()).not.toContain('bodyweight')
  })

  it('blocks deselecting the final section while leaving the checkbox operable', async () => {
    useStore.setState({ S: { ...state(), statsSections: ['bodyweight'] } })
    await renderStats()
    await openSections()
    const selected = checkbox('bodyweight')
    expect(selected.disabled).toBe(false)
    await click(selected)

    expect(visibleSections()).toEqual(['bodyweight'])
    expect(checkbox('bodyweight').getAttribute('aria-checked')).toBe('true')
    expect(sectionsTrigger().querySelector('.lrow-v').textContent).toBe('Body Weight')
    expect(useStore.getState().S.statsSections).toEqual(['bodyweight'])
    expect(host.textContent).toContain('Select at least one section.')
  })

  it('restores selection after leaving Stats and reopening the saved local profile', async () => {
    await renderStats()
    await toggle('measurements')
    await toggle('history')
    await toggle('consistency')
    const saved = JSON.parse(localStorage.getItem('gym_state_v1'))
    expect(saved.statsSections).toEqual(['measurements'])

    await renderStats(false)
    await renderStats()
    expect(visibleSections()).toEqual(['measurements'])
    expect(sectionsTrigger().getAttribute('aria-expanded')).toBe('false')
    expect(sectionsMenu()).toBeNull()

    await renderStats(false)
    useStore.setState({ S: { ...structuredClone(DEF), ...saved } })
    await renderStats()
    expect(visibleSections()).toEqual(['measurements'])
    expect(sectionsTrigger().getAttribute('aria-expanded')).toBe('false')
    await openSections()
    expect(checkbox('history').getAttribute('aria-checked')).toBe('false')
    expect(checkbox('consistency').getAttribute('aria-checked')).toBe('false')
  })

  it('keeps the dropdown open while selecting and deselecting sections', async () => {
    await renderStats()
    await openSections()
    await click(checkbox('bodyweight'))
    expect(sectionsTrigger().getAttribute('aria-expanded')).toBe('true')
    expect(sectionsMenu()).not.toBeNull()
    await click(checkbox('history'))
    await click(checkbox('consistency'))
    expect(sectionsTrigger().getAttribute('aria-expanded')).toBe('true')
    expect(visibleSections()).toEqual(['bodyweight'])
    expect(checkbox('bodyweight').getAttribute('aria-checked')).toBe('true')
  })

  it('closes from the trigger and reopens with the saved selection intact', async () => {
    await renderStats()
    await toggle('bodyweight')
    const selected = useStore.getState().S.statsSections
    await click(sectionsTrigger())
    expect(sectionsTrigger().getAttribute('aria-expanded')).toBe('false')
    expect(sectionsMenu()).toBeNull()
    expect(useStore.getState().S.statsSections).toEqual(selected)
    await openSections()
    expect(checkbox('bodyweight').getAttribute('aria-checked')).toBe('true')
  })

  it('closes on Escape from a checkbox and restores focus to the trigger', async () => {
    await renderStats()
    await openSections()
    const choice = checkbox('history')
    choice.focus()
    expect(document.activeElement).toBe(choice)
    await act(async () => { choice.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    expect(sectionsMenu()).toBeNull()
    expect(sectionsTrigger().getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(sectionsTrigger())
  })

  it('closes on outside pointer interaction and preserves inside pointer interaction', async () => {
    await renderStats()
    await openSections()
    await act(async () => {
      checkbox('history').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }))
    })
    expect(sectionsTrigger().getAttribute('aria-expanded')).toBe('true')
    await act(async () => { host.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' })) })
    expect(sectionsMenu()).toBeNull()
    expect(sectionsTrigger().getAttribute('aria-expanded')).toBe('false')
    expect(visibleSections()).toEqual(['history', 'consistency'])
  })

  it('preserves the muscle view and range while hiding and showing its section', async () => {
    useStore.setState({ S: { ...state(), statsSections: ['history', 'muscles'] } })
    await renderStats()
    await click(button(section('muscles'), '30d'))
    await click(button(section('muscles'), 'Strength'))
    await toggle('muscles')
    expect(section('muscles').hidden).toBe(true)
    await toggle('muscles')
    expect(button(section('muscles'), 'Strength').getAttribute('aria-pressed')).toBe('true')
    await click(button(section('muscles'), 'Muscle balance'))
    expect(button(section('muscles'), '30d').getAttribute('aria-pressed')).toBe('true')
  })

  it('preserves the independent Routine duration period while hiding and showing its section', async () => {
    useStore.setState({ S: { ...state(), statsSections: ['history', 'duration'] } })
    await renderStats()
    await click(section('duration').querySelector('button.lrow-select'))
    await click(button(host.querySelector('[data-test-sheet]'), 'Last 30 days'))
    expect(section('duration').querySelector('.lrow-v').textContent).toBe('Last 30 days')
    await toggle('duration')
    expect(section('duration').hidden).toBe(true)
    await toggle('duration')
    expect(section('duration').querySelector('.lrow-v').textContent).toBe('Last 30 days')
  })

  it('keeps the chosen measurement dates through visibility changes and resets them when measurement data changes', async () => {
    useStore.setState({ S: { ...state(), statsSections: ['history', 'measurements'], measurements: [
      { id: 'first', d: '2026-09-01', waist: 90 },
      { id: 'second', d: '2026-09-10', waist: 88 },
      { id: 'third', d: '2026-09-20', waist: 86 },
      { id: 'last', d: '2026-10-05', waist: 85 },
    ] } })
    await renderStats()
    const dates = () => [...section('measurements').querySelectorAll('.body-dates select')]
    const choose = async (index, value) => act(async () => {
      dates()[index].value = value
      dates()[index].dispatchEvent(new Event('change', { bubbles: true }))
    })
    await choose(0, '1')
    await choose(1, '2')
    expect(dates().map(select => select.value)).toEqual(['1', '2'])

    await toggle('measurements')
    expect(section('measurements').hidden).toBe(true)
    expect(dates().map(select => select.value)).toEqual(['1', '2'])
    await toggle('measurements')
    await toggle('bodyweight')
    expect(dates().map(select => select.value)).toEqual(['1', '2'])

    await act(async () => { useStore.getState().update(s => { s.measurements[2].waist = 84.5 }) })
    expect(dates().map(select => select.value)).toEqual(['0', '3'])
    expect(useStore.getState().S.measurements[2].waist).toBe(84.5)
  })

  it('changes visibility without changing saved workouts, routines, measurements or weight', async () => {
    const original = state()
    useStore.setState({ S: original })
    await renderStats()
    await toggle('effort')
    await toggle('history')
    await toggle('consistency')
    await toggle('bodyweight')
    await toggle('effort')
    const current = useStore.getState().S
    for (const key of ['workouts', 'routines', 'measurements', 'bodyweight', 'trainingStartDate']) {
      expect(current[key]).toEqual(original[key])
    }
  })
})
