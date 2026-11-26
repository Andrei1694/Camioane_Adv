const key = 'camioane.screen-resolutions.v1'

// Storage can be blocked (private windows, cleared site data); callers fall back to defaults.
export async function readResolutions() {
  return window.localStorage.getItem(key)
}

export async function writeResolutions(text: string) {
  window.localStorage.setItem(key, text)
}
