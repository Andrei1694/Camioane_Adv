import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { handleAdminError } from '../../auth/adminAccess'
import { useSession } from '../../auth/session'
import { api, errorMessage } from '../../lib/api'
import { useNotify } from '../../lib/useNotify'
import { campaignsKey } from '../../lib/campaign'
import type { CampaignPageData, StoredCampaign } from '../../lib/campaign'
import { plural } from '../../lib/format'
import CampaignCreator from './components/CampaignCreator'
import { formatDay, formatHours, scheduleMinutes } from './campaign'
import './CampaignPage.css'

const pageSize = 50

export default function CampaignPage() {
  const revision = useSession((state) => state.revision)
  const queryClient = useQueryClient()
  const [editor, setEditor] = useState<{ campaign?: StoredCampaign, instance: number } | null>(null)
  const [offset, setOffset] = useState(0)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<{ id: string, message: string } | null>(null)
  const notify = useNotify()
  const createButton = useRef<HTMLButtonElement>(null)
  const editButtons = useRef(new Map<string, HTMLButtonElement>())
  const requestNumber = useRef(0)
  const list = useQuery({
    queryKey: [...campaignsKey(revision), 'list', offset],
    queryFn: async ({ signal }) => {
      try { return await api.campaigns({ limit: pageSize, offset }, signal) }
      catch (error) { await handleAdminError(error, revision); throw error }
    },
  })
  const campaigns = list.data?.campaigns ?? []

  useEffect(() => () => { requestNumber.current++ }, [])

  useEffect(() => {
    const previous = document.title
    document.title = `${editor ? editor.campaign ? 'Edit campaign' : 'Campaign creator' : 'Campaigns'} · Camioane App`
    return () => { document.title = previous }
  }, [editor])

  async function openEditor(id: string) {
    const request = ++requestNumber.current
    setLoadingId(id)
    setLoadError(null)
    try {
      const campaign = await queryClient.fetchQuery({
        queryKey: [...campaignsKey(revision), 'detail', id],
        queryFn: ({ signal }) => api.campaign(id, signal), staleTime: 0,
      })
      if (request !== requestNumber.current || revision !== useSession.getState().revision) return
      setEditor({ campaign, instance: request })
    } catch (error) {
      await handleAdminError(error, revision)
      if (request === requestNumber.current && revision === useSession.getState().revision) {
        setLoadError({ id, message: errorMessage(error) })
      }
    } finally {
      if (request === requestNumber.current) setLoadingId(null)
    }
  }

  function closeEditor(outcome: string, variant: 'success' | 'info', id = editor?.campaign?.id) {
    requestNumber.current++
    flushSync(() => { setEditor(null); setLoadingId(null); setLoadError(null) })
    notify({ variant, message: outcome })
    const target = id ? editButtons.current.get(id) ?? createButton.current : createButton.current
    target?.focus()
  }

  async function saved(campaign: StoredCampaign) {
    await queryClient.cancelQueries({ queryKey: campaignsKey(revision) })
    if (revision !== useSession.getState().revision) return
    queryClient.setQueryData([...campaignsKey(revision), 'detail', campaign.id], campaign)
    if (editor?.campaign) {
      queryClient.setQueriesData<CampaignPageData>({ queryKey: [...campaignsKey(revision), 'list'] }, (page) => page && ({
        ...page, campaigns: page.campaigns.map((row) => row.id === campaign.id ? campaign : row),
      }))
    } else {
      queryClient.setQueryData<CampaignPageData>([...campaignsKey(revision), 'list', 0], (page) => page && ({
        campaigns: [campaign, ...page.campaigns].slice(0, pageSize), total: page.total + 1,
      }))
      flushSync(() => setOffset(0))
    }
    closeEditor(`${campaign.name} ${editor?.campaign ? 'updated' : 'saved'} as a draft.`, 'success', editor?.campaign?.id)
    void queryClient.invalidateQueries({ queryKey: campaignsKey(revision) })
  }

  const content = editor ? <CampaignCreator key={editor.instance} initialCampaign={editor.campaign}
    onComplete={saved} onCancel={() => closeEditor(editor.campaign ? 'Changes cancelled.' : 'Draft cancelled.', 'info')}
    reloading={loadingId !== null} reloadError={loadError?.message}
    onReload={() => { if (editor.campaign) void openEditor(editor.campaign.id) }} />
    : <section className="campaign-page campaign-list-page" aria-labelledby="campaign-heading">
      <header className="campaign-page-heading">
        <div>
          <h1 id="campaign-heading">Campaigns</h1>
          <p className="page-description">Saved drafts are shared with all administrators. Saving does not launch a campaign.</p>
        </div>
        <button ref={createButton} type="button" className="primary-button" disabled={loadingId !== null} onClick={() => {
          setLoadError(null); setEditor({ instance: ++requestNumber.current })
        }}>Create campaign</button>
      </header>
      {list.isError && <p className="request-error" role="alert">{errorMessage(list.error)} <button type="button" onClick={() => void list.refetch()}>Retry</button></p>}
      {loadError && <p className="request-error" role="alert">{loadError.message} <button type="button" disabled={loadingId !== null} onClick={() => void openEditor(loadError.id)}>Retry opening campaign</button></p>}
      <div className="campaign-table-frame" aria-busy={list.isFetching || loadingId !== null}>
        <table className="campaign-table" role="table" aria-label="Campaigns">
          <caption>{list.data ? plural(list.data.total, 'campaign') : 'Campaigns'} · All times in Europe/Bucharest</caption>
          <thead role="rowgroup"><tr role="row">
            <th scope="col" role="columnheader">Campaign name</th>
            <th scope="col" role="columnheader" className="campaign-period-column">Date range</th>
            <th scope="col" role="columnheader" className="num campaign-days-column">Selected days</th>
            <th scope="col" role="columnheader" className="num campaign-hours-column">Scheduled hours</th>
            <th scope="col" role="columnheader" className="campaign-status-column">Status</th>
            <th scope="col" role="columnheader" className="campaign-action-column">Actions</th>
          </tr></thead>
          <tbody role="rowgroup">
            {campaigns.map((campaign) => {
              const firstDate = campaign.days[0].date
              const lastDate = campaign.days[campaign.days.length - 1].date
              return <tr key={campaign.id} role="row">
                <th scope="row" role="rowheader" className="campaign-name-cell">{campaign.name}</th>
                <td role="cell" className="campaign-period-cell">
                  <time dateTime={firstDate}>{formatDay(firstDate)}</time>
                  {lastDate !== firstDate && <span className="cell-sub"> to <time dateTime={lastDate}>{formatDay(lastDate)}</time></span>}
                </td>
                <td role="cell" className="num campaign-days-cell">{campaign.days.length}<span className="campaign-mobile-label"> selected {campaign.days.length === 1 ? 'day' : 'days'}</span></td>
                <td role="cell" className="num campaign-hours-cell">{formatHours(scheduleMinutes(campaign.days))}<span className="campaign-mobile-label"> scheduled</span></td>
                <td role="cell" className="campaign-status-cell"><span className="pill pill-neutral">Draft</span></td>
                <td role="cell" className="campaign-action-cell">
                  <button type="button" className="text-button" aria-label={`Edit ${campaign.name}`} disabled={loadingId !== null}
                    ref={(element) => { if (element) editButtons.current.set(campaign.id, element); else editButtons.current.delete(campaign.id) }}
                    onClick={() => void openEditor(campaign.id)}>{loadingId === campaign.id ? 'Opening…' : 'Edit'}</button>
                </td>
              </tr>
            })}
            {!campaigns.length && <tr role="row"><td role="cell" colSpan={6} className="campaign-empty-cell">
              {list.isPending ? 'Loading campaigns…' : list.isError ? 'Campaigns could not be loaded.' : 'No campaigns yet. Create a campaign to plan its dates and working hours.'}
            </td></tr>}
          </tbody>
        </table>
      </div>
      {list.data && list.data.total > pageSize && <nav className="pagination" aria-label="Campaign pages">
        <span>{offset + 1}–{Math.min(offset + pageSize, list.data.total)} of {list.data.total}</span>
        <div className="pagination-buttons">
          <button type="button" disabled={offset === 0 || loadingId !== null} onClick={() => setOffset(Math.max(0, offset - pageSize))}>Previous</button>
          <button type="button" disabled={offset + pageSize >= list.data.total || loadingId !== null} onClick={() => setOffset(offset + pageSize)}>Next</button>
        </div>
      </nav>}
    </section>

  return <>{content}<p className="sr-only" role="status" aria-atomic="true">{loadingId ? 'Opening campaign…' : ''}</p></>
}
