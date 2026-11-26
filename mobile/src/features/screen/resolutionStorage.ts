import { File, Paths } from 'expo-file-system'

// A phone setting, not an account one: it describes the screen this phone drives.
const settings = new File(Paths.document, 'screen-resolutions.json')

export async function readResolutions() {
  return settings.exists ? settings.text() : null
}

export async function writeResolutions(text: string) {
  const temporary = new File(Paths.document, 'screen-resolutions.next.json')
  await temporary.write(text)
  await temporary.move(settings, { overwrite: true })
}
