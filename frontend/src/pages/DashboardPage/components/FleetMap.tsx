import { useEffect, useRef, useState } from 'react'
import { LngLatBounds, Map, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { mapStyle } from '../../../lib/mapConfig'
import { driverFor, statusLabels } from '../fleet'
import type { Vehicle } from '../fleet'
import Icon from './Icon'

setWorkerUrl(workerUrl)

function fitVehicles(map: Map, vehicles: Vehicle[]) {
  const located = vehicles.filter(vehicle => vehicle.coordinates)
  if (!located.length) return
  const bounds = new LngLatBounds()
  for (const vehicle of located) if (vehicle.coordinates) bounds.extend(vehicle.coordinates)
  const attributionSpace = map.getContainer().clientWidth < 640 ? 76 : 48
  map.fitBounds(bounds, { padding: { top: 28, bottom: attributionSpace, left: 28, right: 48 }, maxZoom: 13.1,
    duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300 })
}

export default function FleetMap({ vehicles, selectedId, onSelect }: { vehicles: Vehicle[], selectedId: string | null, onSelect: (id: string) => void }) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<Map | null>(null)
  const fitted = useRef(false)
  const currentVehicles = useRef(vehicles)
  const [attempt, setAttempt] = useState(0)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => { currentVehicles.current = vehicles }, [vehicles])

  useEffect(() => {
    if (!container.current) return
    let instance: Map | undefined
    const lifetime = new AbortController()
    let loaded = false
    const timeout = window.setTimeout(() => { if (!lifetime.signal.aborted && !loaded) setPhase('error') }, 20_000)
    const observer = new ResizeObserver(() => {
      instance?.resize()
      if (instance && loaded && !fitted.current && container.current?.clientWidth) {
        fitVehicles(instance, currentVehicles.current)
        fitted.current = currentVehicles.current.some(vehicle => vehicle.coordinates)
      }
    })
    try {
      instance = new Map({ container: container.current, style: mapStyle, center: [26.101, 44.439], zoom: 12.1,
        attributionControl: { compact: true }, renderWorldCopies: false })
      map.current = instance
      instance.addControl(new NavigationControl({ showCompass: false }), 'top-right')
      instance.on('load', () => {
        if (lifetime.signal.aborted) return
        loaded = true
        clearTimeout(timeout)
        setPhase('ready')
      })
      instance.on('error', () => { if (!lifetime.signal.aborted && !loaded) setPhase('error') })
      observer.observe(container.current)
    } catch {
      queueMicrotask(() => { if (!lifetime.signal.aborted) setPhase('error') })
    }
    return () => {
      lifetime.abort()
      clearTimeout(timeout)
      observer.disconnect()
      instance?.remove()
      map.current = null
      fitted.current = false
    }
  }, [attempt])

  useEffect(() => {
    if (!map.current || phase !== 'ready') return
    const instance = map.current
    if (!fitted.current && container.current?.clientWidth && vehicles.some(vehicle => vehicle.coordinates)) {
      fitVehicles(instance, vehicles)
      fitted.current = true
    }
    const markers = vehicles.flatMap(vehicle => {
      if (!vehicle.coordinates) return []
      const button = document.createElement('button')
      button.type = 'button'
      button.className = `fleet-marker fleet-marker--${vehicle.screen.status}`
      button.dataset.vehicleId = vehicle.id
      button.setAttribute('aria-label', `${vehicle.registration}, ${driverFor(vehicle).name}, ${statusLabels[vehicle.screen.status]}. Open vehicle details`)
      button.setAttribute('aria-pressed', 'false')
      const dot = document.createElement('span')
      dot.className = 'fleet-marker-face'
      dot.textContent = vehicle.registration.split(' ')[1]
      button.append(dot)
      button.addEventListener('click', () => {
        // MapLibre consumes pointer focus; restore the trigger before opening its dialog.
        button.focus()
        onSelect(vehicle.id)
      })
      return [new Marker({ element: button }).setLngLat(vehicle.coordinates).addTo(instance)]
    })
    return () => { for (const marker of markers) marker.remove() }
  }, [vehicles, phase, onSelect])

  useEffect(() => {
    for (const button of container.current?.querySelectorAll<HTMLButtonElement>('.fleet-marker') ?? []) {
      const selected = button.dataset.vehicleId === selectedId
      button.classList.toggle('is-selected', selected)
      button.setAttribute('aria-pressed', String(selected))
    }
  }, [vehicles, phase, selectedId])

  const located = vehicles.filter(vehicle => vehicle.coordinates).length
  return <section className="fleet-panel fleet-map-panel" aria-labelledby="fleet-map-title">
    <div className="fleet-panel-heading">
      <div><h2 id="fleet-map-title">Fleet map</h2><p>Bucharest <span aria-hidden="true">·</span> Last known locations</p></div>
      <button type="button" className="fleet-icon-button" aria-label="Fit map to fleet" disabled={phase !== 'ready' || !located} onClick={() => { if (map.current) fitVehicles(map.current, vehicles) }}><Icon name="fit" /></button>
    </div>
    <div className="fleet-map-stage">
      <div ref={container} className="fleet-map" aria-label="Map of advertising vehicles in Bucharest" />
      {phase !== 'ready' && <div className="fleet-map-state" role="status">
        <Icon name={phase === 'error' ? 'pin' : 'car'} />
        <strong>{phase === 'error' ? 'Map unavailable' : 'Loading the city map…'}</strong>
        <p>{phase === 'error' ? 'You can still inspect every vehicle in the fleet list.' : 'Loading streets and last known vehicle locations.'}</p>
        {phase === 'error' && <button type="button" onClick={() => { setPhase('loading'); setAttempt(value => value + 1) }}>Retry map</button>}
      </div>}
      {phase === 'ready' && !vehicles.length && <p className="fleet-map-empty">No vehicles match these filters.</p>}
    </div>
    <div className="fleet-map-caption">
      <span className="fleet-map-legend">{(['broadcasting', 'offline', 'syncing', 'idle'] as const).filter(status => vehicles.some(vehicle => vehicle.screen.status === status)).map(status => <span key={status}><i className={`status-dot status-dot--${status}`} />{statusLabels[status]}</span>)}</span>
      <span>{located} of {vehicles.length} located</span>
    </div>
  </section>
}
