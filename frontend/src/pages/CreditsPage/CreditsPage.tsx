import { useId, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAdminAccess } from '../../auth/adminAccess'
import { useSession } from '../../auth/session'
import { useNotify } from '../../lib/useNotify'
import type { CreditPurchase } from '../../lib/credit'
import AdjustBalanceDialog from './components/AdjustBalanceDialog'
import CreditHistory from './components/CreditHistory'
import PendingPurchases from './components/PendingPurchases'
import PurchaseReviewDialog from './components/PurchaseReviewDialog'
import { accountName, creditsKey, listView, pendingPurchases } from './creditsData'
import './CreditsPage.css'

export default function CreditsPage() {
  const revision = useSession((state) => state.revision)
  const access = useAdminAccess()
  const queryClient = useQueryClient()
  const notify = useNotify()
  // The dialog keeps the purchase it opened with, so a refresh that drops it from the list can't close it mid-review.
  const [review, setReview] = useState<CreditPurchase | null>(null)
  const [adjusting, setAdjusting] = useState(false)
  const [account, setAccount] = useState<string | null>(null)
  const reviewButton = useRef<HTMLButtonElement>(null)
  const adjustButton = useRef<HTMLButtonElement>(null)
  const describeId = useId()

  const pendingKey = [...creditsKey(revision), 'pending'] as const
  const pending = useQuery({ queryKey: pendingKey, queryFn: ({ signal }) => pendingPurchases(signal) })
  const oldest = pending.data?.[0]
  const nameOf = (userId: string | null) => accountName(access.users, userId)

  function refreshCredits() {
    void queryClient.invalidateQueries({ queryKey: creditsKey(revision) })
  }

  function settled(outcome: string, purchase: CreditPurchase) {
    notify({ variant: 'success', message: outcome })
    // Drop the row now, so focus can go to what is still there; the refetch confirms it.
    const remaining = queryClient.setQueryData<CreditPurchase[]>(pendingKey, (rows) => rows?.filter((row) => row.id !== purchase.id))
    requestAnimationFrame(() => (remaining?.length ? reviewButton : adjustButton).current?.focus())
  }

  return (
    <section className="credits-page">
      <header>
        <div className="page-heading">
          <h1>Credite</h1>
          <div className="page-actions">
            <button ref={adjustButton} type="button" onClick={() => setAdjusting(true)}>Ajustează soldul</button>
            <button ref={reviewButton} type="button" className="primary-button" disabled={!oldest}
              aria-describedby={!oldest && !pending.data ? describeId : undefined}
              onClick={() => { if (oldest) setReview(oldest) }}>
              {oldest || !pending.data ? 'Verifică cea mai veche plată' : 'Nicio plată în așteptare'}
            </button>
          </div>
        </div>
        <p className="page-description">Achizițiile rămân aici până când le verifici plata în afara aplicației. Confirmarea unei achiziții adaugă creditele în cont.</p>
      </header>

      <PendingPurchases view={listView(pending, (rows) => ({ rows, total: rows.length }))} asOf={pending.dataUpdatedAt}
        describeId={describeId} nameOf={nameOf} onRetry={() => void pending.refetch()}
        onReview={setReview} />

      <CreditHistory users={access.users} account={account} onAccount={setAccount} />

      {review && (
        <PurchaseReviewDialog key={review.id} purchase={review} name={nameOf(review.userId)} asOf={pending.dataUpdatedAt}
          onClose={() => setReview(null)} onSettled={(outcome) => settled(outcome, review)} onChanged={refreshCredits} />
      )}
      {adjusting && (
        <AdjustBalanceDialog users={access.users} initialUserId={account} onClose={() => setAdjusting(false)}
          onAdjusted={(message) => notify({ variant: 'success', message })} onChanged={refreshCredits} />
      )}
    </section>
  )
}
