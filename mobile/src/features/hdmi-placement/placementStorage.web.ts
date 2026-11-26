import type { HdmiPlacement } from '../../../modules/hdmi-player'
import { decodePlacement } from './placement'

const key = 'camioane.hdmi-placement.v1'

export async function readPlacement() {
  return decodePlacement(typeof window === 'undefined' ? null : window.localStorage.getItem(key))
}

export async function writePlacement(placement: HdmiPlacement) {
  window.localStorage.setItem(key, JSON.stringify(placement))
}
