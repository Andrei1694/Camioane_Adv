import { useCallback, useMemo, useState } from 'react'
import { assignedCampaign, campaigns, driverFor, matchesVehicle, snapshot, statusLabels, vehicles } from './fleet'
import { useFleetDemo } from './demoStore'
import DetailPanel from './components/DetailPanel'
import type { Detail } from './components/DetailPanel'
import FleetMap from './components/FleetMap'
import Icon from './components/Icon'
import './DashboardPage.css'

export default function DashboardPage() {
  const assignments = useFleetDemo(state => state.assignments)
  const assign = useFleetDemo(state => state.assign)
  const reset = useFleetDemo(state => state.reset)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [campaignId, setCampaignId] = useState('all')
  const [detail, setDetail] = useState<Detail | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [mobileView, setMobileView] = useState<'fleet' | 'map'>('fleet')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const visible = useMemo(() => vehicles.filter(vehicle => matchesVehicle(vehicle, query, status, campaignId, assignments)), [query, status, campaignId, assignments])
  const hasFilters = !!query.trim() || status !== 'all' || campaignId !== 'all'
  const issues = visible.filter(vehicle => vehicle.issue).sort((a, b) => Number(b.issue?.severity === 'critical') - Number(a.issue?.severity === 'critical'))
  const scopedCampaigns = campaigns.filter(campaign => !hasFilters || visible.some(vehicle => assignedCampaign(vehicle.id, assignments)?.id === campaign.id))
  const activeCampaigns = scopedCampaigns.filter(campaign => campaign.status === 'active')
  const broadcasting = visible.filter(vehicle => vehicle.screen.status === 'broadcasting').length
  const driversOnShift = new Set(visible.filter(vehicle => driverFor(vehicle).onShift).map(vehicle => vehicle.driverId)).size
  const tableRows = expanded ? visible : visible.slice(0, 4)
  const selectVehicle = useCallback((id: string) => setDetail({ kind: 'vehicle', id }), [])

  function clearFilters() { setQuery(''); setStatus('all'); setCampaignId('all') }
  function saveAssignment(vehicleId: string, newCampaignId: string) {
    if (!assign(vehicleId, newCampaignId)) return
    const vehicle = vehicles.find(item => item.id === vehicleId)
    setNotice(`Demo assignment saved for ${vehicle?.registration}. Last confirmed playback is unchanged.`)
    setDetail(null)
  }

  return <div className={`fleet-dashboard fleet-dashboard--${mobileView}`}>
    <header className="fleet-page-heading">
      <div><h1>Fleet overview</h1><p><Icon name="pin" />{snapshot.city}<span className="fleet-heading-divider" />{snapshot.date}<span className="fleet-snapshot">Demo snapshot · {snapshot.time}</span></p></div>
      <button type="button" className="primary-button fleet-assign-button" aria-label="Assign campaign" onClick={() => setDetail({ kind: 'assign' })}><Icon name="plus" /><span>Assign<span className="assign-full-label"> campaign</span></span></button>
    </header>

    <div className="fleet-summary" aria-label="Fleet summary for the current filters">
      <div className="fleet-metric fleet-metric--lead"><p>Broadcasting screens</p><strong>{broadcasting}<span>/ {visible.length}</span></strong><small><span className="status-dot" />Playing advertising</small></div>
      <div className="fleet-metric"><p>Drivers on shift</p><strong>{driversOnShift}</strong><small>{visible.length - driversOnShift} off shift</small></div>
      <div className="fleet-metric"><p>Active campaigns</p><strong>{activeCampaigns.length}</strong><small>{scopedCampaigns.filter(campaign => campaign.status === 'scheduled').length} scheduled next</small></div>
      <div className="fleet-metric"><p>Needs attention</p><strong className={issues.length ? 'fleet-warning-number' : ''}>{issues.length}</strong><button type="button" className="fleet-text-button" disabled={!issues.length} onClick={() => { setStatus('attention'); setMobileView('fleet') }}>Review vehicles<Icon name="arrow" /></button></div>
    </div>

    <div className={`fleet-toolbar${filtersOpen ? ' fleet-toolbar--expanded' : ''}`}>
      <div className="fleet-search"><Icon name="search" /><input aria-label="Search fleet by driver or registration" placeholder="Search driver or registration…" value={query} onChange={event => setQuery(event.target.value)} />{query && <button type="button" className="fleet-icon-button" aria-label="Clear fleet search" onClick={() => setQuery('')}><Icon name="close" /></button>}</div>
      <button type="button" className="fleet-filter-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(value => !value)}>Filters{status !== 'all' || campaignId !== 'all' ? ' •' : ''}</button>
      <label className="fleet-filter"><span className="sr-only">Screen status</span><select value={status} onChange={event => setStatus(event.target.value)}><option value="all">All screen states</option><option value="broadcasting">Broadcasting</option><option value="attention">Needs attention</option><option value="syncing">Sync delayed</option><option value="offline">Offline</option><option value="idle">Standby</option></select></label>
      <label className="fleet-filter"><span className="sr-only">Campaign</span><select value={campaignId} onChange={event => setCampaignId(event.target.value)}><option value="all">All campaigns</option>{campaigns.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.advertiser}</option>)}</select></label>
      {hasFilters && <button type="button" className="fleet-text-button fleet-clear" onClick={clearFilters}>Clear filters</button>}
      <span className="fleet-result-count" role="status">{visible.length} vehicles</span>
    </div>

    <div className="fleet-mobile-switch" role="group" aria-label="Fleet display"><button type="button" aria-pressed={mobileView === 'fleet'} onClick={() => setMobileView('fleet')}><Icon name="car" />Fleet list</button><button type="button" aria-pressed={mobileView === 'map'} onClick={() => setMobileView('map')}><Icon name="pin" />City map</button></div>

    <div className="fleet-workspace">
      <div className="fleet-map-region"><FleetMap vehicles={visible} selectedId={detail?.kind === 'vehicle' ? detail.id : null} onSelect={selectVehicle} /></div>
      <section className="fleet-panel fleet-attention" aria-labelledby="attention-title">
        <div className="fleet-panel-heading"><div><h2 id="attention-title">Needs attention <span className="fleet-count">{issues.length}</span></h2><p>{issues.length ? 'Keep every screen on the road.' : 'No issues in this view.'}</p></div><Icon name="warning" /></div>
        <div className="fleet-issue-list">{issues.length ? issues.map(vehicle => <button type="button" className="fleet-issue" key={vehicle.id} onClick={() => selectVehicle(vehicle.id)}><span className={`issue-dot issue-dot--${vehicle.issue!.severity}`} /><span className="fleet-issue-content"><strong>{vehicle.issue!.title}</strong><span>{vehicle.registration} <span aria-hidden="true">·</span> {driverFor(vehicle).name.split(' ')[0]}</span><small>Since {vehicle.issue!.since} <span aria-hidden="true">·</span> {vehicle.area}</small></span><Icon name="arrow" /></button>) : <div className="fleet-attention-empty"><Icon name="check" /><p>{visible.length ? 'Every screen in this view is clear of reported issues.' : 'No vehicles match these filters.'}</p></div>}</div>
        <p className="fleet-panel-footnote">Screen health reflects the {snapshot.time} snapshot.</p>
      </section>

      <section className="fleet-panel fleet-list-panel" aria-labelledby="fleet-list-title">
        <div className="fleet-panel-heading"><div><h2 id="fleet-list-title">On the road <span className="fleet-count">{visible.length}</span></h2><p>Drivers, screens and their assigned campaigns.</p></div></div>
        <div className="fleet-table-wrap"><table className="fleet-table"><thead><tr><th scope="col">Vehicle / driver</th><th scope="col">Assigned campaign</th><th scope="col">Screen</th><th scope="col" className="fleet-time">Last seen</th><th scope="col"><span className="sr-only">Details</span></th></tr></thead><tbody>
          {tableRows.map(vehicle => {
            const driver = driverFor(vehicle)
            const campaign = assignedCampaign(vehicle.id, assignments)
            return <tr key={vehicle.id}>
              <td><button type="button" className="fleet-identity" onClick={() => selectVehicle(vehicle.id)}><span className={`driver-avatar driver-avatar--${driver.id}`}>{driver.initials}</span><span><strong>{vehicle.registration}</strong><small>{driver.name}</small></span></button></td>
              <td className="fleet-campaign-cell">{campaign ? <button type="button" className="fleet-campaign-link" onClick={() => setDetail({ kind: 'campaign', id: campaign.id })}><span>{campaign.advertiser}</span><small>{campaign.name}</small></button> : <span className="fleet-secondary">Not assigned</span>}</td>
              <td><span className={`fleet-status fleet-status--${vehicle.screen.status}`}>{statusLabels[vehicle.screen.status]}</span></td>
              <td className="fleet-time">{vehicle.screen.lastContact}<small>{vehicle.area}</small></td>
              <td className="fleet-row-action"><button type="button" className="fleet-icon-button" aria-label={`View ${vehicle.registration}`} onClick={() => selectVehicle(vehicle.id)}><Icon name="arrow" /></button></td>
            </tr>
          })}
        </tbody></table></div>
        {!visible.length && <div className="fleet-empty"><p>No vehicles match your search.</p><button type="button" className="fleet-text-button" onClick={clearFilters}>Clear filters</button></div>}
        {!!visible.length && <div className="fleet-list-footer"><span>Showing {tableRows.length} of {visible.length} vehicles</span>{visible.length > 4 && <button type="button" className="fleet-text-button" onClick={() => setExpanded(value => !value)}>{expanded ? 'Show fewer' : `View all ${visible.length} vehicles`}<Icon name="arrow" /></button>}</div>}
      </section>

      <section className="fleet-panel fleet-campaigns" aria-labelledby="campaigns-title">
        <div className="fleet-panel-heading"><div><h2 id="campaigns-title">Out in the city</h2><p>Campaigns {hasFilters ? 'in this view' : 'on screen and up next'}.</p></div><Icon name="screen" /></div>
        <div className="fleet-campaign-list">{scopedCampaigns.map(campaign => {
          const count = visible.filter(vehicle => assignedCampaign(vehicle.id, assignments)?.id === campaign.id).length
          return <button key={campaign.id} type="button" className="fleet-campaign-row" onClick={() => setDetail({ kind: 'campaign', id: campaign.id })}><img src={campaign.creative} alt="" width="80" height="40" /><span><strong>{campaign.advertiser}</strong><small>{campaign.status === 'active' ? `${count} assigned ${count === 1 ? 'vehicle' : 'vehicles'}` : 'Starts 7 Nov'}</small></span><Icon name="arrow" /></button>
        })}</div>
        {!scopedCampaigns.length && <p className="fleet-empty">No assigned campaigns in this view.</p>}
        <p className="fleet-panel-footnote">Assignments are planned; playback is confirmed per screen.</p>
      </section>
    </div>
    <footer className="fleet-footer"><p>Sample fleet & campaign data <span aria-hidden="true">·</span> All times in Bucharest</p><button type="button" className="fleet-text-button" onClick={() => { reset(); clearFilters(); setNotice('Demo reset to the original snapshot.') }}><Icon name="reset" />Reset demo</button></footer>
    <p className="fleet-announcement" role="status">{notice}</p>
    {detail && <DetailPanel detail={detail} assignments={assignments} onClose={() => setDetail(null)} onSelect={setDetail} onSave={saveAssignment} />}
  </div>
}
