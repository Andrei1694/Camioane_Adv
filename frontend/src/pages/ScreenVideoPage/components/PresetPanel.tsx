import { useEffect, useId, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { handleAdminError } from '../../../auth/adminAccess'
import { useSession } from '../../../auth/session'
import { api, ApiError, errorMessage } from '../../../lib/api'
import { sameLayout, screenLayoutError, screenPresetNameError, screenPresetsKey } from '../../../lib/screenPreset'
import type { ScreenLayout, ScreenPreset, ScreenPresetInput } from '../../../lib/screenPreset'
import { useNotify } from '../../../lib/useNotify'

type Action = 'save' | 'create' | 'delete'

interface Props {
  layout: ScreenLayout
  selectedPreset: ScreenPreset | null
  name: string
  touched: boolean
  busy: boolean
  onSelect: (preset: ScreenPreset) => void
  onNameChange: (name: string) => void
  onDelete: () => void
  onPendingChange: (pending: boolean) => void
}

export default function PresetPanel({ layout, selectedPreset, name, touched, busy,
  onSelect, onNameChange, onDelete, onPendingChange }: Props) {
  const revision = useSession((state) => state.revision)
  const queryClient = useQueryClient()
  const notify = useNotify()
  const ids = useId()
  const inFlight = useRef(false)
  const lifetime = useRef<AbortController | null>(null)
  const [failure, setFailure] = useState<{ message: string, action: Action } | null>(null)
  const [conflict, setConflict] = useState(false)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller
    return () => controller.abort()
  }, [])

  const list = useQuery({
    queryKey: screenPresetsKey(revision),
    queryFn: async ({ signal }) => {
      try { return await api.screenPresets(signal) }
      catch (error) { await handleAdminError(error, revision); throw error }
    },
  })
  const save = useMutation({
    mutationFn: ({ original, input }: { original: ScreenPreset | null, input: ScreenPresetInput }) => original
      ? api.updateScreenPreset(original.id, { ...input, version: original.version }) : api.createScreenPreset(input),
  })
  const remove = useMutation({ mutationFn: api.deleteScreenPreset })
  const pending = save.isPending || remove.isPending
  const disabled = busy || pending
  const selectedPresetId = selectedPreset?.id ?? ''
  const latest = list.data?.find((preset) => preset.id === selectedPresetId)
  const dirty = selectedPreset ? name.trim() !== selectedPreset.name || !sameLayout(layout, selectedPreset) : touched
  const nameError = screenPresetNameError(name)
  const validation = screenLayoutError(layout) || nameError
  const unavailable = missing || (list.isSuccess && !!selectedPreset && !latest)

  useEffect(() => {
    if (!touched && !busy && !pending && list.isSuccess && list.data[0]) onSelect(list.data[0])
  }, [touched, busy, pending, list.isSuccess, list.data, onSelect])

  function current() {
    return lifetime.current !== null && !lifetime.current.signal.aborted && revision === useSession.getState().revision
  }

  function refresh() {
    if (current()) void queryClient.invalidateQueries({ queryKey: screenPresetsKey(revision) })
  }

  function select(preset: ScreenPreset) {
    if (disabled || inFlight.current) return
    if (dirty && !window.confirm('Renunți la modificările nesalvate ale acestei configurații?')) return
    setFailure(null)
    setConflict(false)
    setMissing(false)
    onSelect(preset)
  }

  async function persist(action: Action) {
    if (disabled || inFlight.current || (action !== 'delete' && validation)) return
    if (action !== 'create' && (!selectedPreset || unavailable)) return
    if (action === 'save' && (!dirty || conflict)) return
    if (action === 'delete' && !window.confirm(`Ștergi definitiv presetul „${selectedPreset!.name}” pentru toți administratorii?`)) return
    inFlight.current = true
    onPendingChange(true)
    setFailure(null)
    const original = action === 'create' ? null : selectedPreset
    try {
      const result = action === 'delete'
        ? await remove.mutateAsync(original!.id)
        : await save.mutateAsync({ original, input: { name: name.trim(), canvas: layout.canvas, regions: layout.regions } })
      if (!current()) return
      await queryClient.cancelQueries({ queryKey: screenPresetsKey(revision) })
      if (!current()) return
      queryClient.setQueryData<ScreenPreset[]>(screenPresetsKey(revision), (presets) => {
        const remaining = (presets ?? []).filter((preset) => preset.id !== (result?.id ?? original?.id))
        return result ? [...remaining, result].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)) : remaining
      })
      if (result) onSelect(result)
      else onDelete()
      setConflict(false)
      setMissing(false)
      notify({ variant: 'success', message: action === 'delete'
        ? `Presetul „${original!.name}” a fost șters. Configurația curentă este păstrată.`
        : `Presetul „${result!.name}” a fost salvat.` })
    } catch (error) {
      await handleAdminError(error, revision)
      if (!current()) return
      let message = errorMessage(error)
      if (error instanceof ApiError && error.status === 409) {
        setConflict(true)
        message = 'Presetul a fost modificat de alt administrator. Modificările tale sunt păstrate. Reîncarcă presetul sau salvează configurația ca preset nou.'
      }
      if (error instanceof ApiError && error.status === 404) {
        setMissing(true)
        message = 'Presetul a fost șters de alt administrator. Configurația ta este păstrată și poate fi salvată ca preset nou.'
      }
      setFailure({ message, action })
    } finally {
      inFlight.current = false
      if (current()) { onPendingChange(false); refresh() }
    }
  }

  async function retry() {
    if (conflict || unavailable) {
      const result = await list.refetch()
      if (!current() || result.isError) return
      const preset = result.data?.find((preset) => preset.id === selectedPresetId)
      if (preset) select(preset)
    } else if (failure) await persist(failure.action)
  }

  return <section className="screen-presets" aria-labelledby={`${ids}-title`} aria-busy={pending}>
    <h2 id={`${ids}-title`}>Preseturi de ecran</h2>
    <div className="screen-preset-fields">
      <div className="form-field">
        <label htmlFor={`${ids}-select`}>Configurație</label>
        <select id={`${ids}-select`} value={selectedPresetId} disabled={disabled || !list.data?.length}
          onChange={(event) => {
            const preset = list.data?.find((preset) => preset.id === event.currentTarget.value)
            if (preset) select(preset)
          }}>
          {!selectedPreset && <option value="">Configurație nesalvată</option>}
          {selectedPreset && !latest && <option value={selectedPreset.id}>{selectedPreset.name}{dirty ? ' (modificat)' : ''}</option>}
          {list.data?.map((preset) => <option key={preset.id} value={preset.id}>
            {preset.id === selectedPresetId ? selectedPreset!.name : preset.name}{preset.id === selectedPresetId && dirty ? ' (modificat)' : ''}
          </option>)}
        </select>
      </div>
      <div className="form-field">
        <label htmlFor={`${ids}-name`}>Numele presetului</label>
        <input id={`${ids}-name`} value={name} disabled={disabled} maxLength={200}
          aria-invalid={!!name && !!nameError} aria-describedby={`${ids}-name-hint`}
          onChange={(event) => { onNameChange(event.currentTarget.value); setFailure(null) }} />
        <p id={`${ids}-name-hint`} className={name && nameError ? 'field-error' : 'field-hint'}>
          {name && nameError ? nameError : 'Un nume de 1–200 de caractere este necesar pentru salvare.'}
        </p>
      </div>
    </div>
    <div className="screen-preset-actions">
      <button type="button" disabled={disabled || !selectedPreset || !dirty || !!validation || conflict || unavailable}
        onClick={() => void persist('save')}>Salvează</button>
      <button type="button" disabled={disabled || !!validation} onClick={() => void persist('create')}>Salvează ca preset nou</button>
      <button type="button" className="danger" disabled={disabled || !selectedPreset || unavailable}
        onClick={() => void persist('delete')}>Șterge</button>
      {selectedPreset && latest && (conflict || latest.version !== selectedPreset.version) && <button type="button"
        disabled={disabled} onClick={() => select(latest)}>Reîncarcă presetul</button>}
    </div>
    <p className="screen-note" role="status">{pending ? 'Se salvează modificările…'
      : list.isPending ? 'Se încarcă preseturile… Configurația ViPlex implicită este disponibilă.'
      : unavailable ? 'Presetul selectat nu mai există. Poți salva configurația ca preset nou.'
      : !list.data?.length ? 'Nu există preseturi disponibile. Configurația curentă poate fi salvată ca preset nou.'
      : dirty ? 'Configurația are modificări nesalvate.' : 'Preseturile sunt partajate între administratori.'}</p>
    {list.isError && <div className="request-error" role="alert">
      <p>Preseturile nu au putut fi încărcate. {errorMessage(list.error)}</p>
      <button type="button" disabled={disabled || list.isFetching} onClick={() => void list.refetch()}>Reîncearcă</button>
    </div>}
    {failure && <div className="request-error" role="alert">
      <p>{failure.message}</p>
      <button type="button" disabled={disabled || list.isFetching} onClick={() => void retry()}>Reîncearcă</button>
    </div>}
  </section>
}
