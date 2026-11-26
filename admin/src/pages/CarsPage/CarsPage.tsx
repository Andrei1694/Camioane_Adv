import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminAccessOptions, handleAdminError } from '../../auth/adminAccess'
import { useSession } from '../../auth/session'
import { api, ApiError, errorMessage } from '../../lib/api'
import { carRoutes, carStatuses, carsKey, plateKey } from '../../lib/car'
import type { Car, CarInput } from '../../lib/car'
import { formatCount, plural } from '../../lib/format'
import { useNotify } from '../../lib/useNotify'
import { carStatusLabels, carStatusTones, matchesCarSearch } from './car'
import CarForm from './components/CarForm'
import DeleteCarDialog from './components/DeleteCarDialog'
import './CarsPage.css'

export default function CarsPage() {
  const revision = useSession((state) => state.revision)
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [routeFilter, setRouteFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [editor, setEditor] = useState<{ car?: Car, instance: number } | null>(null)
  const [deleting, setDeleting] = useState<Car | null>(null)
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
    queryKey: [...carsKey(revision), 'list'],
    queryFn: async ({ signal }) => {
      try { return await api.cars(signal) }
      catch (error) { await handleAdminError(error, revision); throw error }
    },
  })
  const save = useMutation({
    mutationFn: ({ original, input }: { original?: Car, input: CarInput }) => original
      ? api.updateCar(original.id, { ...input, version: original.version }) : api.createCar(input),
    onError: (error) => handleAdminError(error, revision),
  })
  const remove = useMutation({ mutationFn: api.deleteCar, onError: (error) => handleAdminError(error, revision) })
  const cars = list.data ?? []
  const filtered = cars.filter((car) => matchesCarSearch(car, search)
    && (routeFilter === 'all' || (car.routeId ?? 'unassigned') === routeFilter)
    && (statusFilter === 'all' || car.status === statusFilter))
  const hasFilters = search !== '' || routeFilter !== 'all' || statusFilter !== 'all'
  const busy = editor !== null || deleting !== null || save.isPending || remove.isPending || reloading

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    const previous = document.title
    document.title = 'Mașini · Camioane App'
    return () => { document.title = previous }
  }, [])

  // A late mutation must not publish data or feedback after logout, denial, or navigation.
  function canCommit() {
    const access = queryClient.getQueryState(adminAccessOptions(revision).queryKey)
    return mounted.current && revision === useSession.getState().revision
      && access?.status === 'success' && access.data?.status === 'granted'
  }

  function refreshCars() {
    if (revision === useSession.getState().revision) void queryClient.invalidateQueries({ queryKey: carsKey(revision) })
  }

  async function updateCache(id: string, car?: Car) {
    await queryClient.cancelQueries({ queryKey: carsKey(revision) })
    if (!canCommit()) return false
    queryClient.setQueryData<Car[]>([...carsKey(revision), 'list'], (current) => {
      if (!current) return current
      const next = current.filter((row) => row.id !== id)
      if (car) next.push(car)
      return next.sort((a, b) => {
        const left = plateKey(a.plate), right = plateKey(b.plate)
        return left < right ? -1 : left > right ? 1 : a.id.localeCompare(b.id)
      })
    })
    if (car) queryClient.setQueryData([...carsKey(revision), 'detail', id], car)
    else queryClient.removeQueries({ queryKey: [...carsKey(revision), 'detail', id], exact: true })
    refreshCars()
    return true
  }

  function openEditor(car?: Car) {
    setFormFailure('')
    setMissing(false)
    setCanReload(false)
    setEditor({ car, instance: ++instance.current })
  }

  function clearFilters() {
    setSearch('')
    setRouteFilter('all')
    setStatusFilter('all')
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

  async function saveCar(input: CarInput) {
    if (inFlight.current || !editor || missing) return
    inFlight.current = true
    const original = editor?.car
    setFormFailure('')
    try {
      const saved = await save.mutateAsync({ original, input })
      if (!await updateCache(saved.id, saved) || !canCommit()) return
      // A saved car should be visible even when its new details no longer match the filters.
      clearFilters()
      closeEditor()
      notify({ variant: 'success', message: `${original ? 'S-a actualizat' : 'S-a adăugat'} ${saved.plate}.` })
    } catch (error) {
      if (!canCommit()) return
      setFormFailure(errorMessage(error))
      if (error instanceof ApiError && error.status === 409) {
        setCanReload(Boolean(original))
        refreshCars()
      }
      if (error instanceof ApiError && error.status === 404) {
        setMissing(true)
        setFormFailure('Această mașină a fost ștearsă. Închide editorul pentru a reveni la flotă.')
        if (original) await updateCache(original.id)
      }
    } finally {
      inFlight.current = false
    }
  }

  async function reloadCar() {
    if (inFlight.current || !editor?.car) return
    inFlight.current = true
    setReloading(true)
    setFormFailure('')
    const id = editor.car.id
    try {
      const car = await queryClient.fetchQuery({
        queryKey: [...carsKey(revision), 'detail', id],
        queryFn: ({ signal }) => api.car(id, signal), staleTime: 0,
      })
      if (!await updateCache(car.id, car) || !canCommit()) return
      openEditor(car)
    } catch (error) {
      await handleAdminError(error, revision)
      if (!canCommit()) return
      setFormFailure(errorMessage(error))
      if (error instanceof ApiError && error.status === 404) {
        setMissing(true)
        setFormFailure('Această mașină a fost ștearsă. Închide editorul pentru a reveni la flotă.')
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

  async function deleteCar() {
    if (inFlight.current || !deleting || deleteMissing) return
    inFlight.current = true
    setDeleteFailure('')
    try {
      await remove.mutateAsync(deleting.id)
      if (!await updateCache(deleting.id) || !canCommit()) return
      notify({ variant: 'success', message: `S-a șters ${deleting.plate}.` })
      closeDelete()
    } catch (error) {
      if (!canCommit()) return
      setDeleteFailure(errorMessage(error))
      if (error instanceof ApiError && error.status === 404) {
        setDeleteMissing(true)
        setDeleteFailure('Această mașină a fost deja ștearsă. Închide dialogul pentru a reveni la flotă.')
        await updateCache(deleting.id)
      }
    } finally {
      inFlight.current = false
    }
  }

  return (
    <section className="cars-page">
      <header>
        <div className="page-heading">
          <h1>Mașini</h1>
          <button ref={addButton} className={editor ? undefined : 'primary-button'} type="button" disabled={busy || !list.data}
            onClick={(event) => {
              returnFocus.current = event.currentTarget
              openEditor()
            }}>Adaugă o mașină</button>
        </div>
        <p className="page-description">Gestionează mașinile, numele șoferilor, traseele și starea flotei. Modificările salvate sunt disponibile tuturor administratorilor.</p>
      </header>

      {editor && <CarForm key={editor.instance} car={editor.car} cars={cars} onSave={(input) => void saveCar(input)} onCancel={closeEditor}
        pending={save.isPending} reloading={reloading} error={formFailure} missing={missing} canReload={canReload} onReload={() => void reloadCar()} />}

      {list.isError && <p className="request-error" role="alert">
        {errorMessage(list.error)} {list.data && 'Se afișează ultimul inventar încărcat.'}{' '}
        <button type="button" disabled={list.isFetching} onClick={() => void list.refetch()}>{list.isFetching ? 'Se reîncearcă…' : 'Reîncearcă'}</button>
      </p>}

      <div className="cars-filters" role="search" aria-label="Filtrează mașinile">
        <div className="form-field cars-search">
          <label htmlFor="cars-search">Caută mașini</label>
          <input id="cars-search" type="search" placeholder="Număr de înmatriculare, marcă/model sau șofer" value={search}
            onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="cars-route-filter">Traseu</label>
          <select id="cars-route-filter" value={routeFilter} onChange={(event) => setRouteFilter(event.target.value)}>
            <option value="all">Toate traseele</option>
            <option value="unassigned">Neatribuit</option>
            {carRoutes.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="cars-status-filter">Stare</label>
          <select id="cars-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">Toate stările</option>
            {carStatuses.map((status) => <option key={status} value={status}>{carStatusLabels[status]}</option>)}
          </select>
        </div>
      </div>

      <div className="cars-table-frame" aria-busy={list.isFetching}>
        <table className="cars-table" role="table" aria-label="Mașini">
          <caption>
            <div className="cars-list-heading">
              <span aria-live="polite" aria-atomic="true">
                {!list.data ? 'Mașini' : hasFilters ? `${formatCount(filtered.length)} din ${plural(cars.length, 'mașină', 'mașini')}` : plural(cars.length, 'mașină', 'mașini')}
                {list.isFetching && list.data ? ' · Se actualizează…' : ''}
              </span>
              <button className="text-button" type="button" disabled={!hasFilters} onClick={clearFilters}>Resetează filtrele</button>
            </div>
          </caption>
          <thead role="rowgroup"><tr role="row">
            <th scope="col" role="columnheader">Număr de înmatriculare</th>
            <th scope="col" role="columnheader">Marcă/model</th>
            <th scope="col" role="columnheader">Șofer</th>
            <th scope="col" role="columnheader" className="cars-route-column">Traseu</th>
            <th scope="col" role="columnheader" className="cars-status-column">Stare</th>
            <th scope="col" role="columnheader" className="cars-actions-column">Acțiuni</th>
          </tr></thead>
          <tbody role="rowgroup">
            {filtered.map((car) => (
              <tr key={car.id} role="row">
                <th scope="row" role="rowheader" className="cars-plate">{car.plate}</th>
                <td role="cell"><span className="cars-mobile-label" aria-hidden="true">Marcă/model</span>{car.makeModel}</td>
                <td role="cell"><span className="cars-mobile-label" aria-hidden="true">Șofer</span>{car.driverName || <span className="missing">Neatribuit</span>}</td>
                <td role="cell"><span className="cars-mobile-label" aria-hidden="true">Traseu</span>{carRoutes.find((route) => route.id === car.routeId)?.name ?? <span className="missing">Neatribuit</span>}</td>
                <td role="cell" className="cars-status-cell"><span className="cars-mobile-label" aria-hidden="true">Stare</span><span className={`pill pill-${carStatusTones[car.status]}`}>{carStatusLabels[car.status]}</span></td>
                <td role="cell" className="cars-actions-cell"><div className="cars-row-actions">
                  <button type="button" className="text-button" aria-label={`Editează ${car.plate}`} disabled={busy}
                    onClick={(event) => {
                      returnFocus.current = event.currentTarget
                      openEditor(car)
                    }}>Editează</button>
                  <button type="button" className="text-button danger" aria-label={`Șterge ${car.plate}`} disabled={busy}
                    onClick={(event) => {
                      returnFocus.current = event.currentTarget
                      setDeleteFailure('')
                      setDeleteMissing(false)
                      setDeleting(car)
                    }}>Șterge</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.isPending && <p className="empty-state cars-empty" role="status">Se încarcă mașinile…</p>}
        {list.data && filtered.length === 0 && <p className="empty-state cars-empty">
          {cars.length === 0 ? 'Nu există încă mașini în flotă. Adaugă o mașină pentru a începe.' : 'Nicio mașină nu corespunde filtrelor. Încearcă altă căutare sau resetează filtrele.'}
        </p>}
      </div>
      {deleting && <DeleteCarDialog car={deleting} onCancel={closeDelete} onDelete={() => void deleteCar()}
        pending={remove.isPending} error={deleteFailure} missing={deleteMissing} />}
    </section>
  )
}
