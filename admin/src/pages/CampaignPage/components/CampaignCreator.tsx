import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useMutation } from '@tanstack/react-query'
import { handleAdminError } from '../../../auth/adminAccess'
import { useSession } from '../../../auth/session'
import { api, ApiError, errorMessage } from '../../../lib/api'
import { maxCampaignNameLength } from '../../../lib/campaign'
import type { CampaignInput, StoredCampaign } from '../../../lib/campaign'
import { formatCount, plural } from '../../../lib/format'
import CampaignCalendar from './CampaignCalendar'
import CampaignHoursCalendar from './CampaignHoursCalendar'
import CampaignReview from './CampaignReview'
import DayTimeline from './DayTimeline'
import IntervalEditor from './IntervalEditor'
import { changedPastDays, dayIsComplete, emptyInterval, formatDay, formatHours, formatTime, intervalErrors, monthOf, scheduleMinutes, todayInBucharest } from '../campaign'
import type { CampaignDay } from '../campaign'

interface CampaignCreatorProps {
  initialCampaign?: StoredCampaign
  onComplete: (campaign: StoredCampaign) => Promise<void>
  onCancel: () => void
  onReload: () => void
  reloading: boolean
  reloadError?: string
}

type Step = 0 | 1 | 2
const stepLabels = ['Zile', 'Ore de funcționare', 'Verifică'] as const

function focusControl(id: string) {
  document.getElementById(id)?.focus()
}

export default function CampaignCreator({ initialCampaign, onComplete, onCancel, onReload, reloading, reloadError }: CampaignCreatorProps) {
  const revision = useSession((state) => state.revision)
  const saving = useRef(false)
  const [today, setToday] = useState(todayInBucharest)
  const [month, setMonth] = useState(() => monthOf(initialCampaign?.days[0].date ?? today))
  const [name, setName] = useState(initialCampaign?.name ?? '')
  const [days, setDays] = useState<CampaignDay[]>(() => structuredClone(initialCampaign?.days ?? []))
  const [activeDate, setActiveDate] = useState(initialCampaign?.days[0].date ?? '')
  const [step, setStep] = useState<Step>(0)
  const [showErrors, setShowErrors] = useState(false)
  const [dateError, setDateError] = useState('')
  const [message, setMessage] = useState('')
  const save = useMutation({
    mutationFn: (input: CampaignInput) => initialCampaign
      ? api.updateCampaign(initialCampaign.id, { ...input, version: initialCampaign.version }) : api.createCampaign(input),
    onSuccess: async (campaign) => {
      if (revision === useSession.getState().revision) await onComplete(campaign)
    },
    onError: (error) => handleAdminError(error, revision),
  })
  const busy = save.isPending || reloading
  const conflict = save.error instanceof ApiError && save.error.status === 409
  const pastChanged = !!initialCampaign && changedPastDays(days, initialCampaign.days, today)

  const activeDay = days.find((day) => day.date === activeDate) ?? days[0]
  const totalMinutes = scheduleMinutes(days)
  const missingDays = days.filter((day) => !dayIsComplete(day)).length
  const campaignName = name.trim() || 'Campanie fără nume'
  const copyDayCount = days.filter((day) => day.date !== activeDay?.date && day.date >= today).length

  function blocked() { return saving.current || reloading }
  function readOnly(date: string) { return date < todayInBucharest() }

  useEffect(() => {
    focusControl('campaign-name')
    const refreshToday = () => setToday(todayInBucharest())
    const timer = window.setInterval(refreshToday, 60_000)
    window.addEventListener('focus', refreshToday)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshToday)
    }
  }, [])

  function chooseDate(date: string) {
    if (blocked()) return
    if (step !== 0) {
      setActiveDate(date)
      return
    }
    const alreadySelected = days.some((day) => day.date === date)
    if (initialCampaign && readOnly(date)) return
    if (!alreadySelected && date < todayInBucharest()) return
    const next = alreadySelected ? days.filter((day) => day.date !== date)
      : [...days, { date, intervals: [] }].sort((a, b) => a.date.localeCompare(b.date))
    setDays(next)
    setActiveDate(alreadySelected ? next[0]?.date ?? '' : date)
    setDateError('')
    setMessage(`${formatDay(date)} ${alreadySelected ? 'eliminată' : 'selectată'}. ${plural(next.length, 'zi selectată', 'zile selectate')}.`)
  }

  function goToStep(next: Step) {
    if (blocked()) return false
    const currentToday = todayInBucharest()
    const invalidPast = initialCampaign ? changedPastDays(days, initialCampaign.days, currentToday)
      : days.some((day) => day.date < currentToday)
    if (next > 0 && (!days.length || invalidPast)) {
      flushSync(() => {
        setToday(currentToday)
        setStep(0)
        setDateError(invalidPast ? initialCampaign ? 'Restabilește programul salvat pentru zilele trecute înainte de a continua.' : 'Elimină zilele trecute înainte de a continua.' : 'Selectează cel puțin o zi pentru campanie.')
      })
      focusControl('campaign-date-error')
      return false
    }
    if (next === 2) {
      const invalid = days.find((day) => !dayIsComplete(day))
      if (invalid) {
        flushSync(() => {
          setStep(1)
          setShowErrors(true)
          setActiveDate(invalid.date)
          setMonth(monthOf(invalid.date))
          setMessage(`Completează orele de funcționare pentru ${formatDay(invalid.date)} înainte de verificare.`)
        })
        const errors = intervalErrors(invalid.intervals)
        const first = invalid.intervals.find((interval) => errors.has(interval.id))
        focusControl(first ? `interval-${first.id}-${errors.get(first.id)!.field}` : 'campaign-add-interval')
        return false
      }
    }
    flushSync(() => {
      setStep(next)
      setDateError('')
      setMessage('')
      if (next > 0 && activeDay) { setActiveDate(activeDay.date); setMonth(monthOf(activeDay.date)) }
    })
    focusControl('campaign-stage-heading')
    return true
  }

  function changeInterval(id: string, field: 'start' | 'end', value: number | null) {
    if (blocked() || !activeDay || readOnly(activeDay.date)) return
    setDays((previous) => previous.map((day) => day.date === activeDay?.date
      ? { ...day, intervals: day.intervals.map((interval) => interval.id === id ? { ...interval, [field]: value } : interval) } : day))
    setMessage('')
  }

  function addInterval() {
    if (blocked() || !activeDay || readOnly(activeDay.date)) return
    const interval = emptyInterval()
    flushSync(() => setDays((previous) => previous.map((day) => day.date === activeDay?.date
      ? { ...day, intervals: [...day.intervals, interval] } : day)))
    focusControl(`interval-${interval.id}-start`)
  }

  function removeInterval(id: string) {
    if (blocked() || !activeDay || readOnly(activeDay.date)) return
    const remaining = activeDay.intervals.filter((interval) => interval.id !== id)
    flushSync(() => {
      setDays((previous) => previous.map((day) => day.date === activeDay.date ? { ...day, intervals: remaining } : day))
      setMessage('Intervalul a fost eliminat.')
    })
    focusControl(remaining.length ? `interval-${remaining[remaining.length - 1].id}-start` : 'campaign-add-interval')
  }

  function createCalendarInterval(date: string, start: number, end: number) {
    if (blocked()) return 'Așteaptă finalizarea cererii în curs.'
    if (readOnly(date)) return 'Zilele și orele trecute pot fi doar consultate.'
    const day = days.find((value) => value.date === date)
    if (!day) return 'Alege o zi selectată pentru campanie.'
    const interval = { id: crypto.randomUUID(), start, end }
    const error = intervalErrors([...day.intervals, interval]).get(interval.id)
    if (error) return error.message
    setDays((previous) => previous.map((value) => value.date === date
      ? { ...value, intervals: [...value.intervals, interval] } : value))
    setActiveDate(date)
    setMessage(`${formatTime(start)}–${formatTime(end)} adăugat la ${formatDay(date)}.`)
    return null
  }

  function editCalendarInterval(date: string, intervalId: string) {
    if (blocked()) return
    flushSync(() => { setActiveDate(date); setMonth(monthOf(date)); setMessage('') })
    focusControl(readOnly(date) ? 'campaign-stage-heading' : `interval-${intervalId}-start`)
  }

  function copyHours() {
    if (blocked() || !activeDay || !dayIsComplete(activeDay)) return
    const currentToday = todayInBucharest()
    const count = days.filter((day) => day.date !== activeDay.date && day.date >= currentToday).length
    setDays((previous) => previous.map((day) => day.date === activeDay.date || day.date < currentToday ? day
      : { ...day, intervals: activeDay.intervals.map((interval) => ({ ...interval, id: crypto.randomUUID() })) }))
    setMessage(`Orele din ${formatDay(activeDay.date)} au fost aplicate la ${plural(count, 'altă zi editabilă', 'alte zile editabile')}.`)
  }

  function editDay(date: string) {
    if (blocked()) return
    flushSync(() => { setStep(1); setActiveDate(date); setMonth(monthOf(date)); setMessage('') })
    focusControl('campaign-stage-heading')
  }

  function restorePastSchedule() {
    if (!initialCampaign || blocked()) return
    const currentToday = todayInBucharest()
    const next = [...structuredClone(initialCampaign.days.filter((day) => day.date < currentToday)),
      ...days.filter((day) => day.date >= currentToday)].sort((a, b) => a.date.localeCompare(b.date))
    flushSync(() => {
      setToday(currentToday); setDays(next); setDateError(''); setStep(0)
      setActiveDate(next[0]?.date ?? ''); setMonth(monthOf(next[0]?.date ?? currentToday))
      setMessage('Zilele și orele trecute au fost restabilite din versiunea salvată. Modificările pentru astăzi și zilele viitoare au fost păstrate.')
    })
    focusControl('campaign-stage-heading')
  }

  async function finishDraft() {
    if (blocked()) return
    if (!goToStep(2)) return
    saving.current = true
    try {
      await save.mutateAsync({ name: campaignName,
        days: days.map((day) => ({ date: day.date, intervals: day.intervals.map((interval) => ({ ...interval, start: interval.start!, end: interval.end! })) })),
      })
    } catch {
      setToday(todayInBucharest())
      requestAnimationFrame(() => focusControl('campaign-save-error'))
    } finally {
      saving.current = false
    }
  }

  return <section className="campaign-page campaign-creator-page" aria-labelledby="campaign-heading">
    <header className="campaign-page-heading">
      <div><h1 id="campaign-heading">{initialCampaign ? 'Editează campania' : 'Creare campanie'}</h1><p className="page-description">Alege zilele. Stabilește orele. Verifică programul.</p></div>
      <span className="pill pill-neutral">{initialCampaign ? 'Schiță' : 'Schiță nesalvată'}</span>
    </header>

    <fieldset className="campaign-form" disabled={busy} aria-label={initialCampaign ? 'Editează campania' : 'Creează o campanie'} aria-busy={busy}>
      <div className="campaign-progress">
        <nav aria-label="Etapele campaniei"><ol className="campaign-steps">
          {stepLabels.map((label, index) => <li key={label}>
            <button type="button" aria-current={step === index ? 'step' : undefined} onClick={() => goToStep(index as Step)}>
              {index < step && <svg className="campaign-check" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg>}{label}
            </button>
          </li>)}
        </ol></nav>
        <dl className="campaign-totals" aria-label="Totaluri pentru schiță">
          <div><dt>Zile selectate</dt><dd className="num">{formatCount(days.length)}</dd></div>
          <div><dt>Ore programate</dt><dd className="num">{formatHours(totalMinutes)}</dd></div>
        </dl>
      </div>

      {initialCampaign && days.some((day) => day.date < today) && <p className="campaign-help">Zilele și orele trecute pot fi doar consultate. Poți redenumi în continuare campania.</p>}
      {pastChanged && <div className="campaign-past-warning" role="alert">
        <p>O zi a trecut în timpul editării. Restabilește programul ei salvat înainte de a salva; modificările pentru astăzi și zilele viitoare vor fi păstrate.</p>
        <button type="button" onClick={restorePastSchedule}>Restabilește programul trecut salvat</button>
      </div>}

      <div className="campaign-workspace">
        <div className="campaign-calendar-panel">
          {step === 1 ? <CampaignHoursCalendar days={days} activeDate={activeDay?.date ?? ''} showErrors={showErrors} readOnlyBefore={today}
            onDate={chooseDate} onCreate={createCalendarInterval} onEdit={editCalendarInterval} /> : <>
            <CampaignCalendar days={days} today={today} month={month} activeDate={activeDay?.date ?? ''}
              selecting={step === 0} showErrors={showErrors} lockedBefore={initialCampaign ? today : undefined} onMonth={setMonth} onDate={chooseDate} />
            {step === 2 && activeDay && <DayTimeline day={activeDay} />}
          </>}
        </div>
        <div className="campaign-detail">
          <h2 id="campaign-stage-heading" tabIndex={-1}>{step === 0 ? 'Zilele campaniei' : step === 1 ? 'Stabilește programul zilnic' : 'Verifică-ți campania'}</h2>
          {step === 0 ? <>
            <div className="form-field campaign-name-field">
              <label htmlFor="campaign-name">Numele campaniei <span className="optional-label">(opțional)</span></label>
              <input id="campaign-name" autoComplete="off" maxLength={maxCampaignNameLength} value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="campaign-date-summary">
              <h3>{days.length ? plural(days.length, 'zi selectată', 'zile selectate') : 'Nicio zi selectată'}</h3>
              <p className="campaign-help">{days.length ? 'Zilele selectate pot fi consecutive sau din luni diferite.' : 'Selectează zilele în care va rula campania. Poți stabili ore diferite pentru fiecare zi.'}</p>
              {days.length > 0 && <ul className="campaign-selected-dates">{days.map((day) => <li key={day.date}>
                <span>{formatDay(day.date)}</span>
                <button type="button" className="icon-button" disabled={!!initialCampaign && day.date < today} aria-label={`Elimină ${formatDay(day.date)}`} onClick={() => {
                  flushSync(() => chooseDate(day.date))
                  focusControl('campaign-name')
                }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M7 17 17 7" /></svg></button>
              </li>)}</ul>}
            </div>
            {dateError && <p id="campaign-date-error" className="field-error" role="alert" tabIndex={-1}>{dateError}</p>}
          </> : step === 1 && activeDay ? <>
            <p className="campaign-help campaign-schedule-progress">{missingDays ? `Lipsesc orele pentru ${plural(missingDays, 'zi', 'zile')}.` : 'Fiecare zi selectată are ore de funcționare.'}</p>
            <div className="form-field campaign-day-select">
              <label htmlFor="campaign-edit-day">Zi de editat</label>
              <select id="campaign-edit-day" value={activeDay.date} onChange={(event) => { setActiveDate(event.target.value); setMonth(monthOf(event.target.value)) }}>
                {days.map((day) => <option key={day.date} value={day.date}>{formatDay(day.date)}{dayIsComplete(day) ? '' : ' · Lipsesc orele'}</option>)}
              </select>
            </div>
            <IntervalEditor key={activeDay.date} day={activeDay} copyDayCount={copyDayCount} readOnly={activeDay.date < today} showErrors={showErrors}
              onChange={changeInterval} onAdd={addInterval} onRemove={removeInterval} onCopy={copyHours} />
          </> : <>
            <p className="campaign-review-name">{campaignName}</p>
            <dl className="campaign-review-facts">
              <div><dt>Prima zi</dt><dd>{days[0] ? formatDay(days[0].date) : '—'}</dd></div>
              <div><dt>Ultima zi</dt><dd>{days.length ? formatDay(days[days.length - 1].date) : '—'}</dd></div>
              <div><dt>Fus orar</dt><dd>Europe/Bucharest</dd></div>
            </dl>
            <p className="campaign-help">Verifică fiecare zi și interval din programul de mai jos înainte de a finaliza schița.</p>
            <button type="button" className="text-button campaign-edit-dates" onClick={() => goToStep(0)}>Editează numele sau zilele</button>
            <CampaignReview days={days} onEdit={editDay} readOnlyBefore={today} />
          </>}
        </div>
      </div>

      <p className="campaign-message" role="status" aria-atomic="true">{message}</p>
      {save.isError && <div id="campaign-save-error" className="request-error" role="alert" tabIndex={-1}>
        <p>{errorMessage(save.error)}</p>
        {conflict && initialCampaign && <button type="button" onClick={onReload}>Renunță la modificări și reîncarcă ultima versiune a campaniei</button>}
      </div>}
      {reloadError && <p className="request-error" role="alert">{reloadError}</p>}
      <footer className="campaign-footer">
        <p className="campaign-help">Salvarea face schița disponibilă tuturor administratorilor. Nu lansează campania. Modificările nesalvate se pierd la ieșire.</p>
        <div className="campaign-actions">
          <button type="button" onClick={onCancel}>Anulează</button>
          {step > 0 && <button type="button" onClick={() => goToStep(step === 2 ? 1 : 0)}>Înapoi</button>}
          <button type="button" className="primary-button" onClick={() => step === 2 ? void finishDraft() : goToStep(step === 0 ? 1 : 2)}>
            {reloading ? 'Se reîncarcă…' : save.isPending ? 'Se salvează…' : step === 0 ? 'Stabilește orele' : step === 1 ? 'Verifică campania' : initialCampaign ? 'Salvează modificările' : 'Salvează schița'}
            {step !== 2 && <span aria-hidden="true"> →</span>}
          </button>
        </div>
      </footer>
    </fieldset>
  </section>
}
