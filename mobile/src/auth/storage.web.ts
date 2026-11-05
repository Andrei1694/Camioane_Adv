// Browser sessions survive reloads in this tab and end when the tab is closed.
export async function getItemAsync(key: string) {
  return window.sessionStorage.getItem(key)
}

export async function setItemAsync(key: string, value: string) {
  window.sessionStorage.setItem(key, value)
}

export async function deleteItemAsync(key: string) {
  window.sessionStorage.removeItem(key)
}

export const storageNotice = 'Browser storage is unavailable. You may need to sign in again after reloading.'
