import { create } from 'zustand'
import { useSession } from '../../auth/session'
import { campaigns, initialAssignments, vehicles } from './fleet'
import type { Assignment } from './fleet'

interface DemoState {
  assignments: Assignment[]
  assign: (vehicleId: string, campaignId: string) => boolean
  reset: () => void
}

export const useFleetDemo = create<DemoState>((set) => ({
  assignments: [...initialAssignments],
  assign: (vehicleId, campaignId) => {
    if (!vehicles.some(vehicle => vehicle.id === vehicleId)
      || !campaigns.some(campaign => campaign.id === campaignId && campaign.status === 'active')) return false
    set(state => ({ assignments: [...state.assignments.filter(assignment => assignment.vehicleId !== vehicleId), { vehicleId, campaignId }] }))
    return true
  },
  reset: () => set({ assignments: [...initialAssignments] }),
}))

// In-memory only: navigation retains the demo, a session replacement clears it.
const unsubscribe = useSession.subscribe((state, previous) => {
  if (state.revision !== previous.revision) useFleetDemo.getState().reset()
})
if (import.meta.hot) import.meta.hot.dispose(unsubscribe)
