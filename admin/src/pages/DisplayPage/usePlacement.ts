import { useState } from 'react'
import { decodePlacement, defaultPlacement, validPlacement } from './placement'
import type { Placement } from './placement'

const storageKey = 'camioane.display-placement.v1'

function readPlacement() {
  try {
    return { placement: decodePlacement(localStorage.getItem(storageKey)), error: '' }
  } catch {
    return { placement: { ...defaultPlacement }, error: 'Poziționarea salvată nu a putut fi citită. Se folosește 1:1 la 0,0.' }
  }
}

export function usePlacement() {
  const [state, setState] = useState(readPlacement)

  function update(placement: Placement) {
    if (!validPlacement(placement)) return
    let error = ''
    try { localStorage.setItem(storageKey, JSON.stringify(placement)) } catch {
      error = 'Poziționarea nu a putut fi salvată în acest browser. Ajustarea este temporară; încearcă din nou.'
    }
    setState({ placement, error })
  }

  return { ...state, update }
}
