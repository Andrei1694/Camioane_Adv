import { useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSession } from '../../../auth/session'
import { api, errorMessage } from '../../../lib/api'
import { formatCount } from '../../../lib/format'
import type { User } from '../../../lib/user'
import { creditsKey, listView, pageSize, useBalance } from '../creditsData'
import LedgerTable from './LedgerTable'
import PurchaseHistoryTable from './PurchaseHistoryTable'

type Tab = 'ledger' | 'purchases'

const tabs: { id: Tab, label: string }[] = [
  { id: 'ledger', label: 'Tranzacții' },
  { id: 'purchases', label: 'Achiziții' },
]

/** The ledger and every purchase, for all accounts or one. Picking an account also shows its balance. */
export default function CreditHistory({ users, account, onAccount }: {
  users: readonly User[]
  /** The account to filter by, or null for every account. */
  account: string | null
  onAccount: (userId: string | null) => void
}) {
  const revision = useSession((state) => state.revision)
  const [tab, setTab] = useState<Tab>('ledger')
  const [ledgerOffset, setLedgerOffset] = useState(0)
  const [purchaseOffset, setPurchaseOffset] = useState(0)
  const tabButtons = useRef<Record<Tab, HTMLButtonElement | null>>({ ledger: null, purchases: null })
  const id = useId()
  const userId = account ?? undefined
  // Paging keeps the old rows until the next page lands; another account's rows are never shown in the meantime.
  const samePageSet = <T,>(previous: T | undefined, query?: { queryKey: readonly unknown[] }) => query?.queryKey[3] === account ? previous : undefined

  const ledger = useQuery({
    queryKey: [...creditsKey(revision), 'ledger', account, ledgerOffset],
    queryFn: ({ signal }) => api.creditTransactions({ limit: pageSize, offset: ledgerOffset, userId }, signal),
    placeholderData: samePageSet,
    enabled: tab === 'ledger',
  })
  const purchases = useQuery({
    queryKey: [...creditsKey(revision), 'purchases', account, purchaseOffset],
    queryFn: ({ signal }) => api.creditPurchases({ limit: pageSize, offset: purchaseOffset, userId }, signal),
    placeholderData: samePageSet,
    enabled: tab === 'purchases',
  })
  const balance = useBalance(account)

  function pickAccount(value: string) {
    setLedgerOffset(0)
    setPurchaseOffset(0)
    onAccount(value === '' ? null : value)
  }

  function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((item) => item.id === tab)
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    const target = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs[tabs.length - 1]
      : step ? tabs[(index + step + tabs.length) % tabs.length] : null
    if (!target) return
    event.preventDefault()
    setTab(target.id)
    tabButtons.current[target.id]?.focus()
  }

  return (
    <section className="credits-section" aria-labelledby="history-title">
      <div className="section-heading">
        <h2 id="history-title">Istoric</h2>
        <div className="form-field account-filter">
          <label htmlFor={`${id}-account`}>Cont</label>
          <select id={`${id}-account`} value={account ?? ''} onChange={(event) => pickAccount(event.target.value)}>
            <option value="">Toate conturile</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.email}</option>)}
          </select>
        </div>
      </div>

      {account !== null && (
        <div className="account-balance" aria-live="polite">
          {balance.data ? (
            <p>
              <span className="balance-label">Sold </span>
              <span className="balance-figure num">{formatCount(balance.data.balance)}</span><span className="unit"> cr</span>
              {balance.isFetching && <span className="unit"> · Se actualizează…</span>}
            </p>
          ) : balance.isError ? (
            <div className="request-error inline-error" role="alert">
              <p>Soldul nu a putut fi încărcat. {errorMessage(balance.error)}</p>
              <button type="button" className="ghost-button" disabled={balance.isFetching} onClick={() => void balance.refetch()}>
                {balance.isFetching ? 'Se reîncearcă…' : 'Reîncearcă'}
              </button>
            </div>
          ) : <p className="balance-label">Se încarcă soldul…</p>}
        </div>
      )}

      <div className="tabs" role="tablist" aria-label="Istoricul creditelor" onKeyDown={moveFocus}>
        {tabs.map((item) => (
          <button key={item.id} ref={(element) => { tabButtons.current[item.id] = element }} type="button" role="tab"
            id={`${id}-tab-${item.id}`} aria-controls={`${id}-panel-${item.id}`} aria-selected={tab === item.id}
            tabIndex={tab === item.id ? 0 : -1} className="tab" onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`${id}-panel-${tab}`} aria-labelledby={`${id}-tab-${tab}`}>
        {tab === 'ledger'
          ? <LedgerTable view={listView(ledger, (data) => ({ rows: data.transactions, total: data.total }))} offset={ledgerOffset}
              filtered={account !== null} onRetry={() => void ledger.refetch()} onPage={setLedgerOffset} />
          : <PurchaseHistoryTable view={listView(purchases, (data) => ({ rows: data.purchases, total: data.total }))} offset={purchaseOffset}
              filtered={account !== null} onRetry={() => void purchases.refetch()} onPage={setPurchaseOffset} />}
      </div>
    </section>
  )
}
