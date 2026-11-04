import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { assignedCampaign, campaignFor, campaigns, driverFor, snapshot, statusLabels, vehicles } from '../fleet'
import type { Assignment } from '../fleet'
import Icon from './Icon'

export type Detail = { kind: 'vehicle', id: string } | { kind: 'campaign', id: string } | { kind: 'assign', vehicleId?: string }

function AssignmentForm({ vehicleId, assignments, onSave }: { vehicleId?: string, assignments: Assignment[], onSave: (vehicleId: string, campaignId: string) => void }) {
  const [selectedVehicle, setSelectedVehicle] = useState(vehicleId ?? '')
  const [selectedCampaign, setSelectedCampaign] = useState(assignedCampaign(vehicleId ?? '', assignments)?.id ?? '')
  const vehicle = vehicles.find(item => item.id === selectedVehicle)
  const campaign = campaignFor(selectedCampaign)
  const unchanged = !!selectedVehicle && assignedCampaign(selectedVehicle, assignments)?.id === selectedCampaign

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (vehicle && campaign?.status === 'active' && !unchanged) onSave(vehicle.id, campaign.id)
  }

  return <form className="assignment-form" onSubmit={submit}>
    <p className="fleet-detail-intro">Choose the creative you want to assign to a vehicle’s LED screen.</p>
    <label htmlFor="assign-vehicle">Vehicle</label>
    <select id="assign-vehicle" value={selectedVehicle} required onChange={event => {
      setSelectedVehicle(event.target.value)
      setSelectedCampaign(assignedCampaign(event.target.value, assignments)?.id ?? '')
    }}>
      <option value="" disabled>Select a vehicle</option>
      {vehicles.map(item => <option key={item.id} value={item.id}>{item.registration} · {driverFor(item).name}</option>)}
    </select>
    <label htmlFor="assign-campaign">Active campaign</label>
    <select id="assign-campaign" value={selectedCampaign} required onChange={event => setSelectedCampaign(event.target.value)}>
      <option value="" disabled>Select a campaign</option>
      {campaigns.filter(item => item.status === 'active').map(item => <option key={item.id} value={item.id}>{item.advertiser} · {item.name}</option>)}
    </select>
    {campaign && <div className="assignment-preview"><img src={campaign.creative} alt={campaign.creativeAlt} width="960" height="480" /><p>{campaign.duration}s creative <span>· {campaign.timeWindow}</span></p></div>}
    {vehicle && <p className="assignment-screen">{vehicle.screen.id} <span>· {statusLabels[vehicle.screen.status]}</span></p>}
    <p className="fleet-demo-note" id="assignment-note">Demo assignment only. No content is sent to a device. Screen health and last confirmed playback stay unchanged.</p>
    <button type="submit" className="primary-button" disabled={!selectedVehicle || !selectedCampaign || unchanged} aria-describedby="assignment-note">{unchanged ? 'Already assigned' : 'Save demo assignment'}<Icon name="arrow" /></button>
  </form>
}

export default function DetailPanel({ detail, assignments, onClose, onSelect, onSave }: {
  detail: Detail, assignments: Assignment[], onClose: () => void, onSelect: (detail: Detail) => void,
  onSave: (vehicleId: string, campaignId: string) => void,
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const vehicle = detail.kind === 'vehicle' ? vehicles.find(item => item.id === detail.id) : undefined
  const campaign = detail.kind === 'campaign' ? campaignFor(detail.id) : undefined
  const driver = vehicle ? driverFor(vehicle) : undefined
  const assigned = vehicle ? assignedCampaign(vehicle.id, assignments) : undefined
  const confirmed = vehicle ? campaignFor(vehicle.screen.observedCampaignId) : undefined
  const campaignVehicles = campaign ? vehicles.filter(item => assignedCampaign(item.id, assignments)?.id === campaign.id) : []
  const title = vehicle?.registration ?? campaign?.advertiser ?? 'Assign campaign'

  useEffect(() => {
    const element = dialog.current
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousLabel = previous?.getAttribute('aria-label')
    element?.showModal()
    return () => {
      element?.close()
      queueMicrotask(() => {
        const replacement = previousLabel ? document.querySelector<HTMLElement>(`button[aria-label="${CSS.escape(previousLabel)}"]`) : null
        const fallback = document.querySelector<HTMLElement>('.fleet-assign-button')
        const destination = previous?.isConnected ? previous : replacement ?? fallback
        destination?.focus()
      })
    }
  }, [])

  useEffect(() => { closeButton.current?.focus(); if (dialog.current) dialog.current.scrollTop = 0 }, [detail])

  return <dialog ref={dialog} className="fleet-detail" aria-labelledby="fleet-detail-title" onClose={onClose}
    onClick={event => {
      if (event.target !== event.currentTarget) return
      const bounds = event.currentTarget.getBoundingClientRect()
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose()
    }}>
    <header className="fleet-detail-header"><div><p>{vehicle ? 'Vehicle details' : campaign ? 'Campaign details' : 'Fleet assignment'}</p><h2 id="fleet-detail-title">{title}</h2></div><button ref={closeButton} type="button" className="fleet-icon-button" aria-label={detail.kind === 'assign' ? 'Cancel assignment' : 'Close details'} onClick={onClose}><Icon name="close" /></button></header>
    <div className="fleet-detail-body">
      {vehicle && driver && <>
        <div className="fleet-detail-driver"><span className={`driver-avatar driver-avatar--${driver.id}`}>{driver.initials}</span><div><h3>{driver.name}</h3><p>{driver.shift}</p></div></div>
        <dl className="fleet-facts"><div><dt>Vehicle</dt><dd>{vehicle.model}</dd></div><div><dt>Last location</dt><dd>{vehicle.area}</dd></div><div><dt>Coordinates</dt><dd>{vehicle.coordinates ? `${vehicle.coordinates[1].toFixed(4)}, ${vehicle.coordinates[0].toFixed(4)}` : '—'}</dd></div></dl>
        <section className="fleet-detail-section"><div className="fleet-detail-section-title"><h3>LED screen</h3><span className={`fleet-status fleet-status--${vehicle.screen.status}`}>{statusLabels[vehicle.screen.status]}</span></div><dl className="fleet-facts"><div><dt>Screen ID</dt><dd>{vehicle.screen.id}</dd></div><div><dt>Resolution</dt><dd>{vehicle.screen.resolution}</dd></div><div><dt>Last contact</dt><dd>{vehicle.screen.lastContact} · {snapshot.date}</dd></div></dl>
          {vehicle.issue && <div className={`detail-issue detail-issue--${vehicle.issue.severity}`}><Icon name="warning" /><div><strong>{vehicle.issue.title}</strong><p>{vehicle.issue.description}</p></div></div>}
        </section>
        <section className="fleet-detail-section"><div className="fleet-detail-section-title"><h3>Last confirmed creative</h3><span>{vehicle.screen.lastContact}</span></div>
          {confirmed ? <><img className="fleet-creative-large" src={confirmed.creative} alt={confirmed.creativeAlt} width="960" height="480" /><p className="creative-caption">{confirmed.advertiser} <span>· {confirmed.duration}s</span></p></> : <p className="fleet-empty">No playback reported for this screen.</p>}
        </section>
        <section className="fleet-detail-section"><div className="fleet-detail-section-title"><h3>Planned campaign</h3><button className="fleet-text-button" type="button" onClick={() => onSelect({ kind: 'assign', vehicleId: vehicle.id })}>Change <Icon name="arrow" /></button></div><p>{assigned?.name ?? 'No campaign assigned'}</p><p className="fleet-secondary">{assigned?.advertiser ?? 'Ready for a new assignment'}</p>
          {assigned?.id !== vehicle.screen.observedCampaignId && <p className="fleet-demo-note">Demo assignment updated. Device acknowledgment has not been received.</p>}
        </section>
      </>}
      {campaign && <>
        <img className="fleet-creative-large" src={campaign.creative} alt={campaign.creativeAlt} width="960" height="480" />
        <h3 className="campaign-detail-name">{campaign.name}</h3>
        <dl className="fleet-facts"><div><dt>Schedule</dt><dd>{campaign.status === 'active' ? 'Active' : 'Scheduled'}</dd></div><div><dt>Dates</dt><dd>{campaign.dates}</dd></div><div><dt>Daily window</dt><dd>{campaign.timeWindow}</dd></div><div><dt>Creative duration</dt><dd>{campaign.duration} seconds</dd></div></dl>
        <section className="fleet-detail-section"><h3>Assigned vehicles <span className="fleet-count">{campaignVehicles.length}</span></h3><div className="campaign-vehicle-list">{campaignVehicles.length ? campaignVehicles.map(item => <button key={item.id} type="button" onClick={() => onSelect({ kind: 'vehicle', id: item.id })}><span><strong>{item.registration}</strong><small>{driverFor(item).name}</small></span><span className={`fleet-status fleet-status--${item.screen.status}`}>{statusLabels[item.screen.status]}</span><Icon name="arrow" /></button>) : <p className="fleet-empty">No vehicles assigned. This campaign starts on 7 November.</p>}</div></section>
      </>}
      {detail.kind === 'assign' && <AssignmentForm key={detail.vehicleId ?? 'new'} vehicleId={detail.vehicleId} assignments={assignments} onSave={onSave} />}
    </div>
    <footer className="fleet-detail-footer">Demo snapshot · {snapshot.date}, {snapshot.time} · Bucharest time</footer>
  </dialog>
}
