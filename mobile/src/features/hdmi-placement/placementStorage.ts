import { File, Paths } from 'expo-file-system'
import type { HdmiPlacement } from '../../../modules/hdmi-player'
import { decodePlacement } from './placement'

const settings = new File(Paths.document, 'hdmi-placement.json')

export async function readPlacement() {
  return decodePlacement(settings.exists ? await settings.text() : null)
}

export async function writePlacement(placement: HdmiPlacement) {
  const temporary = new File(Paths.document, 'hdmi-placement.next.json')
  await temporary.write(JSON.stringify(placement))
  await temporary.move(settings, { overwrite: true })
}
