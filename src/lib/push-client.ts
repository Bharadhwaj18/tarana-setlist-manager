// Client-safe only — no `web-push` import here, so nothing server-only ends
// up in the browser bundle. Converts the VAPID public key (a URL-safe
// base64 string) into the raw Uint8Array the Push API's
// `applicationServerKey` option requires.
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
