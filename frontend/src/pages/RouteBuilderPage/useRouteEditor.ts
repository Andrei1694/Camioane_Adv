import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { handleAdminError } from '../../auth/adminAccess'
import { useSession } from '../../auth/session'
import { api, ApiError, errorMessage } from '../../lib/api'
import { routeInputError, routesKey } from '../../lib/route'
import type { RouteInput, SavedRoute } from '../../lib/route'
import { useNotify } from '../../lib/useNotify'
import { loadDraft, saveDraft } from './route'
import useRouteMap from './useRouteMap'

export const routePageSize = 50

export default function useRouteEditor(userId: string) {
  const revision = useSession((state) => state.revision)
  const queryClient = useQueryClient()
  const notify = useNotify()
  const [draft] = useState(() => loadDraft(userId))
  const builder = useRouteMap(draft.waypoints)
  const [name, setName] = useState(draft.name)
  const [saved, setSaved] = useState(draft.saved)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [offset, setOffset] = useState(0)
  const [pending, setPending] = useState('')
  const [failure, setFailure] = useState('')
  const [conflict, setConflict] = useState(false)
  const [missing, setMissing] = useState(false)
  const inFlight = useRef(false)
  const lifetime = useRef<AbortController | null>(null)
  const input = { name, waypoints: builder.waypoints }
  const validation = routeInputError(input)
  const dirty = saved ? name.trim() !== saved.name || JSON.stringify(builder.waypoints) !== JSON.stringify(saved.waypoints)
    : Boolean(name || builder.waypoints.length)

  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller
    return () => { controller.abort() }
  }, [])

  useEffect(() => saveDraft(userId, { name, waypoints: builder.waypoints, saved }), [userId, name, builder.waypoints, saved])

  const list = useQuery({
    queryKey: [...routesKey(revision), 'list', offset],
    enabled: libraryOpen,
    queryFn: async ({ signal }) => {
      try { return await api.routes({ limit: routePageSize, offset }, signal) }
      catch (error) { await handleAdminError(error, revision); throw error }
    },
  })

  // Deletion by another administrator can empty the last page.
  if (list.data && offset > 0 && offset >= list.data.total) {
    setOffset(Math.max(0, Math.ceil(list.data.total / routePageSize) - 1) * routePageSize)
  }

  const save = useMutation({
    mutationFn: ({ original, input }: { original: SavedRoute | null, input: RouteInput }) => original
      ? api.updateRoute(original.id, { ...input, version: original.version }) : api.createRoute(input),
  })
  const remove = useMutation({ mutationFn: api.deleteRoute })

  function current() {
    return lifetime.current !== null && !lifetime.current.signal.aborted && revision === useSession.getState().revision
  }

  function begin(message: string) {
    if (inFlight.current) return false
    inFlight.current = true
    builder.lockEditing(true)
    setPending(message)
    setFailure('')
    return true
  }

  function finish() {
    inFlight.current = false
    if (current()) {
      builder.lockEditing(false)
      setPending('')
    }
  }

  function confirmReplace() {
    return !dirty || window.confirm('Renunți la modificările nesalvate ale acestui traseu?')
  }

  function refresh() {
    if (current()) void queryClient.invalidateQueries({ queryKey: routesKey(revision) })
  }

  async function saveRoute(asNew = false) {
    if (inFlight.current || (missing && !asNew)) return false
    if (validation) { setFailure(validation); return false }
    if (!begin('Se salvează traseul…')) return false
    const original = asNew ? null : saved
    try {
      const route = await save.mutateAsync({ original, input })
      if (!current()) return false
      await queryClient.cancelQueries({ queryKey: routesKey(revision) })
      if (!current()) return false
      queryClient.setQueryData([...routesKey(revision), 'detail', route.id], route)
      setSaved(route)
      setName(route.name)
      setConflict(false)
      setMissing(false)
      if (!original) setOffset(0)
      refresh()
      notify({ variant: 'success', message: `Traseul „${route.name}” a fost ${original ? 'actualizat' : 'salvat'}.` })
      return true
    } catch (error) {
      await handleAdminError(error, revision)
      if (!current()) return false
      setFailure(errorMessage(error))
      if (error instanceof ApiError && error.status === 409 && original) { setConflict(true); refresh() }
      if (error instanceof ApiError && error.status === 404 && original) {
        setMissing(true)
        setFailure('Acest traseu a fost șters. Modificările tale sunt păstrate; salvează-le ca traseu nou.')
        refresh()
      }
    } finally { finish() }
    return false
  }

  async function openRoute(id: string) {
    if (inFlight.current || !confirmReplace() || !begin('Se deschide traseul…')) return false
    try {
      const route = await queryClient.fetchQuery({
        queryKey: [...routesKey(revision), 'detail', id], staleTime: 0,
        queryFn: ({ signal }) => api.route(id, AbortSignal.any([signal, lifetime.current!.signal])),
      })
      if (!current()) return false
      setName(route.name)
      setSaved(route)
      builder.replaceStops(route.waypoints)
      setConflict(false)
      setMissing(false)
      setLibraryOpen(false)
      return true
    } catch (error) {
      await handleAdminError(error, revision)
      if (current()) {
        setFailure(errorMessage(error))
        if (error instanceof ApiError && error.status === 404) {
          if (saved?.id === id) {
            setMissing(true)
            setFailure('Acest traseu a fost șters. Modificările tale sunt păstrate; salvează-le ca traseu nou.')
          }
          refresh()
        }
      }
      return false
    } finally { finish() }
  }

  function newRoute() {
    if (inFlight.current || !confirmReplace()) return false
    setName('')
    setSaved(null)
    builder.replaceStops([])
    setFailure('')
    setConflict(false)
    setMissing(false)
    return true
  }

  async function deleteRoute(route: SavedRoute) {
    if (inFlight.current || !window.confirm(`Ștergi definitiv „${route.name}” pentru toți administratorii?`) || !begin('Se șterge traseul…')) return
    try {
      let alreadyDeleted = false
      try { await remove.mutateAsync(route.id) }
      catch (error) {
        if (!(error instanceof ApiError) || error.status !== 404) throw error
        alreadyDeleted = true
      }
      if (!current()) return
      await queryClient.cancelQueries({ queryKey: routesKey(revision) })
      if (!current()) return
      queryClient.removeQueries({ queryKey: [...routesKey(revision), 'detail', route.id], exact: true })
      if (saved?.id === route.id) {
        setSaved(null)
        setConflict(false)
        setMissing(false)
      }
      refresh()
      notify({ variant: alreadyDeleted ? 'info' : 'success', message: `Traseul „${route.name}” ${alreadyDeleted ? 'a fost deja șters' : 'a fost șters'}.` })
    } catch (error) {
      await handleAdminError(error, revision)
      if (current()) setFailure(errorMessage(error))
    } finally { finish() }
  }

  return {
    builder, name, setName, saved, dirty, validation, pending, failure, conflict, missing,
    libraryOpen, setLibraryOpen, list, offset, setOffset, saveRoute, openRoute, newRoute, deleteRoute,
  }
}
