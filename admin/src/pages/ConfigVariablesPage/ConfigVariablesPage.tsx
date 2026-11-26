import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminAccessOptions, handleAdminError } from '../../auth/adminAccess'
import { useSession } from '../../auth/session'
import { api, ApiError, errorMessage } from '../../lib/api'
import { configVariablesKey } from '../../lib/configVariable'
import type { ConfigVariable, ConfigVariableInput } from '../../lib/configVariable'
import { formatCount, plural } from '../../lib/format'
import { useNotify } from '../../lib/useNotify'
import { matchesConfigVariableSearch } from './configVariable'
import ConfigVariableForm from './components/ConfigVariableForm'
import DeleteConfirmationDialog from '../../components/DeleteConfirmationDialog'
import './ConfigVariablesPage.css'

export default function ConfigVariablesPage() {
  const revision = useSession((state) => state.revision)
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<{ variable?: ConfigVariable, instance: number } | null>(null)
  const [deleting, setDeleting] = useState<ConfigVariable | null>(null)
  const [formFailure, setFormFailure] = useState('')
  const [deleteFailure, setDeleteFailure] = useState('')
  const [missing, setMissing] = useState(false)
  const [deleteMissing, setDeleteMissing] = useState(false)
  const [canReload, setCanReload] = useState(false)
  const [reloading, setReloading] = useState(false)
  const mounted = useRef(false)
  const inFlight = useRef(false)
  const instance = useRef(0)
  const addButton = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef<HTMLButtonElement | null>(null)
  const notify = useNotify()
  const list = useQuery({
    queryKey: [...configVariablesKey(revision), 'list'],
    queryFn: async ({ signal }) => {
      try { return await api.configVariables(signal) }
      catch (error) { await handleAdminError(error, revision); throw error }
    },
  })
  const save = useMutation({
    mutationFn: ({ original, input }: { original?: ConfigVariable, input: ConfigVariableInput }) => original
      ? api.updateConfigVariable(original.id, { ...input, version: original.version }) : api.createConfigVariable(input),
    onError: (error) => handleAdminError(error, revision),
  })
  const remove = useMutation({ mutationFn: api.deleteConfigVariable, onError: (error) => handleAdminError(error, revision) })
  const variables = list.data ?? []
  const filtered = variables.filter((variable) => matchesConfigVariableSearch(variable, search))
  const hasFilters = search !== ''
  const busy = editor !== null || deleting !== null || save.isPending || remove.isPending || reloading

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    const previous = document.title
    document.title = 'Variabile de configurare · Camioane App'
    return () => { document.title = previous }
  }, [])

  // A late mutation must not publish data or feedback after logout, denial, or navigation.
  function canCommit() {
    const access = queryClient.getQueryState(adminAccessOptions(revision).queryKey)
    return mounted.current && revision === useSession.getState().revision
      && access?.status === 'success' && access.data?.status === 'granted'
  }

  function refreshVariables() {
    if (revision === useSession.getState().revision) void queryClient.invalidateQueries({ queryKey: configVariablesKey(revision) })
  }

  async function updateCache(id: string, variable?: ConfigVariable) {
    await queryClient.cancelQueries({ queryKey: configVariablesKey(revision) })
    if (!canCommit()) return false
    queryClient.setQueryData<ConfigVariable[]>([...configVariablesKey(revision), 'list'], (current) => {
      if (!current) return current
      const next = current.filter((row) => row.id !== id)
      if (variable) next.push(variable)
      return next.sort((a, b) => a.name.localeCompare(b.name, 'ro') || a.id.localeCompare(b.id))
    })
    if (variable) queryClient.setQueryData([...configVariablesKey(revision), 'detail', id], variable)
    else queryClient.removeQueries({ queryKey: [...configVariablesKey(revision), 'detail', id], exact: true })
    refreshVariables()
    return true
  }

  function openEditor(variable?: ConfigVariable) {
    setFormFailure('')
    setMissing(false)
    setCanReload(false)
    setEditor({ variable, instance: ++instance.current })
  }

  function clearFilters() {
    setSearch('')
  }

  function restoreFocus() {
    requestAnimationFrame(() => {
      const target = returnFocus.current
      if (target?.isConnected && !target.disabled) target.focus()
      else addButton.current?.focus()
    })
  }

  function closeEditor() {
    setEditor(null)
    restoreFocus()
  }

  async function saveVariable(input: ConfigVariableInput) {
    if (inFlight.current || !editor || missing) return
    inFlight.current = true
    const original = editor?.variable
    setFormFailure('')
    try {
      const saved = await save.mutateAsync({ original, input })
      if (!await updateCache(saved.id, saved) || !canCommit()) return
      // A saved variable should remain visible after its name or value changes.
      clearFilters()
      closeEditor()
      notify({ variant: 'success', message: `${original ? 'S-a actualizat' : 'S-a adăugat'} ${saved.name}.` })
    } catch (error) {
      if (!canCommit()) return
      setFormFailure(errorMessage(error))
      if (error instanceof ApiError && error.status === 409) {
        setCanReload(Boolean(original))
        refreshVariables()
      }
      if (error instanceof ApiError && error.status === 404) {
        setMissing(true)
        setFormFailure('Această variabilă a fost ștearsă. Închide editorul pentru a reveni la listă.')
        if (original) await updateCache(original.id)
      }
    } finally {
      inFlight.current = false
    }
  }

  async function reloadVariable() {
    if (inFlight.current || !editor?.variable) return
    inFlight.current = true
    setReloading(true)
    setFormFailure('')
    const id = editor.variable.id
    try {
      const variable = await queryClient.fetchQuery({
        queryKey: [...configVariablesKey(revision), 'detail', id],
        queryFn: ({ signal }) => api.configVariable(id, signal), staleTime: 0,
      })
      if (!await updateCache(variable.id, variable) || !canCommit()) return
      openEditor(variable)
    } catch (error) {
      await handleAdminError(error, revision)
      if (!canCommit()) return
      setFormFailure(errorMessage(error))
      if (error instanceof ApiError && error.status === 404) {
        setMissing(true)
        setFormFailure('Această variabilă a fost ștearsă. Închide editorul pentru a reveni la listă.')
        await updateCache(id)
      }
    } finally {
      inFlight.current = false
      if (mounted.current) setReloading(false)
    }
  }

  function closeDelete() {
    setDeleting(null)
    restoreFocus()
  }

  async function deleteConfigVariable() {
    if (inFlight.current || !deleting || deleteMissing) return
    inFlight.current = true
    setDeleteFailure('')
    try {
      await remove.mutateAsync(deleting.id)
      if (!await updateCache(deleting.id) || !canCommit()) return
      notify({ variant: 'success', message: `S-a șters ${deleting.name}.` })
      closeDelete()
    } catch (error) {
      if (!canCommit()) return
      setDeleteFailure(errorMessage(error))
      if (error instanceof ApiError && error.status === 404) {
        setDeleteMissing(true)
        setDeleteFailure('Această variabilă a fost deja ștearsă. Închide dialogul pentru a reveni la listă.')
        await updateCache(deleting.id)
      }
    } finally {
      inFlight.current = false
    }
  }

  return (
    <section className="config-variables-page">
      <header>
        <div className="page-heading">
          <h1>Variabile de configurare</h1>
          <button ref={addButton} className={editor ? undefined : 'primary-button'} type="button" disabled={busy || !list.data}
            onClick={(event) => {
              returnFocus.current = event.currentTarget
              openEditor()
            }}>Adaugă o variabilă</button>
        </div>
        <p className="page-description">Gestionează numele, valorile și descrierile variabilelor. Modificările salvate sunt disponibile tuturor administratorilor.</p>
      </header>

      {editor && <ConfigVariableForm key={editor.instance} variable={editor.variable} variables={variables}
        onSave={(input) => void saveVariable(input)} onCancel={closeEditor} pending={save.isPending}
        reloading={reloading} error={formFailure} missing={missing} canReload={canReload} onReload={() => void reloadVariable()} />}

      {list.isError && <p className="request-error" role="alert">
        {errorMessage(list.error)} {list.data && 'Se afișează ultimele variabile încărcate.'}{' '}
        <button type="button" disabled={list.isFetching} onClick={() => void list.refetch()}>{list.isFetching ? 'Se reîncearcă…' : 'Reîncearcă'}</button>
      </p>}

      <div className="config-variables-search form-field" role="search" aria-label="Caută variabile">
        <label htmlFor="config-variables-search">Caută variabile</label>
        <input id="config-variables-search" type="search" placeholder="Nume, valoare sau descriere" value={search}
          onChange={(event) => setSearch(event.target.value)} />
      </div>

      <div className="config-variables-table-frame" aria-busy={list.isFetching}>
        <table className="config-variables-table" role="table" aria-label="Variabile de configurare">
          <caption>
            <div className="config-variables-list-heading">
              <span aria-live="polite" aria-atomic="true">
                {!list.data ? 'Variabile' : hasFilters ? `${formatCount(filtered.length)} din ${plural(variables.length, 'variabilă', 'variabile')}` : plural(variables.length, 'variabilă', 'variabile')}
                {list.isFetching && list.data ? ' · Se actualizează…' : ''}
              </span>
              <button className="text-button" type="button" disabled={!hasFilters} onClick={clearFilters}>Resetează căutarea</button>
            </div>
          </caption>
          <thead role="rowgroup"><tr role="row">
            <th scope="col" role="columnheader">Nume</th>
            <th scope="col" role="columnheader">Valoare</th>
            <th scope="col" role="columnheader">Descriere</th>
            <th scope="col" role="columnheader" className="config-variables-actions-column">Acțiuni</th>
          </tr></thead>
          <tbody role="rowgroup">
            {filtered.map((variable) => (
              <tr key={variable.id} role="row">
                <th scope="row" role="rowheader" className="config-variable-name">{variable.name}</th>
                <td role="cell">
                  <span className="config-variables-mobile-label" aria-hidden="true">Valoare</span>
                  {variable.value.trim() ? <div className="config-variable-text" tabIndex={0} role="region" aria-label={`Valoarea ${variable.name}`}>{variable.value}</div>
                    : <span className="missing">{variable.value ? 'Doar spații și linii noi' : 'Valoare goală'}</span>}
                </td>
                <td role="cell">
                  <span className="config-variables-mobile-label" aria-hidden="true">Descriere</span>
                  {variable.description ? <div className="config-variable-text" tabIndex={0} role="region" aria-label={`Descrierea ${variable.name}`}>{variable.description}</div>
                    : <span className="missing">Fără descriere</span>}
                </td>
                <td role="cell"><div className="config-variables-row-actions">
                  <button type="button" className="text-button" aria-label={`Editează ${variable.name}`} disabled={busy}
                    onClick={(event) => {
                      returnFocus.current = event.currentTarget
                      openEditor(variable)
                    }}>Editează</button>
                  <button type="button" className="text-button danger" aria-label={`Șterge ${variable.name}`} disabled={busy}
                    onClick={(event) => {
                      returnFocus.current = event.currentTarget
                      setDeleteFailure('')
                      setDeleteMissing(false)
                      setDeleting(variable)
                    }}>Șterge</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.isPending && <p className="empty-state config-variables-empty" role="status">Se încarcă variabilele…</p>}
        {list.data && filtered.length === 0 && <p className="empty-state config-variables-empty">
          {variables.length === 0 ? 'Nu există încă variabile de configurare. Adaugă o variabilă pentru a începe.' : 'Nicio variabilă nu corespunde căutării. Încearcă alt termen sau resetează căutarea.'}
        </p>}
      </div>
      {deleting && <DeleteConfirmationDialog title={`Ștergi variabila ${deleting.name}?`}
        description="Variabila va fi ștearsă definitiv pentru toți administratorii." deleteLabel="Șterge variabila"
        onCancel={closeDelete} onDelete={() => void deleteConfigVariable()}
        pending={remove.isPending} error={deleteFailure} missing={deleteMissing} />}
    </section>
  )
}

